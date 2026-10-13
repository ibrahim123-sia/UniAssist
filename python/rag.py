"""
========================================================
RAG.PY - Retrieval-Augmented Generation Pipeline
========================================================

Pipeline:
  Question -> Vector Search -> Relevant Chunks -> LLM Prompt -> Answer

LLM backend is selected by `config.USE_LOCAL_LLM`:
  false -> cloud (default): the providers in CLOUD_LLM_ORDER, Groq first
           (GROQ_API_KEY, optional GROQ_API_KEY_2 failover) then Gemini
           (GEMINI_API_KEY); each call is capped by CLOUD_LLM_TIMEOUT
  true  -> local Ollama daemon (OLLAMA_HOST / OLLAMA_MODEL, OLLAMA_TIMEOUT)
"""

import re             # For regular expression operations in source matching and text cleanup
import threading      # Guards lazy one-time initialization against concurrent requests

import ollama         # The Ollama library for local LLM inference

import config         # Local application configuration and credentials settings
import database       # ChromaDB retrieval helper functions



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


def create_prompt(question, relevant_chunks, language="en", guest=False):
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
    # Guests have no "Register a complaint" button — they must log in first.
    complaint_hint = (
        'tell them in one sentence, in the reply language, that they can log in to the MAJU student portal and register a complaint with the right department from there'
        if guest else
        'tell them in one sentence, in the reply language, that they can tap "Register a complaint" below this message to send it to the right department (keep the button name "Register a complaint" in English)'
    )

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
   - If the student is describing a personal issue or complaint (e.g. registry error, payment issue, IT portal problem), {complaint_hint}.
   - If neither the context nor the chat history can answer, reply exactly with: {no_info}

F) DRAFT / COMPOSE / WRITE request ("draft an email", "write a leave application", "email likh do", "compose a message", "draft it", "I said draft it", "likh ke do"):
   - The student wants you to actually WRITE the content, not just explain how. Produce the finished piece.
   - For an email, write a complete email: a salutation, a clear body covering the student's stated purpose (reason, dates, etc.), and a polite closing.
   - Resolve WHO it is for and any address/email from BOTH the chat history and the context. If you already named a recipient or gave their email in an earlier turn (e.g. [recipient name] / **[recipient email]**), use that same recipient and email here — do NOT claim you lack it.
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

class LLMUnavailableError(RuntimeError):
    """Every configured LLM backend failed (or returned nothing usable).

    Raised instead of returning an error string, so provider error text can
    never be shown to a student as if it were an answer. The API maps this to
    HTTP 503 and Node shows its own friendly fallback; the underlying details
    are only logged server-side.
    """


_ollama_client = None
_groq_clients = {}  # api_key -> Groq client, so each key keeps its own connection
_client_lock = threading.Lock()


def _get_ollama_client():
    global _ollama_client
    if _ollama_client is None:
        with _client_lock:
            if _ollama_client is None:
                _ollama_client = ollama.Client(host=config.OLLAMA_HOST, timeout=config.LLM_REQUEST_TIMEOUT)
    return _ollama_client


def _get_groq_client(api_key):
    """Return a cached Groq client for the given API key (one per key)."""
    client = _groq_clients.get(api_key)
    if client is None:
        with _client_lock:
            client = _groq_clients.get(api_key)
            if client is None:
                from groq import Groq  # Groq client SDK for calling Groq cloud LLM API, imported lazily so local-only installs don't need the dependency

                client = Groq(api_key=api_key, timeout=config.CLOUD_LLM_TIMEOUT)
                _groq_clients[api_key] = client
    return client


def _is_rate_limit_error(exc):
    """Heuristic: did this Groq error come from hitting a rate / quota limit?

    We match on the SDK's status_code (429) when present, otherwise on the
    message text.
    """
    status = getattr(exc, "status_code", None) or getattr(exc, "code", None)
    if status == 429:
        return True
    msg = str(exc).lower()
    return any(s in msg for s in ("rate limit", "rate_limit", "429", "quota", "too many requests"))


def _should_rotate_groq_key(exc):
    """Is this a per-key failure that another Groq key could get past?

    Rotate on rate/quota limits (429), auth/permission problems with this
    key (401/403 — e.g. an expired or revoked key) and Groq-side 5xx errors.
    Anything else is a request problem that every key would hit identically:
    404 (model decommissioned / not available), 400 (bad parameter), 413/422,
    or a network failure — retrying it on the next key only doubles latency,
    so we fail straight through to the next provider instead.
    """
    status = getattr(exc, "status_code", None)
    if isinstance(status, int):
        return status in (401, 403, 429) or status >= 500
    return _is_rate_limit_error(exc)


def _llm_chat_gemini(messages, temperature, timeout=None):
    """Call Google Gemini OpenAI-compatible API via standard requests.
    Omit max_tokens to prevent the OpenAI proxy from truncating output.
    """
    if not config.GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not configured in environment.")

    import requests    # Standard library for sending HTTP requests to the Gemini API endpoint

    url = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
    headers = {
        "Authorization": f"Bearer {config.GEMINI_API_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": config.GEMINI_MODEL,
        "messages": messages,
        "temperature": temperature
    }

    response = requests.post(url, headers=headers, json=payload, timeout=timeout or config.CLOUD_LLM_TIMEOUT)
    if response.status_code == 200:
        res_json = response.json()
        try:
            content = res_json["choices"][0]["message"]["content"] or ""
        except (KeyError, IndexError, TypeError) as e:
            raise RuntimeError(f"Unexpected response structure from Gemini API: {res_json}") from e
        if not content.strip():
            # Safety blocks / max-token stops come back as 200 with no text.
            raise RuntimeError("Gemini returned empty content")
        return content
    else:
        raise RuntimeError(f"Gemini API returned status {response.status_code}: {response.text}")


def _groq_completion_kwargs(max_tokens):
    """Token-budget / reasoning parameters for the configured Groq model.

    gpt-oss models spend hidden reasoning tokens out of the same completion
    budget, so they get `reasoning_effort` plus a larger budget. Other models
    reject `reasoning_effort` with a 400, so it's only sent to gpt-oss.
    """
    if "gpt-oss" in config.GROQ_MODEL.lower():
        return {
            "max_completion_tokens": max(max_tokens, config.GROQ_MAX_COMPLETION_TOKENS),
            "reasoning_effort": config.GROQ_REASONING_EFFORT,
        }
    return {"max_completion_tokens": max_tokens}


def _llm_chat_groq(messages, temperature, max_tokens, timeout=None):
    """Call Groq, rolling over to the next API key when one is exhausted.

    `config.GROQ_API_KEYS` holds the keys in priority order (primary first,
    then keys from secondary accounts). We move to the next key only for
    per-key failures (see `_should_rotate_groq_key`); a bad model name or bad
    request raises immediately so the caller can fail over to the next
    provider in CLOUD_LLM_ORDER without burning every key on the same error.
    """
    keys = config.GROQ_API_KEYS
    if not keys:
        raise RuntimeError(
            "USE_LOCAL_LLM=false and Groq selected, but no GROQ_API_KEY is set. "
            "Add GROQ_API_KEY (and optionally GROQ_API_KEY_2) to python/.env."
        )

    errors = []
    for idx, api_key in enumerate(keys):
        try:
            client = _get_groq_client(api_key)
            response = client.chat.completions.create(
                model=config.GROQ_MODEL,
                messages=messages,
                temperature=temperature,
                timeout=timeout or config.CLOUD_LLM_TIMEOUT,
                **_groq_completion_kwargs(max_tokens),
            )
        except Exception as exc:
            status = getattr(exc, "status_code", None)
            if not _should_rotate_groq_key(exc):
                if status in (400, 404):
                    print(
                        f"  Groq rejected the request (HTTP {status}) — check GROQ_MODEL "
                        f"'{config.GROQ_MODEL}' is still available on this key. Not rotating keys."
                    )
                raise RuntimeError(f"Groq key#{idx + 1} failed (not retryable): {exc}") from exc
            reason = "rate-limited" if _is_rate_limit_error(exc) else f"failed (HTTP {status})"
            errors.append(f"key#{idx + 1}: {exc}")
            if idx < len(keys) - 1:
                print(f"  Groq key #{idx + 1} {reason}; rolling over to key #{idx + 2}...")
                continue
            # Last key — give up so the caller can try the next provider.
            raise RuntimeError(
                f"All {len(keys)} Groq key(s) failed. Errors: {'; '.join(errors)}"
            ) from exc

        content = (response.choices[0].message.content or "") if response.choices else ""
        if not content.strip():
            # e.g. a reasoning model that spent its whole budget thinking
            # (finish_reason "length"). Another key would do the same.
            finish = response.choices[0].finish_reason if response.choices else None
            raise RuntimeError(f"Groq returned empty content (finish_reason={finish})")
        if idx > 0:
            print(f"  Groq answered on key #{idx + 1} (primary key was unavailable).")
        return content


def _llm_chat(messages, temperature, max_tokens, timeout=None):
    """Backend-agnostic chat call. Returns non-empty assistant text or raises.

    `timeout` (seconds) caps each cloud provider request; default
    CLOUD_LLM_TIMEOUT. A caller with its own budget (listing extraction)
    passes what it has left so an abandoned call doesn't keep running.
    Ollama keeps its client-level OLLAMA_TIMEOUT (a cold local model is slow).

    Routes to local Ollama or cloud models based on `config.USE_LOCAL_LLM`.
    If USE_LOCAL_LLM is false, attempts to query cloud models using the preferred order
    defined in `config.CLOUD_LLM_ORDER`, failing over to secondary options if a provider fails.
    Raises LLMUnavailableError when nothing produced an answer.
    """
    if config.USE_LOCAL_LLM:
        try:
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
        except ollama.ResponseError as exc:
            if "not found" in str(exc).lower():
                print(f"  Ollama model `{config.OLLAMA_MODEL}` is not installed. "
                      f"Run: `ollama pull {config.OLLAMA_MODEL}`")
            raise LLMUnavailableError(f"Ollama error: {exc}") from exc
        except Exception as exc:
            print(f"  Cannot reach Ollama at {config.OLLAMA_HOST}. Is the daemon running?")
            raise LLMUnavailableError(f"Ollama unreachable: {exc}") from exc
        content = (response.get("message") or {}).get("content", "") or ""
        if not content.strip():
            raise LLMUnavailableError("Ollama returned empty content")
        return content

    errors = []
    for provider in config.CLOUD_LLM_ORDER:
        if provider == "gemini":
            try:
                print(f"  Attempting to call Gemini ({config.GEMINI_MODEL})...")
                return _llm_chat_gemini(messages, temperature, timeout=timeout)
            except Exception as exc:
                err_msg = f"Gemini call failed: {exc}"
                print(f"  Warning: {err_msg}")
                errors.append(err_msg)
        elif provider == "groq":
            try:
                print(f"  Attempting to call Groq ({config.GROQ_MODEL})...")
                return _llm_chat_groq(messages, temperature, max_tokens, timeout=timeout)
            except Exception as exc:
                err_msg = f"Groq call failed: {exc}"
                print(f"  Warning: {err_msg}")
                errors.append(err_msg)
        else:
            print(f"  Warning: Unknown provider '{provider}' in CLOUD_LLM_ORDER")

    raise LLMUnavailableError(f"All configured cloud LLM providers failed. Errors: {'; '.join(errors)}")


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

    Raises LLMUnavailableError if no backend produced an answer — callers
    must not turn that into answer text.
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
    except LLMUnavailableError:
        raise
    except Exception as exc:
        raise LLMUnavailableError(f"LLM call failed: {exc}") from exc


# Llama 3.2:3b reliably opens replies with one of these throat-clearing
# phrases despite a "no preamble" rule. Strip whichever one shows up at
# the very start (case-insensitive, optional trailing comma/colon/dash).
#
# Every literal word ends in \b so "Surely ..." or "Sureshot" isn't cut to
# "ly ..." / "shot". Clause-stripping patterns only end on a comma/period
# that is followed by whitespace (or end of text): "Rs 9,000" contains a
# comma, and stopping there used to leave the answer starting at "000**".
_CLAUSE_END = r"[^,.\n]*[,.](?:\s+|$)"
_PREAMBLE_PATTERNS = [
    r"sure\b[!,.\s]*",
    r"of course\b[!,.\s]*",
    r"certainly\b[!,.\s]*",
    r"absolutely\b[!,.\s]*",
    r"great question\b[!,.\s]*",
    r"here(?:'s| is)\b(?: the answer\b)?[:,\s\-]*",
    r"based on the (?:context|information|provided context|provided information)\b[:,\s\-]*",
    r"according to the (?:context|information|provided context)\b[:,\s\-]*",
    r"as (?:per|stated in) the (?:context|information)\b[:,\s\-]*",
    r"the answer (?:is|to your question is)\b[:,\s\-]*",
    # "It seems / sounds / looks like you ..." sympathy preambles that
    # paraphrase the user's question before the actual answer ("It sounds
    # like you're having trouble with X, ..."). Only when the clause is about
    # "you" — "It looks like the fee is Rs 9,000" IS the answer.
    r"it (?:seems|sounds|looks) like you(?:'re|'ve| are| have)?\b" + _CLAUSE_END,
    r"i (?:see|understand)(?: that)? (?:you|your)\b" + _CLAUSE_END,
    r"i (?:can|will) (?:help|try to help)\b" + _CLAUSE_END,
    r"thanks? for (?:asking|your question)\b[!,.\s]*",
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
    # A "Sources:" / "References:" block only counts when it starts a line.
    # The old unanchored pattern also matched inside words and phrases —
    # "Human Resources: hr@jinnah.edu" lost everything after "Re".
    answer = re.sub(
        r"(?ims)^[ \t]*(?:📎\s*)?(?:sources?|references?)\s*:.*?(?=\n\n|\Z)", "", answer
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


_init_lock = threading.Lock()


def get_embedding_model():
    """The process-wide SentenceTransformer, loaded once on first use.

    Shared with the admin endpoints in api.py so the ~90MB model isn't held
    in memory twice. Double-checked locking: requests run on FastAPI's
    threadpool, and two cold requests must not both load the model.
    """
    global _model
    if _model is None:
        with _init_lock:
            if _model is None:
                _model = database.get_embedding_model()
                print(f"  Embedding model loaded: {config.EMBEDDING_MODEL}")
    return _model


def _initialize():
    """Load the collection + embedding model once. Returns the collection.

    Callers use the returned handle rather than re-reading the `_collection`
    global, which `_reset_collection` may set to None from another thread.
    """
    global _collection
    collection = _collection
    if collection is None:
        with _init_lock:
            if _collection is None:
                print("Initializing RAG system...")
                client = database.get_chroma_client()
                # get_or_create: the KB legitimately starts empty (no
                # chroma_db folder at all) and is filled from the admin
                # panel; a plain get_collection made every /ask a 500 then.
                collection = database.get_or_create_collection(client)
                print(f"  Database loaded: {collection.count()} documents")
                if config.USE_LOCAL_LLM:
                    print(f"  LLM: {config.OLLAMA_MODEL} via Ollama @ {config.OLLAMA_HOST}")
                else:
                    print(f"  LLM: Cloud LLM failover order: {', '.join(config.CLOUD_LLM_ORDER)}")
                _collection = collection  # publish only once fully set up
            else:
                collection = _collection
    get_embedding_model()
    _warm_llm()
    return collection


def _reset_collection():
    """Drop the cached collection handle (e.g. after `run.py build` replaced it)."""
    global _collection
    with _init_lock:
        _collection = None
    database.clear_keyword_cache()


# Markers that signal a question is an ELLIPTICAL follow-up — it leans on the
# previous turn for its subject ("or fee?", "aur iska deadline?", "what about
# BSCS?"). For these, and ONLY these, we prepend the prior user turn to the
# retrieval query. A self-contained question like "Admission requirements?"
# carries its own subject and must NOT be prepended, otherwise the previous
# turn's topic ("what programs...") dominates the embedding and buries the
# chunks that actually answer it.
_ELLIPTICAL_PREFIXES = (
    "or ", "and ", "also ", "plus ", "what about", "how about", "whatabout",
    "aur ", "phir ", "tou ", "ab ",
)
# ("to " and "ya " are deliberately absent: "to apply for BSCS what do I
# need?" and "ya ..." openers are usually complete questions, and prepending
# the previous turn to them only diluted retrieval.)
# Back-reference pronouns that, when present, mean the subject lives in history.
_BACKREF_WORDS = {
    "it", "its", "it's", "they", "them", "their", "this", "that", "these",
    "those", "one", "same",
    # Roman-Urdu pronouns / referents
    "iska", "iski", "isko", "ispe", "uska", "uski", "usko", "uspe",
    "inka", "inki", "unka", "unki", "yeh", "ye", "woh", "wo",
}


def _is_elliptical_followup(question):
    """True if the question relies on the previous turn for its subject.

    Two signals: it opens with a connector ("or...", "aur...") OR it is short
    and contains only a back-reference pronoun as its noun ("its fee?",
    "uska deadline?"). A question that names its own topic noun
    ("admission requirements", "application deadlines") is self-contained
    and returns False.
    """
    q = (question or "").strip().lower()
    if not q:
        return False
    if q.startswith(_ELLIPTICAL_PREFIXES):
        return True
    words = re.findall(r"[a-z']+", q)
    # Short question whose only "subject-ish" words are back-references.
    if len(words) <= 4 and any(w in _BACKREF_WORDS for w in words):
        return True
    return False


def _build_retrieval_query(question, history):
    """For elliptical follow-ups, prepend the latest prior user turn so the
    retrieval embedding regains the subject that lives in the conversation.

    Why: "or fee" alone embeds to "fees in general" and retrieves the generic
    fee chunk. Prepending the prior user turn ("bscs admission") biases the
    embedding back toward the actual topic. But this is done ONLY for
    elliptical follow-ups — a self-contained question keeps its own subject,
    so prepending would only dilute it.

    Only the LATEST prior user message is added — older turns dilute the
    embedding without much benefit, and the prior assistant reply often
    contains too much off-topic detail to be useful here.
    """
    if not history or not _is_elliptical_followup(question):
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


def _merge_search_results(result_sets, top_k):
    """Merge several (chunks, sources, scores, ids) tuples into one ranked list.

    Dedup key is the Chroma chunk id (same convention as `database.search`;
    the old 120-char text prefix merged distinct chunks that open with the
    same page title + heading). When a chunk appears in more than one result
    set we keep its HIGHEST score. Used to combine a standalone-question
    retrieval with the history-prepended one so neither view's relevant
    chunks are lost.
    """
    merged = {}
    for chunks, sources, scores, ids in result_sets:
        for c, m, s, cid in zip(chunks, sources, scores, ids):
            key = cid or c
            existing = merged.get(key)
            if existing is None or s > existing["score"]:
                merged[key] = {"text": c, "meta": m, "score": s}
    ranked = sorted(merged.values(), key=lambda r: r["score"], reverse=True)[:top_k]
    return (
        [r["text"] for r in ranked],
        [r["meta"] for r in ranked],
        [r["score"] for r in ranked],
    )


def _retrieve(question, history, collection):
    """Hybrid retrieval for the question (+ history-prepended variant) over
    `collection` (the handle `_initialize` returned)."""
    # Retrieve for the standalone question FIRST — a complete question like
    # "Admission requirements?" must not be diluted by the previous turn.
    # Then, if this looks like a follow-up, ALSO retrieve with the prior user
    # turn prepended (helps elliptical follow-ups like "or fee?") and merge.
    # Merging keeps the best of both views instead of letting the prepended
    # query bury the chunks that actually answer a self-contained question.
    queries = [question]
    retrieval_query = _build_retrieval_query(question, history)
    if retrieval_query != question:
        queries.append(retrieval_query)
    result_sets = [
        database.search(
            question=q,
            collection=collection,
            model=get_embedding_model(),
            top_k=config.TOP_K_RESULTS,
        )
        for q in queries
    ]
    return _merge_search_results(result_sets, config.TOP_K_RESULTS)


def _normalize_for_match(text):
    """Lower-case, unify apostrophes, drop markdown emphasis and punctuation
    runs, collapse whitespace — so "**I don’t have information about that in
    my database.**" still matches the fallback text."""
    text = (text or "").lower().replace("’", "'").replace("‘", "'")
    text = re.sub(r"[*_`#>]+", " ", text)
    text = re.sub(r"[.!?,;:]+", " ", text)
    return " ".join(text.split())


_NO_INFO_NORMALIZED = tuple({_normalize_for_match(t) for t in NO_INFO_FALLBACK.values()})


def is_no_info_answer(answer):
    """True if the answer is (or contains) one of the NO_INFO_FALLBACK texts.

    The prompt tells the model to reply with exactly that sentence when it
    can't answer, so its presence is the signal that the question went
    unanswered (Node then files it under "Unanswered Questions").
    """
    norm = _normalize_for_match(answer)
    if not norm:
        return True  # an empty answer answered nothing
    return any(fallback in norm for fallback in _NO_INFO_NORMALIZED)


# Pure greetings / thanks get a fixed reply instead of an LLM call. With chat
# history attached, the model tends to echo its previous turn (e.g. repeating
# "I don't have information..." in reply to "hi"), and skipping the call also
# saves Groq's per-minute token budget. Only exact matches — "hi, what is the
# fee?" still goes through the normal pipeline.
_GREETINGS = {
    "hi", "hii", "hello", "hey", "salam", "salaam", "aoa", "assalamualaikum",
    "assalam o alaikum", "asalam o alaikum", "assalamu alaikum", "assalam-o-alaikum",
    "good morning", "good afternoon", "good evening", "hello there", "hi there",
}
_THANKS = {
    "thanks", "thank you", "thankyou", "thx", "shukriya", "shukria", "thanks a lot",
    "thank you so much", "jazakallah", "ok thanks", "okay thanks",
}
_SMALL_TALK_REPLIES = {
    "greeting": {
        "en": "Hello! I'm MAJU Assistant. Ask me anything about admissions, fees, programs, scholarships or campus life at MAJU.",
        "roman_urdu": "Assalam o Alaikum! Main MAJU Assistant hoon. Admission, fee, programs, scholarships ya MAJU ke baare mein kuch bhi poochein.",
    },
    "thanks": {
        "en": "You're welcome! Let me know if there's anything else about MAJU I can help with.",
        "roman_urdu": "Koi baat nahi! MAJU ke baare mein aur kuch poochna ho to zaroor batayein.",
    },
}


def small_talk_reply(question, language="en"):
    """Fixed reply for a bare greeting / thank-you, else None."""
    norm = _normalize_for_match(question).replace("-", " ")
    if norm in _GREETINGS:
        kind = "greeting"
    elif norm in _THANKS:
        kind = "thanks"
    else:
        return None
    replies = _SMALL_TALK_REPLIES[kind]
    roman = language == "roman_urdu" or norm in {"salam", "salaam", "aoa", "shukriya", "shukria", "jazakallah"} or "alaikum" in norm
    return replies["roman_urdu"] if roman else replies["en"]


def ask(question, language="en", history=None, guest=False):
    """Run the RAG pipeline and return just the answer text (CLI / legacy callers)."""
    answer, _answered = ask_detailed(question, language=language, history=history, guest=guest)
    return answer


def ask_detailed(question, language="en", history=None, guest=False):
    """Run the full RAG pipeline for a student question.

    Returns `(answer, answered)`. `answered` is False when retrieval found
    nothing (empty knowledge base) or the model fell back to the
    NO_INFO_FALLBACK sentence — see `is_no_info_answer`.

    `language` should be one of "en", "roman_urdu", "mixed" — it controls the
    language of the generated answer. The retrieval step is language-agnostic
    (English embeddings handle Roman-Urdu queries acceptably for our corpus).

    `history` (optional): prior chat turns as [{role, content}, ...] oldest
    first. Used for two things: (1) passed to the LLM so it can resolve
    follow-ups conversationally, and (2) the latest prior user turn is
    prepended to the retrieval query so follow-ups like "or fee" still
    pull topic-relevant chunks instead of generic ones.

    Raises LLMUnavailableError when no LLM backend could answer.
    """
    canned = small_talk_reply(question, language)
    if canned:
        return canned, True

    collection = _initialize()

    try:
        chunks, _sources, _scores = _retrieve(question, history, collection)
    except Exception as exc:
        # `run.py build` deletes and recreates the collection, which leaves
        # our cached handle pointing at a collection that no longer exists.
        # Re-fetch it once instead of failing every request until restart.
        if not database.is_missing_collection_error(exc):
            raise
        print("  Cached collection no longer exists (rebuilt?); reloading it")
        _reset_collection()
        collection = _initialize()
        chunks, _sources, _scores = _retrieve(question, history, collection)

    if not chunks:
        return NO_INFO_FALLBACK.get(language, NO_INFO_FALLBACK["en"]), False

    prompt = create_prompt(question, chunks, language=language, guest=guest)
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

    return cleaned, not is_no_info_answer(cleaned)
