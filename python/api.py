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
import uuid
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


class ChunkBody(BaseModel):
    text: str
    source: Optional[str] = "admin"


class ChunkUpdate(BaseModel):
    text: str


class ModerationBody(BaseModel):
    text: str


# =============================================================
# /ASK — Public RAG with moderation
# =============================================================

WARNING_RESPONSE = (
    "I noticed inappropriate language in your message. Please rephrase your "
    "question respectfully so I can help you."
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
    moderation = check_message(request.question)
    if moderation["flagged"]:
        if request.user_id:
            _flag_user(request.user_id, request.question, moderation["matches"], request.chat_id)
        return AnswerResponse(
            answer=WARNING_RESPONSE,
            flagged=True,
            matches=moderation["matches"],
        )

    answer = rag.ask(request.question)
    return AnswerResponse(answer=answer, flagged=False)


@app.post("/moderation/check")
async def moderation_check(body: ModerationBody):
    return check_message(body.text)


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
    _user: dict = None,
):
    _user = verify_admin(_user) if not isinstance(_user, dict) else _user
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

def _extract_text(filename: str, content: bytes) -> str:
    name = (filename or "").lower()
    if name.endswith(".txt"):
        return content.decode("utf-8", errors="ignore")
    if name.endswith(".pdf"):
        from pypdf import PdfReader  # local import so the lib is optional at boot
        reader = PdfReader(io.BytesIO(content))
        return "\n".join((page.extract_text() or "") for page in reader.pages)
    if name.endswith(".docx"):
        import docx  # python-docx
        doc = docx.Document(io.BytesIO(content))
        return "\n".join(p.text for p in doc.paragraphs)
    raise HTTPException(status_code=400, detail="Unsupported file type. Use PDF, DOCX, or TXT.")


def _split_text(text: str, chunk_size: int = None, overlap: int = None) -> List[str]:
    chunk_size = chunk_size or config.CHUNK_SIZE
    overlap = overlap or config.CHUNK_OVERLAP
    text = (text or "").strip()
    if not text:
        return []
    try:
        from langchain_text_splitters import RecursiveCharacterTextSplitter
        splitter = RecursiveCharacterTextSplitter(
            chunk_size=chunk_size,
            chunk_overlap=overlap,
            separators=["\n\n", "\n", ". ", " ", ""],
        )
        return [c.strip() for c in splitter.split_text(text) if c.strip()]
    except ImportError:
        # Fallback: naive splitter
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

    text = _extract_text(file.filename, content)
    if not text.strip():
        raise HTTPException(status_code=400, detail="No text could be extracted")

    chunks = _split_text(text)
    if not chunks:
        raise HTTPException(status_code=400, detail="Document produced no chunks")

    col = _ensure_collection()
    model = _get_embedding_model()
    src = source or file.filename or "upload"

    ids, docs, metas, embeds = [], [], [], []
    for piece in chunks:
        cid = f"doc_{uuid.uuid4().hex[:12]}"
        ids.append(cid)
        docs.append(piece)
        metas.append({"source": src, "chunk_id": cid, "filename": file.filename})
        embeds.append(model.encode(piece).tolist())

    # ChromaDB accepts batch; if collection is large we should chunk this further
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
