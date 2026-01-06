"""
RAG QUERY SYSTEM FOR UNIVERSITY Q&A
"""

# ==================== SECTION 1: IMPORTS ====================
import chromadb
from sentence_transformers import SentenceTransformer
import json
import os
from dotenv import load_dotenv

# Load environment variables (for API keys)
load_dotenv()

# ==================== SECTION 2: INITIALIZE CHROMADB ====================
print("="*60)
print("INITIALIZING RAG QUERY SYSTEM")
print("="*60)

def init_chromadb():
    """Initialize ChromaDB connection"""
    print("📂 Loading ChromaDB vector database...")
    
    try:
        # Try modern API first
        client = chromadb.PersistentClient(path="./chroma_db")
        print("✅ Using PersistentClient")
    except AttributeError:
        # Fall back to legacy API
        client = chromadb.Client(settings=chromadb.config.Settings(
            persist_directory="./chroma_db"
        ))
        print("✅ Using Client with Settings")
    
    # Get the collection
    collection = client.get_collection(name="university_chunks")
    print(f"✅ Loaded collection: 'university_chunks'")
    print(f"   Total documents: {collection.count()}")
    
    return collection

# ==================== SECTION 3: LOAD EMBEDDING MODEL ====================
def init_embedding_model():
    """Initialize the embedding model"""
    print("\n🤖 Loading embedding model...")
    model = SentenceTransformer('all-MiniLM-L6-v2')
    print("✅ Model loaded: all-MiniLM-L6-v2")
    return model

# ==================== SECTION 4: SEARCH FUNCTION ====================
def search_chromadb(question, collection, model, top_k=5):
    """
    Search ChromaDB for relevant chunks
    Returns: chunks, sources, and similarity scores
    """
    # Convert question to embedding
    question_embedding = model.encode(question).tolist()
    
    # Search ChromaDB
    results = collection.query(
        query_embeddings=[question_embedding],
        n_results=top_k,
        include=["documents", "metadatas", "distances"]
    )
    
    # Extract results
    chunks = results['documents'][0] if results['documents'] else []
    sources = results['metadatas'][0] if results['metadatas'] else []
    distances = results['distances'][0] if results['distances'] else []
    
    # Convert distances to similarity scores (higher = more similar)
    similarity_scores = [(1 - dist) for dist in distances] if distances else []
    
    return chunks, sources, similarity_scores

# ==================== SECTION 5: CREATE PROMPT ====================
def create_rag_prompt(question, relevant_chunks, sources):
    """
    Create a prompt for the LLM with context and instructions
    """
    # Combine chunks into context
    context_parts = []
    for i, (chunk, source) in enumerate(zip(relevant_chunks, sources), 1):
        context_parts.append(f"[Source {i}: {source['source']}]\n{chunk}")
    
    context = "\n\n---\n\n".join(context_parts)
    
    # Create the prompt
    prompt = f"""You are a helpful assistant for Muhammad Ali Jinnah University (MAJU).
Your task is to answer student questions using ONLY the provided context from the university website.
If the context doesn't contain the answer, say "I don't have information about that in my database."

CONTEXT FROM UNIVERSITY WEBSITE:
{context}

STUDENT'S QUESTION: {question}

INSTRUCTIONS:
1. Answer clearly and concisely
2. Use ONLY information from the context above
3. For each important fact, cite the source number in brackets like [1]
4. If the context has contact info (emails, phones), include them
5. If the context has fees or numbers, be precise

ANSWER:"""
    
    return prompt, sources

# ==================== SECTION 6: LLM INTEGRATION ====================
def get_llm_response(prompt, provider="groq"):
    """
    Get response from LLM (Groq)
    """
    if provider.lower() == "groq":
        return get_groq_response(prompt)
    else:
        return "[LLM NOT CONFIGURED - Install Groq]"

def get_groq_response(prompt):
    """Get response from Groq - UPDATED MODEL"""
    try:
        from groq import Groq
        
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            return "❌ GROQ_API_KEY not found in .env file"
        
        client = Groq(api_key=api_key)
        
        response = client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            messages=[
                {"role": "system", "content": "You are a helpful university assistant."},
                {"role": "user", "content": prompt}
            ],
            temperature=0.3,
            max_tokens=1000
        )
        
        return response.choices[0].message.content
        
    except ImportError:
        return "❌ Install Groq: pip install groq"
    except Exception as e:
        return f"❌ Groq Error: {str(e)}"

# ==================== SECTION 7: MAIN RAG FUNCTION ====================
def ask_university_rag(question, provider="groq"):
    """
    Main RAG pipeline: Question → Search → LLM → Answer
    """
    print(f"\n🔍 QUESTION: {question}")
    print("-"*60)
    
    # Initialize components
    collection = init_chromadb()
    model = init_embedding_model()
    
    # Step 1: Search for relevant chunks
    print(f"\n📚 Searching database for relevant information...")
    chunks, sources, scores = search_chromadb(question, collection, model, top_k=3)
    
    if not chunks:
        return "❌ No relevant information found in database."
    
    # Show what was found
    print(f"✅ Found {len(chunks)} relevant chunks:")
    for i, (chunk, source, score) in enumerate(zip(chunks, sources, scores), 1):
        print(f"   {i}. Similarity: {score:.2f} | Source: {source['source']}")
        print(f"      Preview: {chunk[:100]}...")
    
    # Step 2: Create prompt
    prompt, source_list = create_rag_prompt(question, chunks, sources)
    
    # Step 3: Get LLM response
    print(f"\n💭 Generating answer using {provider.upper()}...")
    answer = get_llm_response(prompt, provider)
    
    # Step 4: Format final answer with sources
    print(f"\n📝 FORMATTING ANSWER WITH CITATIONS...")
    
    # Add source URLs at the end
    if source_list:
        answer += "\n\n📎 SOURCES:\n"
        for i, source in enumerate(source_list, 1):
            answer += f"{i}. {source['source']}\n"
    
    return answer

# ==================== SECTION 8: BATCH TESTING ====================
def test_sample_questions():
    """Test the RAG system with sample student questions"""
    test_questions = [
        "What is the fee structure for BS Computer Science?",
        "How can I contact the admissions office?",
        "What scholarships are available?",
        "Tell me about the Computer Science faculty",
        "What are the admission requirements?"
    ]
    
    print("="*60)
    print("🧪 RUNNING SAMPLE TESTS")
    print("="*60)
    
    for i, question in enumerate(test_questions, 1):
        print(f"\n🧪 TEST {i}: {question}")
        answer = ask_university_rag(question, provider="groq")
        print(f"\n📢 ANSWER:\n{answer}")
        print("="*60)
        input("Press Enter for next test...")

# ==================== SECTION 9: INTERACTIVE MODE ====================
def interactive_mode():
    """Run interactive Q&A session"""
    print("="*60)
    print("🎯 UNIVERSITY RAG Q&A SYSTEM")
    print("="*60)
    print("Type 'quit' or 'exit' to end the session")
    print("Type 'test' to run sample questions")
    print("="*60)
    
    # Initialize once for the session
    print("\n🔄 Initializing system...")
    collection = init_chromadb()
    model = init_embedding_model()
    print("✅ System ready!")
    
    while True:
        print("\n" + "-"*40)
        question = input("\n❓ Student Question: ").strip()
        
        if question.lower() in ['quit', 'exit', 'q']:
            print("👋 Goodbye!")
            break
        
        if question.lower() == 'test':
            test_sample_questions()
            continue
        
        if not question:
            continue
        
        # Run RAG pipeline
        answer = ask_university_rag(question, provider="groq")
        print(f"\n📢 ANSWER:\n{answer}")

# ==================== SECTION 10: MAIN EXECUTION ====================
if __name__ == "__main__":
    import sys
    
    # Create .env file template if it doesn't exist
    if not os.path.exists(".env"):
        with open(".env", "w") as f:
            f.write("# API Keys for RAG System\n")
            f.write("# Get your API key from console.groq.com\n")
            f.write("GROQ_API_KEY=your_groq_api_key_here\n\n")
            f.write("# OR use OpenAI (optional)\n")
            f.write("# OPENAI_API_KEY=your_openai_api_key_here\n")
        print("📝 Created .env template file. Please add your API keys!")
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "test":
            test_sample_questions()
        elif sys.argv[1] == "ask" and len(sys.argv) > 2:
            question = " ".join(sys.argv[2:])
            answer = ask_university_rag(question, provider="groq")
            print(f"\n📢 FINAL ANSWER:\n{answer}")
        else:
            print("Usage:")
            print("  python rag_query.py                     # Interactive mode")
            print("  python rag_query.py test                # Run sample tests")
            print("  python rag_query.py ask 'your question' # Ask single question")
    else:
        interactive_mode()