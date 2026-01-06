import json
import random
from sentence_transformers import SentenceTransformer

print("="*60)
print("STEP 1: TESTING EMBEDDINGS WITH QUALITY CHECKS")
print("="*60)

print("\n📦 Loading your data...")
with open("data/chunks.json", "r", encoding="utf-8") as f:
    chunks = json.load(f)

print(f"✅ Loaded {len(chunks)} chunks")

# ==================== QUALITY CHECK 1: RANDOM SAMPLES ====================
print("\n🔍 QUALITY CHECK 1: Testing RANDOM chunks (not just first one)")
print("-"*60)

for i in range(3):  # Test 3 random chunks
    random_chunk = random.choice(chunks)
    print(f"\nRandom Chunk {i+1}:")
    print(f"  Length: {len(random_chunk['text'])} chars")
    print(f"  Source: {random_chunk['source']}")
    print(f"  Preview: {random_chunk['text'][:150]}...")

# ==================== QUALITY CHECK 2: CHUNK SIZE ANALYSIS ====================
print("\n📏 QUALITY CHECK 2: Chunk Size Distribution")
print("-"*60)

size_ranges = {
    "Too Small (<100 chars)": 0,
    "Good (100-500 chars)": 0,
    "Optimal (500-1200 chars)": 0,
    "Large (1200-2000 chars)": 0,
    "Too Large (>2000 chars)": 0
}

for chunk in chunks:
    length = len(chunk['text'])
    if length < 100:
        size_ranges["Too Small (<100 chars)"] += 1
    elif length < 500:
        size_ranges["Too Small (<100 chars)"] += 1
    elif length < 1200:
        size_ranges["Optimal (500-1200 chars)"] += 1
    elif length < 2000:
        size_ranges["Large (1200-2000 chars)"] += 1
    else:
        size_ranges["Too Large (>2000 chars)"] += 1

for category, count in size_ranges.items():
    percentage = (count / len(chunks)) * 100
    print(f"  {category}: {count} chunks ({percentage:.1f}%)")

# ==================== EMBEDDING TEST ====================
print("\n🤖 TEST: Creating Embeddings")
print("-"*60)

model = SentenceTransformer('all-MiniLM-L6-v2')
print("✅ Embedding model loaded: all-MiniLM-L6-v2")

# Test on 3 random chunks
test_chunks = random.sample(chunks, 3)

for i, chunk in enumerate(test_chunks):
    print(f"\nTest {i+1}:")
    print(f"  Text length: {len(chunk['text'])} chars")
    
    # Size warning
    if len(chunk['text']) > 2000:
        print("  ⚠️ WARNING: Chunk is too large for optimal RAG")
    elif len(chunk['text']) < 100:
        print("  ⚠️ WARNING: Chunk might be too small")
    
    # Create embedding
    embedding = model.encode(chunk['text'])
    print(f"  Embedding created: {len(embedding)} numbers")
    print(f"  First 3 numbers: {embedding[:3]}")

# Test on a question
print("\n❓ TEST: Embedding a question")
question = "What is the fee structure for computer science?"
question_embedding = model.encode(question)
print(f"Question: '{question}'")
print(f"Question embedding: {len(question_embedding)} numbers")
print(f"First 3 numbers: {question_embedding[:3]}")

# ==================== SIMILARITY TEST ====================
print("\n🎯 TEST: Semantic Similarity")
print("-"*60)

# Test if similar texts get similar embeddings
text1 = "admission fee structure"
text2 = "tuition cost for programs"
text3 = "library timing schedule"

emb1 = model.encode(text1)
emb2 = model.encode(text2)
emb3 = model.encode(text3)

# Calculate cosine similarity (simplified)
from numpy import dot
from numpy.linalg import norm

cos_sim_1_2 = dot(emb1, emb2) / (norm(emb1) * norm(emb2))
cos_sim_1_3 = dot(emb1, emb3) / (norm(emb1) * norm(emb3))

print(f"Similarity between '{text1}' and '{text2}': {cos_sim_1_2:.3f}")
print(f"Similarity between '{text1}' and '{text3}': {cos_sim_1_3:.3f}")
print("Note: Higher number (closer to 1) means more similar")

print("\n" + "="*60)
print("✅ STEP 1 COMPLETE: Embeddings are working!")
print("="*60)