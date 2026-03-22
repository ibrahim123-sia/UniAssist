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

def search(question, collection, model, top_k=None):
    """
    Search the vector database for chunks relevant to a question.

    This is the core of the RAG system: it finds the most relevant
    pieces of information from all the scraped data.

    HOW SIMILARITY WORKS:
      ChromaDB returns "distances" (lower = more similar).
      We convert these to "similarity scores" (higher = more similar)
      using the formula: similarity = 1 - distance

    Args:
        question:    The user's question (natural language)
        collection:  The ChromaDB collection to search
        model:       The embedding model (to encode the question)
        top_k:       How many results to return (default from config)

    Returns:
        Tuple of (chunks, sources, similarity_scores)
        - chunks:  List of text strings (the relevant content)
        - sources: List of metadata dicts (with source URLs)
        - scores:  List of floats (0-1, higher = more relevant)
    """
    if top_k is None:
        top_k = config.TOP_K_RESULTS

    # Convert the question to a vector (same model used for chunks)
    question_embedding = model.encode(question).tolist()

    # Query ChromaDB for the most similar chunks
    results = collection.query(
        query_embeddings=[question_embedding],
        n_results=top_k,
        include=["documents", "metadatas", "distances"],
    )

    # Extract results from ChromaDB's response format
    chunks = results["documents"][0] if results["documents"] else []
    sources = results["metadatas"][0] if results["metadatas"] else []
    distances = results["distances"][0] if results["distances"] else []

    # Convert distances to similarity scores (higher = better)
    scores = [(1 - dist) for dist in distances] if distances else []

    return chunks, sources, scores
