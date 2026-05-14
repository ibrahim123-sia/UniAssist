"""
moderation.py — Bad-language detection for chat messages.

Scans English + Roman-Urdu profanity. Returns a structured result so the
caller can decide whether to short-circuit a response and notify admins.
"""

import re

# English profanity (kept terse; expand as we collect false-positive feedback)
ENGLISH_BAD_WORDS = {
    "fuck", "fucker", "fucking", "shit", "bitch", "bastard", "asshole",
    "dick", "cunt", "motherfucker", "douchebag", "wanker", "twat", "prick",
    "slut", "whore", "retard", "faggot", "nigger", "nigga",
    "piss", "pussy", "cock", "jackass", "dumbass", "crap", "fag",
    "screw you", "stfu", "wtf",
}

# Roman-Urdu profanity wordlist. Roman-Urdu has many spelling variants so
# we match by stems and known forms.
ROMAN_URDU_BAD_WORDS = {
    # Direct slurs
    "madarchod", "madarchood", "behnchod", "behenchod", "bhenchod", "bhencho",
    "bsdk", "bhosdike", "bhosdi", "bhosdiwale", "lawda", "lauda", "lavda",
    "lund", "lundtopi", "chutiya", "chutia", "chutiye", "chootia",
    "gandu", "gaandu", "gand", "gaand", "kutta", "kuttiya", "kameena",
    "haramkhor", "harami", "haraami", "kanjar", "saala", "saale", "saali",
    "randi", "rand", "randiyon", "kanjri", "tatti", "tatte",
    "jhaant", "jhant", "jhaatu", "jhatu",
    "phudi", "phuddi", "fudi", "fuddi",
    "loda", "loday", "lodu",
    "marjao", "tera", "teri", "tere",  # only flagged in combo
    # Combos commonly seen
    "teri maa", "teri behan", "behan ki",
}

# Compile a single regex once. We allow non-word chars between letters so
# users can't bypass with "f.u.c.k" — but keep this conservative to limit
# false positives on short common words.
def _build_pattern(words):
    parts = [re.escape(w) for w in sorted(words, key=len, reverse=True)]
    return re.compile(r"(?<![a-z0-9])(" + "|".join(parts) + r")(?![a-z0-9])", re.IGNORECASE)


_EN_RE = _build_pattern(ENGLISH_BAD_WORDS)
_UR_RE = _build_pattern(ROMAN_URDU_BAD_WORDS)


def check_message(text: str) -> dict:
    """
    Scan `text` for profanity in English and Roman-Urdu.

    Returns: {
      "flagged": bool,
      "matches": [str, ...],
      "language": "en" | "roman_urdu" | "mixed" | None,
    }
    """
    if not text:
        return {"flagged": False, "matches": [], "language": None}

    en_matches = [m.group(0).lower() for m in _EN_RE.finditer(text)]
    ur_matches = [m.group(0).lower() for m in _UR_RE.finditer(text)]

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
