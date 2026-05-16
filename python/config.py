"""
========================================================
CONFIG.PY - Central Configuration for the RAG Pipeline
========================================================

This file holds ALL settings for the entire pipeline.
When you want to add a new website to scrape, just add
a new entry to the WEBSITES list below. Everything else
will adapt automatically.

HOW TO ADD A NEW WEBSITE:
    1. Add a new dictionary to the WEBSITES list
    2. Set the sitemap_url, allowed_domain, and base_url
    3. Run: python run.py scrape
    4. Run: python run.py build
    That's it! The RAG system will now include that site.
"""

import os
from dotenv import load_dotenv

# Load API keys from .env file
load_dotenv()


# =============================================================
# WEBSITES TO SCRAPE
# =============================================================
# Each website needs:
#   - name:           A short label (used in logs)
#   - sitemap_url:    The sitemap XML URL to discover pages
#   - allowed_domain: Only scrape URLs containing this domain
#   - base_url:       The homepage (used as fallback reference)
#
# To add a new website, just copy one block and change the values.

WEBSITES = [
    {
        "name": "MAJU",
        "sitemap_url": "https://jinnah.edu/sitemap_index.xml",
        "allowed_domain": "jinnah.edu",
        "base_url": "https://jinnah.edu",
    },
    # Example: To add another university, uncomment below:
    # {
    #     "name": "Another University",
    #     "sitemap_url": "https://example-university.edu/sitemap.xml",
    #     "allowed_domain": "example-university.edu",
    #     "base_url": "https://example-university.edu",
    # },
]


# =============================================================
# SCRAPING SETTINGS
# =============================================================
# These control how web pages are fetched and processed.

REQUEST_TIMEOUT = 10            # Seconds to wait before giving up on a page
MIN_TEXT_LENGTH = 50            # Pages shorter than this are skipped


# =============================================================
# CHUNKING SETTINGS
# =============================================================
# Text is split into "chunks" before being stored in the database.
# Chunk size affects how much context the AI sees per result.
# Overlap ensures no information is lost at chunk boundaries.

CHUNK_SIZE = 1500               # Max characters per chunk
CHUNK_OVERLAP = 250             # Characters of overlap between consecutive chunks
MIN_CHUNK_LENGTH = 50           # Chunks shorter than this are discarded


# =============================================================
# URL FILTERING
# =============================================================
# URLs matching these patterns are skipped during scraping.
# This prevents downloading images, PDFs, and other non-text files.

BLACKLIST_EXTENSIONS = [
    ".jpg", ".jpeg", ".png", ".gif", ".svg", ".webp",  # Images
    ".pdf", ".doc", ".docx", ".xls", ".xlsx",           # Documents
    ".zip", ".rar", ".tar", ".gz",                       # Archives
    ".mp3", ".mp4", ".avi", ".mov",                      # Media
]

BLACKLIST_URL_KEYWORDS = [
    "wp-content/uploads",   # WordPress media uploads
    "/gallery/",            # Photo galleries
    "/image/",              # Image directories
    "/photo/",              # Photo directories
]


# =============================================================
# HTML CLEANUP
# =============================================================
# These HTML elements are removed before extracting text.
# This keeps the scraped content clean and relevant.

UNWANTED_HTML_TAGS = [
    "script", "style", "nav", "footer", "header",
    "noscript", "aside", "sidebar", "share", "pagination",
]

UNWANTED_CSS_CLASSES = [
    "share", "pagination", "navigation", "breadcrumb",
    "related-posts", "post-navigation", "widget",
    "comments", "social-share", "meta", "tags",
]

UNWANTED_HTML_IDS = [
    "comments", "sidebar", "related-posts", "navigation",
]

# Text patterns removed from the final scraped content
UNWANTED_TEXT_PATTERNS = [
    "WhatsApp us",
    "Share:",
    "Previous post",
    "Next post",
    "You may also like",
    "Read More",
    "Home ",
    "Archives - Muhammad Ali Jinnah University",
    "- Muhammad Ali Jinnah University",
]


# =============================================================
# EMBEDDING & VECTOR DATABASE
# =============================================================
# The embedding model converts text into numbers (vectors).
# ChromaDB stores these vectors for fast similarity search.

EMBEDDING_MODEL = "all-MiniLM-L6-v2"   # Lightweight, fast, 384 dimensions
EMBEDDING_DIMENSION = 384               # Output size of the embedding model
CHROMA_DB_PATH = "./chroma_db"          # Where ChromaDB stores its files
COLLECTION_NAME = "university_chunks"   # Name of the vector collection
BATCH_SIZE = 100                        # Chunks processed at a time during build


# =============================================================
# LLM (LARGE LANGUAGE MODEL) SETTINGS
# =============================================================
# We now run Llama 3.2:3b locally through the Ollama daemon.
# Start the daemon with `ollama serve` (or the Ollama tray app on Windows).
# Pull the model once with: `ollama pull llama3.2:3b`

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
LLM_MODEL = os.getenv("OLLAMA_MODEL", "llama3.2:3b")
LLM_TEMPERATURE = 0.3                       # Lower = more focused answers (0-1)
LLM_MAX_TOKENS = 1000                       # Max length of generated answer (Ollama `num_predict`)
LLM_REQUEST_TIMEOUT = int(os.getenv("OLLAMA_TIMEOUT", "300"))  # seconds; 3B on CPU is slow (cold start ~30-60s + generation)
TOP_K_RESULTS = 3                            # Number of chunks to retrieve per question


# =============================================================
# SPEECH-TO-TEXT (replaces AssemblyAI)
# =============================================================
# Local Whisper via `faster-whisper`. The model is downloaded on first use
# and cached in ~/.cache/huggingface. `base` (~145MB) is a good speed/quality
# tradeoff on CPU; switch to `tiny` (~75MB) for faster, `small` (~470MB) for
# better accuracy.

WHISPER_MODEL = os.getenv("WHISPER_MODEL", "base")
WHISPER_DEVICE = os.getenv("WHISPER_DEVICE", "cpu")   # "cpu" or "cuda"
WHISPER_COMPUTE_TYPE = os.getenv("WHISPER_COMPUTE_TYPE", "int8")  # int8 = fastest on CPU


# =============================================================
# DATA FILE PATHS
# =============================================================
# Where scraped data is saved on disk.

DATA_DIR = "./data"
URLS_FILE = os.path.join(DATA_DIR, "urls.txt")
CLEAN_PAGES_FILE = os.path.join(DATA_DIR, "clean_pages.json")
CHUNKS_FILE = os.path.join(DATA_DIR, "chunks.json")
METADATA_FILE = os.path.join(CHROMA_DB_PATH, "metadata.json")


# =============================================================
# IMPORTANT KEYWORDS
# =============================================================
# Pages containing these keywords are kept even if they're short.
# This ensures we don't lose critical contact/admission info.

IMPORTANT_KEYWORDS = [
    "admission", "apply", "deadline", "fee", "contact",
    "email", "phone", "office", "registrar",
    "exam", "scholarship",
]
