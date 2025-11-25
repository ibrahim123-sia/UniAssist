import json
import re
from typing import List, Dict, Any

class DataProcessor:
    def __init__(self, chunk_size=1000, chunk_overlap=200):
        self.chunk_size = chunk_size
        self.chunk_overlap = chunk_overlap
    
    def process_scraped_data(self, raw_data: List[Dict]) -> List[Dict]:
        """Process raw scraped data into chunks"""
        processed_chunks = []
        
        for page in raw_data:
            if page['status'] != 'success':
                continue
                
            # Create chunks from main content
            content_chunks = self.create_content_chunks(page)
            processed_chunks.extend(content_chunks)
            
            # Create chunks from tables
            table_chunks = self.create_table_chunks(page)
            processed_chunks.extend(table_chunks)
        
        print(f"📊 Created {len(processed_chunks)} chunks from {len([p for p in raw_data if p['status']=='success'])} pages")
        return processed_chunks
    
    def create_content_chunks(self, page: Dict) -> List[Dict]:
        """Split page content into chunks"""
        chunks = []
        content = page['content']
        
        # Simple chunking by sentence/section
        sentences = re.split(r'[.!?]+', content)
        current_chunk = ""
        
        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue
                
            if len(current_chunk) + len(sentence) < self.chunk_size:
                current_chunk += " " + sentence if current_chunk else sentence
            else:
                if current_chunk:
                    chunks.append(self.create_chunk_dict(current_chunk, page, 'content', len(chunks)))
                current_chunk = sentence
        
        # Don't forget the last chunk
        if current_chunk:
            chunks.append(self.create_chunk_dict(current_chunk, page, 'content', len(chunks)))
        
        return chunks
    
    def create_table_chunks(self, page: Dict) -> List[Dict]:
        """Convert tables into text chunks"""
        chunks = []
        
        for table_idx, table in enumerate(page.get('tables', [])):
            table_text = self.table_to_text(table)
            if table_text and len(table_text) > 50:
                chunks.append(self.create_chunk_dict(table_text, page, 'table', table_idx))
        
        return chunks
    
    def table_to_text(self, table: Dict) -> str:
        """Convert table data to readable text"""
        if not table.get('rows'):
            return ""
        
        text_parts = []
        
        # Add context
        if table.get('context'):
            text_parts.append(f"Context: {table['context']}")
        
        # Add table data
        for i, row in enumerate(table['rows']):
            row_text = " | ".join(str(cell) for cell in row if cell)
            if row_text:
                text_parts.append(f"Row {i+1}: {row_text}")
        
        return "\n".join(text_parts)
    
    def create_chunk_dict(self, content: str, page: Dict, chunk_type: str, chunk_id: int) -> Dict:
        """Create a standardized chunk dictionary"""
        return {
            'content': content.strip(),
            'metadata': {
                'source': page['url'],
                'title': page['title'],
                'type': chunk_type,
                'chunk_id': f"{chunk_type}_{chunk_id}",
                'scraped_at': page['scraped_at']
            }
        }
    
    def save_processed_data(self, chunks: List[Dict], filename: str):
        """Save processed chunks to JSON"""
        with open(f'data/processed/{filename}', 'w', encoding='utf-8') as f:
            json.dump(chunks, f, indent=2, ensure_ascii=False)
        
        print(f"💾 Saved {len(chunks)} chunks to data/processed/{filename}")