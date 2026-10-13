"""
========================================================
QUESTION_CLUSTER.PY - Group similar unanswered questions
========================================================

Backs `POST /questions/cluster`: Node sends the admin's open "Unanswered
Questions" and gets back groups of questions that ask the same thing, so
the admin can answer "BSCS fee kitni hai" and "what is the fee for BSCS"
once instead of twice.

How:
  1. Light normalisation so the English-only embedding model can compare
     Roman-Urdu and English phrasings: common Roman-Urdu question words are
     mapped to English ("kitni" -> "how much"), program codes are spelled
     out ("bscs" -> "bs computer science").
  2. Embed with the SAME all-MiniLM-L6-v2 instance the RAG pipeline holds
     (rag.get_embedding_model) — unit-normalised, so cosine = dot product.
  3. Greedy clustering: the question with the most neighbours above the
     threshold becomes a group's representative and takes all its still
     unassigned neighbours; repeat. Singletons are groups of one.
  4. A conflict guard: two questions naming different programs or degree
     levels ("BSCS fee" vs "MSCS fee", cosine ~0.8) are never grouped — the
     admin answers a whole group at once, so a wrong merge would send the
     BS fee to someone who asked about the MS fee. It is checked against
     every member already in the group, not only the representative.

Never touches Chroma: this is pure in-memory math over the request body.
"""

import re             # For tokenising / normalising question text

import numpy as np    # For the pairwise cosine-similarity matrix


# =============================================================
# LIMITS
# =============================================================

MAX_ITEMS = 1000            # Node sends at most 1000 questions per call
MAX_TEXT_CHARS = 2000       # UnansweredQuestion.question max length
# Cosine similarity (after normalisation, see `normalize_question`) at or
# above which two questions are considered the same. Measured on MAJU-style
# English + Roman-Urdu paraphrases — see the module report in the PR notes.
DEFAULT_THRESHOLD = 0.72


# =============================================================
# NORMALISATION
# =============================================================

# Roman-Urdu function / question words -> English, so MiniLM (an English
# model) sees "bscs fee how much" instead of unknown sub-word pieces. The
# filler words ("kya", "hai", "ki") are dropped: left in, they made two
# unrelated Roman-Urdu questions look alike just for sharing "kya hai".
_ROMAN_URDU_MAP = {
    "kitni": "how much", "kitna": "how much", "kitne": "how many",
    "kahan": "where", "kidhar": "where", "kab": "when",
    "kaise": "how", "kaisay": "how", "kese": "how", "kesay": "how", "kaisy": "how",
    "kyun": "why", "kyon": "why", "kon": "who", "kaun": "who", "konsa": "which", "kaunsa": "which",
    "milega": "get", "milegi": "get", "milta": "get", "milti": "get", "lena": "get",
    "chahiye": "need", "chahye": "need", "chahiay": "need",
    "nahi": "not", "nahin": "not", "nai": "not",
    "karna": "do", "karein": "do", "karen": "do", "karun": "do",
    "batao": "tell", "bataein": "tell", "bata": "tell",
    "fees": "fee", "dakhla": "admission", "akhri": "last", "tareekh": "date", "tarikh": "date",
    "kya": "", "kia": "", "hai": "", "hain": "", "he": "", "ki": "", "ka": "", "ke": "",
    "ko": "", "se": "", "mein": "", "mai": "", "mujhe": "", "muje": "",
    "hum": "", "ham": "", "ap": "", "aap": "", "plz": "", "please": "", "sir": "", "bhai": "",
}

# Program codes spelled out the way the university website writes them.
_PROGRAMS = {
    "bscs": "bs computer science", "bsse": "bs software engineering",
    "bsee": "bs electrical engineering", "bsai": "bs artificial intelligence",
    "bsds": "bs data science", "bsaf": "bs accounting and finance",
    "mscs": "ms computer science", "msse": "ms software engineering",
    "msds": "ms data science", "msee": "ms electrical engineering",
    "phdcs": "phd computer science",
    "bba": "bba business administration", "mba": "mba business administration",
}

_TOKEN_RE = re.compile(r"[a-z0-9]+")


def normalize_question(text):
    """Lower-case, strip punctuation, translate Roman-Urdu words, expand codes."""
    out = []
    for token in _TOKEN_RE.findall((text or "").lower()):
        token = _PROGRAMS.get(token, token)
        token = _ROMAN_URDU_MAP.get(token, token)
        if token:
            out.append(token)
    return " ".join(out)


# =============================================================
# CONFLICT GUARD
# =============================================================

_LEVEL_PATTERNS = (
    ("bs", re.compile(r"\b(bs|bachelors?|undergrad\w*|bba)\b")),
    ("ms", re.compile(r"\b(ms|masters?|mphil|mba|postgrad\w*)\b")),
    ("phd", re.compile(r"\b(phd|doctoral|doctorate)\b")),
)
_SUBJECT_PATTERNS = (
    ("cs", re.compile(r"\b(computer science|cs)\b")),
    ("se", re.compile(r"\b(software engineering|se)\b")),
    ("ee", re.compile(r"\b(electrical engineering|ee)\b")),
    ("ai", re.compile(r"\b(artificial intelligence|ai)\b")),
    ("ds", re.compile(r"\b(data science|ds)\b")),
    ("biz", re.compile(r"\b(business administration|bba|mba|management sciences?)\b")),
    ("af", re.compile(r"\b(accounting and finance|accounting|finance)\b")),
    ("psy", re.compile(r"\b(psychology)\b")),
    ("bio", re.compile(r"\b(bioinformatics|biotechnology|biosciences?)\b")),
)


def _signature(normalized):
    """(degree levels, subjects) a normalised question names, as frozensets."""
    levels = frozenset(name for name, pat in _LEVEL_PATTERNS if pat.search(normalized))
    subjects = frozenset(name for name, pat in _SUBJECT_PATTERNS if pat.search(normalized))
    return levels, subjects


def _conflicts(sig_a, sig_b):
    """True when both questions name a level (or subject) and none match."""
    for a, b in zip(sig_a, sig_b):
        if a and b and not (a & b):
            return True
    return False


# =============================================================
# CLUSTERING
# =============================================================

def cluster_texts(texts, model, threshold=DEFAULT_THRESHOLD):
    """Group `texts` by meaning. Returns [(representative_index, [indices])].

    Every input index appears in exactly one group; groups are sorted by
    size (largest first), ties by their earliest input index (Node sends
    newest first, so fresher groups win ties). Indices inside a group keep
    input order.
    """
    n = len(texts)
    if n == 0:
        return []
    normalized = [normalize_question(t) for t in texts]
    signatures = [_signature(t) for t in normalized]

    # Embed each distinct normalised text once (repeated questions are common).
    unique = list(dict.fromkeys(t for t in normalized if t))
    groups = []
    assigned = [False] * n
    if unique:
        pos = {t: i for i, t in enumerate(unique)}
        emb = model.encode(
            unique, batch_size=64, normalize_embeddings=True,
            convert_to_numpy=True, show_progress_bar=False,
        )
        emb = np.asarray(emb, dtype=np.float32)
        live = [i for i in range(n) if normalized[i]]
        rows = emb[[pos[normalized[i]] for i in live]]
        sims = rows @ rows.T

        # Neighbour lists (excluding self) that also pass the conflict guard.
        neighbours = {}
        for a, i in enumerate(live):
            cand = np.nonzero(sims[a] >= threshold)[0]
            neighbours[i] = [
                live[b] for b in cand
                if b != a and not _conflicts(signatures[i], signatures[live[b]])
            ]

        live_pos = {i: a for a, i in enumerate(live)}

        # Most-connected question first; ties keep input order.
        for center in sorted(live, key=lambda i: (-len(neighbours[i]), i)):
            if assigned[center]:
                continue
            # Closest neighbours join first, and each must be compatible with
            # EVERY member already in the group, not just the center: "admission
            # deadline" is compatible with both "bs admission deadline" and
            # "phd admission deadline", but those two must never share a group.
            row = sims[live_pos[center]]
            candidates = sorted(
                (j for j in neighbours[center] if not assigned[j]),
                key=lambda j: (-float(row[live_pos[j]]), j),
            )
            members = [center]
            for j in candidates:
                if not any(_conflicts(signatures[j], signatures[m]) for m in members):
                    members.append(j)
            for j in members:
                assigned[j] = True
            groups.append((center, sorted(members)))

    # Blank / punctuation-only questions can't be compared: one group each.
    groups.extend((i, [i]) for i in range(n) if not assigned[i])
    groups.sort(key=lambda g: (-len(g[1]), g[1][0]))
    return groups
