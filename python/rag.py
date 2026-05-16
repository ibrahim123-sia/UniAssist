"""
========================================================
RAG.PY - Retrieval-Augmented Generation Pipeline
========================================================

Pipeline:
  Question -> Vector Search -> Relevant Chunks -> LLM Prompt -> Answer

LLM backend: local Ollama daemon running `llama3.2:3b`.
Start Ollama from the tray app (Windows) or `ollama serve` and run
`ollama pull llama3.2:3b` once before booting this service.
"""

import re

import ollama

import config
import database


# =============================================================
# PROMPT CREATION
# =============================================================

LANGUAGE_INSTRUCTION = {
    "en": "Respond in clear, natural English.",
    "roman_urdu": (
        "The student wrote in Roman Urdu (Urdu typed using English letters). "
        "Respond in Roman Urdu using the same casual romanized style. "
        "Do NOT use the Urdu script."
    ),
    "mixed": (
        "The student mixed English and Roman Urdu. Reply in the same mixed "
        "style, keeping Roman Urdu phrases in Roman letters."
    ),
}


def create_prompt(question, relevant_chunks, language="en"):
    """Build the RAG prompt with optional language directive."""
    context = "\n\n---\n\n".join(relevant_chunks)
    lang_line = LANGUAGE_INSTRUCTION.get(language, LANGUAGE_INSTRUCTION["en"])

    prompt = f"""You are a helpful assistant for Muhammad Ali Jinnah University (MAJU).
Your task is to answer student questions using ONLY the provided context from the university website.
If the context doesn't contain the answer, say "I don't have information about that in my database."

CONTEXT FROM UNIVERSITY WEBSITE:
{context}

STUDENT'S QUESTION: {question}

INSTRUCTIONS:
1. {lang_line}
2. Answer clearly and concisely
3. Use ONLY information from the context above
4. DO NOT mention sources or citations in your answer
5. DO NOT include any numbers in brackets like [1] or [2]
6. DO NOT add a sources section at the end
7. Provide a clean, natural answer as if you're a university representative
8. If the context has contact info (emails, phones), include them naturally
9. If the context has fees or numbers, be precise

ANSWER:"""

    return prompt


# =============================================================
# LLM INTEGRATION (Ollama)
# =============================================================

_ollama_client = None


def _get_ollama_client():
    global _ollama_client
    if _ollama_client is None:
        _ollama_client = ollama.Client(host=config.OLLAMA_HOST, timeout=config.LLM_REQUEST_TIMEOUT)
    return _ollama_client


def get_llm_response(prompt, language="en"):
    """Send a prompt to the local Ollama daemon and return the assistant text."""
    client = _get_ollama_client()
    system_msg = (
        "You are a helpful university assistant. "
        "Provide answers without citations or source references. "
        + LANGUAGE_INSTRUCTION.get(language, LANGUAGE_INSTRUCTION["en"])
    )

    try:
        response = client.chat(
            model=config.LLM_MODEL,
            messages=[
                {"role": "system", "content": system_msg},
                {"role": "user", "content": prompt},
            ],
            options={
                "temperature": config.LLM_TEMPERATURE,
                "num_predict": config.LLM_MAX_TOKENS,
            },
        )
    except ollama.ResponseError as exc:
        if "not found" in str(exc).lower():
            return (
                f"Error: model `{config.LLM_MODEL}` is not installed in Ollama. "
                f"Run: `ollama pull {config.LLM_MODEL}`"
            )
        return f"Error from Ollama: {exc}"
    except Exception as exc:
        return (
            f"Error: cannot reach Ollama at {config.OLLAMA_HOST}. "
            f"Is the daemon running? ({exc})"
        )

    return (response.get("message") or {}).get("content", "")


def clean_answer(answer):
    """Strip citation markers + trailing 'Sources:' blocks that sometimes slip through."""
    answer = re.sub(r"\[\d+\]", "", answer)
    answer = re.sub(r"(?i)(sources?:.*?)(?=\n\n|\Z)", "", answer, flags=re.DOTALL)
    answer = re.sub(
        r"(?i)\n\n(?:📎\s*)?(?:source|references?):.*", "", answer, flags=re.DOTALL
    )
    return answer.strip()


# =============================================================
# MAIN PIPELINE
# =============================================================

_collection = None
_model = None


_llm_warmed = False


def _warm_llm():
    """Pre-load the model into Ollama's RAM so the first real /ask is fast.

    Ollama lazy-loads weights on the first request to a model, which can take
    30-60s for a 3B on CPU. Calling once at boot trades startup time for
    predictable per-request latency.
    """
    global _llm_warmed
    if _llm_warmed:
        return
    try:
        client = _get_ollama_client()
        client.chat(
            model=config.LLM_MODEL,
            messages=[{"role": "user", "content": "ok"}],
            options={"num_predict": 1, "temperature": 0.0},
        )
        _llm_warmed = True
        print(f"  LLM warmed: {config.LLM_MODEL}")
    except Exception as exc:
        print(f"  LLM warmup skipped: {exc}")


def _initialize():
    global _collection, _model
    if _collection is None:
        print("Initializing RAG system...")
        client = database.get_chroma_client()
        _collection = database.get_collection(client)
        print(f"  Database loaded: {_collection.count()} documents")
    if _model is None:
        _model = database.get_embedding_model()
        print(f"  Embedding model loaded: {config.EMBEDDING_MODEL}")
    print(f"  LLM: {config.LLM_MODEL} via {config.OLLAMA_HOST}")
    _warm_llm()


def ask(question, language="en"):
    """Run the full RAG pipeline for a student question.

    `language` should be one of "en", "roman_urdu", "mixed" — it controls the
    language of the generated answer. The retrieval step is language-agnostic
    (English embeddings handle Roman-Urdu queries acceptably for our corpus).
    """
    _initialize()

    chunks, _sources, _scores = database.search(
        question=question,
        collection=_collection,
        model=_model,
        top_k=config.TOP_K_RESULTS,
    )

    if not chunks:
        if language == "roman_urdu":
            return "Mujhe iss baare mein database mein koi information nahi mili."
        return "I don't have information about that in my database."

    prompt = create_prompt(question, chunks, language=language)
    answer = get_llm_response(prompt, language=language)
    return clean_answer(answer)
