import faiss
import numpy as np
import json
import pickle
from typing import List, Dict, Any
from .embeddings import EmbeddingGenerator

class VectorDBManager:
    def __init__(self, index_path: str = "vector_db/faiss_index"):
        self.index_path = index_path
        self.embedding_generator = EmbeddingGenerator()
        self.index = None
        self.chunks = []
        
    def initialize_index(self, dimension: int = 384):
        """Initialize FAISS index"""
        self.index = faiss.IndexFlatIP(dimension)  # Inner product for cosine similarity
        print(f"📊 Initialized FAISS index with dimension {dimension}")
    
    def add_chunks_to_index(self, chunks: List[Dict]):
        """Add processed chunks to vector database"""
        if not chunks:
            print("❌ No chunks to add to index")
            return
        
        # Extract texts for embedding
        texts = [chunk['content'] for chunk in chunks]
        
        # Generate embeddings
        embeddings = self.embedding_generator.generate_embeddings(texts)
        
        # Initialize index if not exists
        if self.index is None:
            self.initialize_index(embeddings.shape[1])
        
        # Add to index
        self.index.add(embeddings.astype('float32'))
        self.chunks.extend(chunks)
        
        print(f"✅ Added {len(chunks)} chunks to vector database")
        print(f"📈 Total chunks in index: {len(self.chunks)}")
    
    def search_similar(self, query: str, k: int = 5) -> List[Dict]:
        """Search for similar chunks"""
        if self.index is None or len(self.chunks) == 0:
            print("❌ Vector database is empty")
            return []
        
        # Generate query embedding
        query_embedding = self.embedding_generator.generate_embedding(query)
        query_embedding = np.array([query_embedding]).astype('float32')
        
        # Search in index
        scores, indices = self.index.search(query_embedding, k)
        
        results = []
        for score, idx in zip(scores[0], indices[0]):
            if idx < len(self.chunks):
                results.append({
                    'chunk': self.chunks[idx],
                    'score': float(score),
                    'rank': len(results) + 1
                })
        
        print(f"🔍 Found {len(results)} results for query: '{query}'")
        return results
    
    def save_index(self):
        """Save FAISS index and chunks"""
        if self.index is not None:
            faiss.write_index(self.index, f"{self.index_path}.faiss")
            with open(f"{self.index_path}_chunks.pkl", 'wb') as f:
                pickle.dump(self.chunks, f)
            print(f"💾 Saved index with {len(self.chunks)} chunks")
    
    def load_index(self):
        """Load FAISS index and chunks"""
        try:
            self.index = faiss.read_index(f"{self.index_path}.faiss")
            with open(f"{self.index_path}_chunks.pkl", 'rb') as f:
                self.chunks = pickle.load(f)
            print(f"📥 Loaded index with {len(self.chunks)} chunks")
        except FileNotFoundError:
            print("❌ No existing index found. Creating new one.")
            self.initialize_index()