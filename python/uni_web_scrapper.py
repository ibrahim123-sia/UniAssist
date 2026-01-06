# ==================== SECTION 1: IMPORTS ====================
import requests, json, re, os, sys
from bs4 import BeautifulSoup
from tqdm import tqdm

# ==================== SECTION 2: CONFIGURATION ====================
class Config:
    BASE_URL = "https://jinnah.edu"
    SITEMAP_INDEX = "https://jinnah.edu/sitemap_index.xml"
    MIN_TEXT_LENGTH = 50
    CHUNK_SIZE = 1500
    OVERLAP = 250
    REQUEST_TIMEOUT = 10
    
    BLACKLIST_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.gif', '.pdf', '.doc', '.docx', '.zip']
    BLACKLIST_KEYWORDS = ['wp-content/uploads', '/gallery/', '/image/', '/photo/']

# ==================== SECTION 3: URL FILTERING ====================
def should_include_url(url):
    """Filter out images and useless pages"""
    url_lower = url.lower().strip()
    
    # Must be from jinnah.edu
    if 'jinnah.edu' not in url_lower:
        return False
    
    # Check blacklisted extensions
    for ext in Config.BLACKLIST_EXTENSIONS:
        if url_lower.endswith(ext):
            return False
    
    # Check blacklisted keywords in URL path
    for keyword in Config.BLACKLIST_KEYWORDS:
        if keyword in url_lower:
            return False
    
    # Keep main pages (no extension or .html/.htm)
    if not url_lower.endswith(('.html', '.htm', '.php', '.aspx')):
        # Check if it has any file extension
        last_part = url_lower.split('/')[-1]
        if '.' in last_part:
            # Has extension but not whitelisted - probably a file
            return False
    
    # Must be http or https
    if not url_lower.startswith(('http://', 'https://')):
        return False
    
    return True

# ==================== SECTION 4: URL EXTRACTION ====================
def get_all_urls():
    """Extract URLs from sitemap with filtering"""
    response = requests.get(Config.SITEMAP_INDEX)
    soup = BeautifulSoup(response.text, "xml")

    sitemap_urls = [loc.text for loc in soup.find_all("loc")]
    all_urls = []

    for sitemap in sitemap_urls:
        res = requests.get(sitemap)
        s = BeautifulSoup(res.text, "xml")
        urls = [loc.text for loc in s.find_all("loc")]
        
        # FILTER URLs
        for url in urls:
            if should_include_url(url):
                all_urls.append(url)

    return list(set(all_urls))  # remove duplicates

# ==================== SECTION 5: SCRAPING ====================
def scrape_page(url):
    """Scrape and clean single page"""
    try:
        response = requests.get(url, timeout=Config.REQUEST_TIMEOUT)
        soup = BeautifulSoup(response.text, "lxml")

        # Remove non-content elements - PHASE 1 (tags)
        unwanted_tags = ["script", "style", "nav", "footer", "header", 
                        "noscript", "aside", "sidebar", "share", "pagination"]
        
        for tag in unwanted_tags:
            for element in soup.find_all(tag):
                element.decompose()
        
        # PHASE 2 - Remove by class names
        unwanted_classes = ["share", "pagination", "navigation", "breadcrumb", 
                           "related-posts", "post-navigation", "widget",
                           "comments", "social-share", "meta", "tags"]
        
        for class_name in unwanted_classes:
            for element in soup.find_all(class_=class_name):
                element.decompose()
        
        # PHASE 3 - Remove by ID
        unwanted_ids = ["comments", "sidebar", "related-posts", "navigation"]
        
        for element_id in unwanted_ids:
            element = soup.find(id=element_id)
            if element:
                element.decompose()

        # Extract text
        text = soup.get_text(separator=" ")
        text = " ".join(text.split())
        
        # REMOVE COMMON FOOTER/NAV PATTERNS
        unwanted_patterns = [
            "WhatsApp us",
            "Share:",
            "Previous post",
            "Next post", 
            "You may also like",
            "Read More",
            "Home ",
            "Archives - Muhammad Ali Jinnah University",
            "- Muhammad Ali Jinnah University"
        ]
        
        for pattern in unwanted_patterns:
            text = text.replace(pattern, "")
        
        # Clean extra spaces
        text = " ".join(text.split())
        
        return text
    except Exception as e:
        print(f"Error scraping {url}: {e}")
        return ""

# ==================== SECTION 6: CLEANING ====================
EMAIL_REGEX = r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
PHONE_REGEX = r"(\+?\d{1,3}[\s\-]?)?\d{7,15}"

IMPORTANT_KEYWORDS = [
    "admission", "apply", "deadline", "fee", "contact",
    "email", "phone", "office", "registrar",
    "exam", "scholarship"
]

def contains_important_info(text):
    if re.search(EMAIL_REGEX, text):
        return True
    if re.search(PHONE_REGEX, text):
        return True

    for kw in IMPORTANT_KEYWORDS:
        if kw.lower() in text.lower():
            return True

    return False

def is_garbage_text(text):
    """Detect if text is actually binary/image data misread as text"""
    if not text:
        return True
    
    # Count non-printable/weird characters (binary detection)
    weird_chars = 0
    for char in text[:1000]:  # Check first 1000 chars only
        # Normal text characters: letters, digits, punctuation, whitespace
        if ord(char) > 127:  # Non-ASCII characters
            weird_chars += 1
    
    # If more than 20% are weird characters, it's likely binary/garbage
    if len(text) > 0 and (weird_chars / min(len(text), 1000)) > 0.2:
        return True
    
    # Check for common binary patterns
    binary_patterns = [
        r'\x00',  # Null bytes
        r'\ufffd',  # Unicode replacement character �
    ]
    
    for pattern in binary_patterns:
        if re.search(pattern, text[:500]):
            return True
    
    # If text is too short but no important info
    if len(text) < 50 and not contains_important_info(text):
        return True
    
    return False

def clean_text(text):
    """Main cleaning function with garbage detection"""
    # First check if it's garbage/binary
    if is_garbage_text(text):
        return None
    
    # Then apply your existing logic
    if len(text) >= Config.MIN_TEXT_LENGTH:
        return text

    if contains_important_info(text):
        return text

    return None

# ==================== SECTION 7: CHUNKING ====================
def chunk_text(text):
    """Split text into chunks"""
    if not text or len(text.strip()) == 0:
        return []
    
    chunks = []
    start = 0
    
    while start < len(text):
        # Calculate end position
        end = min(start + Config.CHUNK_SIZE, len(text))
        
        # Try to end at sentence boundary (if not at end of text)
        if end < len(text):
            original_end = end
            # Look backwards for sentence end
            while end > start and text[end] not in ['.', '!', '?', '\n', ' ']:
                end -= 1
            
            # If we went too far back, use original end
            if end <= start + Config.CHUNK_SIZE // 2:  # Less than half chunk size
                end = original_end
        
        chunk = text[start:end].strip()
        if chunk and len(chunk) > 50:  # Skip very small chunks
            chunks.append(chunk)
        
        # Move start for next chunk with overlap
        start = end - Config.OVERLAP
        if start <= end:  # Prevent getting stuck
            start = end  # Skip overlap if issue
    
    return chunks

# ==================== SECTION 8: DATA LOADING/SAVING ====================
def load_existing_urls():
    """Load URLs from file if exists"""
    if os.path.exists("data/urls.txt"):
        with open("data/urls.txt", "r", encoding="utf-8") as f:
            return [line.strip() for line in f.readlines()]
    return []

def load_existing_pages():
    """Load cleaned pages from existing data"""
    if os.path.exists("data/clean_pages.json"):
        with open("data/clean_pages.json", "r", encoding="utf-8") as f:
            return json.load(f)
    return []

def load_existing_chunks():
    """Load chunks from existing data"""
    if os.path.exists("data/chunks.json"):
        with open("data/chunks.json", "r", encoding="utf-8") as f:
            return json.load(f)
    return []

def save_urls(urls):
    """Save URLs to file"""
    os.makedirs("data", exist_ok=True)
    with open("data/urls.txt", "w", encoding="utf-8") as f:
        for url in urls:
            f.write(url + "\n")

def save_pages(pages):
    """Save cleaned pages to file"""
    with open("data/clean_pages.json", "w", encoding="utf-8") as f:
        json.dump(pages, f, indent=2, ensure_ascii=False)

def save_chunks(chunks):
    """Save chunks to file"""
    with open("data/chunks.json", "w", encoding="utf-8") as f:
        json.dump(chunks, f, indent=2, ensure_ascii=False)

# ==================== SECTION 9: MAIN PIPELINE ====================
def run_full_pipeline():
    """Run complete pipeline from start to finish"""
    print("="*60)
    print("UNIVERSITY RAG PIPELINE - FULL RUN")
    print("="*60)
    
    print("\nStep 1: Extracting URLs from sitemap...")
    urls = get_all_urls()
    print(f"✅ Found {len(urls)} URLs after filtering")
    save_urls(urls)
    
    print(f"\nStep 2: Scraping {len(urls)} pages...")
    clean_pages = []
    for url in tqdm(urls, desc="Scraping"):
        try:
            text = scrape_page(url)
            clean = clean_text(text)
            if clean:
                clean_pages.append({"url": url, "content": clean})
        except Exception as e:
            continue
    
    print(f"✅ Scraped and cleaned {len(clean_pages)} pages")
    save_pages(clean_pages)
    
    print(f"\nStep 3: Chunking {len(clean_pages)} pages...")
    all_chunks = []
    for page in tqdm(clean_pages, desc="Chunking"):
        chunks = chunk_text(page["content"])
        for chunk in chunks:
            all_chunks.append({"text": chunk, "source": page["url"]})
    
    print(f"✅ Created {len(all_chunks)} chunks")
    save_chunks(all_chunks)
    
    print("\n" + "="*60)
    print("✅ PIPELINE COMPLETE!")
    print(f"📦 Total chunks: {len(all_chunks)}")
    print(f"📏 Avg chunk size: {sum(len(c['text']) for c in all_chunks)/len(all_chunks):.0f} chars")
    print("="*60)
    
    return all_chunks

def run_chunk_only():
    """Only re-chunk existing cleaned data"""
    print("="*60)
    print("RE-CHUNKING EXISTING DATA")
    print("="*60)
    
    pages = load_existing_pages()
    if not pages:
        print("❌ No clean_pages.json found. Run full pipeline first.")
        return
    
    print(f"📄 Loaded {len(pages)} existing pages")
    
    print("\nRe-chunking pages...")
    all_chunks = []
    for page in tqdm(pages, desc="Chunking"):
        chunks = chunk_text(page["content"])
        for chunk in chunks:
            all_chunks.append({"text": chunk, "source": page["url"]})
    
    print(f"✅ Created {len(all_chunks)} chunks")
    save_chunks(all_chunks)
    
    print(f"📦 Total chunks: {len(all_chunks)}")
    print(f"📏 Avg chunk size: {sum(len(c['text']) for c in all_chunks)/len(all_chunks):.0f} chars")

def run_update():
    """Smart update - only scrape new URLs"""
    print("="*60)
    print("SMART UPDATE - SCAN FOR NEW PAGES")
    print("="*60)
    
    print("Note: This feature needs more development")
    print("For now, please run 'full' to refresh all data")
    print("Or 'chunk-only' to re-chunk existing data")

# ==================== SECTION 10: QUICK SEARCH (Bonus!) ====================
def quick_search(query=None):
    """Quick search through existing chunks"""
    chunks = load_existing_chunks()
    if not chunks:
        print("❌ No chunks found. Run pipeline first.")
        return
    
    print(f"🔍 Loaded {len(chunks)} chunks for searching")
    
    if not query:
        query = input("\n❓ Enter search query: ").strip()
    
    query_words = query.lower().split()
    results = []
    
    for chunk in chunks:
        chunk_text_lower = chunk['text'].lower()
        
        # Calculate score
        score = 0
        
        # EXACT MATCH BONUS
        if any(word in chunk_text_lower for word in ['admission', 'fee', 'scholarship', 'faculty', 'contact']):
            score += 3
        
        # ALL WORDS MATCH BONUS
        if all(word in chunk_text_lower for word in query_words):
            score += 2
        
        # ANY WORD MATCH
        score += sum(1 for word in query_words if word in chunk_text_lower)
        
        # Normalize score
        normalized_score = score / max(len(query_words) * 2, 1)
        
        if normalized_score > 0.2:
            results.append({
                'score': normalized_score,
                'text': chunk['text'],
                'source': chunk['source']
            })
    
    results.sort(key=lambda x: x['score'], reverse=True)
    
    print(f"\n🔎 Found {len(results)} results for: '{query}'")
    print("="*60)
    
    for i, res in enumerate(results[:3]):
        print(f"\n✅ RESULT {i+1} (Score: {res['score']:.2f})")
        print(f"🔗 Source: {res['source']}")
        print(f"📝 Content: {res['text'][:300]}...")
        print("-"*60)

# ==================== SECTION 11: MAIN EXECUTION ====================
if __name__ == "__main__":
    # Ensure data directory exists
    os.makedirs("data", exist_ok=True)
    
    if len(sys.argv) > 1:
        command = sys.argv[1].lower()
        
        if command == "full":
            run_full_pipeline()
        elif command == "chunk-only":
            run_chunk_only()
        elif command == "update":
            run_update()
        elif command == "search":
            query = " ".join(sys.argv[2:]) if len(sys.argv) > 2 else None
            quick_search(query)
        else:
            print("❌ Unknown command")
            print("\nUsage:")
            print("  python single_file.py full           - Run complete pipeline")
            print("  python single_file.py chunk-only     - Re-chunk existing data")
            print("  python single_file.py update         - Smart update (not ready)")
            print("  python single_file.py search [query] - Search existing chunks")
            print("\n  python single_file.py              - Show this help")
    else:
        print("="*60)
        print("UNIVERSITY RAG PIPELINE - SINGLE FILE")
        print("="*60)
        print("\nCommands:")
        print("  full           - Run complete pipeline")
        print("  chunk-only     - Re-chunk existing data")
        print("  update         - Smart update (not ready)")
        print("  search [query] - Search existing chunks")
        print("\nExamples:")
        print("  python single_file.py full")
        print("  python single_file.py chunk-only")
        print("  python single_file.py search 'admission fee'")
        print("\nCurrent data status:")
        
        # Check existing files
        if os.path.exists("data/chunks.json"):
            chunks = load_existing_chunks()
            print(f"  ✅ Found {len(chunks)} existing chunks")
        else:
            print("  ❌ No existing data found")