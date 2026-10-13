"""
========================================================
API.PY - FastAPI Server for the RAG System
========================================================

Exposes the RAG system + admin vector-DB CRUD over HTTP.

HEALTH:
  GET  /health          — liveness probe for Node (no auth; never touches the LLM)
  GET  /health/details  — LLM providers / KB / model status (internal secret;
                          model-list calls only, no tokens spent; cached 30 s)

INTERNAL ENDPOINTS (require X-Internal-Secret, sent only by the Node server):
  POST /ask               — RAG question/answer (used by Node + chat);
                            `answered: false` marks a question the bot couldn't answer
  POST /transcribe        — local Whisper speech-to-text
  POST /moderation/check  — profanity check
  POST /language/detect   — language classifier
  POST /listings/extract  — scrape a job/scholarship/event page into draft fields
  POST /listings/extract-jobs        — same, as a background job (202 {jobId})
  GET  /listings/extract-jobs/{id}   — that job's stage / result / error
  POST /kb/qa             — add an admin's answer to the KB as one Q&A chunk
  DELETE /kb/qa/{id}      — remove one such qa_ chunk ({deleted: bool})
  POST /questions/cluster — group similar unanswered questions (embeddings only)

ADMIN ENDPOINTS (require valid admin JWT — called by the admin browser directly):
  GET    /chunks                — list chunks (paginated)
                                   (read-only endpoints never create chroma_db:
                                   a missing KB reads as empty)
  GET    /chunks/{chunk_id}     — fetch single chunk
  POST   /chunks                — add a new chunk
  PATCH  /chunks/{chunk_id}     — update chunk text (re-embeds)
  DELETE /chunks/{chunk_id}     — remove chunk
  POST   /documents             — upload PDF/DOCX/TXT, split + embed
  POST   /kb/ingest-url         — scrape a page / whole site into the KB (background job, 202)
  GET    /kb/jobs               — recent ingest jobs (in memory, newest first)
  GET    /kb/jobs/{job_id}      — one ingest job's progress
  GET    /kb/sources            — admin-ingested URLs with chunk counts
  DELETE /kb/sources?url=...    — remove one ingested URL's chunks

URL SAFETY:
  Every admin-supplied URL is fetched through url_safety.py (http/https
  only, public addresses only — re-checked on every redirect and on the
  connected socket — size/time/content-type limits). Unsafe URLs -> 400,
  unreachable pages -> 502.

MODERATION:
  Every /ask call runs profanity detection. Flagged messages are NOT
  answered; instead Python posts a webhook to Node's internal endpoint
  so the user is flagged and admin is notified.

CONCURRENCY:
  Every endpoint is a plain `def`, not `async def`. They all do blocking
  work (LLM HTTP calls, embeddings, Whisper, PDF parsing, `requests`), and a
  blocking call inside `async def` freezes the whole event loop — one slow
  /ask used to stall /health and every other request. Plain `def` endpoints
  run on FastAPI's threadpool instead; the shared lazy state they touch
  (models, collection, keyword index) is lock-protected.
"""

import os             # For accessing environment variables and filesystem paths
import io             # For byte stream management during file uploads
import sys            # For making console output Windows-safe
import re             # For regular expression operations in validation
import hmac           # For constant-time comparison of the internal shared secret
import uuid           # For generating unique identifiers for document records
import tempfile       # For creating temporary files during audio transcription
from typing import Optional, List, Literal  # For type hinting in API request models

import jwt            # For verifying and decoding JWT tokens from the Node server
import requests       # For sending HTTP requests and triggering Node admin webhooks
from fastapi import FastAPI, HTTPException, Header, UploadFile, File, Form, Query, Depends  # FastAPI web framework components
from fastapi.middleware.cors import CORSMiddleware  # CORS support for frontend API requests
from pydantic import BaseModel, Field  # For defining and validating request/response schemas
import uvicorn        # ASGI server to run the FastAPI app
from dotenv import load_dotenv  # For loading variables from .env into environment

# Local project modules
import config         # Application configurations and global settings
import rag            # Retrieval Augmented Generation pipeline
import database       # ChromaDB operations and search queries
import kb_ingest      # Admin URL ingestion jobs + admin Q&A chunks
import listing_extract  # Job/scholarship/event field extraction from a link
import question_cluster  # Grouping of similar unanswered questions
import system_health  # Provider / KB checks for the admin health page
import transcribe as transcribe_module  # Whisper model state (for /health/details); `transcribe` is the endpoint below
import url_safety     # SSRF-safe URL validation/fetching (error types)
from moderation import check_message  # Urdu and English abuse detection filter
from language_detect import detect_language, normalize_for_prompt  # Language classifier
from transcribe import transcribe_audio  # Local Whisper speech-to-text transcription

load_dotenv()

# A Windows console (cp1252) raises UnicodeEncodeError on any print of an
# Urdu URL, emoji or provider error text — inside a request that turned a
# log line into a 500. Unencodable characters are escaped instead.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(errors="backslashreplace")
    except (AttributeError, ValueError, OSError):
        pass  # not a TextIOWrapper (e.g. captured by a test runner)


# =============================================================
# APP SETUP
# =============================================================

app = FastAPI(
    title="UniAssist RAG + Admin API",
    description="RAG endpoint for students; admin CRUD for the vector store.",
)

# CORS — allow Vite dev client (5173) and any extra origin via env
default_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
extra = os.getenv("CORS_ALLOW_ORIGINS", "")
if extra:
    default_origins.extend([o.strip() for o in extra.split(",") if o.strip()])

app.add_middleware(
    CORSMiddleware,
    allow_origins=default_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


JWT_SECRET = os.getenv("JWT_SECRET")
NODE_INTERNAL_URL = os.getenv("NODE_INTERNAL_URL", "http://localhost:3000")
INTERNAL_SECRET = os.getenv("INTERNAL_SECRET")

# Upload caps. Node already limits voice notes to 5 MB; 10 MB here leaves
# headroom without letting a direct caller make Whisper chew on huge files.
MAX_AUDIO_BYTES = 10 * 1024 * 1024
MAX_DOCUMENT_BYTES = 20 * 1024 * 1024

# Prompt-size limits. Node caps prompts at 4000 chars and history at the
# last 6 messages (2000 chars each); these are the outer bounds for anything
# that reaches Python directly. The question gets extra headroom because
# Node's email-draft endpoint wraps a 4000-char prompt with recipient (200),
# subject (200) and instruction boilerplate before sending it as `question`.
MAX_TEXT_CHARS = 4000
MAX_QUESTION_CHARS = 5000
MAX_HISTORY_ITEMS = 20


# =============================================================
# AUTH DEPENDENCIES
# =============================================================

def require_internal_secret(
    x_internal_secret: Optional[str] = Header(default=None),
) -> None:
    """Only the Node server may call /ask, /transcribe and the helper endpoints.

    Without this anyone who can reach port 8000 could burn the LLM quota,
    run Whisper on arbitrary uploads, or trigger flag-user webhooks against
    any user id. Fails closed: if INTERNAL_SECRET isn't configured the
    endpoints refuse to serve (503) rather than run unauthenticated.
    """
    if not INTERNAL_SECRET:
        print("  Rejecting internal request: INTERNAL_SECRET is not configured")
        raise HTTPException(status_code=503, detail="Service not configured")
    if not x_internal_secret or not hmac.compare_digest(
        x_internal_secret.encode("utf-8"), INTERNAL_SECRET.encode("utf-8")
    ):
        raise HTTPException(status_code=401, detail="Invalid internal credentials")


def verify_admin(authorization: Optional[str] = Header(default=None)) -> dict:
    """
    Decode the JWT issued by the Node server and ensure the user is an admin.

    The Node server signs `{ id }` and stores role on the user document.
    Python only knows the secret — it trusts the role claim if one is signed in,
    otherwise it calls back to Node to verify the role.

    For now, we accept JWTs that carry the user id and call Node to confirm
    role. This avoids embedding role into JWTs (which would require Node changes).
    """
    if not JWT_SECRET:
        raise HTTPException(status_code=500, detail="Python JWT_SECRET not configured")
    if not authorization:
        raise HTTPException(status_code=401, detail="Missing Authorization header")

    token = authorization.replace("Bearer ", "").strip()
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=["HS256"])
    except jwt.PyJWTError as exc:
        raise HTTPException(status_code=401, detail=f"Invalid token: {exc}")

    user_id = payload.get("id")
    if not user_id:
        raise HTTPException(status_code=401, detail="Token missing user id")

    # Verify admin role via Node (single round-trip; result is cheap to compute)
    try:
        resp = requests.get(
            f"{NODE_INTERNAL_URL}/api/admin/internal/verify-admin",
            headers={
                "Authorization": token,
                "x-internal-secret": INTERNAL_SECRET or "",
            },
            timeout=5,
        )
    except requests.RequestException as exc:
        raise HTTPException(status_code=502, detail=f"Cannot reach Node for auth: {exc}")

    if resp.status_code != 200:
        # Pass Node's verdict through: 401 means the session is invalid/expired
        # (client should re-login), 403 means logged in but not an admin (or
        # the two servers' INTERNAL_SECRET values don't match). Collapsing both
        # into "Not an admin user" made expired sessions look like a role bug.
        try:
            node_msg = (resp.json() or {}).get("message")
        except ValueError:
            node_msg = None
        if resp.status_code == 401:
            raise HTTPException(status_code=401, detail=node_msg or "Session invalid or expired — please log in again")
        if resp.status_code == 403:
            raise HTTPException(status_code=403, detail=node_msg or "Not an admin user")
        raise HTTPException(status_code=502, detail=f"Admin verification failed (Node returned {resp.status_code})")

    return {"id": user_id, **(resp.json().get("user") or {})}


# =============================================================
# MODELS
# =============================================================

class HistoryMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str = Field(..., max_length=MAX_TEXT_CHARS)


class QuestionRequest(BaseModel):
    question: str = Field(..., max_length=MAX_QUESTION_CHARS)
    user_id: Optional[str] = None
    chat_id: Optional[str] = None
    # Prior turns of the same chat, oldest first. The Node API trims this
    # to the last few messages before sending; Python just forwards it to
    # the LLM as conversational context (does NOT use it for retrieval).
    history: Optional[List[HistoryMessage]] = Field(default=None, max_length=MAX_HISTORY_ITEMS)


class AnswerResponse(BaseModel):
    answer: str
    # False when the bot could not answer (empty retrieval, the no-info
    # fallback, or a moderated message). Node files unflagged unanswered
    # questions for the admin's "Unanswered Questions" tab.
    answered: bool = True
    flagged: bool = False
    matches: Optional[List[str]] = None
    language: Optional[str] = None


class ChunkBody(BaseModel):
    text: str
    source: Optional[str] = "admin"


class ChunkUpdate(BaseModel):
    text: str


class ModerationBody(BaseModel):
    text: str = Field(..., max_length=MAX_TEXT_CHARS)


class LanguageBody(BaseModel):
    text: str = Field(..., max_length=MAX_TEXT_CHARS)


# =============================================================
# HEALTH
# =============================================================

@app.get("/health")
def health():
    """Cheap liveness probe for Node. Deliberately does not load models or
    call the LLM — it only proves the process is up and serving."""
    return {"status": "ok"}


@app.get("/health/details", dependencies=[Depends(require_internal_secret)])
def health_details():
    """Dependency status for the admin "System Health" page (via Node).

    Never loads a model, never spends LLM tokens, never creates chroma_db —
    see system_health.py. Model state is read from the modules' lazy-load
    globals: a model that hasn't been needed yet simply reports loaded=false.
    """
    return system_health.get_details(
        embeddings_loaded=rag._model is not None,
        whisper_loaded=transcribe_module._model is not None,
        collection=rag._collection,
    )


# =============================================================
# /ASK — Internal RAG with moderation
# =============================================================

WARNING_RESPONSE = (
    "I noticed inappropriate language in your message. Please rephrase your "
    "question respectfully so I can help you."
)
WARNING_RESPONSE_URDU = (
    "Aap ke message mein na-munasib alfaaz hain. Baraye meherbani apna sawal "
    "tameez se dobara likhein taa-ke main madad kar sakun."
)

# Mongo ObjectId: 24 hex chars. Guests send no user_id (and a "guest:<uuid>"
# chat_id) — only genuine accounts may ever be flagged.
_OBJECT_ID_RE = re.compile(r"[0-9a-fA-F]{24}")


def _flag_user(user_id: str, message: str, matches: List[str], chat_id: Optional[str]):
    if not INTERNAL_SECRET:
        return
    try:
        requests.post(
            f"{NODE_INTERNAL_URL}/api/admin/internal/flag-user",
            headers={"x-internal-secret": INTERNAL_SECRET, "Content-Type": "application/json"},
            json={
                "userId": user_id,
                "message": message,
                "matches": matches,
                "chatId": chat_id,
            },
            timeout=5,
        )
    except requests.RequestException as exc:
        print(f"flag-user webhook failed: {exc}")


@app.post("/ask", response_model=AnswerResponse, dependencies=[Depends(require_internal_secret)])
def ask_question(request: QuestionRequest):
    detected = detect_language(request.question)
    lang = normalize_for_prompt(detected["language"])

    moderation = check_message(request.question)
    if moderation["flagged"]:
        if request.user_id and _OBJECT_ID_RE.fullmatch(request.user_id):
            _flag_user(request.user_id, request.question, moderation["matches"], request.chat_id)
        warning = WARNING_RESPONSE_URDU if lang == "roman_urdu" else WARNING_RESPONSE
        return AnswerResponse(
            answer=warning,
            answered=False,
            flagged=True,
            matches=moderation["matches"],
            language=detected["language"],
        )

    history_payload = (
        [{"role": h.role, "content": h.content} for h in request.history]
        if request.history else None
    )
    if history_payload:
        print(f"  /ask received {len(history_payload)} prior turns ({lang})")
    else:
        print(f"  /ask no history attached ({lang})")
    try:
        # Guests send no user_id; they get "log in to register a complaint"
        # instead of a pointer to a button they don't have.
        answer, answered = rag.ask_detailed(
            request.question, language=lang, history=history_payload, guest=not request.user_id,
        )
    except rag.LLMUnavailableError as exc:
        # Details stay in the server log. Node turns any non-2xx into its own
        # friendly fallback, so provider error text never reaches a student.
        print(f"  /ask LLM unavailable: {exc}")
        raise HTTPException(status_code=503, detail="LLM unavailable")
    return AnswerResponse(answer=answer, answered=answered, flagged=False, language=detected["language"])


@app.post("/moderation/check", dependencies=[Depends(require_internal_secret)])
def moderation_check(body: ModerationBody):
    return check_message(body.text)


@app.post("/language/detect", dependencies=[Depends(require_internal_secret)])
def language_detect(body: LanguageBody):
    """Language classifier — used by Node when needed."""
    return detect_language(body.text)


# =============================================================
# /TRANSCRIBE — Local speech-to-text (replaces AssemblyAI)
# =============================================================

# Only formats ffmpeg/Whisper handle and Node actually sends. The suffix is
# used for the temp file name, so it must never come straight from the
# client-supplied filename.
_AUDIO_SUFFIXES = {".webm", ".wav", ".mp3", ".ogg", ".m4a"}
_AUDIO_MIME_SUFFIX = {
    "webm": ".webm", "wav": ".wav", "x-wav": ".wav", "wave": ".wav",
    "mpeg": ".mp3", "mp3": ".mp3", "ogg": ".ogg",
    "mp4": ".m4a", "x-m4a": ".m4a", "m4a": ".m4a",
}


def _read_upload(file: UploadFile, max_bytes: int, what: str) -> bytes:
    """Read an upload, refusing anything over `max_bytes` with HTTP 413."""
    content = file.file.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise HTTPException(
            status_code=413,
            detail=f"{what} too large (max {max_bytes // (1024 * 1024)} MB)",
        )
    return content


@app.post("/transcribe", dependencies=[Depends(require_internal_secret)])
def transcribe(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
):
    """Transcribe an uploaded audio file with local Whisper.

    Accepts webm / wav / mp3 / ogg / m4a. The audio is written to a temp
    file because faster-whisper reads from disk (it shells out to ffmpeg
    under the hood for non-WAV formats).
    """
    content = _read_upload(file, MAX_AUDIO_BYTES, "Audio file")
    if not content:
        raise HTTPException(status_code=400, detail="Empty audio file")

    # Preserve the original extension so ffmpeg picks the right demuxer.
    suffix = ""
    if file.filename and "." in file.filename:
        suffix = "." + file.filename.rsplit(".", 1)[-1].lower()
    elif file.content_type and "/" in file.content_type:
        subtype = file.content_type.split("/", 1)[-1].split(";")[0].strip().lower()
        suffix = _AUDIO_MIME_SUFFIX.get(subtype, "")
    if suffix not in _AUDIO_SUFFIXES:
        suffix = ".webm"

    fd, tmp_path = tempfile.mkstemp(suffix=suffix, prefix="uniassist_audio_")
    try:
        with os.fdopen(fd, "wb") as fh:
            fh.write(content)
        result = transcribe_audio(tmp_path, language=language)
    finally:
        try:
            os.remove(tmp_path)
        except OSError:
            pass

    if not result["success"]:
        raise HTTPException(status_code=422, detail=result.get("error") or "Transcription failed")
    return result


# =============================================================
# ADMIN — CHUNK CRUD
# =============================================================

def _ensure_collection():
    """For writes: the collection, created on first use."""
    return database.get_or_create_collection(database.get_chroma_client())


def _existing_collection():
    """For reads (and deletes): the collection, or None if nothing was ever
    stored — never creates python/chroma_db."""
    return database.get_existing_collection()


def _get_embedding_model():
    # Same instance the RAG pipeline uses — loading a second copy of the
    # model here doubled its memory footprint.
    return rag.get_embedding_model()


@app.get("/chunks")
def list_chunks(
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
):
    verify_admin(authorization)
    return _list_chunks_impl(limit, offset, search)


def _list_chunks_impl(limit: int, offset: int, search: Optional[str]):
    col = _existing_collection()
    if col is None:
        return {"success": True, "items": [], "total": 0}
    total = col.count()

    # Chroma's get() returns all docs. For larger collections we'd want a
    # better store; for now we slice in Python.
    all_data = col.get(include=["documents", "metadatas"])
    ids = all_data.get("ids", [])
    docs = all_data.get("documents", [])
    metas = all_data.get("metadatas", []) or [{}] * len(ids)

    items = []
    for cid, text, meta in zip(ids, docs, metas):
        if search and search.lower() not in (text or "").lower():
            continue
        items.append({
            "id": cid,
            "source": (meta or {}).get("source", ""),
            "preview": (text or "")[:200],
            "length": len(text or ""),
        })

    filtered_total = len(items) if search else total
    sliced = items[offset:offset + limit]
    return {"success": True, "items": sliced, "total": filtered_total}


@app.get("/chunks/{chunk_id}")
def get_chunk(chunk_id: str, authorization: Optional[str] = Header(default=None)):
    verify_admin(authorization)
    col = _existing_collection()
    res = col.get(ids=[chunk_id], include=["documents", "metadatas"]) if col is not None else {}
    if not res.get("ids"):
        raise HTTPException(status_code=404, detail="Chunk not found")
    return {
        "success": True,
        "chunk": {
            "id": res["ids"][0],
            "text": res["documents"][0],
            "source": (res["metadatas"][0] or {}).get("source", ""),
        },
    }


@app.post("/chunks")
def add_chunk(body: ChunkBody, authorization: Optional[str] = Header(default=None)):
    verify_admin(authorization)
    if not body.text or not body.text.strip():
        raise HTTPException(status_code=400, detail="text is required")
    col = _ensure_collection()
    model = _get_embedding_model()
    cid = f"admin_{uuid.uuid4().hex[:12]}"
    embedding = model.encode(body.text).tolist()
    col.add(
        ids=[cid],
        documents=[body.text],
        metadatas=[{"source": body.source or "admin", "chunk_id": cid}],
        embeddings=[embedding],
    )
    database.clear_keyword_cache()
    return {"success": True, "chunk": {"id": cid, "text": body.text, "source": body.source}}


@app.patch("/chunks/{chunk_id}")
def update_chunk(chunk_id: str, body: ChunkUpdate, authorization: Optional[str] = Header(default=None)):
    verify_admin(authorization)
    if not body.text or not body.text.strip():
        raise HTTPException(status_code=400, detail="text is required")
    col = _existing_collection()
    existing = col.get(ids=[chunk_id], include=["metadatas"]) if col is not None else {}
    if not existing.get("ids"):
        raise HTTPException(status_code=404, detail="Chunk not found")
    # Merge into the existing metadata — uploaded-document chunks also carry
    # filename/heading, which a plain overwrite used to throw away.
    metadata = dict(existing["metadatas"][0] or {})
    metadata.setdefault("source", "admin")
    metadata["chunk_id"] = chunk_id
    source = metadata["source"]
    model = _get_embedding_model()
    embedding = model.encode(body.text).tolist()
    # ChromaDB supports update() with embeddings + documents
    col.update(
        ids=[chunk_id],
        documents=[body.text],
        embeddings=[embedding],
        metadatas=[metadata],
    )
    database.clear_keyword_cache()
    return {"success": True, "chunk": {"id": chunk_id, "text": body.text, "source": source}}


@app.delete("/chunks/{chunk_id}")
def delete_chunk(chunk_id: str, authorization: Optional[str] = Header(default=None)):
    verify_admin(authorization)
    col = _existing_collection()
    existing = col.get(ids=[chunk_id]) if col is not None else {}
    if not existing.get("ids"):
        raise HTTPException(status_code=404, detail="Chunk not found")
    col.delete(ids=[chunk_id])
    database.clear_keyword_cache()
    return {"success": True, "id": chunk_id}


# =============================================================
# ADMIN — DOCUMENT UPLOAD
# =============================================================

def _extract_structured_elements(filename: str, content: bytes) -> List[dict]:
    """Pull structural elements (heading vs paragraph) from an uploaded file.

    Returns a list of `{"tag": ..., "text": ...}` dicts the way `scraper.extract_structured`
    does for HTML, so the same `chunk_elements` packer can be reused for admin uploads.

    - PDFs: we walk pages, treating each page break as a fresh paragraph
      group. Lines that are short + all-caps are promoted to H2 (best-effort
      heading detection for typical academic/admin PDFs).
    - DOCX: python-docx exposes paragraph styles. We map `Heading 1..4`
      to h1..h4; everything else is a paragraph.
    - TXT: blank lines split paragraphs; an all-caps short line becomes h2.
    """
    name = (filename or "").lower()
    elements: List[dict] = []

    def is_probably_heading(line: str) -> bool:
        s = line.strip()
        if not s or len(s) > 90:
            return False
        if s.endswith((".", "?", "!", ":", ",")):
            return False
        letters = [c for c in s if c.isalpha()]
        if not letters:
            return False
        upper_ratio = sum(1 for c in letters if c.isupper()) / len(letters)
        return upper_ratio > 0.7

    def push_paragraphs(text_block: str):
        for chunk in re.split(r"\n{2,}", text_block):
            chunk = chunk.strip()
            if not chunk:
                continue
            # If the very first line of the block looks like a heading,
            # split it off so it's tagged properly.
            lines = chunk.split("\n", 1)
            first = lines[0].strip()
            rest = lines[1].strip() if len(lines) > 1 else ""
            if is_probably_heading(first):
                elements.append({"tag": "h2", "text": first})
                if rest:
                    elements.append({"tag": "p", "text": " ".join(rest.split())})
            else:
                elements.append({"tag": "p", "text": " ".join(chunk.split())})

    if name.endswith(".txt"):
        text = content.decode("utf-8", errors="ignore")
        push_paragraphs(text)
        return elements

    if name.endswith(".pdf"):
        from pypdf import PdfReader  # For parsing and extracting text from uploaded PDF documents
        # A corrupt/encrypted/mislabelled file makes pypdf raise all kinds of
        # exceptions; that's the uploader's problem (400), not a server error.
        try:
            reader = PdfReader(io.BytesIO(content))
            for page in reader.pages:
                page_text = page.extract_text() or ""
                push_paragraphs(page_text)
        except Exception as exc:
            print(f"  PDF parse failed for {filename!r}: {exc}")
            raise HTTPException(status_code=400, detail="Could not read this PDF (corrupt, encrypted, or not a PDF)")
        return elements

    if name.endswith(".docx"):
        import docx  # For parsing and extracting text and headers from uploaded DOCX documents
        try:
            doc = docx.Document(io.BytesIO(content))
            for p in doc.paragraphs:
                text = (p.text or "").strip()
                if not text:
                    continue
                style = (p.style.name if p.style else "") or ""
                if style.startswith("Heading"):
                    # "Heading 1" .. "Heading 4" -> h1..h4
                    digit = next((c for c in style if c.isdigit()), "2")
                    level = min(int(digit), 4)
                    elements.append({"tag": f"h{level}", "text": text})
                else:
                    elements.append({"tag": "p", "text": text})
        except Exception as exc:
            print(f"  DOCX parse failed for {filename!r}: {exc}")
            raise HTTPException(status_code=400, detail="Could not read this DOCX (corrupt or not a Word document)")
        return elements

    raise HTTPException(status_code=400, detail="Unsupported file type. Use PDF, DOCX, or TXT.")


def _chunk_uploaded_document(filename: str, content: bytes) -> List[dict]:
    """Return [{"text": ..., "heading": ...}, ...] using the same structural
    pipeline the scraper uses. One chunk = one self-contained topic block.
    """
    elements = _extract_structured_elements(filename, content)
    if not elements:
        return []
    from scraper import chunk_elements  # For applying structural paragraph grouping/chunking to document elements, imported lazily to keep API startup fast
    return chunk_elements(elements, page_title=os.path.splitext(os.path.basename(filename or ""))[0])


@app.post("/documents")
def upload_document(
    file: UploadFile = File(...),
    source: Optional[str] = Form(None),
    authorization: Optional[str] = Header(default=None),
):
    verify_admin(authorization)
    content = _read_upload(file, MAX_DOCUMENT_BYTES, "Document")
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")

    structured = _chunk_uploaded_document(file.filename, content)
    if not structured:
        raise HTTPException(status_code=400, detail="Document produced no chunks")

    col = _ensure_collection()
    model = _get_embedding_model()
    src = source or file.filename or "upload"

    ids, docs, metas, embeds = [], [], [], []
    for piece in structured:
        cid = f"doc_{uuid.uuid4().hex[:12]}"
        ids.append(cid)
        docs.append(piece["text"])
        metas.append({
            "source": src,
            "chunk_id": cid,
            "filename": file.filename or "",
            "heading": piece.get("heading", ""),
        })
        embeds.append(model.encode(piece["text"]).tolist())

    col.add(ids=ids, documents=docs, metadatas=metas, embeddings=embeds)
    database.clear_keyword_cache()

    return {
        "success": True,
        "filename": file.filename,
        "source": src,
        "chunks_added": len(ids),
    }


# =============================================================
# LISTINGS — scrape a job / scholarship / event page (internal, Node only)
# =============================================================

class ListingExtractBody(BaseModel):
    url: str
    kind: str


@app.post("/listings/extract", dependencies=[Depends(require_internal_secret)])
def listings_extract(body: ListingExtractBody):
    """Fetch an admin-supplied job/scholarship/event URL and return draft fields.

    Node creates a *draft* Listing from the result; the admin reviews it
    before publishing, so a heuristic-only extraction is acceptable.
    400 = unsafe/invalid URL or non-HTML page, 502 = page unreachable.
    """
    if body.kind not in listing_extract.LISTING_KINDS:
        raise HTTPException(status_code=400, detail=listing_extract.KIND_ERROR)
    try:
        return listing_extract.extract_listing(body.url, body.kind)
    except url_safety.UnsafeURLError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except url_safety.FetchError as exc:
        raise HTTPException(status_code=502, detail=str(exc))


@app.post("/listings/extract-jobs", status_code=202, dependencies=[Depends(require_internal_secret)])
def listings_extract_job(body: ListingExtractBody):
    """Start the same extraction as /listings/extract in the background.

    Validates kind + URL now (400, same messages as the sync endpoint) and
    answers 202 {"jobId"}; poll GET /listings/extract-jobs/{jobId}.
    """
    try:
        job_id = listing_extract.start_extract_job(body.url, body.kind)
    except url_safety.UnsafeURLError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except listing_extract.ExtractJobsBusy as exc:
        raise HTTPException(status_code=429, detail=str(exc))
    return {"jobId": job_id}


@app.get("/listings/extract-jobs/{job_id}", dependencies=[Depends(require_internal_secret)])
def listings_extract_job_status(job_id: str):
    """{jobId, status: running|done|failed, stage, startedAt, updatedAt,
    result: <the /listings/extract body>|null, error: {status, message}|null}.

    stage: queued -> fetching -> reading -> [extracting] -> [fallback] -> done
    (a failed job keeps the stage it failed in). Finished jobs are kept for
    15 minutes; 404 after that or after a restart.
    """
    job = listing_extract.get_extract_job(job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found (it may have expired or been cleared by a restart)")
    return job


# =============================================================
# KNOWLEDGE BASE — admin URL ingestion (admin JWT) + Q&A (internal)
# =============================================================

class KbIngestBody(BaseModel):
    url: str
    mode: str = "page"
    maxPages: Optional[int] = None


class KbQaBody(BaseModel):
    # The contract caps the question at 1000 chars, but a student's question
    # can be up to 2000 (UnansweredQuestion model). Accept it and store the
    # first 1000 rather than 422 the admin's "add to knowledge base".
    question: str = Field(..., max_length=2000)
    answer: str = Field(..., max_length=4000)
    sourceLabel: Optional[str] = Field(default="Admin answer", max_length=200)


KB_QA_MAX_QUESTION_CHARS = 1000


@app.post("/kb/ingest-url", status_code=202)
def kb_ingest_url(body: KbIngestBody, authorization: Optional[str] = Header(default=None)):
    """Start a background job that scrapes a page (mode=page) or a whole
    site (mode=site, sitemap first, else same-host crawl) into the KB.
    Poll GET /kb/jobs/{jobId} for progress."""
    verify_admin(authorization)
    if body.mode not in ("page", "site"):
        raise HTTPException(status_code=400, detail="mode must be 'page' or 'site'")
    try:
        job = kb_ingest.start_ingest(body.url, body.mode, body.maxPages)
    except url_safety.UnsafeURLError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    except kb_ingest.IngestConflict as exc:
        raise HTTPException(status_code=409, detail=str(exc))
    except kb_ingest.IngestBusy as exc:
        raise HTTPException(status_code=429, detail=str(exc))
    return {"jobId": job["jobId"], "status": job["status"]}


@app.get("/kb/jobs")
def kb_list_jobs(authorization: Optional[str] = Header(default=None)):
    verify_admin(authorization)
    return {"success": True, "jobs": kb_ingest.list_jobs()}


@app.get("/kb/jobs/{job_id}")
def kb_get_job(job_id: str, authorization: Optional[str] = Header(default=None)):
    verify_admin(authorization)
    job = kb_ingest.get_job(job_id)
    if not job:
        # Jobs are in memory: a Python restart forgets them.
        raise HTTPException(status_code=404, detail="Job not found (it may have been cleared by a restart)")
    return job


@app.get("/kb/sources")
def kb_list_sources(authorization: Optional[str] = Header(default=None)):
    verify_admin(authorization)
    sources = kb_ingest.list_sources()
    return {"success": True, "sources": sources, "total": len(sources)}


@app.delete("/kb/sources")
def kb_delete_source(
    url: str = Query(..., min_length=1, max_length=2048),
    authorization: Optional[str] = Header(default=None),
):
    verify_admin(authorization)
    deleted = kb_ingest.delete_source(url)
    if not deleted:
        raise HTTPException(status_code=404, detail="No website chunks found for that URL")
    return {"success": True, "url": url, "deleted": deleted}


@app.post("/kb/qa", dependencies=[Depends(require_internal_secret)])
def kb_add_qa(body: KbQaBody):
    """Store an admin's answer to an unanswered question as one KB chunk,
    so the bot can answer the same question itself next time."""
    question = " ".join(body.question.split())[:KB_QA_MAX_QUESTION_CHARS]
    answer = body.answer.strip()
    if not question or not answer:
        raise HTTPException(status_code=400, detail="question and answer are required")
    label = (body.sourceLabel or "").strip() or "Admin answer"
    cid = kb_ingest.add_qa(question, answer, label)
    return {"success": True, "id": cid}


@app.delete("/kb/qa/{chunk_id}", dependencies=[Depends(require_internal_secret)])
def kb_delete_qa(chunk_id: str):
    """Remove one admin-answer chunk (Node replaces it when an answer is
    edited). Only `qa_` ids — every other chunk kind is managed elsewhere.
    `deleted: false` when it was already gone."""
    if not chunk_id.startswith("qa_") or len(chunk_id) > 100:
        raise HTTPException(status_code=400, detail="Only admin Q&A chunks (ids starting with 'qa_') can be deleted here")
    return {"deleted": kb_ingest.delete_qa(chunk_id)}


# =============================================================
# UNANSWERED QUESTIONS — semantic grouping (internal, Node only)
# =============================================================

class ClusterItem(BaseModel):
    id: str
    text: str


class ClusterBody(BaseModel):
    items: List[ClusterItem]
    threshold: Optional[float] = None


@app.post("/questions/cluster", dependencies=[Depends(require_internal_secret)])
def questions_cluster(body: ClusterBody):
    """Group questions that ask the same thing (admin "Grouped" view).

    Uses the RAG pipeline's already-loaded embedding model and nothing else —
    no Chroma, no LLM. Every id comes back in exactly one cluster
    (singletons included); clusters are sorted largest first.
    """
    if len(body.items) > question_cluster.MAX_ITEMS:
        raise HTTPException(status_code=400, detail=f"At most {question_cluster.MAX_ITEMS} items per request")
    if any(len(item.text) > question_cluster.MAX_TEXT_CHARS for item in body.items):
        raise HTTPException(status_code=400, detail=f"Item text longer than {question_cluster.MAX_TEXT_CHARS} characters")
    threshold = question_cluster.DEFAULT_THRESHOLD if body.threshold is None else body.threshold
    if not 0.0 < threshold <= 1.0:
        raise HTTPException(status_code=400, detail="threshold must be in (0, 1]")
    if not body.items:
        return {"clusters": []}
    groups = question_cluster.cluster_texts(
        [item.text for item in body.items], rag.get_embedding_model(), threshold,
    )
    return {
        "clusters": [
            {"ids": [body.items[i].id for i in members], "representativeId": body.items[rep].id}
            for rep, members in groups
        ]
    }


# =============================================================
# SERVER STARTUP
# =============================================================

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
