"""
========================================================
DATABASE.PY - Vector Database Operations (ChromaDB)
========================================================

This file handles everything related to the vector database:
  - Building the database from chunks (embeddings)
  - Searching the database for relevant chunks

WHAT IS A VECTOR DATABASE?
  Normal databases search by exact keywords. A vector database
  converts text into numbers (vectors/embeddings) and searches
  by meaning. So "tuition cost" finds results about "fee structure"
  even though the words are different.

HOW IT WORKS:
  1. Each text chunk is converted to a 384-number vector
     using the embedding model (all-MiniLM-L6-v2)
  2. These vectors are stored in ChromaDB
  3. When you ask a question, it's also converted to a vector
  4. ChromaDB finds the chunks whose vectors are closest
     to your question's vector (= most similar meaning)
"""

import json           # For loading and parsing chunks and saving collection metadata
import os             # For handling database and metadata file paths
import threading      # Guards creation of the shared Chroma client
import chromadb       # The vector database client library for similarity search
from sentence_transformers import SentenceTransformer  # For generating text embeddings locally
from tqdm import tqdm  # For displaying progress bars during database build

import config         # Local application configuration parameters



# =============================================================
# INITIALIZATION - Setting up the database and model
# =============================================================

_client = None         # (path, client): one shared client per process
_client_lock = threading.Lock()


def get_chroma_client():
    """
    Return the ChromaDB client that saves data to disk.

    ChromaDB has two APIs (old and new). We try the modern one first
    and fall back to the legacy one for compatibility.

    The client is created once and shared: two requests opening it at the
    same moment (the admin panel loads several lists at once) made Chroma
    fail with "Could not connect to tenant default_tenant".

    Returns:
        A ChromaDB client connected to the local database folder
    """
    global _client
    with _client_lock:
        if _client is not None and _client[0] == config.CHROMA_DB_PATH:
            return _client[1]
        try:
            # Modern API (ChromaDB >= 0.4.0)
            client = chromadb.PersistentClient(path=config.CHROMA_DB_PATH)
        except AttributeError:
            # Legacy API (older ChromaDB versions)
            client = chromadb.Client(
                settings=chromadb.config.Settings(
                    persist_directory=config.CHROMA_DB_PATH
                )
            )
        _client = (config.CHROMA_DB_PATH, client)
        return client


def get_embedding_model():
    """
    Load the sentence embedding model.

    This model (all-MiniLM-L6-v2) converts text into 384-dimensional
    vectors. It's lightweight (~27MB) and fast, but still accurate
    for semantic similarity tasks.

    Returns:
        A SentenceTransformer model ready to encode text
    """
    model = SentenceTransformer(config.EMBEDDING_MODEL)
    return model


def get_collection(client):
    """
    Get the ChromaDB collection (like a "table" in a normal database).

    Args:
        client: A ChromaDB client

    Returns:
        The university_chunks collection
    """
    return client.get_collection(name=config.COLLECTION_NAME)


# New collections use cosine distance so `1 - distance` is the cosine
# similarity directly. Collections built before this change use Chroma's
# default (squared L2) and are still scored correctly — see `_semantic_score`.
COLLECTION_METADATA = {"hnsw:space": "cosine"}


def get_or_create_collection(client):
    """Return the chunk collection, creating it (cosine space) if missing.

    Chroma's own get_or_create is atomic, unlike the old get-then-create
    (two first writers racing used to make one of them fail). For an existing
    collection the metadata is ignored, so a pre-cosine (L2) collection keeps
    its space and `_semantic_score` still reads it correctly.
    """
    return client.get_or_create_collection(
        name=config.COLLECTION_NAME, metadata=COLLECTION_METADATA
    )


def get_existing_collection():
    """The chunk collection if it already exists, else None — never creates it.

    For read-only endpoints: opening a PersistentClient creates the
    chroma_db folder, so an absent folder is answered as "nothing stored
    yet" without touching Chroma at all.
    """
    if not os.path.isdir(config.CHROMA_DB_PATH):
        return None
    try:
        return get_collection(get_chroma_client())
    except Exception as exc:
        if is_missing_collection_error(exc) or "not exist" in str(exc).lower():
            return None
        raise


def is_missing_collection_error(exc):
    """True if `exc` means the collection handle points at a deleted collection.

    `run.py build` deletes and recreates the collection while the API may be
    holding the old handle; Chroma then raises NotFoundError ("Collection
    [...] does not exist"). Older Chroma versions used other class names, so
    match on the name/message rather than importing a version-specific class.
    """
    name = type(exc).__name__
    msg = str(exc).lower()
    return (
        name in ("NotFoundError", "InvalidCollectionException")
        or "does not exist" in msg
    )


# Chunks added through the admin panel (admin_*), document upload (doc_*),
# admin URL ingestion (web_*, see kb_ingest.py) or an admin's answer to an
# unanswered student question (qa_*) exist only in Chroma, never in
# chunks.json — a rebuild must carry them over.
PRESERVED_ID_PREFIXES = ("admin_", "doc_", "web_", "qa_")
PRESERVED_BACKUP_FILE = os.path.join(config.DATA_DIR, "preserved_admin_chunks.json")


def _read_preserved_chunks(client):
    """Fetch admin_/doc_/web_/qa_ chunks from the current collection (if any)."""
    try:
        old = client.get_collection(name=config.COLLECTION_NAME)
    except Exception:
        return []
    all_ids = old.get(include=[]).get("ids", []) or []
    keep_ids = [i for i in all_ids if i.startswith(PRESERVED_ID_PREFIXES)]
    if not keep_ids:
        return []
    data = old.get(ids=keep_ids, include=["documents", "metadatas"])
    metas = data.get("metadatas") or [{} for _ in data.get("ids", [])]
    return [
        {"id": cid, "document": doc, "metadata": meta or {}}
        for cid, doc, meta in zip(data.get("ids", []), data.get("documents", []), metas)
        if doc
    ]


# =============================================================
# BUILD - Creating the vector database from chunks
# =============================================================

def build_database():
    """
    Build the vector database from scraped chunks.

    This reads chunks.json, generates embeddings for each chunk,
    and stores everything in ChromaDB. This is the most time-consuming
    step because every chunk needs to be converted to a vector.

    Admin-added (admin_*), uploaded-document (doc_*), URL-ingested (web_*)
    and admin-answer (qa_*) chunks are read out of the old collection first and re-added after the rebuild, so a
    re-scrape never wipes content an administrator entered by hand.

    Run this after scraping: python run.py build
    """
    print("=" * 60)
    print("BUILDING VECTOR DATABASE")
    print("=" * 60)

    # Step 1: Load the chunks from disk. A missing chunks.json (nothing
    # scraped yet — the KB may be fed purely through the admin panel) must
    # not crash, and must not wipe the collection either.
    print("\nLoading chunks...")
    if not os.path.exists(config.CHUNKS_FILE):
        print(f"  {config.CHUNKS_FILE} not found — nothing to build. Run "
              "`python run.py scrape` first. The existing collection was left untouched.")
        print("=" * 60)
        return
    with open(config.CHUNKS_FILE, "r", encoding="utf-8") as f:
        chunks = json.load(f)
    print(f"  Loaded {len(chunks)} chunks")

    # Step 2: Set up ChromaDB
    print("\nSetting up ChromaDB...")
    client = get_chroma_client()

    # Save admin/document chunks before the old collection is deleted. They
    # are also written to disk so a crash mid-build doesn't lose them.
    preserved = _read_preserved_chunks(client)
    if preserved:
        os.makedirs(config.DATA_DIR, exist_ok=True)
        with open(PRESERVED_BACKUP_FILE, "w", encoding="utf-8") as f:
            json.dump(preserved, f, indent=2, ensure_ascii=False)
        print(f"  Preserving {len(preserved)} admin/document/web/Q&A chunks "
              f"(backup: {PRESERVED_BACKUP_FILE})")

    # Delete old collection if it exists, then create a fresh one
    try:
        client.delete_collection(name=config.COLLECTION_NAME)
        print(f"  Deleted old collection '{config.COLLECTION_NAME}'")
    except Exception:
        pass  # Collection didn't exist — that's fine

    collection = get_or_create_collection(client)
    print(f"  Created new collection: '{config.COLLECTION_NAME}' (cosine)")

    # Step 3: Load the embedding model
    print("\nLoading embedding model...")
    model = get_embedding_model()
    print(f"  Model loaded: {config.EMBEDDING_MODEL}")

    # Step 4: Process chunks in batches and add to database
    print(f"\nAdding {len(chunks)} chunks to database...")
    total_batches = (len(chunks) + config.BATCH_SIZE - 1) // config.BATCH_SIZE

    for batch_idx in tqdm(range(total_batches), desc="Processing"):
        # Get the current batch of chunks
        start = batch_idx * config.BATCH_SIZE
        end = min(start + config.BATCH_SIZE, len(chunks))
        batch = chunks[start:end]

        # Prepare data for ChromaDB
        ids = []           # Unique ID for each chunk
        documents = []     # The actual text
        metadatas = []     # Extra info (source URL)
        embeddings = []    # The vector representation

        for i, chunk in enumerate(batch):
            chunk_id = f"chunk_{start + i}"

            # Combine page title, heading, and text to make the chunk self-contained for search
            title = chunk.get("page_title", "")
            heading = chunk.get("heading", "")
            text = chunk["text"]

            prefix_parts = []
            if title:
                prefix_parts.append(title)
            if heading and heading != title:
                prefix_parts.append(heading)

            if prefix_parts:
                doc_text = "\n\n".join(prefix_parts) + "\n\n" + text
            else:
                doc_text = text

            ids.append(chunk_id)
            documents.append(doc_text)
            metadatas.append({"source": chunk["source"], "chunk_id": chunk_id})

            # Convert combined text to a 384-dimensional vector
            embedding = model.encode(doc_text).tolist()
            embeddings.append(embedding)

        # Add this batch to ChromaDB
        collection.add(
            ids=ids,
            documents=documents,
            metadatas=metadatas,
            embeddings=embeddings,
        )

    # Step 5: Verify the database
    count = collection.count()
    print(f"\nDatabase built successfully!")
    print(f"  Total documents: {count}")

    # Step 6: Run a test query to make sure it works
    print("\nRunning test query: 'What is the admission fee?'")
    if count == 0:
        results = {"documents": [[]]}
    else:
        test_embedding = model.encode("What is the admission fee?").tolist()
        results = collection.query(query_embeddings=[test_embedding], n_results=min(3, count))

    if results["documents"][0]:
        print(f"  Found {len(results['documents'][0])} results")
        print(f"  Top match: {results['documents'][0][0][:120]}...")
    else:
        print("  WARNING: Test query returned no results!")

    # Step 7: Re-add the preserved admin/document chunks. They are
    # re-embedded with the current model rather than copied, so a change of
    # EMBEDDING_MODEL can't leave them in an incompatible vector space.
    if preserved:
        print(f"\nRestoring {len(preserved)} admin/document/web/Q&A chunks...")
        for start in range(0, len(preserved), config.BATCH_SIZE):
            batch = preserved[start:start + config.BATCH_SIZE]
            collection.add(
                ids=[p["id"] for p in batch],
                documents=[p["document"] for p in batch],
                metadatas=[p["metadata"] or {"source": "admin", "chunk_id": p["id"]} for p in batch],
                embeddings=[model.encode(p["document"]).tolist() for p in batch],
            )
        print(f"  Total documents after restore: {collection.count()}")

    clear_keyword_cache()
    print("=" * 60)


# =============================================================
# SEARCH - Finding relevant chunks for a question
# =============================================================

import re as _re      # For regular expressions used in query tokenization
import math as _math  # For calculation of TF-IDF / BM25 term weights in keyword search
import threading as _threading  # Guards the shared keyword index across request threads


_STOPWORDS = {
    "the", "a", "an", "is", "are", "was", "were", "be", "been", "being",
    "of", "in", "on", "at", "to", "for", "and", "or", "but", "with",
    "from", "by", "as", "that", "this", "these", "those", "it", "its",
    "what", "which", "who", "whom", "whose", "where", "when", "why", "how",
    "do", "does", "did", "have", "has", "had", "can", "could", "should",
    "would", "will", "may", "might", "i", "you", "we", "they", "he", "she",
    "me", "my", "your", "our", "their", "his", "her",
    "tell", "give", "list", "show", "please", "any", "some", "all",
    "about", "into", "than", "then", "there", "here",
    # Roman-Urdu stopwords (very common, low-signal)
    "kya", "kia", "mein", "main", "hai", "hain", "ho", "hoon", "ka", "ki",
    "ke", "se", "ko", "par", "pe", "or", "aur", "yeh", "ye", "wo", "wah",
    "kaisay", "kaise",
}


_ABBREVIATION_MAP = {
    "bscs": ["bs", "cs", "computer", "science"],
    "bsse": ["bs", "se", "software", "engineering"],
    "bsee": ["bs", "ee", "electrical", "engineering"],
    "bsai": ["bs", "ai", "artificial", "intelligence"],
    "mscs": ["ms", "cs", "computer", "science"],
    "msse": ["ms", "se", "software", "engineering"],
    "msds": ["ms", "ds", "data", "science"],
    "phdcs": ["phd", "cs", "computer", "science"],
    "bba": ["business", "administration"],
    "mba": ["business", "administration"]
}


# Query-expansion tokens (added by _query_token_weights, not typed by the
# student) count for this fraction of a typed token's weight. Without the
# down-weighting, "or fee?" (1 real token + 9 program-expansion tokens) was
# ranked almost entirely on whether a chunk mentioned "bs"/"ms"/"phd".
EXPANSION_TOKEN_WEIGHT = 0.5


def _query_token_weights(text):
    """Pull useful keywords out of a free-form question, with weights.

    Returns {token: weight}. Typed tokens (length >= 3, not an English or
    Roman-Urdu stopword) weigh 1.0; tokens that only came from query
    expansion (abbreviations like "bscs" -> "computer science", or the
    program-level terms added for fee/admission/program questions) weigh
    EXPANSION_TOKEN_WEIGHT.
    """
    text = (text or "").lower()
    # Normalize course codes like cs-3413 or cs 3413 to cs3413
    text = _re.sub(r"\b([a-z]+)[\s\-]+(\d+)\b", r"\1\2", text)
    # Treat hyphens/slashes as word separators but keep alphanumerics
    text = _re.sub(r"[^a-z0-9\s\-/]+", " ", text)
    raw = [t.strip("-/") for t in text.split() if t.strip("-/")]
    tokens = [t for t in raw if len(t) >= 3 and t not in _STOPWORDS]

    # Query expansion for programs/degrees/courses to capture structured lists
    expanded = []

    # 1. Expand abbreviations
    for t in tokens:
        if t in _ABBREVIATION_MAP:
            expanded.extend(_ABBREVIATION_MAP[t])

    # 2. Expand general program queries
    has_program_query = any(
        _stem(t) in ("program", "degree", "course", "offer", "admission", "fee")
        for t in tokens
    )
    if has_program_query:
        expanded.extend(["undergraduate", "graduate", "postgraduate", "phd", "bachelor", "master", "doctorate", "bs", "ms"])

    weights = {t: EXPANSION_TOKEN_WEIGHT for t in expanded}
    weights.update({t: 1.0 for t in tokens})  # a typed token is never down-weighted
    return weights


def _meaningful_tokens(text):
    """Keyword tokens for a question (typed + expansion), unweighted."""
    return list(_query_token_weights(text))


def _stem(word):
    """Normalize common academic suffixes and spelling variations (singular/plural, UK/US spelling)."""
    w = word.lower()
    # Normalize common academic terms
    if w in ("programme", "programmes", "programming"):
        return "program"
    if w in ("admissions", "admission"):
        return "admission"
    if w in ("scholarships", "scholarship"):
        return "scholarship"
    if w in ("courses", "course"):
        return "course"
    if w in ("fees", "fee"):
        return "fee"
    if w in ("universities", "university"):
        return "university"

    # Standard suffixes
    for suffix in ("ies", "es", "s", "ed", "ing"):
        if w.endswith(suffix) and len(w) - len(suffix) >= 3:
            res = w[:-len(suffix)]
            if suffix == "ies":
                res += "y"
            return res
    return w


_WORD_RE = _re.compile(r"[a-z0-9\-]+")


def _word_forms(text_low):
    """Split lowercased text into (raw_forms, stem_forms) sets.

    raw_forms holds every word plus its de-hyphenated form ("e-mail" ->
    "email"); stem_forms holds the `_stem` of each. A query token matches a
    chunk when the token is in raw_forms or its stem is in stem_forms — the
    exact rule the old per-query `_has_word` scan applied, but computed once
    per chunk instead of once per (query token x chunk).
    """
    raw, stems = set(), set()
    for w in _WORD_RE.findall(text_low):
        raw.add(w)
        stems.add(_stem(w))
        if "-" in w:
            w_norm = w.replace("-", "")
            raw.add(w_norm)
            stems.add(_stem(w_norm))
    return raw, stems


def _url_forms(source_url):
    """All URL tokens of a source link, raw + stemmed + de-hyphenated."""
    url_tokens = set()
    for w in _WORD_RE.findall((source_url or "").lower()):
        url_tokens.add(w)
        url_tokens.add(_stem(w))
        if "-" in w:
            url_tokens.add(w.replace("-", ""))
            url_tokens.add(_stem(w.replace("-", "")))
    return url_tokens


class _KeywordIndex:
    """Immutable inverted index over the whole chunk corpus.

    Built once per collection version, then shared read-only by every
    request thread. Each map goes form -> tuple of chunk positions, so a
    query token's matching chunks are three dict lookups instead of a
    regex scan of all ~4.8k chunks (which cost 10-60 s of CPU per query).
    """

    __slots__ = ("key", "chunks", "ids", "metas", "raw", "stem", "url")

    def __init__(self, key, chunks, ids, metas):
        self.key = key
        self.chunks = chunks
        self.ids = ids
        self.metas = metas
        raw_idx, stem_idx, url_idx = {}, {}, {}
        for idx, text in enumerate(chunks):
            if not text:
                continue  # empty chunks never matched before either
            raw, stems = _word_forms(text.lower())
            meta = metas[idx] if idx < len(metas) else {}
            for f in raw:
                raw_idx.setdefault(f, []).append(idx)
            for f in stems:
                stem_idx.setdefault(f, []).append(idx)
            for f in _url_forms((meta or {}).get("source", "")):
                url_idx.setdefault(f, []).append(idx)
        self.raw = {k: tuple(v) for k, v in raw_idx.items()}
        self.stem = {k: tuple(v) for k, v in stem_idx.items()}
        self.url = {k: tuple(v) for k, v in url_idx.items()}

    def match(self, token):
        """Return (matched_positions, url_positions) for one query token.

        Same rule as the old `_has_word`: the token's stem in the chunk's URL
        tokens (counts as a URL hit, which earns a boost), else the raw token
        or its stem among the chunk's words.
        """
        token_stem = _stem(token)
        in_url = set(self.url.get(token_stem, ()))
        matched = in_url.union(self.raw.get(token, ()), self.stem.get(token_stem, ()))
        return matched, in_url


_keyword_cache = None                 # the live _KeywordIndex (or None)
_keyword_cache_lock = _threading.Lock()


def clear_keyword_cache():
    """Clear the cached chunks in RAM to force reload on the next search."""
    global _keyword_cache
    with _keyword_cache_lock:
        _keyword_cache = None
    print("  Database keyword search cache cleared")


def _collection_key(collection):
    """Cache identity: collection id + count.

    The count alone misses a rebuild that happens to produce the same number
    of chunks; the collection id changes on every rebuild.
    """
    return (str(getattr(collection, "id", "")), collection.count())


def _load_all_chunks(collection):
    """Return the keyword index for the collection, building it if stale.

    ChromaDB doesn't offer keyword search on its own. For ~5k chunks the
    cost of holding the corpus + index in memory is small. The cache is
    invalidated when the collection id/count changes and explicitly by admin
    CRUD (`clear_keyword_cache`).

    Concurrency: requests run in FastAPI's threadpool. The index is built
    outside any reader's view and published with a single reference swap
    under the lock, so a reader never sees a half-built or None index.
    """
    global _keyword_cache
    key = _collection_key(collection)
    current = _keyword_cache
    if current is not None and current.key == key:
        return current
    with _keyword_cache_lock:
        current = _keyword_cache
        if current is not None and current.key == key:
            return current  # another thread rebuilt it while we waited
        data = collection.get(include=["documents", "metadatas"])
        chunks = data.get("documents", []) or []
        ids = data.get("ids", []) or []
        metas = data.get("metadatas", []) or [{} for _ in chunks]
        metas = [m or {} for m in metas]
        index = _KeywordIndex(key, chunks, ids, metas)
        _keyword_cache = index
        return index


def _keyword_search(question, collection, top_k):
    """Score chunks by TF-IDF based keyword matching over text and URLs.

    Uses stemmed whole-word matching so variations (like "programs" vs "programmes",
    "admissions" vs "admission") match correctly, while protecting against
    substring matches.

    Returns (chunks, metas, scores, ids).
    """
    weights = _query_token_weights(question)
    if not weights:
        return [], [], [], []

    index = _load_all_chunks(collection)
    chunks = index.chunks
    total_docs = len(chunks)

    # One pass: per-token match sets give DF directly, and the same sets are
    # reused for scoring below.
    matches = {t: index.match(t) for t in weights}

    idfs = {}
    total_query_idf = 0.0
    for t, (matched, _in_url) in matches.items():
        # Calculate IDF with standard smoothing
        idf = _math.log((total_docs + 1) / (len(matched) + 1))
        idfs[t] = idf
        total_query_idf += idf * weights[t]

    if total_query_idf <= 0.0:
        return [], [], [], []

    # Score each chunk that matched at least one token
    sums = {}
    for t, (matched, in_url) in matches.items():
        base = idfs[t] * weights[t]
        for idx in matched:
            # Boost match if it's found in the source URL path
            sums[idx] = sums.get(idx, 0.0) + (base * 1.5 if idx in in_url else base)

    # Normalized score between 0 and 1 (can exceed 1 if URL boosts apply).
    # Tie breaker: prefer shorter, more focused chunks.
    scored = [
        (s / total_query_idf, -len(chunks[idx]), idx)
        for idx, s in sums.items()
        if s > 0
    ]
    if not scored:
        return [], [], [], []

    scored.sort(reverse=True)
    out_chunks, out_metas, out_scores, out_ids = [], [], [], []
    for score, _neglen, idx in scored[:top_k]:
        out_chunks.append(chunks[idx])
        out_metas.append(index.metas[idx] if idx < len(index.metas) else {})
        out_scores.append(score)
        out_ids.append(index.ids[idx] if idx < len(index.ids) else None)
    return out_chunks, out_metas, out_scores, out_ids


def _collection_space(collection):
    """Distance function of a collection: "cosine", "l2" (Chroma's default) or "ip"."""
    space = (getattr(collection, "metadata", None) or {}).get("hnsw:space")
    if not space:
        try:
            space = ((collection.configuration or {}).get("hnsw") or {}).get("space")
        except Exception:
            space = None
    return (space or "l2").lower()


def _semantic_score(distance, space):
    """Convert a Chroma distance into cosine similarity in [-1, 1].

    Embeddings are unit-normalized (all-MiniLM-L6-v2 ends in a Normalize
    layer), so:
      - cosine space: d = 1 - cos            -> cos = 1 - d
      - ip space:     d = 1 - dot = 1 - cos  -> cos = 1 - d
      - l2 space:     d = |a-b|^2 = 2 - 2cos -> cos = 1 - d/2
    The old `1 - d` on an L2 collection went negative for any cos < 0.5.
    """
    if space == "l2":
        return 1.0 - distance / 2.0
    return 1.0 - distance


def search(question, collection, model, top_k=None):
    """Hybrid retrieval: semantic top-K merged with a keyword fallback.

    Why hybrid?
      - Semantic search (vector similarity) is great for paraphrased
        questions ("what's the cost of CS?" finds "BSCS fee structure").
      - But it under-weights *exact tokens* — course codes like "CS-201",
        phone numbers, faculty names, fee figures. Those are caught by
        the keyword pass instead.
      - We dedupe by chunk id so a chunk found by both methods only
        appears once but with a boosted combined score.

    Returns (chunks, sources, scores, ids) in descending relevance.
    """
    if top_k is None:
        top_k = config.TOP_K_RESULTS

    # An empty knowledge base is a normal state (fresh install, or every
    # source deleted): report "nothing found" without querying Chroma or
    # paying for an embedding.
    if collection.count() == 0:
        return [], [], [], []

    # --- semantic pass --------------------------------------------------
    question_embedding = model.encode(question).tolist()
    results = collection.query(
        query_embeddings=[question_embedding],
        n_results=top_k,
        include=["documents", "metadatas", "distances"],
    )
    sem_ids = results["ids"][0] if results.get("ids") else []
    sem_chunks = results["documents"][0] if results["documents"] else []
    sem_metas = results["metadatas"][0] if results["metadatas"] else []
    sem_dists = results["distances"][0] if results["distances"] else []
    space = _collection_space(collection)
    sem_scores = [_semantic_score(d, space) for d in sem_dists]

    # --- keyword pass ---------------------------------------------------
    kw_k = getattr(config, "KEYWORD_BOOST_TOP_K", 4)
    kw_chunks, kw_metas, kw_scores, kw_ids = _keyword_search(question, collection, top_k=kw_k)

    # --- merge with dedup -----------------------------------------------
    # Identity key: the Chroma chunk id. (The old 120-char text prefix
    # collided for distinct chunks that share a page title + heading, so one
    # silently replaced the other.) Text is only a fallback if an id is
    # somehow missing.
    merged = {}
    for cid, c, m, s in zip(sem_ids, sem_chunks, sem_metas, sem_scores):
        key = cid or c
        merged[key] = {"id": cid, "text": c, "meta": m or {}, "score": s, "kw": 0.0}
    for cid, c, m, s in zip(kw_ids, kw_chunks, kw_metas, kw_scores):
        key = cid or c
        if key in merged:
            merged[key]["kw"] = max(merged[key]["kw"], s)
        else:
            merged[key] = {"id": cid, "text": c, "meta": m or {}, "score": 0.0, "kw": s}

    # Combined score: semantic + 1.0 * keyword (semantic is primary,
    # keyword is a boost for exact term matching)
    ranked = sorted(
        merged.values(),
        key=lambda r: r["score"] + 1.0 * r["kw"],
        reverse=True,
    )[:top_k]

    chunks = [r["text"] for r in ranked]
    sources = [r["meta"] for r in ranked]
    scores = [r["score"] + 1.0 * r["kw"] for r in ranked]
    ids = [r["id"] for r in ranked]
    return chunks, sources, scores, ids
