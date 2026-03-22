"""
========================================================
SCRAPER.PY - Web Scraping, Cleaning & Chunking Pipeline
========================================================

This file handles the entire data collection process:
  1. Discover URLs from website sitemaps
  2. Scrape each page and extract clean text
  3. Filter out garbage/binary content
  4. Split long text into smaller chunks

The scraper works with ANY website defined in config.py.
Just add a new website config and run the pipeline.

FLOW:
  Sitemap XML → URLs → Raw HTML → Clean Text → Chunks → JSON files
"""

import requests
import json
import re
import os
from bs4 import BeautifulSoup
from tqdm import tqdm

# Import all settings from our config file
import config


# =============================================================
# URL DISCOVERY - Finding all pages to scrape
# =============================================================

def should_include_url(url, allowed_domain):
    """
    Decide whether a URL should be scraped or skipped.

    We skip URLs that point to images, PDFs, or other non-text files.
    We only keep URLs that belong to the allowed domain.

    Args:
        url:             The URL to check
        allowed_domain:  The domain this URL must belong to (e.g. "jinnah.edu")

    Returns:
        True if the URL should be scraped, False otherwise
    """
    url_lower = url.lower().strip()

    # Rule 1: Must belong to the correct domain
    if allowed_domain not in url_lower:
        return False

    # Rule 2: Skip blacklisted file extensions (images, PDFs, etc.)
    for ext in config.BLACKLIST_EXTENSIONS:
        if url_lower.endswith(ext):
            return False

    # Rule 3: Skip URLs with blacklisted keywords (uploads, galleries, etc.)
    for keyword in config.BLACKLIST_URL_KEYWORDS:
        if keyword in url_lower:
            return False

    # Rule 4: If it has a file extension that's not a web page, skip it
    if not url_lower.endswith((".html", ".htm", ".php", ".aspx")):
        last_part = url_lower.split("/")[-1]
        if "." in last_part:
            return False  # Has unknown extension — probably a file, not a page

    # Rule 5: Must be a valid HTTP/HTTPS URL
    if not url_lower.startswith(("http://", "https://")):
        return False

    return True


def get_urls_from_sitemap(sitemap_url, allowed_domain):
    """
    Extract all page URLs from a website's sitemap.

    Most websites have a sitemap_index.xml that links to multiple
    smaller sitemaps. We fetch each one and collect all URLs.

    Args:
        sitemap_url:     URL of the sitemap index XML
        allowed_domain:  Only keep URLs from this domain

    Returns:
        List of unique, filtered URLs ready for scraping
    """
    print(f"  Fetching sitemap: {sitemap_url}")
    response = requests.get(sitemap_url, timeout=config.REQUEST_TIMEOUT)
    soup = BeautifulSoup(response.text, "xml")

    # A sitemap index contains links to other sitemaps
    sitemap_links = [loc.text for loc in soup.find_all("loc")]
    all_urls = []

    for link in sitemap_links:
        # Each link could be a sub-sitemap or a direct page URL.
        # We try to parse it as a sitemap first.
        try:
            res = requests.get(link, timeout=config.REQUEST_TIMEOUT)
            sub_soup = BeautifulSoup(res.text, "xml")
            page_urls = [loc.text for loc in sub_soup.find_all("loc")]

            # If it had <loc> tags inside, it was a sitemap
            if page_urls:
                for url in page_urls:
                    if should_include_url(url, allowed_domain):
                        all_urls.append(url)
            else:
                # It was a direct URL, not a sub-sitemap
                if should_include_url(link, allowed_domain):
                    all_urls.append(link)
        except Exception:
            # If fetching a sub-sitemap fails, just add the link itself
            if should_include_url(link, allowed_domain):
                all_urls.append(link)

    # Remove duplicate URLs
    unique_urls = list(set(all_urls))
    return unique_urls


def get_all_urls():
    """
    Discover URLs from ALL websites defined in config.py.

    This loops through each website in config.WEBSITES and
    collects all their page URLs. This is what makes the system
    flexible — add a new website to the config and it gets included.

    Returns:
        List of all unique URLs from all configured websites
    """
    all_urls = []

    for website in config.WEBSITES:
        print(f"\nDiscovering URLs for: {website['name']}")
        urls = get_urls_from_sitemap(
            sitemap_url=website["sitemap_url"],
            allowed_domain=website["allowed_domain"],
        )
        print(f"  Found {len(urls)} URLs from {website['name']}")
        all_urls.extend(urls)

    # Final deduplication across all websites
    unique_urls = list(set(all_urls))
    print(f"\nTotal unique URLs: {len(unique_urls)}")
    return unique_urls


# =============================================================
# PAGE SCRAPING - Extracting clean text from HTML
# =============================================================

def scrape_page(url):
    """
    Fetch a web page and extract its text content.

    This does a 3-phase HTML cleanup:
      Phase 1: Remove unwanted HTML tags (scripts, nav, footer, etc.)
      Phase 2: Remove elements by CSS class name (share buttons, etc.)
      Phase 3: Remove elements by HTML ID (sidebar, comments, etc.)

    After cleanup, we extract the visible text and remove
    common footer/navigation patterns.

    Args:
        url: The page URL to scrape

    Returns:
        Cleaned text content, or empty string if scraping failed
    """
    try:
        response = requests.get(url, timeout=config.REQUEST_TIMEOUT)
        soup = BeautifulSoup(response.text, "lxml")

        # Phase 1: Remove unwanted HTML tags entirely
        for tag_name in config.UNWANTED_HTML_TAGS:
            for element in soup.find_all(tag_name):
                element.decompose()

        # Phase 2: Remove elements with unwanted CSS classes
        for class_name in config.UNWANTED_CSS_CLASSES:
            for element in soup.find_all(class_=class_name):
                element.decompose()

        # Phase 3: Remove elements with unwanted IDs
        for element_id in config.UNWANTED_HTML_IDS:
            element = soup.find(id=element_id)
            if element:
                element.decompose()

        # Extract all visible text with spaces between elements
        text = soup.get_text(separator=" ")

        # Normalize whitespace (collapse multiple spaces into one)
        text = " ".join(text.split())

        # Remove common footer/navigation text patterns
        for pattern in config.UNWANTED_TEXT_PATTERNS:
            text = text.replace(pattern, "")

        # Final whitespace cleanup
        text = " ".join(text.split())

        return text

    except Exception as e:
        print(f"  Error scraping {url}: {e}")
        return ""


# =============================================================
# TEXT CLEANING - Filtering out garbage content
# =============================================================

# Regex patterns to detect contact information
EMAIL_REGEX = r"[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}"
PHONE_REGEX = r"(\+?\d{1,3}[\s\-]?)?\d{7,15}"


def contains_important_info(text):
    """
    Check if text contains important information worth keeping.

    Even if a page is short, we keep it if it has email addresses,
    phone numbers, or important keywords like "admission" or "fee".

    Args:
        text: The text to check

    Returns:
        True if the text contains important information
    """
    # Check for email addresses
    if re.search(EMAIL_REGEX, text):
        return True

    # Check for phone numbers
    if re.search(PHONE_REGEX, text):
        return True

    # Check for important keywords
    text_lower = text.lower()
    for keyword in config.IMPORTANT_KEYWORDS:
        if keyword in text_lower:
            return True

    return False


def is_garbage_text(text):
    """
    Detect if text is actually binary/image data misread as text.

    Sometimes web scraping accidentally reads binary files (images, PDFs)
    as text, producing gibberish. This function catches those cases.

    Args:
        text: The text to check

    Returns:
        True if the text appears to be garbage/binary data
    """
    if not text:
        return True

    # Count non-ASCII characters in the first 1000 chars
    # Normal text has very few; binary data has many
    sample = text[:1000]
    weird_char_count = sum(1 for char in sample if ord(char) > 127)

    # If more than 20% are non-ASCII, it's likely binary data
    if len(sample) > 0 and (weird_char_count / len(sample)) > 0.2:
        return True

    # Check for null bytes and unicode replacement characters
    # These are strong indicators of binary data
    binary_patterns = [r"\x00", r"\ufffd"]
    for pattern in binary_patterns:
        if re.search(pattern, text[:500]):
            return True

    # Very short text without important info is not useful
    if len(text) < config.MIN_TEXT_LENGTH and not contains_important_info(text):
        return True

    return False


def clean_text(text):
    """
    Main text cleaning function.

    Applies garbage detection first, then checks minimum length.
    Short pages with important info (contacts, fees) are kept.

    Args:
        text: Raw scraped text

    Returns:
        Cleaned text, or None if the text should be discarded
    """
    # Step 1: Reject garbage/binary content
    if is_garbage_text(text):
        return None

    # Step 2: Keep if long enough
    if len(text) >= config.MIN_TEXT_LENGTH:
        return text

    # Step 3: Keep short text only if it has important info
    if contains_important_info(text):
        return text

    return None


# =============================================================
# TEXT CHUNKING - Splitting text into database-ready pieces
# =============================================================

def chunk_text(text):
    """
    Split a long text into smaller overlapping chunks.

    WHY CHUNKING?
    The embedding model works best with smaller pieces of text.
    If we feed it an entire web page, the meaning gets diluted.
    Smaller chunks = more precise search results.

    WHY OVERLAP?
    Without overlap, a sentence at the boundary between two chunks
    could be split in half and lose its meaning. Overlap ensures
    every sentence appears fully in at least one chunk.

    Args:
        text: The full text to split

    Returns:
        List of text chunks (strings)
    """
    if not text or len(text.strip()) == 0:
        return []

    chunks = []
    start = 0

    while start < len(text):
        # Calculate where this chunk ends
        end = min(start + config.CHUNK_SIZE, len(text))

        # Try to break at a sentence boundary (period, question mark, etc.)
        # This avoids cutting sentences in half
        if end < len(text):
            original_end = end
            while end > start and text[end] not in [".", "!", "?", "\n", " "]:
                end -= 1

            # If we backed up too far (past half the chunk), use the original end
            if end <= start + config.CHUNK_SIZE // 2:
                end = original_end

        chunk = text[start:end].strip()

        # Only keep chunks that are long enough to be useful
        if chunk and len(chunk) > config.MIN_CHUNK_LENGTH:
            chunks.append(chunk)

        # Start the next chunk with some overlap from this one
        start = end - config.CHUNK_OVERLAP
        if start <= end:
            start = end  # Safety: prevent infinite loop

    return chunks


# =============================================================
# DATA PERSISTENCE - Saving and loading data files
# =============================================================

def save_urls(urls):
    """Save discovered URLs to a text file (one URL per line)."""
    os.makedirs(config.DATA_DIR, exist_ok=True)
    with open(config.URLS_FILE, "w", encoding="utf-8") as f:
        for url in urls:
            f.write(url + "\n")
    print(f"  Saved {len(urls)} URLs to {config.URLS_FILE}")


def save_pages(pages):
    """Save cleaned page data to JSON."""
    with open(config.CLEAN_PAGES_FILE, "w", encoding="utf-8") as f:
        json.dump(pages, f, indent=2, ensure_ascii=False)
    print(f"  Saved {len(pages)} pages to {config.CLEAN_PAGES_FILE}")


def save_chunks(chunks):
    """Save text chunks to JSON."""
    with open(config.CHUNKS_FILE, "w", encoding="utf-8") as f:
        json.dump(chunks, f, indent=2, ensure_ascii=False)
    print(f"  Saved {len(chunks)} chunks to {config.CHUNKS_FILE}")


def load_urls():
    """Load previously saved URLs from file."""
    if os.path.exists(config.URLS_FILE):
        with open(config.URLS_FILE, "r", encoding="utf-8") as f:
            return [line.strip() for line in f.readlines() if line.strip()]
    return []


def load_pages():
    """Load previously saved cleaned pages from JSON."""
    if os.path.exists(config.CLEAN_PAGES_FILE):
        with open(config.CLEAN_PAGES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


def load_chunks():
    """Load previously saved chunks from JSON."""
    if os.path.exists(config.CHUNKS_FILE):
        with open(config.CHUNKS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


# =============================================================
# PIPELINE - Orchestrating the full scraping process
# =============================================================

def run_full_pipeline():
    """
    Run the complete scraping pipeline from start to finish.

    Steps:
      1. Discover URLs from all configured website sitemaps
      2. Scrape each page and extract clean text
      3. Split text into chunks for the vector database

    This is the main function you run when setting up or refreshing data.
    """
    print("=" * 60)
    print("SCRAPING PIPELINE - FULL RUN")
    print("=" * 60)

    # Ensure data directory exists
    os.makedirs(config.DATA_DIR, exist_ok=True)

    # Step 1: Discover all URLs
    print("\nStep 1: Discovering URLs from sitemaps...")
    urls = get_all_urls()
    save_urls(urls)

    # Step 2: Scrape and clean each page
    print(f"\nStep 2: Scraping {len(urls)} pages...")
    clean_pages = []
    for url in tqdm(urls, desc="Scraping"):
        try:
            raw_text = scrape_page(url)
            cleaned = clean_text(raw_text)
            if cleaned:
                clean_pages.append({"url": url, "content": cleaned})
        except Exception:
            continue  # Skip pages that fail

    save_pages(clean_pages)

    # Step 3: Chunk the cleaned text
    print(f"\nStep 3: Chunking {len(clean_pages)} pages...")
    all_chunks = []
    for page in tqdm(clean_pages, desc="Chunking"):
        page_chunks = chunk_text(page["content"])
        for chunk in page_chunks:
            all_chunks.append({"text": chunk, "source": page["url"]})

    save_chunks(all_chunks)

    # Print summary
    print("\n" + "=" * 60)
    print("PIPELINE COMPLETE!")
    print(f"  URLs discovered:  {len(urls)}")
    print(f"  Pages scraped:    {len(clean_pages)}")
    print(f"  Chunks created:   {len(all_chunks)}")
    if all_chunks:
        avg = sum(len(c["text"]) for c in all_chunks) / len(all_chunks)
        print(f"  Avg chunk size:   {avg:.0f} characters")
    print("=" * 60)

    return all_chunks


def run_rechunk():
    """
    Re-chunk existing scraped data without re-scraping.

    Useful when you change CHUNK_SIZE or CHUNK_OVERLAP in config.py
    and want to regenerate chunks from already-scraped pages.
    """
    print("=" * 60)
    print("RE-CHUNKING EXISTING DATA")
    print("=" * 60)

    pages = load_pages()
    if not pages:
        print("No existing pages found. Run 'scrape' first.")
        return

    print(f"  Loaded {len(pages)} existing pages")

    all_chunks = []
    for page in tqdm(pages, desc="Chunking"):
        page_chunks = chunk_text(page["content"])
        for chunk in page_chunks:
            all_chunks.append({"text": chunk, "source": page["url"]})

    save_chunks(all_chunks)

    print(f"\n  Total chunks: {len(all_chunks)}")
    if all_chunks:
        avg = sum(len(c["text"]) for c in all_chunks) / len(all_chunks)
        print(f"  Avg chunk size: {avg:.0f} characters")
