"""
moderation.py — Bad-language detection for chat messages.

Scans English + Roman-Urdu profanity. Returns a structured result so the
caller can decide whether to short-circuit a response and notify admins.

A flag is not just a refused answer — /ask reports it to Node, which records
it on the student's account and notifies every admin. So false positives are
expensive, and the single-word lists below only contain words that are
abusive on their own. Words that are also ordinary names, places, kinship
terms or vocabulary (Lund University, Tatta, "dalal" = broker, "saali" =
sister-in-law, "Hijra" = the Islamic calendar, "rand" = currency, "teri" =
"your") appear only inside multi-word phrases that are unambiguous.
"""

import re             # For compiling and executing regular expressions to detect profanity


# English profanity (kept terse; expand as we collect false-positive feedback)
ENGLISH_BAD_WORDS = {
    "fuck", "fucker", "fucking", "shit", "shitty", "bitch", "bastard", "asshole",
    "dick", "cunt", "motherfucker", "douchebag", "wanker", "twat", "prick",
    "slut", "whore", "retard", "retarded", "faggot", "nigger", "nigga",
    "piss", "pussy", "cock", "jackass", "dumbass", "crap", "fag",
    "screw you", "stfu", "wtf",
}

# English words that also match with a regular inflection ("fucked",
# "bitches", "sluts"). Deliberately excludes words whose inflected forms are
# innocent: "pricked", "cocked", "pissed" (= angry), "crapped".
ENGLISH_INFLECTABLE = {
    "fuck", "fucker", "shit", "bitch", "bastard", "asshole", "dick", "cunt",
    "motherfucker", "douchebag", "wanker", "twat", "slut", "whore", "faggot",
    "fag", "nigger", "nigga", "pussy", "jackass", "dumbass", "retard",
}
_ENGLISH_SUFFIX = r"(?:s|es|ed|er|ers|ing|in|z)?"

# Roman-Urdu profanity and disrespectful wordlist.
ROMAN_URDU_BAD_WORDS = {
    # Direct slurs & vulgarities (including spelling variants)
    "madarchod", "madarchood", "madarchode", "madarchoday",
    "behnchod", "behenchod", "bhenchod", "bhencho", "bhenchood", "bhanchod", "bhanchood",
    "bsdk", "bhosdike", "bhosdi", "bhosdiwale", "bhosdiwalay", "bhosri", "bhosda", "bhosday",
    "lawda", "lauda", "lavda", "loda", "loday", "lodu",
    "lundtopi",
    "chutiya", "chutia", "chutiye", "chootia", "chutya", "chootya", "chutyay",
    "gandu", "gaandu", "gaand",
    "kutta", "kutte", "kuttay", "kutti", "kuttiya", "kutto",
    "suar", "suwar", "sooar", "soowar", "khinzir", "khinzeer", "khinzeere",
    "kanjar", "kanjr", "kanjri", "kanjriyon",
    "randi", "randiyon", "ranndi",
    "tatti",
    "jhaant", "jhant", "jhaatu", "jhatu",
    "phudi", "phuddi", "fudi", "fuddi",
    "dalla", "dallay",
    "bharwa", "bharway", "bhadwa", "bhadway",
    "gashti", "gashtee", "gasti", "gastie",
    "khusra", "khusray",

    # Culturally disrespectful words (Urdu/Pakistani university context)
    "laanti", "lanti", "lanat", "laanat",
    "bakwas", "bakwaas",
    "badtameez", "badtameezi", "badtamez",
    "jahil", "jaahil", "jahill",
    "kameena", "kameene", "kameenay", "kameeni",

    # Disrespectful verbs flagged in this helpdesk context
    "marjao", "mar jao",

    # Combos and phrases. Ambiguous single words (lund, gand, saala/saali,
    # teri/tera/tere, choot = also "chhoot"/discount) only count here, in
    # contexts that can't be innocent.
    "teri maa", "teri behan", "teri bhen", "teri maa ki", "teri ma ki",
    "tere baap ki", "teri gand", "teri gaand", "mera lund", "lund le", "lund lo",
    "saala kutta", "saale kutte", "saali kutti", "behan ki", "bhen ki",
    "bhenyak", "bhen yak", "penyak", "pen yak",
    "ullu ka patha", "ullu ka pattha", "ullu k pathe", "ullu ke pathe",
    "lanat ho", "lanti ho", "bhag yahan se", "bhaag yahan se", "bhago yahan se",
}


def _word_pattern(phrase, suffix=""):
    """Regex for one listed word/phrase, tolerant of letter elongation.

    Each letter may repeat ("fuuuck", "kutttaaa"), and spaces in phrases
    match any run of whitespace. A doubled letter in the listed word still
    needs at least two copies, so "soar" can't match "sooar". The match must
    stand alone (no letter/digit on either side).
    """
    parts = []
    for ch in phrase:
        if ch == " ":
            parts.append(r"\s+")
        else:
            parts.append(re.escape(ch) + "+")
    return re.compile(
        r"(?<![a-z0-9])" + "".join(parts) + suffix + r"(?![a-z0-9])",
        re.IGNORECASE,
    )


def _build_patterns(words, inflectable=()):
    # Longest first so a phrase is reported instead of a word inside it.
    return [
        (w, _word_pattern(w, _ENGLISH_SUFFIX if w in inflectable else ""))
        for w in sorted(words, key=len, reverse=True)
    ]


_EN_PATTERNS = _build_patterns(ENGLISH_BAD_WORDS, ENGLISH_INFLECTABLE)
_UR_PATTERNS = _build_patterns(ROMAN_URDU_BAD_WORDS)


# --- Obfuscation normalization ----------------------------------------------
# "f.u.c.k" / "f u c k" / "f-u-c-k": three or more single letters separated
# only by punctuation/spaces are joined back into one word. Requiring every
# piece to be a lone letter keeps ordinary text ("it's hit") intact.
_SPACED_LETTERS_RE = re.compile(r"(?<![a-z0-9])[a-z](?:[\W_]{1,3}[a-z](?![a-z0-9])){2,}", re.IGNORECASE)
# Leetspeak inside words: "sh1t", "b1tch", "a$$hole". Only applied to tokens
# that mix letters with these characters, so plain numbers are untouched.
_LEET_MAP = str.maketrans({"0": "o", "1": "i", "3": "e", "4": "a", "5": "s", "@": "a", "$": "s", "!": "i"})
_LEET_TOKEN_RE = re.compile(r"[a-z0-9@$!]*[a-z][a-z0-9@$!]*", re.IGNORECASE)


def _normalize_obfuscation(text):
    """Return `text` with letter-spacing and leetspeak obfuscation undone."""
    text = _SPACED_LETTERS_RE.sub(lambda m: re.sub(r"[\W_]", "", m.group(0)), text)

    def _deleet(m):
        tok = m.group(0)
        if any(c in tok for c in "0134@$!5"):
            return tok.translate(_LEET_MAP)
        return tok

    return _LEET_TOKEN_RE.sub(_deleet, text)


def _find(patterns, texts):
    found = []
    for word, pattern in patterns:
        if any(pattern.search(t) for t in texts):
            found.append(word)
    return found


def check_message(text: str) -> dict:
    """
    Scan `text` for profanity in English and Roman-Urdu.

    The raw text and an obfuscation-normalized copy are both scanned;
    matches are reported as the canonical listed word ("fucked" -> "fuck").

    Returns: {
      "flagged": bool,
      "matches": [str, ...],
      "language": "en" | "roman_urdu" | "mixed" | None,
    }
    """
    if not text:
        return {"flagged": False, "matches": [], "language": None}

    texts = [text]
    normalized = _normalize_obfuscation(text)
    if normalized != text:
        texts.append(normalized)

    en_matches = _find(_EN_PATTERNS, texts)
    ur_matches = _find(_UR_PATTERNS, texts)

    matches = sorted(set(en_matches + ur_matches))
    if not matches:
        return {"flagged": False, "matches": [], "language": None}

    if en_matches and ur_matches:
        lang = "mixed"
    elif ur_matches:
        lang = "roman_urdu"
    else:
        lang = "en"

    return {"flagged": True, "matches": matches, "language": lang}
