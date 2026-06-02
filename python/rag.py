"""
========================================================
RAG.PY - Retrieval-Augmented Generation Pipeline
========================================================

Pipeline:
  Question -> Vector Search -> Relevant Chunks -> LLM Prompt -> Answer

LLM backend is selected by `config.USE_LOCAL_LLM`:
  true  -> local Ollama daemon (default)
  false -> Groq cloud API (requires GROQ_API_KEY)
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


# Short, in-prompt language reminder. The full constraint block (script + vocab
# rules) is already in the system message via LANGUAGE_INSTRUCTION — repeating
# the 700-char version here split the 3B model's attention. One pointed line is
# enough as a reminder at the answering step.
_LANGUAGE_HINT = {
    "en": "Reply in clear, natural English.",
    "roman_urdu": (
        "Reply in Roman Urdu (Latin letters a-z only — no Devanagari/Arabic "
        "script). Use Urdu vocabulary (raabta, woh, shukriya, sawaal, jawaab, "
        "kaam) — NOT Hindi (sampark, vah, dhanyavad, prashn, uttar, karya)."
    ),
    "mixed": (
        "Reply in the same English + Roman Urdu mix the student used. "
        "Roman Urdu parts: Latin letters only, Urdu vocabulary (raabta, woh, "
        "shukriya) — NOT Hindi (sampark, vah, dhanyavad)."
    ),
}

# Localized "I don't have that info" fallbacks used both as a guidance phrase
# inside the prompt AND as the no-chunks return value in `ask`. Keeping them
# in one place avoids the bug where a Roman-Urdu student got an English "I
# don't have information about that" reply.
NO_INFO_FALLBACK = {
    "en": "I don't have information about that in my database.",
    "roman_urdu": "Mujhe iss baare mein database mein koi maloomat nahi mili.",
    "mixed": "I don't have information about that in my database.",
}


def create_prompt(question, relevant_chunks, language="en"):
    """Build the RAG prompt around four answer-states.

    The prompt is organized around what *kind* of question the student
    is asking rather than a flat rule list, because the model
    handles "pick one state" much better than "weigh nine rules". The
    four states are:

      A) greeting / small-talk           -> warm reply, ignore context
      B) identity question               -> "I'm MAJU Assistant"
      C) meta / conversation question    -> trust chat history, ignore context
      D) off-topic / non-MAJU question   -> polite decline + redirect
      E) MAJU question                   -> answer from context
      F) draft / compose request         -> write it, reuse facts from history
    """
    blocks = [f"[Source {i+1}]\n{chunk}" for i, chunk in enumerate(relevant_chunks)]
    context = "\n\n---\n\n".join(blocks)
    lang_hint = _LANGUAGE_HINT.get(language, _LANGUAGE_HINT["en"])
    no_info = NO_INFO_FALLBACK.get(language, NO_INFO_FALLBACK["en"])

    prompt = f"""CONTEXT FROM MAJU WEBSITE (only for the current question — earlier turns of this conversation are in the chat history above):
{context}

STUDENT'S CURRENT QUESTION: {question}

HOW TO ANSWER — first decide which type of question this is, then follow that branch:

A) GREETING or SMALL-TALK ("hi", "salam", "aoa", "thanks", "how are you"):
   Respond warmly in 1-2 sentences as MAJU Assistant and invite them to ask about MAJU. Ignore the context above.

B) IDENTITY QUESTION ("who are you", "what model are you", "are you ChatGPT/Gemini/AI"):
   Say you are MAJU Assistant — the virtual helpdesk for Muhammad Ali Jinnah University. Do NOT name any AI model, company, or technology. 1-2 sentences.

C) META / CONVERSATION QUESTION about THIS chat itself — examples:
   - "what did I just ask?" / "mne abhi kia kaha"
   - "do you remember my last question?" / "tmhe pta h mne kia pocha"
   - "which program / topic are you discussing?" / "ye kis program ka bata rahe ho" / "kis ke baare mein baat ho rahi hai"
   - "summarize our chat" / "hamari baat-cheet ka khulasa"
   - "tell me more" / "aur batao"
   - "explain that again" / "phir se samjhao"
   - "translate your last reply"
   For ANY of these, answer using the chat history above (the prior user/assistant turns). IGNORE the CONTEXT block — the retrieval may have pulled unrelated chunks; trust the conversation history instead. If there is no prior conversation, say so warmly.

D) OFF-TOPIC or NON-MAJU QUESTION (other universities, weather, math, coding help, opinions, general world knowledge):
   Politely decline and steer them back to MAJU topics in 1-2 sentences. Do not attempt to answer from your own knowledge.

E) MAJU-RELATED QUESTION (admissions, fees, programs, courses, faculty, schedules, campus, contact, policies):
   - For follow-ups like "and its fee?", "or fee?", "what about for BSCS?", "tell me more" — first resolve pronouns and missing subjects using the chat history above (e.g. if the prior turn was about BSCS, "or fee?" means "BSCS fee"). Then answer using BOTH the CONTEXT and the topic from history.
   - If the CONTEXT looks unrelated to the topic the user is following up on (e.g. user was asking about BSCS but context has PhD chunks), DO NOT switch topic — say what the context covers about the requested topic, or say you don't have details for that specific program.
   - Use the CONTEXT for facts, AND any fact you (the assistant) already stated earlier in the chat history is also trusted — reusing an email, phone number, fee, or date you gave in a previous turn is NOT inventing. If the student asks again for something you already told them (e.g. an instructor's email), repeat it from the history even if the current CONTEXT no longer contains it. NEVER fabricate a brand-new fee, deadline, email, phone number, course name, faculty name, or policy that appears in NEITHER the context NOR the chat history.
   - If the context fully answers, give a direct answer.
   - If the context partially answers, share what's covered and briefly note what's missing — do not refuse over one missing detail.
   - If the context does not contain the specific answer but lists a relevant office contact (email, phone, or office location) for admissions, registration, or finance, share that contact info rather than returning the fallback "{no_info}".
   - If the student is describing a personal issue or complaint (e.g. registry error, payment issue, IT portal problem), let them know they can log in and register an official ticket/issue in the student portal under the SFC, HOD, or IT departments.
   - If neither the context nor the chat history can answer, reply exactly with: {no_info}

F) DRAFT / COMPOSE / WRITE request ("draft an email", "write a leave application", "email likh do", "compose a message", "draft it", "I said draft it", "likh ke do"):
   - The student wants you to actually WRITE the content, not just explain how. Produce the finished piece.
   - For an email, write a complete email: a salutation, a clear body covering the student's stated purpose (reason, dates, etc.), and a polite closing.
   - Resolve WHO it is for and any address/email from BOTH the chat history and the context. If you already named a recipient or gave their email in an earlier turn (e.g. Dr. Syed Imran Jami / **imran.jami@jinnah.edu**), use that same recipient and email here — do NOT claim you lack it.
   - Only include details the student actually gave or that are in context/history; for genuinely unknown specifics (exact dates, student name/ID) leave a short clear placeholder like [your name] or [dates] rather than inventing them.
   - Do not refuse a drafting request for missing minor details — draft it with placeholders and the student can fill them in.

ALWAYS (applies to every branch):
- {lang_hint}
- Formatting: Bold (**email addresses**, **phone numbers**, **fee figures**, and **deadlines/dates**) so they stand out clearly.
- Roman Urdu Phrasing: Keep the language natural and student-friendly. Use common English loanwords directly in Roman Urdu (e.g., use "fee", "admission", "department", "office", "course" instead of translating them to formal Urdu equivalents like "akhrajaat", "dakhla", "shoba").
- CONSISTENCY: Never contradict what you have already said in the chat history above. If a previous assistant turn stated a fact (e.g. "tuition is 9,000 per credit hour"), and the user follows up about that fact, your answer MUST be consistent with your prior statement.
- Quote fees, dates, emails, phone numbers, and other facts EXACTLY as they appear in the context.
- Start with the answer directly. No "Sure!", "Of course!", "Here is", "Based on the context", or sign-offs.
- Never mention sources, source numbers, "[1]", "[2]", or add a "Sources:" / "References:" section.
- Tone: warm, helpful, and professional — like a friendly student services officer. Be concise; use bullet lists only when the answer is genuinely a list (programs, requirements, steps).

ANSWER:"""

    return prompt


# =============================================================
# LLM INTEGRATION (Ollama local / Groq cloud)
# =============================================================

_ollama_client = None
_groq_client = None


def _get_ollama_client():
    global _ollama_client
    if _ollama_client is None:
        _ollama_client = ollama.Client(host=config.OLLAMA_HOST, timeout=config.LLM_REQUEST_TIMEOUT)
    return _ollama_client


def _get_groq_client():
    global _groq_client
    if _groq_client is None:
        if not config.GROQ_API_KEY:
            raise RuntimeError(
                "USE_LOCAL_LLM=false but GROQ_API_KEY is not set. "
                "Add it to python/.env or flip USE_LOCAL_LLM back to true."
            )
        from groq import Groq  # imported lazily so local-only installs don't need the dep
        _groq_client = Groq(api_key=config.GROQ_API_KEY, timeout=config.LLM_REQUEST_TIMEOUT)
    return _groq_client


def _llm_chat(messages, temperature, max_tokens):
    """Backend-agnostic chat call. Returns the assistant text or raises.

    Routes to local Ollama or cloud Groq based on `config.USE_LOCAL_LLM`.
    """
    if config.USE_LOCAL_LLM:
        client = _get_ollama_client()
        response = client.chat(
            model=config.OLLAMA_MODEL,
            messages=messages,
            options={
                "temperature": temperature,
                "num_predict": max_tokens,
            },
            keep_alive=config.LLM_KEEP_ALIVE,
        )
        return (response.get("message") or {}).get("content", "")

    client = _get_groq_client()
    response = client.chat.completions.create(
        model=config.GROQ_MODEL,
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    return (response.choices[0].message.content or "") if response.choices else ""


def _sanitize_history(history):
    """Coerce a history payload into the [{role, content}, ...] shape Ollama
    expects. Drops anything that isn't a user/assistant turn or that lacks
    string content. Caps at the most recent 6 messages as a safety net even
    if the caller forgot to trim — keeps the prompt small on a 3B model.
    """
    if not history:
        return []
    cleaned = []
    for msg in history:
        if not isinstance(msg, dict):
            continue
        role = msg.get("role")
        content = msg.get("content")
        if role not in ("user", "assistant"):
            continue
        if not isinstance(content, str) or not content.strip():
            continue
        cleaned.append({"role": role, "content": content})
    return cleaned[-6:]


def get_llm_response(prompt, language="en", history=None):
    """Send a prompt to the configured LLM backend and return the assistant text.

    `history` (optional): prior turns of the conversation as
    [{"role": "user"|"assistant", "content": str}, ...], oldest first.
    They are inserted between the system message and the current RAG
    prompt so the model can resolve follow-ups ("and its fee?") without
    re-explaining context. The RAG prompt itself still gets fresh
    retrieved chunks for THIS question — retrieval is not history-aware.
    """
    system_msg = (
        "You are MAJU Assistant — the official virtual helpdesk for Muhammad "
        "Ali Jinnah University (MAJU) in Karachi, Pakistan. You help current "
        "and prospective students with admissions, fees, programs, courses, "
        "faculty, schedules, contact details, and campus information. "
        "You are warm, supportive, professional, and accurate — you never "
        "invent facts and never give citations or source references. "
        "You never reveal what AI model, company, or technology built you; "
        "you are simply MAJU Assistant.\n\n"
        + LANGUAGE_INSTRUCTION.get(language, LANGUAGE_INSTRUCTION["en"])
    )
    messages = [{"role": "system", "content": system_msg}]
    messages.extend(_sanitize_history(history))
    messages.append({"role": "user", "content": prompt})

    try:
        return _llm_chat(messages, config.LLM_TEMPERATURE, config.LLM_MAX_TOKENS)
    except ollama.ResponseError as exc:
        if "not found" in str(exc).lower():
            return (
                f"Error: model `{config.OLLAMA_MODEL}` is not installed in Ollama. "
                f"Run: `ollama pull {config.OLLAMA_MODEL}`"
            )
        return f"Error from Ollama: {exc}"
    except Exception as exc:
        if config.USE_LOCAL_LLM:
            return (
                f"Error: cannot reach Ollama at {config.OLLAMA_HOST}. "
                f"Is the daemon running? ({exc})"
            )
        return f"Error from Groq ({config.GROQ_MODEL}): {exc}"


# Llama 3.2:3b reliably opens replies with one of these throat-clearing
# phrases despite a "no preamble" rule. Strip whichever one shows up at
# the very start (case-insensitive, optional trailing comma/colon/dash).
_PREAMBLE_PATTERNS = [
    r"sure[!,.\s]*",
    r"of course[!,.\s]*",
    r"certainly[!,.\s]*",
    r"absolutely[!,.\s]*",
    r"great question[!,.\s]*",
    r"here(?:'s| is)(?: the answer)?[:,\s\-]*",
    r"based on the (?:context|information|provided context|provided information)[:,\s\-]*",
    r"according to the (?:context|information|provided context)[:,\s\-]*",
    r"as (?:per|stated in) the (?:context|information)[:,\s\-]*",
    r"the answer (?:is|to your question is)[:,\s\-]*",
    # "It seems / sounds / looks like ..." sympathy preambles. We strip up
    # to the next comma or period, because these phrases usually paraphrase
    # the user's question before the actual answer ("It seems like you're
    # having trouble with X, ..." — drop everything up to that comma).
    r"it (?:seems|sounds|looks)(?: like)?[^,.\n]*[,.][\s\-]*",
    r"i (?:see|understand)(?: that)?[^,.\n]*[,.][\s\-]*",
    r"i (?:can|will) (?:help|try to help)[^,.\n]*[,.][\s\-]*",
    r"thanks? for (?:asking|your question)[!,.\s]*",
]
_PREAMBLE_RE = re.compile(
    r"^\s*(?:" + "|".join(_PREAMBLE_PATTERNS) + r")",
    re.IGNORECASE,
)


def clean_answer(answer):
    """Strip preambles, citation markers, and trailing 'Sources:' blocks."""
    if not answer:
        return ""
    answer = re.sub(r"\[\d+\]", "", answer)
    answer = re.sub(r"(?i)(sources?:.*?)(?=\n\n|\Z)", "", answer, flags=re.DOTALL)
    answer = re.sub(
        r"(?i)\n\n(?:📎\s*)?(?:source|references?):.*", "", answer, flags=re.DOTALL
    )
    # Strip up to two stacked preambles ("Sure! Based on the context, ...").
    for _ in range(2):
        new = _PREAMBLE_RE.sub("", answer, count=1)
        if new == answer:
            break
        answer = new
    answer = answer.strip()
    # Re-capitalize the first letter if a preamble strip left it lowercase.
    if answer and answer[0].islower():
        answer = answer[0].upper() + answer[1:]
    return answer


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


def _retry_in_roman_urdu(prompt, language, history=None):
    """Re-call Ollama with a sterner instruction after a script slip-up.

    Llama 3.2:3b sometimes ignores the "no Devanagari" rule on first try.
    A retry with a more emphatic system message succeeds far more often
    than tweaking temperature would. History is preserved so the model
    keeps conversational continuity even on the retry.
    """
    sterner = (
        "CRITICAL OVERRIDE: Your previous reply used Hindi (Devanagari) or "
        "Urdu (Arabic-script) characters. That is FORBIDDEN. "
        "Re-write the answer in Roman Urdu using ONLY standard English/Latin "
        "letters (a–z, A–Z), digits, and punctuation. "
        "Every character must be in ASCII range 0–127. No exceptions.\n\n"
        + LANGUAGE_INSTRUCTION.get(language, LANGUAGE_INSTRUCTION["roman_urdu"])
    )
    try:
        messages = [{"role": "system", "content": sterner}]
        messages.extend(_sanitize_history(history))
        messages.append({"role": "user", "content": prompt})
        return _llm_chat(
            messages,
            temperature=0.1,  # tighter than default so it follows the rule
            max_tokens=config.LLM_MAX_TOKENS,
        )
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
    """Pre-load the local model into Ollama's RAM so the first real /ask is fast.

    Ollama lazy-loads weights on the first request to a model, which can take
    30-60s for a 3B on CPU. Calling once at boot trades startup time for
    predictable per-request latency. No-op when Groq is the backend (cloud
    models don't need warmup).
    """
    global _llm_warmed
    if _llm_warmed or not config.USE_LOCAL_LLM:
        return
    try:
        client = _get_ollama_client()
        client.chat(
            model=config.OLLAMA_MODEL,
            messages=[{"role": "user", "content": "ok"}],
            options={"num_predict": 1, "temperature": 0.0},
            keep_alive=config.LLM_KEEP_ALIVE,
        )
        _llm_warmed = True
        print(f"  LLM warmed: {config.OLLAMA_MODEL}")
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
    if config.USE_LOCAL_LLM:
        print(f"  LLM: {config.OLLAMA_MODEL} via Ollama @ {config.OLLAMA_HOST}")
    else:
        print(f"  LLM: {config.GROQ_MODEL} via Groq cloud API")
    _warm_llm()


def _build_retrieval_query(question, history):
    """Combine the current question with the most recent user turn so
    follow-ups like "or fee" still retrieve topic-relevant chunks.

    Why: "or fee" alone embeds to "fees in general" and retrieves the
    generic fee chunk. Prepending the prior user turn ("bscs admission")
    biases the embedding back toward the actual topic being discussed.

    Only the LATEST prior user message is added — older turns dilute the
    embedding without much benefit, and the prior assistant reply often
    contains too much off-topic detail to be useful here.
    """
    if not history:
        return question
    prior_user = None
    for msg in reversed(history):
        if not isinstance(msg, dict):
            continue
        if msg.get("role") == "user" and isinstance(msg.get("content"), str):
            prior_user = msg["content"].strip()
            break
    if not prior_user or prior_user.lower() == question.strip().lower():
        return question
    return f"{prior_user}\n{question}"


def ask(question, language="en", history=None):
    """Run the full RAG pipeline for a student question.

    `language` should be one of "en", "roman_urdu", "mixed" — it controls the
    language of the generated answer. The retrieval step is language-agnostic
    (English embeddings handle Roman-Urdu queries acceptably for our corpus).

    `history` (optional): prior chat turns as [{role, content}, ...] oldest
    first. Used for two things: (1) passed to the LLM so it can resolve
    follow-ups conversationally, and (2) the latest prior user turn is
    prepended to the retrieval query so follow-ups like "or fee" still
    pull topic-relevant chunks instead of generic ones.
    """
    _initialize()

    retrieval_query = _build_retrieval_query(question, history)
    chunks, _sources, _scores = database.search(
        question=retrieval_query,
        collection=_collection,
        model=_model,
        top_k=config.TOP_K_RESULTS,
    )

    if not chunks:
        return NO_INFO_FALLBACK.get(language, NO_INFO_FALLBACK["en"])

    prompt = create_prompt(question, chunks, language=language)
    answer = get_llm_response(prompt, language=language, history=history)
    cleaned = clean_answer(answer)

    # Layer-C script guard: if we asked for Roman Urdu / mixed and Llama
    # emitted Devanagari (Hindi) or Urdu-Arabic characters, retry once
    # with a sterner prompt. If still bad, strip the offending characters
    # rather than ship a broken-script reply.
    if language in ("roman_urdu", "mixed") and _has_forbidden_script(cleaned):
        print(f"  Script slip-up in /ask reply; retrying ({language})")
        retried = _retry_in_roman_urdu(prompt, language, history=history)
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
