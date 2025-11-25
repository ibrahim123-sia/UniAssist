from sentence_transformers import SentenceTransformer
import numpy as np
from typing import List

class EmbeddingGenerator:
    def __init__(self, model_name: str = 'all-MiniLM-L6-v2'):
        self.model = SentenceTransformer(model_name)
        print(f"🔧 Loaded embedding model: {model_name}")
    
    def generate_embeddings(self, texts: List[str]) -> np.ndarray:
        """Generate embeddings for list of texts"""
        print(f"🔄 Generating embeddings for {len(texts)} texts...")
        embeddings = self.model.encode(texts, show_progress_bar=True)
        print(f"✅ Generated embeddings shape: {embeddings.shape}")
        return embeddings
    
    def generate_embedding(self, text: str) -> np.ndarray:
        """Generate embedding for single text"""
        return self.model.encode([text])[0]