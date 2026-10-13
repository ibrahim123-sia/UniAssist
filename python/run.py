"""
========================================================
RUN.PY - CLI Entry Point for All Pipeline Commands
========================================================

This is the single command-line interface for the entire system.
Instead of running different Python files, you run everything
through this one file.

COMMANDS:
  python run.py scrape      Run the full scraping pipeline
  python run.py rechunk     Re-chunk existing data (after changing config)
  python run.py build       Build the vector database from chunks
  python run.py server      Start the FastAPI server
  python run.py ask "..."   Ask a single question (for testing)
  python run.py test        Run sample test questions

TYPICAL WORKFLOW (first time setup):
  1. python run.py scrape   (scrape all websites)
  2. python run.py build    (create the vector database)
  3. python run.py server   (start the API server)

ADDING A NEW WEBSITE:
  1. Edit config.py → add entry to WEBSITES list
  2. python run.py scrape
  3. python run.py build
"""

import sys            # For parsing command line arguments and managing process exit codes

# Windows consoles (cp1252) crash on printing Urdu text / emoji from scraped
# pages or provider errors; escape what the console can't encode instead.
for _stream in (sys.stdout, sys.stderr):
    try:
        _stream.reconfigure(errors="backslashreplace")
    except (AttributeError, ValueError, OSError):
        pass



def print_help():
    """Print available commands and usage examples."""
    print("=" * 60)
    print("UNIVERSITY RAG PIPELINE - COMMAND LINE")
    print("=" * 60)
    print()
    print("Commands:")
    print("  scrape     Scrape all websites and create chunks (--force to accept a >50% shrink)")
    print("  rechunk    Re-chunk existing pages (no re-scraping; --force as above)")
    print("  build      Build the vector database from chunks")
    print("  server     Start the FastAPI server (port 8000)")
    print("  ask \"...\"  Ask a question (for testing)")
    print("  test       Run sample test questions")
    print()
    print("Examples:")
    print("  python run.py scrape")
    print("  python run.py build")
    print("  python run.py server")
    print("  python run.py ask \"What is the admission fee?\"")
    print()
    print("Typical workflow:")
    print("  1. python run.py scrape   (collect data)")
    print("  2. python run.py build    (create database)")
    print("  3. python run.py server   (start API)")


def cmd_scrape(force=False):
    """Run the full scraping pipeline."""
    from scraper import run_full_pipeline  # For executing the site scraper to fetch and process web content
    run_full_pipeline(force=force)


def cmd_rechunk(force=False):
    """Re-chunk existing data."""
    from scraper import run_rechunk  # For rebuilding text chunks without scraping the websites again
    run_rechunk(force=force)


def cmd_build():
    """Build the vector database."""
    from database import build_database  # For encoding text chunks to vectors and writing to ChromaDB
    build_database()


def cmd_server():
    """Start the FastAPI server."""
    import uvicorn  # For starting the ASGI server to host the FastAPI application
    # Import the app so uvicorn can serve it
    from api import app  # The FastAPI app instance configured with our routes
    print("Starting RAG API server on http://0.0.0.0:8000")
    uvicorn.run(app, host="0.0.0.0", port=8000)


def cmd_ask(question):
    """Ask a single question via the RAG pipeline."""
    import rag  # The RAG pipeline module for context retrieval and answering

    print(f"\nQuestion: {question}")
    print("-" * 60)
    try:
        answer = rag.ask(question)
    except rag.LLMUnavailableError as exc:
        # The API returns 503 for this; on the CLI just show why.
        answer = f"[LLM unavailable] {exc}"
    print(f"\nAnswer:\n{answer}")


def cmd_test():
    """Run a set of sample questions to test the system."""
    import rag  # The RAG pipeline module to query test questions


    test_questions = [
        "What is the fee structure for BS Computer Science?",
        "How can I contact the admissions office?",
        "What scholarships are available?",
        "Tell me about the Computer Science faculty",
        "What are the admission requirements?",
    ]

    print("=" * 60)
    print("RUNNING SAMPLE TESTS")
    print("=" * 60)

    for i, question in enumerate(test_questions, 1):
        print(f"\nTest {i}: {question}")
        print("-" * 60)
        try:
            answer = rag.ask(question)
        except rag.LLMUnavailableError as exc:
            answer = f"[LLM unavailable] {exc}"
        print(f"Answer:\n{answer}")
        print("=" * 60)


# =============================================================
# MAIN - Parse command and run
# =============================================================

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print_help()
        sys.exit(0)

    command = sys.argv[1].lower()

    # --force: accept a scrape/rechunk whose output is less than half of
    # what's already saved (otherwise it aborts without overwriting).
    force = "--force" in sys.argv[2:]

    if command == "scrape":
        cmd_scrape(force=force)
    elif command == "rechunk":
        cmd_rechunk(force=force)
    elif command == "build":
        cmd_build()
    elif command == "server":
        cmd_server()
    elif command == "ask":
        if len(sys.argv) < 3:
            print("Usage: python run.py ask \"your question here\"")
            sys.exit(1)
        question = " ".join(sys.argv[2:])
        cmd_ask(question)
    elif command == "test":
        cmd_test()
    else:
        print(f"Unknown command: '{command}'")
        print()
        print_help()
        sys.exit(1)
