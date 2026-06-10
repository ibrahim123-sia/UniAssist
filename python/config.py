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
# Chunks are built structurally (heading -> paragraph), not by raw
# character count. These act as soft bounds, not hard cuts.
#   - TARGET_CHUNK_SIZE: pack paragraphs into a chunk until we hit this.
#   - MAX_CHUNK_SIZE:    if a single section is bigger, split on paragraph
#                        boundaries. A paragraph is never cut in half.
#   - MIN_CHUNK_LENGTH:  chunks below this are merged with the next one
#                        (so a one-line section doesn't become its own
#                        useless chunk).
#
# Legacy CHUNK_SIZE / CHUNK_OVERLAP are kept as fallbacks for code that
# still references them, but the new pipeline uses the structural sizes.

TARGET_CHUNK_SIZE = 900         # Soft target: aim for chunks ~this size
MAX_CHUNK_SIZE = 1600           # Hard ceiling before forcing a paragraph split
MIN_CHUNK_LENGTH = 120          # Below this -> merged with neighbour
CHUNK_SIZE = TARGET_CHUNK_SIZE  # Back-compat alias
CHUNK_OVERLAP = 150             # Used only by legacy splitters


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
    "form", "iframe", "button",
]

UNWANTED_CSS_CLASSES = [
    "share", "pagination", "navigation", "breadcrumb",
    "related-posts", "post-navigation", "widget",
    "comments", "social-share", "meta", "tags",
    "recent-posts", "popular-posts", "post-meta",
    "author-bio", "author-info", "post-author",
    "site-footer", "site-header", "main-navigation",
    "menu", "sub-menu", "search-form", "sidebar",
]

UNWANTED_HTML_IDS = [
    "comments", "sidebar", "related-posts", "navigation",
    "secondary", "site-navigation", "masthead", "colophon",
    "search", "respond",
]

# WordPress-style URL fragments that mark "listing" pages (author archives,
# tag clouds, paginated post lists). Pages whose URL contains any of these
# are skipped — they're not real content, they're indexes of other content.
LISTING_URL_PATTERNS = [
    "/author/",
    "/tag/",
    "/category/",
    "/page/",
    "/feed",
    "/search/",
    "?s=",
    "/comments/",
    "/archive/",
    "/archives/",
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
# Two backends are supported and switched via USE_LOCAL_LLM:
#   true  -> local Ollama daemon (default, no cloud calls)
#   false -> Groq cloud API (requires GROQ_API_KEY)
#
# Local setup: `ollama serve` (or Ollama tray on Windows), then
# `ollama pull llama3.2:3b` once before booting this service.

USE_LOCAL_LLM = os.getenv("USE_LOCAL_LLM", "true").strip().lower() in ("1", "true", "yes", "on")

# Convenience presets: set OLLAMA_MODEL_SIZE=1b or 3b to pick a Llama 3.2 variant
# without typing the full model id. OLLAMA_MODEL still wins if explicitly set to
# something custom (e.g. mistral, qwen, etc.).
_OLLAMA_SIZE_PRESETS = {
    "1b": "llama3.2:1b",
    "3b": "llama3.2:3b",
}
_ollama_size = os.getenv("OLLAMA_MODEL_SIZE", "").strip().lower()

OLLAMA_HOST = os.getenv("OLLAMA_HOST", "http://localhost:11434")
OLLAMA_MODEL = (
    os.getenv("OLLAMA_MODEL")
    or _OLLAMA_SIZE_PRESETS.get(_ollama_size)
    or "llama3.2:3b"
)

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.3-70b-versatile")

# Active model name used by callers/logging — picks the backend's model.
LLM_MODEL = OLLAMA_MODEL if USE_LOCAL_LLM else GROQ_MODEL

LLM_TEMPERATURE = 0.3                       # Lower = more focused answers (0-1)
# Generation time on CPU scales linearly with output tokens; 400 covers typical
# answers (~150-300 tokens) without forcing the model to ramble to 1000.
LLM_MAX_TOKENS = 400                        # Max length of generated answer (Ollama `num_predict`)
LLM_REQUEST_TIMEOUT = int(os.getenv("OLLAMA_TIMEOUT", "300"))  # seconds; 3B on CPU is slow (cold start ~30-60s + generation)
# Pass to Ollama's `keep_alive` so the model stays in RAM between requests.
# Default is 5 min — every cold-after-idle request then pays the ~30-60s reload.
LLM_KEEP_ALIVE = os.getenv("OLLAMA_KEEP_ALIVE", "24h")
TOP_K_RESULTS = 4                            # Number of chunks to retrieve per question (smaller prompt = faster prefill)
KEYWORD_BOOST_TOP_K = 4                      # Extra chunks pulled by keyword fallback before merging


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
    "course", "program", "faculty", "curriculum", "syllabus", "department", "subject", "outline",
    "bs", "ms", "phd", "cs", "se", "ee", "bba", "mba"
]
