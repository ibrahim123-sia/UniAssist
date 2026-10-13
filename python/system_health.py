"""
========================================================
SYSTEM_HEALTH.PY - Dependency checks for the admin health page
========================================================

Backs `GET /health/details`. Node's admin "System Health" page shows one
card per dependency only Python can see: each LLM provider, the knowledge
base (ChromaDB), and whether the embedding / Whisper models are loaded.

Rules every check follows:
  - Read-only and free. LLM providers are probed with their *model list*
    endpoints, never a completion, so a health refresh spends no tokens
    (Groq's free tier is 8K tokens/min — a chat "ping" would eat into what
    students get).
  - Never creates anything. If python/chroma_db doesn't exist yet (fresh
    install, KB filled later from the admin panel) the KB is reported as
    empty instead of opening a client, which would create the folder.
  - Never leaks secrets. API keys only travel in request headers (never in
    a URL that could end up in an exception message), Groq keys are labelled
    "groq", "groq#2"..., and errors are short status texts.
  - Bounded: 5 s timeout per provider, all providers checked concurrently,
    and the whole result is cached for 30 s so a page refresh loop can't
    hammer the providers.
"""

import concurrent.futures  # For checking the providers concurrently
import os             # For checking whether the ChromaDB folder exists
import threading      # Guards the 30 s result cache
import time           # For latency measurement and the cache clock

import requests       # For the providers' model-list endpoints

import config         # Provider keys/models, USE_LOCAL_LLM, CHROMA_DB_PATH
import database       # Existing ChromaDB helpers


PROVIDER_TIMEOUT = 5        # seconds per provider check
CACHE_SECONDS = 30

GROQ_MODELS_URL = "https://api.groq.com/openai/v1/models"
# Fetching the configured model itself checks the key AND that the model
# still exists (a decommissioned model is the failure we actually hit).
GEMINI_MODEL_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}"


# =============================================================
# PROVIDER CHECKS
# =============================================================

def _provider(name, model, configured=True, ok=None, latency_ms=None, error=None):
    return {"name": name, "configured": configured, "ok": ok,
            "latencyMs": latency_ms, "error": error, "model": model}


def _http_error(resp):
    """Short, secret-free description of a failed provider response."""
    if resp.status_code in (401, 403):
        return f"HTTP {resp.status_code}: API key rejected"
    if resp.status_code == 429:
        return "HTTP 429: rate limited"
    return f"HTTP {resp.status_code}"


def _request_error(exc):
    if isinstance(exc, requests.Timeout):
        return f"Timed out after {PROVIDER_TIMEOUT}s"
    if isinstance(exc, requests.ConnectionError):
        return "Connection failed"
    return type(exc).__name__


def _check_groq_key(label, api_key):
    started = time.monotonic()
    try:
        resp = requests.get(
            GROQ_MODELS_URL, headers={"Authorization": f"Bearer {api_key}"}, timeout=PROVIDER_TIMEOUT,
        )
    except requests.RequestException as exc:
        return _provider(label, config.GROQ_MODEL, ok=False, error=_request_error(exc))
    latency = int((time.monotonic() - started) * 1000)
    if resp.status_code != 200:
        return _provider(label, config.GROQ_MODEL, ok=False, latency_ms=latency, error=_http_error(resp))
    try:
        available = {m.get("id") for m in (resp.json().get("data") or []) if isinstance(m, dict)}
    except ValueError:
        return _provider(label, config.GROQ_MODEL, ok=False, latency_ms=latency, error="Unreadable model list")
    if config.GROQ_MODEL not in available:
        return _provider(label, config.GROQ_MODEL, ok=False, latency_ms=latency,
                         error=f"Model '{config.GROQ_MODEL}' is not available on this key")
    return _provider(label, config.GROQ_MODEL, ok=True, latency_ms=latency)


def _check_gemini():
    model = config.GEMINI_MODEL
    started = time.monotonic()
    try:
        resp = requests.get(
            GEMINI_MODEL_URL.format(model=model.removeprefix("models/")),
            headers={"x-goog-api-key": config.GEMINI_API_KEY}, timeout=PROVIDER_TIMEOUT,
        )
    except requests.RequestException as exc:
        return _provider("gemini", model, ok=False, error=_request_error(exc))
    latency = int((time.monotonic() - started) * 1000)
    if resp.status_code == 404:
        return _provider("gemini", model, ok=False, latency_ms=latency, error=f"Model '{model}' not found")
    if resp.status_code != 200:
        # Gemini answers a bad key with 400 API_KEY_INVALID, not 401.
        error = "API key rejected" if resp.status_code == 400 and "API_KEY" in resp.text else _http_error(resp)
        return _provider("gemini", model, ok=False, latency_ms=latency, error=error)
    return _provider("gemini", model, ok=True, latency_ms=latency)


def _check_ollama():
    model = config.OLLAMA_MODEL
    started = time.monotonic()
    try:
        resp = requests.get(f"{config.OLLAMA_HOST.rstrip('/')}/api/tags", timeout=PROVIDER_TIMEOUT)
    except requests.RequestException as exc:
        return _provider("ollama", model, ok=False, error=_request_error(exc))
    latency = int((time.monotonic() - started) * 1000)
    if resp.status_code != 200:
        return _provider("ollama", model, ok=False, latency_ms=latency, error=_http_error(resp))
    try:
        names = {m.get("name") for m in (resp.json().get("models") or []) if isinstance(m, dict)}
    except ValueError:
        return _provider("ollama", model, ok=False, latency_ms=latency, error="Unreadable model list")
    # "llama3.2" is stored as "llama3.2:latest".
    wanted = {model, model if ":" in model else f"{model}:latest"}
    if not names & wanted:
        return _provider("ollama", model, ok=False, latency_ms=latency,
                         error=f"Model '{model}' is not pulled (run: ollama pull {model})")
    return _provider("ollama", model, ok=True, latency_ms=latency)


def _provider_jobs():
    """[(name, model, check callable | None)] in display order.

    Cloud providers follow CLOUD_LLM_ORDER (the order /ask tries them), one
    entry per Groq key; Ollama is only listed when it's the selected backend.
    A None callable means "not configured".
    """
    jobs = []
    if config.USE_LOCAL_LLM:
        jobs.append(("ollama", config.OLLAMA_MODEL, _check_ollama))
    for name in dict.fromkeys(config.CLOUD_LLM_ORDER + ["groq", "gemini"]):
        if name == "groq":
            if not config.GROQ_API_KEYS:
                jobs.append(("groq", config.GROQ_MODEL, None))
            for idx, key in enumerate(config.GROQ_API_KEYS):
                label = "groq" if idx == 0 else f"groq#{idx + 1}"
                jobs.append((label, config.GROQ_MODEL, lambda lbl=label, k=key: _check_groq_key(lbl, k)))
        elif name == "gemini":
            jobs.append(("gemini", config.GEMINI_MODEL, _check_gemini if config.GEMINI_API_KEY else None))
    return jobs


def check_providers():
    jobs = _provider_jobs()
    results = [
        _provider(name, model, configured=False) if fn is None else None
        for name, model, fn in jobs
    ]
    runnable = [(i, fn) for i, (_n, _m, fn) in enumerate(jobs) if fn is not None]
    if runnable:
        with concurrent.futures.ThreadPoolExecutor(max_workers=len(runnable)) as pool:
            futures = {i: pool.submit(fn) for i, fn in runnable}
            for i, future in futures.items():
                try:
                    results[i] = future.result()
                except Exception as exc:  # a check must never break the page
                    name, model, _fn = jobs[i]
                    results[i] = _provider(name, model, ok=False, error=type(exc).__name__)
    return results


# =============================================================
# KNOWLEDGE BASE / MODELS
# =============================================================

def check_knowledge_base(collection=None):
    """Chunk count. `collection` is the RAG pipeline's cached handle, if any."""
    if collection is not None:
        try:
            return {"ok": True, "chunks": collection.count(), "error": None}
        except Exception as exc:
            # A `run.py build` may have replaced the collection under the
            # cached handle; look it up afresh below.
            print(f"  /health/details: cached collection unusable ({type(exc).__name__}); re-checking")
    try:
        if not os.path.isdir(config.CHROMA_DB_PATH):
            # Opening a PersistentClient would create the folder; an absent
            # folder simply means nothing has been added yet.
            return {"ok": True, "chunks": 0, "error": None}
        try:
            col = database.get_collection(database.get_chroma_client())
        except Exception as exc:
            if database.is_missing_collection_error(exc) or "not exist" in str(exc).lower():
                return {"ok": True, "chunks": 0, "error": None}
            raise
        return {"ok": True, "chunks": col.count(), "error": None}
    except Exception as exc:
        print(f"  /health/details: knowledge base check failed: {type(exc).__name__}: {exc}")
        return {"ok": False, "chunks": None, "error": f"Knowledge base unavailable ({type(exc).__name__})"}


# =============================================================
# ENTRY POINT (cached)
# =============================================================

_cache = {"at": 0.0, "value": None}
_cache_lock = threading.Lock()


def get_details(embeddings_loaded, whisper_loaded, collection=None):
    """The /health/details payload, recomputed at most every 30 s.

    The lock is held while computing so concurrent refreshes share one set
    of provider calls instead of each firing their own.
    """
    with _cache_lock:
        now = time.monotonic()
        if _cache["value"] is not None and now - _cache["at"] < CACHE_SECONDS:
            cached = dict(_cache["value"])
        else:
            cached = {
                "llm": {
                    "mode": "local" if config.USE_LOCAL_LLM else "cloud",
                    "providers": check_providers(),
                },
                "knowledgeBase": check_knowledge_base(collection),
            }
            _cache["value"], _cache["at"] = cached, time.monotonic()
            cached = dict(cached)
    # Model load state is a free in-memory read — always report it live.
    cached["embeddings"] = {"loaded": bool(embeddings_loaded)}
    cached["whisper"] = {"loaded": bool(whisper_loaded)}
    return cached


def clear_cache():
    with _cache_lock:
        _cache["value"], _cache["at"] = None, 0.0
