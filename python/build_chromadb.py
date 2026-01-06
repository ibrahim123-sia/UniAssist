import json
import chromadb
from sentence_transformers import SentenceTransformer
from tqdm import tqdm
import os

print("="*60)
print("STEP 2: BUILDING CHROMADB VECTOR DATABASE")
print("="*60)

# ==================== LOAD YOUR DATA ====================
print("\n📦 Loading your scraped chunks...")
with open("data/chunks.json", "r", encoding="utf-8") as f:
    chunks = json.load(f)

print(f"✅ Loaded {len(chunks)} chunks")

# ==================== INITIALIZE CHROMADB ====================
print("\n🔧 Setting up ChromaDB...")

# Initialize ChromaDB client (persistent storage)
# Try the modern way first, then fall back to old API
try:
    # For newer versions of ChromaDB
    import chromadb
    chroma_client = chromadb.PersistentClient(path="./chroma_db")
    print("✅ Using PersistentClient (new API)")
except AttributeError:
    # Fall back to the older API
    import chromadb
    chroma_client = chromadb.Client(settings=chromadb.config.Settings(
        persist_directory="./chroma_db"
    ))
    print("✅ Using Client with Settings (legacy API)")

# Create or get collection
collection_name = "university_chunks"
try:
    # Try to get existing collection
    collection = chroma_client.get_collection(name=collection_name)
    print(f"⚠️ Collection '{collection_name}' already exists")
    
    # Ask user what to do
    response = input("Delete and recreate? (y/n): ").lower()
    if response == 'y':
        chroma_client.delete_collection(name=collection_name)
        collection = chroma_client.create_collection(name=collection_name)
        print("✅ Deleted old collection, created new one")
    else:
        print("✅ Using existing collection")
        print(f"   Collection has {collection.count()} documents")
        exit(0)  # Exit if using existing
        
except Exception as e:
    # Collection doesn't exist, create new
    collection = chroma_client.create_collection(name=collection_name)
    print(f"✅ Created new collection: '{collection_name}'")

# ==================== LOAD EMBEDDING MODEL ====================
print("\n🤖 Loading embedding model...")
model = SentenceTransformer('all-MiniLM-L6-v2')
print("✅ Model loaded: all-MiniLM-L6-v2")

# ==================== ADD CHUNKS TO CHROMADB ====================
print(f"\n📤 Adding {len(chunks)} chunks to ChromaDB...")
print("This will take 2-3 minutes...")

# Batch processing (ChromaDB handles 100 at a time is good)
batch_size = 100
total_batches = (len(chunks) + batch_size - 1) // batch_size

for batch_idx in tqdm(range(total_batches), desc="Processing batches"):
    start_idx = batch_idx * batch_size
    end_idx = min((batch_idx + 1) * batch_size, len(chunks))
    batch_chunks = chunks[start_idx:end_idx]
    
    # Prepare batch data
    ids = []
    documents = []
    metadatas = []
    embeddings = []
    
    for i, chunk in enumerate(batch_chunks):
        chunk_id = f"chunk_{start_idx + i}"
        
        ids.append(chunk_id)
        documents.append(chunk["text"])
        metadatas.append({"source": chunk["source"], "chunk_id": chunk_id})
        
        # Create embedding for this chunk
        embedding = model.encode(chunk["text"]).tolist()
        embeddings.append(embedding)
    
    # Add batch to ChromaDB
    collection.add(
        ids=ids,
        documents=documents,
        metadatas=metadatas,
        embeddings=embeddings
    )

# ==================== VERIFY DATA ====================
print("\n✅ Data added to ChromaDB!")
print(f"\n🔍 Verifying collection...")
count = collection.count()
print(f"   Total documents in collection: {count}")

# Test query to verify it works
print("\n🧪 Testing with a sample query...")
test_question = "What is the admission fee?"
test_embedding = model.encode(test_question).tolist()

results = collection.query(
    query_embeddings=[test_embedding],
    n_results=3
)

print(f"✅ Query successful!")
print(f"   Found {len(results['documents'][0])} similar chunks")
if results['documents'][0]:
    print(f"   Top match: {results['documents'][0][0][:150]}...")

# ==================== SAVE METADATA ====================
print("\n💾 Saving metadata...")
metadata = {
    "total_chunks": count,
    "embedding_model": "all-MiniLM-L6-v2",
    "embedding_dimension": 384,
    "collection_name": collection_name,
    "chunk_sources": len(set(chunk["source"] for chunk in chunks))
}

with open("chroma_db/metadata.json", "w", encoding="utf-8") as f:
    json.dump(metadata, f, indent=2)

print("✅ Metadata saved: chroma_db/metadata.json")

# ==================== DIRECTORY STRUCTURE ====================
print("\n📁 ChromaDB files created:")
chroma_files = os.listdir("./chroma_db")
for file in chroma_files:
    if file.endswith(".parquet") or file.endswith(".json"):
        size = os.path.getsize(f"./chroma_db/{file}") / 1024 / 1024
        print(f"   {file}: {size:.2f} MB")

print("\n" + "="*60)
print("✅ STEP 2 COMPLETE: ChromaDB is ready!")
print(f"📊 Collection: '{collection_name}' with {count} documents")
print("="*60)