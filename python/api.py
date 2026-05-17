"""
========================================================
API.PY - FastAPI Server for the RAG System
========================================================

Exposes the RAG system + admin vector-DB CRUD over HTTP.

PUBLIC ENDPOINT:
  POST /ask          — RAG question/answer (used by Node + chat)

ADMIN ENDPOINTS (require valid admin JWT):
  GET    /chunks                — list chunks (paginated)
  GET    /chunks/{chunk_id}     — fetch single chunk
  POST   /chunks                — add a new chunk
  PATCH  /chunks/{chunk_id}     — update chunk text (re-embeds)
  DELETE /chunks/{chunk_id}     — remove chunk
  POST   /documents             — upload PDF/DOCX/TXT, split + embed

MODERATION:
  Every /ask call runs profanity detection. Flagged messages are NOT
  answered; instead Python posts a webhook to Node's internal endpoint
  so the user is flagged and admin is notified.
"""

import os
import io
import re
import uuid
import tempfile
from typing import Optional, List

import jwt
import requests
from fastapi import FastAPI, HTTPException, Header, UploadFile, File, Form, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import uvicorn
from dotenv import load_dotenv

import config
import rag
import database
from moderation import check_message
from language_detect import detect_language, normalize_for_prompt
from transcribe import transcribe_audio

load_dotenv()


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


# =============================================================
# AUTH DEPENDENCY
# =============================================================

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
        raise HTTPException(status_code=403, detail="Not an admin user")

    return {"id": user_id, **(resp.json().get("user") or {})}


# =============================================================
# MODELS
# =============================================================

class QuestionRequest(BaseModel):
    question: str
    user_id: Optional[str] = None
    chat_id: Optional[str] = None


class AnswerResponse(BaseModel):
    answer: str
    flagged: bool = False
    matches: Optional[List[str]] = None
    language: Optional[str] = None


class ChunkBody(BaseModel):
    text: str
    source: Optional[str] = "admin"


class ChunkUpdate(BaseModel):
    text: str


class ModerationBody(BaseModel):
    text: str


class LanguageBody(BaseModel):
    text: str


# =============================================================
# /ASK — Public RAG with moderation
# =============================================================

WARNING_RESPONSE = (
    "I noticed inappropriate language in your message. Please rephrase your "
    "question respectfully so I can help you."
)
WARNING_RESPONSE_URDU = (
    "Aap ke message mein na-munasib alfaaz hain. Baraye meherbani apna sawal "
    "tameez se dobara likhein taa-ke main madad kar sakun."
)


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


@app.post("/ask", response_model=AnswerResponse)
async def ask_question(request: QuestionRequest):
    detected = detect_language(request.question)
    lang = normalize_for_prompt(detected["language"])

    moderation = check_message(request.question)
    if moderation["flagged"]:
        if request.user_id:
            _flag_user(request.user_id, request.question, moderation["matches"], request.chat_id)
        warning = WARNING_RESPONSE_URDU if lang == "roman_urdu" else WARNING_RESPONSE
        return AnswerResponse(
            answer=warning,
            flagged=True,
            matches=moderation["matches"],
            language=detected["language"],
        )

    answer = rag.ask(request.question, language=lang)
    return AnswerResponse(answer=answer, flagged=False, language=detected["language"])


@app.post("/moderation/check")
async def moderation_check(body: ModerationBody):
    return check_message(body.text)


@app.post("/language/detect")
async def language_detect(body: LanguageBody):
    """Public language classifier — used by Node or the client when needed."""
    return detect_language(body.text)


# =============================================================
# /TRANSCRIBE — Local speech-to-text (replaces AssemblyAI)
# =============================================================

@app.post("/transcribe")
async def transcribe(
    file: UploadFile = File(...),
    language: Optional[str] = Form(None),
):
    """Transcribe an uploaded audio file with local Whisper.

    Accepts webm / wav / mp3 / ogg / m4a. The audio is written to a temp
    file because faster-whisper reads from disk (it shells out to ffmpeg
    under the hood for non-WAV formats).
    """
    content = await file.read()
    if not content:
        raise HTTPException(status_code=400, detail="Empty audio file")

    # Preserve the original extension so ffmpeg picks the right demuxer.
    suffix = ""
    if file.filename and "." in file.filename:
        suffix = "." + file.filename.rsplit(".", 1)[-1].lower()
    elif file.content_type and "/" in file.content_type:
        suffix = "." + file.content_type.split("/", 1)[-1].split(";")[0].lower()
    if not suffix:
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
    client = database.get_chroma_client()
    try:
        col = client.get_collection(name=config.COLLECTION_NAME)
    except Exception:
        col = client.create_collection(name=config.COLLECTION_NAME)
    return col


def _get_embedding_model():
    if not hasattr(_get_embedding_model, "_model"):
        _get_embedding_model._model = database.get_embedding_model()
    return _get_embedding_model._model


@app.get("/chunks")
async def list_chunks(
    limit: int = Query(25, ge=1, le=100),
    offset: int = Query(0, ge=0),
    search: Optional[str] = None,
    authorization: Optional[str] = Header(default=None),
):
    verify_admin(authorization)
    return _list_chunks_impl(limit, offset, search)


def _list_chunks_impl(limit: int, offset: int, search: Optional[str]):
    col = _ensure_collection()
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
async def get_chunk(chunk_id: str, authorization: Optional[str] = Header(default=None)):
    verify_admin(authorization)
    col = _ensure_collection()
    res = col.get(ids=[chunk_id], include=["documents", "metadatas"])
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
async def add_chunk(body: ChunkBody, authorization: Optional[str] = Header(default=None)):
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
    return {"success": True, "chunk": {"id": cid, "text": body.text, "source": body.source}}


@app.patch("/chunks/{chunk_id}")
async def update_chunk(chunk_id: str, body: ChunkUpdate, authorization: Optional[str] = Header(default=None)):
    verify_admin(authorization)
    if not body.text or not body.text.strip():
        raise HTTPException(status_code=400, detail="text is required")
    col = _ensure_collection()
    existing = col.get(ids=[chunk_id], include=["metadatas"])
    if not existing.get("ids"):
        raise HTTPException(status_code=404, detail="Chunk not found")
    source = (existing["metadatas"][0] or {}).get("source", "admin")
    model = _get_embedding_model()
    embedding = model.encode(body.text).tolist()
    # ChromaDB supports update() with embeddings + documents
    col.update(
        ids=[chunk_id],
        documents=[body.text],
        embeddings=[embedding],
        metadatas=[{"source": source, "chunk_id": chunk_id}],
    )
    return {"success": True, "chunk": {"id": chunk_id, "text": body.text, "source": source}}


@app.delete("/chunks/{chunk_id}")
async def delete_chunk(chunk_id: str, authorization: Optional[str] = Header(default=None)):
    verify_admin(authorization)
    col = _ensure_collection()
    existing = col.get(ids=[chunk_id])
    if not existing.get("ids"):
        raise HTTPException(status_code=404, detail="Chunk not found")
    col.delete(ids=[chunk_id])
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
        from pypdf import PdfReader
        reader = PdfReader(io.BytesIO(content))
        for page in reader.pages:
            page_text = page.extract_text() or ""
            push_paragraphs(page_text)
        return elements

    if name.endswith(".docx"):
        import docx
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
        return elements

    raise HTTPException(status_code=400, detail="Unsupported file type. Use PDF, DOCX, or TXT.")


def _chunk_uploaded_document(filename: str, content: bytes) -> List[dict]:
    """Return [{"text": ..., "heading": ...}, ...] using the same structural
    pipeline the scraper uses. One chunk = one self-contained topic block.
    """
    elements = _extract_structured_elements(filename, content)
    if not elements:
        return []
    from scraper import chunk_elements  # local import to avoid boot cost
    return chunk_elements(elements, page_title=os.path.splitext(os.path.basename(filename or ""))[0])


def _split_text(text: str, chunk_size: int = None, overlap: int = None) -> List[str]:
    """Legacy helper kept for any callers expecting flat-text splitting.

    The admin upload endpoint goes through `_chunk_uploaded_document` now.
    """
    chunk_size = chunk_size or config.TARGET_CHUNK_SIZE
    overlap = overlap or config.CHUNK_OVERLAP
    text = (text or "").strip()
    if not text:
        return []
    chunks = []
    start = 0
    while start < len(text):
        end = min(start + chunk_size, len(text))
        chunks.append(text[start:end].strip())
        if end == len(text):
            break
        start = end - overlap
    return [c for c in chunks if c]


@app.post("/documents")
async def upload_document(
    file: UploadFile = File(...),
    source: Optional[str] = Form(None),
    authorization: Optional[str] = Header(default=None),
):
    verify_admin(authorization)
    content = await file.read()
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

    return {
        "success": True,
        "filename": file.filename,
        "source": src,
        "chunks_added": len(ids),
    }


# =============================================================
# SERVER STARTUP
# =============================================================

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
