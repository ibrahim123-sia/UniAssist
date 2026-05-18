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
    # Roman Urdu = Urdu typed with English letters. Llama 3.2:3b will happily
    # output Devanagari (Hindi script) if the prompt says "Urdu" without an
    # explicit script ban — Hindi/Urdu overlap heavily in its training data.
    # The block below is intentionally repetitive and shows BOTH bad scripts
    # alongside a good example so the constraint is unmissable.
    "roman_urdu": (
        "The student wrote in Roman Urdu (Urdu typed using English letters). "
        "You MUST reply in Roman Urdu using ONLY the English alphabet (Latin "
        "letters a-z, A-Z). "
        "STRICT RULES on the output script:\n"
        "- DO NOT use Hindi / Devanagari characters (e.g. कैसे, अच्छा, हैं, क्या, मैं).\n"
        "- DO NOT use Urdu / Arabic-script characters (e.g. کیسے, اچھا, ہیں, کیا).\n"
        "- Every single character of your answer must be standard English "
        "letters, digits, or punctuation — nothing outside basic ASCII.\n"
        "STRICT RULES on VOCABULARY — use Urdu words (Persian/Arabic-origin), "
        "NOT Hindi words (Sanskrit-origin). Roman Urdu is NOT the same as "
        "Roman Hindi. Common Hindi words to AVOID and their Urdu replacements:\n"
        "- 'sampark' (Hindi) -> use 'raabta' (e.g. 'raabta karne ke liye')\n"
        "- 'vah' / 'yah' (Hindi) -> use 'woh' / 'yeh'\n"
        "- 'dhanyavad' (Hindi) -> use 'shukriya'\n"
        "- 'kripya' (Hindi) -> use 'meherbani' or 'baraye meherbani'\n"
        "- 'prashn' (Hindi) -> use 'sawaal'\n"
        "- 'uttar' (Hindi) -> use 'jawaab'\n"
        "- 'samay' (Hindi) -> use 'waqt'\n"
        "- 'karya' (Hindi) -> use 'kaam'\n"
        "- 'vidyarthi' / 'chhatra' (Hindi) -> use 'talib-e-ilm' or just 'student'\n"
        "- 'adhyapak' (Hindi) -> use 'ustaad' or 'professor'\n"
        "- 'vishwavidyalaya' (Hindi) -> use 'university' or 'jamia'\n"
        "- 'pradhan' / 'mukhya' (Hindi) -> use 'sadar' or 'aham'\n"
        "- 'avashyak' (Hindi) -> use 'zaroori'\n"
        "- 'praapt' (Hindi) -> use 'haasil'\n"
        "- 'arambh' (Hindi) -> use 'shuru'\n"
        "- 'samapt' (Hindi) -> use 'khatam'\n"
        "GOOD example: 'Unse raabta karne ke liye unhein email karein. Woh "
        "professor hain aur unka kaam ahem hai.'\n"
        "BAD example (Hindi vocab — do NOT do this): 'Unse sampark karne ke "
        "liye email karein. Vah professor hain aur unka karya mukhya hai.'\n"
        "BAD example (wrong script — do NOT do this): 'आप कैसे हैं' or 'آپ کیسے ہیں'."
    ),
    "mixed": (
        "The student mixed English and Roman Urdu. Reply in the same mixed "
        "style — English where they used English, Roman Urdu where they used "
        "Roman Urdu. Roman Urdu phrases MUST stay in English/Latin letters. "
        "DO NOT use Hindi/Devanagari (e.g. कैसे). DO NOT use Urdu/Arabic "
        "script (e.g. کیسے). Use ONLY ASCII characters in the entire reply. "
        "For the Roman Urdu parts, use Urdu vocabulary (Persian/Arabic-origin), "
        "NOT Hindi/Sanskrit vocabulary. Examples: use 'raabta' not 'sampark', "
        "'woh' not 'vah', 'shukriya' not 'dhanyavad', 'sawaal' not 'prashn', "
        "'jawaab' not 'uttar', 'waqt' not 'samay', 'kaam' not 'karya', "
        "'zaroori' not 'avashyak', 'shuru' not 'arambh'."
    ),
}


def create_prompt(question, relevant_chunks, language="en"):
    """Build the RAG prompt with optional language directive.

    The context blocks are numbered so the LLM can mentally pivot between
    them, but we instruct it not to surface those numbers in the answer.
    The "partial info" clause is intentional: short of nothing-found, we
    want the model to *use what it has* rather than punt to "no info"
    when it sees a relevant-looking chunk that doesn't fully answer.
    """
    blocks = [f"[Source {i+1}]\n{chunk}" for i, chunk in enumerate(relevant_chunks)]
    context = "\n\n---\n\n".join(blocks)
    lang_line = LANGUAGE_INSTRUCTION.get(language, LANGUAGE_INSTRUCTION["en"])

    prompt = f"""You are a helpful assistant for Muhammad Ali Jinnah University (MAJU).
Answer the student's question using the context below.

CONTEXT FROM UNIVERSITY WEBSITE:
{context}

STUDENT'S QUESTION: {question}

INSTRUCTIONS:
1. {lang_line}
2. Answer clearly and concisely.
3. Base your answer on the context above. If only part of the question
   is covered, answer that part fully and briefly note what is not
   covered — DO NOT refuse to answer just because some detail is missing.
4. Only say "I don't have information about that" if the context is
   completely unrelated to the question.
5. DO NOT mention sources, source numbers, or citations like [1] or [2].
6. DO NOT add a "Sources:" or "References:" section at the end.
7. If the context has contact info (emails, phones), include it naturally.
8. If the context has fees or numbers, be precise.
9. Write as a university representative — natural, helpful, direct.

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


# Devanagari (Hindi) U+0900–U+097F + Arabic-script U+0600–U+06FF.
# If the LLM emits any of these while we're trying to deliver Roman Urdu,
# we treat it as a bad output and either retry or strip.
_FORBIDDEN_SCRIPT_RE = re.compile(r"[؀-ۿऀ-ॿ]")


def _has_forbidden_script(text):
    return bool(_FORBIDDEN_SCRIPT_RE.search(text or ""))


# Hindi (Sanskrit-origin) words that Llama 3.2:3b leaks into Roman Urdu
# replies, mapped to their Urdu (Persian/Arabic-origin) equivalents.
# Only words that are unambiguously Hindi-only and have a clean 1:1 Urdu
# replacement — anything genre-dependent (e.g. "naam") is left alone.
_HINDI_TO_URDU = {
    "sampark": "raabta",
    "vah": "woh",
    "yah": "yeh",
    "dhanyavad": "shukriya",
    "kripya": "meherbani se",
    "prashn": "sawaal",
    "uttar": "jawaab",
    "samay": "waqt",
    "karya": "kaam",
    "vidyarthi": "talib-e-ilm",
    "chhatra": "talib-e-ilm",
    "adhyapak": "ustaad",
    "vishwavidyalaya": "university",
    "pradhan": "sadar",
    "mukhya": "aham",
    "avashyak": "zaroori",
    "praapt": "haasil",
    "arambh": "shuru",
    "samapt": "khatam",
}

# Whole-word, case-insensitive, capitalization-preserving.
_HINDI_WORD_RE = re.compile(
    r"\b(" + "|".join(re.escape(w) for w in _HINDI_TO_URDU) + r")\b",
    re.IGNORECASE,
)


def _replace_hindi_words(text):
    """Swap Hindi-origin words for Urdu equivalents, preserving capitalization."""
    if not text:
        return text

    def _sub(match):
        original = match.group(0)
        replacement = _HINDI_TO_URDU[original.lower()]
        if original[0].isupper():
            return replacement[0].upper() + replacement[1:]
        return replacement

    return _HINDI_WORD_RE.sub(_sub, text)


def _retry_in_roman_urdu(prompt, language):
    """Re-call Ollama with a sterner instruction after a script slip-up.

    Llama 3.2:3b sometimes ignores the "no Devanagari" rule on first try.
    A retry with a more emphatic system message succeeds far more often
    than tweaking temperature would.
    """
    client = _get_ollama_client()
    sterner = (
        "CRITICAL OVERRIDE: Your previous reply used Hindi (Devanagari) or "
        "Urdu (Arabic-script) characters. That is FORBIDDEN. "
        "Re-write the answer in Roman Urdu using ONLY standard English/Latin "
        "letters (a–z, A–Z), digits, and punctuation. "
        "Every character must be in ASCII range 0–127. No exceptions.\n\n"
        + LANGUAGE_INSTRUCTION.get(language, LANGUAGE_INSTRUCTION["roman_urdu"])
    )
    try:
        response = client.chat(
            model=config.LLM_MODEL,
            messages=[
                {"role": "system", "content": sterner},
                {"role": "user", "content": prompt},
            ],
            options={
                "temperature": 0.1,  # tighter than default so it follows the rule
                "num_predict": config.LLM_MAX_TOKENS,
            },
        )
        return (response.get("message") or {}).get("content", "")
    except Exception as exc:
        print(f"  retry_in_roman_urdu failed: {exc}")
        return ""


def _strip_forbidden_script(text):
    """Last resort: remove any Devanagari/Arabic-script runs from the text.

    Better a slightly-truncated answer than one full of Hindi characters
    when the user explicitly typed Roman Urdu.
    """
    return _FORBIDDEN_SCRIPT_RE.sub("", text or "").strip()


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
    cleaned = clean_answer(answer)

    # Layer-C script guard: if we asked for Roman Urdu / mixed and Llama
    # emitted Devanagari (Hindi) or Urdu-Arabic characters, retry once
    # with a sterner prompt. If still bad, strip the offending characters
    # rather than ship a broken-script reply.
    if language in ("roman_urdu", "mixed") and _has_forbidden_script(cleaned):
        print(f"  Script slip-up in /ask reply; retrying ({language})")
        retried = _retry_in_roman_urdu(prompt, language)
        retried = clean_answer(retried)
        if retried and not _has_forbidden_script(retried):
            cleaned = retried
        else:
            # Retry also failed — strip the bad characters from whichever
            # response was longer so the user gets the most context possible.
            candidate = retried if len(retried or "") > len(cleaned or "") else cleaned
            cleaned = _strip_forbidden_script(candidate) or cleaned

    # Layer-D vocabulary guard: even with the right script, Llama 3.2:3b
    # often picks Sanskrit-origin Hindi words ("sampark", "vah", "karya")
    # over Persian/Arabic-origin Urdu ones ("raabta", "woh", "kaam").
    # We do a plain word-substitution pass — cheaper and more deterministic
    # than another retry round.
    if language in ("roman_urdu", "mixed"):
        cleaned = _replace_hindi_words(cleaned)

    return cleaned
