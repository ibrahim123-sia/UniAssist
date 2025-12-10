import time
import os
from scraper.university_scraper import UniversityScraper
from scraper.data_processor import DataProcessor
from vector_db.faiss_manager import VectorDBManager
from models.config import UNIVERSITY_URLS

def ensure_directories():
    """Create necessary directories"""
    os.makedirs('data/raw', exist_ok=True)
    os.makedirs('data/processed', exist_ok=True)
    os.makedirs('vector_db', exist_ok=True)

def main():
    print("🚀 STARTING UNIVERSITY RAG DATA PIPELINE")
    print("=" * 60)
    
    ensure_directories()
    
    # Step 1: Web Scraping
    print("\n📥 STEP 1: WEB SCRAPING")
    print("-" * 40)
    
    scraper = UniversityScraper()
    scraped_data = []
    
    for url in UNIVERSITY_URLS:
        page_data = scraper.scrape_page(url)
        scraped_data.append(page_data)
        time.sleep(2)  # Be polite to server
    
    # Save raw data
    import json
    with open('data/raw/scraped_data.json', 'w', encoding='utf-8') as f:
        json.dump(scraped_data, f, indent=2, ensure_ascii=False)
    
    successful_pages = len([p for p in scraped_data if p['status'] == 'success'])
    print(f"✅ Scraped {successful_pages}/{len(UNIVERSITY_URLS)} pages successfully")
    
    # Step 2: Data Processing
    print("\n🔧 STEP 2: DATA PROCESSING & CHUNKING")
    print("-" * 40)
    
    processor = DataProcessor()
    processed_chunks = processor.process_scraped_data(scraped_data)
    processor.save_processed_data(processed_chunks, 'university_chunks.json')
    
    # Step 3: Vector Database
    print("\n🗄️ STEP 3: VECTOR DATABASE CREATION")
    print("-" * 40)
    
    vector_db = VectorDBManager()
    vector_db.add_chunks_to_index(processed_chunks)
    vector_db.save_index()
    
    # Test the system
    print("\n🧪 STEP 4: SYSTEM TEST")
    print("-" * 40)
    
    test_queries = [
        "What is the fee structure for BSCS?",
        "Tell me about admission requirements",
        "Computer science programs available",
        "Scholarship opportunities"
    ]
    
    for query in test_queries:
        print(f"\n🔍 Testing query: '{query}'")
        results = vector_db.search_similar(query, k=3)
        
        for result in results:
            print(f"   📝 Score: {result['score']:.3f} | Source: {result['chunk']['metadata']['source']}")
            print(f"   Content: {result['chunk']['content'][:150]}...")
    
    print("\n🎉 PHASE 1 COMPLETED SUCCESSFULLY!")
    print(f"📊 Total chunks in vector database: {len(processed_chunks)}")
    print("📁 Data saved in: data/raw/, data/processed/, vector_db/")

if __name__ == "__main__":
    main()