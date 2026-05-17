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

import json
import os
import chromadb
from sentence_transformers import SentenceTransformer
from tqdm import tqdm

import config


# =============================================================
# INITIALIZATION - Setting up the database and model
# =============================================================

def get_chroma_client():
    """
    Create a ChromaDB client that saves data to disk.

    ChromaDB has two APIs (old and new). We try the modern one first
    and fall back to the legacy one for compatibility.

    Returns:
        A ChromaDB client connected to the local database folder
    """
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


# =============================================================
# BUILD - Creating the vector database from chunks
# =============================================================

def build_database():
    """
    Build the vector database from scraped chunks.

    This reads chunks.json, generates embeddings for each chunk,
    and stores everything in ChromaDB. This is the most time-consuming
    step because every chunk needs to be converted to a vector.

    Run this after scraping: python run.py build
    """
    print("=" * 60)
    print("BUILDING VECTOR DATABASE")
    print("=" * 60)

    # Step 1: Load the chunks from disk
    print("\nLoading chunks...")
    with open(config.CHUNKS_FILE, "r", encoding="utf-8") as f:
        chunks = json.load(f)
    print(f"  Loaded {len(chunks)} chunks")

    # Step 2: Set up ChromaDB
    print("\nSetting up ChromaDB...")
    client = get_chroma_client()

    # Delete old collection if it exists, then create a fresh one
    try:
        client.delete_collection(name=config.COLLECTION_NAME)
        print(f"  Deleted old collection '{config.COLLECTION_NAME}'")
    except Exception:
        pass  # Collection didn't exist — that's fine

    collection = client.create_collection(name=config.COLLECTION_NAME)
    print(f"  Created new collection: '{config.COLLECTION_NAME}'")

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

            ids.append(chunk_id)
            documents.append(chunk["text"])
            metadatas.append({"source": chunk["source"], "chunk_id": chunk_id})

            # Convert text to a 384-dimensional vector
            embedding = model.encode(chunk["text"]).tolist()
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
    test_embedding = model.encode("What is the admission fee?").tolist()
    results = collection.query(query_embeddings=[test_embedding], n_results=3)

    if results["documents"][0]:
        print(f"  Found {len(results['documents'][0])} results")
        print(f"  Top match: {results['documents'][0][0][:120]}...")
    else:
        print("  WARNING: Test query returned no results!")

    # Step 7: Save metadata for reference
    metadata = {
        "total_chunks": count,
        "embedding_model": config.EMBEDDING_MODEL,
        "embedding_dimension": config.EMBEDDING_DIMENSION,
        "collection_name": config.COLLECTION_NAME,
        "chunk_sources": len(set(chunk["source"] for chunk in chunks)),
    }

    os.makedirs(config.CHROMA_DB_PATH, exist_ok=True)
    with open(config.METADATA_FILE, "w", encoding="utf-8") as f:
        json.dump(metadata, f, indent=2)

    print(f"  Metadata saved to {config.METADATA_FILE}")
    print("=" * 60)


# =============================================================
# SEARCH - Finding relevant chunks for a question
# =============================================================

import re as _re

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


def _meaningful_tokens(text):
    """Pull useful keywords out of a free-form question.

    Returns lowercased tokens of length >= 3 that aren't English/Roman-Urdu
    stopwords. These drive the keyword-fallback pass in `search`.
    """
    text = (text or "").lower()
    # Treat hyphens/slashes as word separators but keep alphanumerics
    text = _re.sub(r"[^a-z0-9\s\-/]+", " ", text)
    raw = [t.strip("-/") for t in text.split() if t.strip("-/")]
    return [t for t in raw if len(t) >= 3 and t not in _STOPWORDS]


_keyword_cache = {"chunks": None, "ids": None, "metas": None, "version": None}


def _load_all_chunks(collection):
    """Cache the full chunk list in RAM for keyword scans.

    ChromaDB doesn't offer keyword search on its own. For ~4k chunks the
    cost of holding the corpus in memory is negligible (~5MB). The cache
    is invalidated when collection.count() changes — covers admin CRUD.
    """
    count = collection.count()
    if _keyword_cache["version"] == count and _keyword_cache["chunks"] is not None:
        return _keyword_cache["chunks"], _keyword_cache["ids"], _keyword_cache["metas"]

    data = collection.get(include=["documents", "metadatas"])
    _keyword_cache["chunks"] = data.get("documents", []) or []
    _keyword_cache["ids"] = data.get("ids", []) or []
    _keyword_cache["metas"] = data.get("metadatas", []) or [{} for _ in _keyword_cache["chunks"]]
    _keyword_cache["version"] = count
    return _keyword_cache["chunks"], _keyword_cache["ids"], _keyword_cache["metas"]


def _keyword_search(question, collection, top_k):
    """Score chunks by how many distinct query tokens they contain.

    Cheap O(N) scan, but it's exactly what catches things semantic search
    misses: course codes ("CS-201"), names, phone numbers, fee figures,
    Roman-Urdu specific words that the English embedding glosses over.

    Ties are broken by chunk length (shorter = more focused = preferred).
    """
    tokens = _meaningful_tokens(question)
    if not tokens:
        return [], [], []

    chunks, ids, metas = _load_all_chunks(collection)
    scored = []
    for idx, text in enumerate(chunks):
        if not text:
            continue
        low = text.lower()
        hits = sum(1 for t in tokens if t in low)
        if hits == 0:
            continue
        scored.append((hits, -len(text), idx))

    if not scored:
        return [], [], []

    scored.sort(reverse=True)
    out_chunks, out_metas, out_scores = [], [], []
    for hits, _neglen, idx in scored[:top_k]:
        out_chunks.append(chunks[idx])
        out_metas.append(metas[idx] if idx < len(metas) else {})
        # Normalise: hits / total_tokens gives 0..1
        out_scores.append(hits / len(tokens))
    return out_chunks, out_metas, out_scores


def search(question, collection, model, top_k=None):
    """Hybrid retrieval: semantic top-K merged with a keyword fallback.

    Why hybrid?
      - Semantic search (vector similarity) is great for paraphrased
        questions ("what's the cost of CS?" finds "BSCS fee structure").
      - But it under-weights *exact tokens* — course codes like "CS-201",
        phone numbers, faculty names, fee figures. Those are caught by
        the keyword pass instead.
      - We dedupe by chunk text so a chunk found by both methods only
        appears once but with a boosted combined score.

    Returns (chunks, sources, scores) in descending relevance.
    """
    if top_k is None:
        top_k = config.TOP_K_RESULTS

    # --- semantic pass --------------------------------------------------
    question_embedding = model.encode(question).tolist()
    results = collection.query(
        query_embeddings=[question_embedding],
        n_results=top_k,
        include=["documents", "metadatas", "distances"],
    )
    sem_chunks = results["documents"][0] if results["documents"] else []
    sem_metas = results["metadatas"][0] if results["metadatas"] else []
    sem_dists = results["distances"][0] if results["distances"] else []
    sem_scores = [(1 - d) for d in sem_dists]

    # --- keyword pass ---------------------------------------------------
    kw_k = getattr(config, "KEYWORD_BOOST_TOP_K", 4)
    kw_chunks, kw_metas, kw_scores = _keyword_search(question, collection, top_k=kw_k)

    # --- merge with dedup -----------------------------------------------
    # Identity key: first 120 chars of chunk text (good enough — chunks
    # don't collide on the prefix in practice).
    merged = {}
    for c, m, s in zip(sem_chunks, sem_metas, sem_scores):
        key = (c or "")[:120]
        merged[key] = {"text": c, "meta": m, "score": s, "kw": 0.0}
    for c, m, s in zip(kw_chunks, kw_metas, kw_scores):
        key = (c or "")[:120]
        if key in merged:
            merged[key]["kw"] = s
        else:
            merged[key] = {"text": c, "meta": m, "score": 0.0, "kw": s}

    # Combined score: semantic + 0.5 * keyword (semantic is primary,
    # keyword is a tie-breaker / safety net)
    ranked = sorted(
        merged.values(),
        key=lambda r: r["score"] + 0.5 * r["kw"],
        reverse=True,
    )[:top_k]

    chunks = [r["text"] for r in ranked]
    sources = [r["meta"] for r in ranked]
    scores = [r["score"] + 0.5 * r["kw"] for r in ranked]
    return chunks, sources, scores
