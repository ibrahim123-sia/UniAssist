"""
========================================================
LISTING_EXTRACT.PY - Job / scholarship / event extraction from a link
========================================================

Backs `POST /listings/extract`: an administrator pastes the URL of a job
posting, scholarship or event page, Node calls this, and the returned
fields pre-fill a DRAFT listing the admin reviews before publishing.

Pipeline:
  URL -> url_safety.fetch_public_url (SSRF-safe, HTML only)
      -> heuristic fields from the HTML (always computed)
      -> LLM structured extraction (same backend switch as the chatbot,
         rag._llm_chat) with a strict-JSON prompt
      -> validate / normalise; LLM nulls are back-filled from the heuristic
  If the LLM is unavailable, too slow, or returns junk, the heuristic result
  is returned on its own (`extractedBy: "heuristic"`).

`POST /listings/extract-jobs` runs the same pipeline as a background job
(start_extract_job / get_extract_job) and reports the stage it is in:
fetching -> reading -> extracting (LLM configured) -> fallback (heuristic
used) -> done.

Why always compute the heuristic: it is cheap, it back-fills fields the LLM
left empty, and many job boards embed schema.org JobPosting JSON-LD that is
more reliable than any free-text reading. Event pages likewise often carry
schema.org Event JSON-LD, and the poster (og:image / JSON-LD image) only
ever comes from the heuristic — image URLs are not in the text the LLM sees.
"""

import concurrent.futures  # Future objects for the LLM call / background jobs
import json           # For parsing the LLM's JSON reply and JSON-LD blocks
import queue          # Work queue of the daemon worker pools
import re             # For date / keyword / cleanup patterns
import threading      # Daemon workers + the extract-job registry lock
import time           # For the overall request time budget
import uuid           # For extract-job ids
from datetime import date, datetime, timezone, time as dt_time  # For deadline / event-date normalisation
from urllib.parse import urljoin, urlsplit  # For resolving apply links and deriving an organisation name

from bs4 import BeautifulSoup  # For reading meta tags, JSON-LD and links

import config         # LISTING_* limits and the USE_LOCAL_LLM switch
import rag            # Shared LLM backend switch (_llm_chat)
import scraper        # Shared HTML cleaning / structural extraction
import url_safety     # SSRF-safe fetching


# =============================================================
# FIELD SCHEMA
# =============================================================

COMMON_FIELDS = ("title", "organization", "location", "deadline", "description",
                 "requirements", "applyUrl")
JOB_FIELDS = ("employmentType", "salary")
SCHOLARSHIP_FIELDS = ("fundingType", "amount", "eligibility", "degreeLevel")
EVENT_FIELDS = ("eventDate", "eventEndDate", "eventTime", "posterUrl")
ALL_FIELDS = COMMON_FIELDS + JOB_FIELDS + SCHOLARSHIP_FIELDS + EVENT_FIELDS
LISTING_KINDS = ("job", "scholarship", "event")
# Fields that only belong to one kind; the others' are forced to None.
KIND_FIELDS = {"job": JOB_FIELDS, "scholarship": SCHOLARSHIP_FIELDS, "event": EVENT_FIELDS}
KIND_NOUN = {"job": "job posting", "scholarship": "scholarship", "event": "event"}

# Length caps — mirror the Node Listing model so a value never fails Mongo
# validation after the admin clicks Save without editing it.
FIELD_MAX = {
    "title": 200, "organization": 200, "location": 200,
    "description": 4000, "requirements": 3000, "eligibility": 3000,
    "applyUrl": 2048, "employmentType": 100, "salary": 200,
    "fundingType": 100, "amount": 200, "degreeLevel": 200,
    "eventTime": 100, "posterUrl": 2000,
}
MULTILINE_FIELDS = {"description", "requirements", "eligibility"}


# =============================================================
# SMALL HELPERS
# =============================================================

_MONTHS = ("january", "february", "march", "april", "may", "june", "july",
           "august", "september", "october", "november", "december")
_MONTH_RE = r"(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\.?"
DATE_IN_TEXT_RE = re.compile(
    r"(\d{4}-\d{1,2}-\d{1,2}"
    rf"|\d{{1,2}}(?:st|nd|rd|th)?\s+(?:of\s+)?{_MONTH_RE},?\s+\d{{4}}"
    rf"|{_MONTH_RE}\s+\d{{1,2}}(?:st|nd|rd|th)?,?\s+\d{{4}}"
    r"|\d{1,2}[/.]\d{1,2}[/.]\d{4})",
    re.IGNORECASE,
)
_DEADLINE_KEYWORD_RE = re.compile(
    r"\b(deadline|closing date|closes?|closing|apply by|apply before|last date|due date|"
    r"submission date|valid through|applications? (?:are )?due|until)\b",
    re.IGNORECASE,
)

_DATE_FORMATS = ("%d %B %Y", "%d %b %Y", "%B %d %Y", "%b %d %Y",
                 "%d/%m/%Y", "%d.%m.%Y", "%d-%m-%Y", "%Y/%m/%d", "%Y-%m-%d")


def parse_date(value):
    """Best-effort date -> "YYYY-MM-DD", or None.

    Accepts ISO dates/datetimes, "15 January 2026", "January 15th, 2026",
    "15/01/2026" (day first — the Pakistani/UK convention). Anything
    unparseable or outside 2000-2100 is None rather than a guess.
    """
    if value is None:
        return None
    if isinstance(value, (date, datetime)):
        d = value if isinstance(value, date) else value.date()
        return d.isoformat() if 2000 <= d.year <= 2100 else None
    s = str(value).strip()
    if not s:
        return None
    m = re.match(r"^(\d{4})-(\d{1,2})-(\d{1,2})", s)
    if m:
        try:
            d = date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
            return d.isoformat() if 2000 <= d.year <= 2100 else None
        except ValueError:
            return None
    s = re.sub(r"(\d)(st|nd|rd|th)\b", r"\1", s, flags=re.IGNORECASE)
    s = re.sub(r"\bof\b", " ", s, flags=re.IGNORECASE)
    s = re.sub(r"\bsept\b", "sep", s, flags=re.IGNORECASE)
    s = s.replace(",", " ").replace(".", " ") if not re.search(r"\d\.\d", s) else s.replace(",", " ")
    s = " ".join(s.split())
    for fmt in _DATE_FORMATS:
        try:
            d = datetime.strptime(s, fmt).date()
        except ValueError:
            continue
        return d.isoformat() if 2000 <= d.year <= 2100 else None
    return None


# "2026-10-20T10:00", "2026-10-20 10:00:00+05:00", "2026-10-20T10:00:00Z"
_ISO_DATETIME_RE = re.compile(
    r"^(\d{4}-\d{1,2}-\d{1,2})[T ](\d{1,2}:\d{2}(?::\d{2})?)(?:\.\d+)?\s*(Z|[+-]\d{2}:?\d{2})?$",
    re.IGNORECASE,
)


def parse_event_datetime(value):
    """Event start/end -> ISO 8601 string ("YYYY-MM-DD" or a datetime), or None.

    Unlike a deadline, an event's time of day matters, so a value that
    carries one keeps it ("2026-10-20T10:00:00+05:00"); without a timezone
    the time is left as local time. Everything else goes through parse_date.
    """
    if isinstance(value, datetime):
        return value.replace(microsecond=0).isoformat() if 2000 <= value.year <= 2100 else None
    if isinstance(value, str):
        m = _ISO_DATETIME_RE.match(value.strip())
        if m:
            day, clock, tz = m.groups()
            if len(clock) <= 5:
                clock += ":00"
            if tz and tz.upper() != "Z" and ":" not in tz:
                tz = f"{tz[:3]}:{tz[3:]}"
            try:
                dt = datetime.fromisoformat(f"{day}T{clock.zfill(8)}{tz or ''}")
            except ValueError:
                return None
            if not 2000 <= dt.year <= 2100:
                return None
            return dt.isoformat()
    return parse_date(value)


def _clock_label(iso_value):
    """"2026-10-20T13:30:00" -> "1:30 PM"; None for a date-only value or midnight."""
    m = re.search(r"T(\d{2}):(\d{2})", iso_value or "")
    if not m or (m.group(1), m.group(2)) == ("00", "00"):
        return None
    hour, minute = int(m.group(1)), m.group(2)
    return f"{hour % 12 or 12}:{minute} {'AM' if hour < 12 else 'PM'}"


def _time_label(start, end):
    """Readable eventTime from ISO start/end datetimes ("10:00 AM – 1:00 PM")."""
    first = _clock_label(start)
    if not first:
        return None
    last = _clock_label(end) if end and end[:10] == start[:10] else None
    return f"{first} – {last}" if last and last != first else first


def _clean_text(value, field):
    """Coerce to plain text, strip stray HTML, collapse whitespace, cap length."""
    if value is None:
        return None
    if isinstance(value, (list, tuple)):
        value = "\n".join(str(v) for v in value if v not in (None, ""))
    elif isinstance(value, dict):
        return None
    s = str(value)
    if "<" in s and ">" in s:
        s = BeautifulSoup(s, "lxml").get_text("\n")
    if field in MULTILINE_FIELDS:
        lines = [" ".join(line.split()) for line in s.splitlines()]
        s = re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()
    else:
        # Separator debris from "<Name> -" style site names / titles.
        s = " ".join(s.split()).strip(" -–—|:·•")
    if not s or s.lower() in ("null", "none", "n/a", "na", "unknown", "not specified", "-"):
        return None
    cap = FIELD_MAX.get(field)
    if cap and len(s) > cap:
        cut = s[:cap]
        # Prefer ending on a sentence/line boundary for long text fields.
        if field in MULTILINE_FIELDS:
            boundary = max(cut.rfind(". "), cut.rfind("\n"))
            if boundary > cap * 0.6:
                cut = cut[:boundary + 1]
        s = cut.rstrip()
    return s


def _absolute_http_url(value, base):
    if not value or not isinstance(value, str):
        return None
    try:
        absolute = urljoin(base, value.strip())
        parts = urlsplit(absolute)
    except ValueError:
        return None
    if parts.scheme not in ("http", "https") or not parts.hostname:
        return None
    return absolute[:FIELD_MAX["applyUrl"]]


_host_checks = {}          # hostname -> is_public_host() verdict (bounded, see _public_image_host)
_HOST_CHECKS_MAX = 256


def _public_image_host(host):
    """url_safety's address classification for a stored image host, cached.

    Resolves the name (no fetch). Every student's browser loads the poster,
    so one pointing at 127.0.0.1 / 10.x / an intranet name must not be saved.
    """
    verdict = _host_checks.get(host)
    if verdict is None:
        verdict = url_safety.is_public_host(host)
        if len(_host_checks) >= _HOST_CHECKS_MAX:
            _host_checks.clear()
        _host_checks[host] = verdict
    return verdict


def _poster_url(value, base):
    """An event poster: absolute http(s) URL on a public host, or None.

    JSON-LD `image` may be a string, an ImageObject ({"url": ...}) or a list
    of either — the first usable one wins. data: URIs (inline base64 images)
    and anything longer than the Listing model allows are dropped, never
    truncated: a cut URL is a broken image. So is a host that is a private /
    loopback address or resolves to one.
    """
    for candidate in (value if isinstance(value, list) else [value]):
        if isinstance(candidate, dict):
            candidate = candidate.get("url") or candidate.get("contentUrl")
        if not isinstance(candidate, str) or candidate.strip().lower().startswith("data:"):
            continue
        try:
            absolute = urljoin(base, candidate.strip())
            parts = urlsplit(absolute)
        except ValueError:
            continue
        if (parts.scheme in ("http", "https") and parts.hostname
                and len(absolute) <= FIELD_MAX["posterUrl"] and _public_image_host(parts.hostname)):
            return absolute
    return None


def _as_datetime(iso_value, end_of_day=False):
    """ISO date/datetime string -> datetime (a bare date = start or end of that day)."""
    try:
        if "T" in iso_value:
            return datetime.fromisoformat(iso_value)
        return datetime.combine(date.fromisoformat(iso_value[:10]), dt_time.max if end_of_day else dt_time.min)
    except (TypeError, ValueError):
        return None


def _ends_before_start(start, end):
    """True when the event's end is strictly before its start.

    Full datetimes, not just the day: "15:00 -> 13:00 the same day" is
    nonsense too. A date-only end means "that whole day". When only one side
    carries a timezone the wall-clock times are compared.
    """
    s, e = _as_datetime(start), _as_datetime(end, end_of_day=True)
    if s is None or e is None:
        return False
    if (s.tzinfo is None) != (e.tzinfo is None):
        s, e = s.replace(tzinfo=None), e.replace(tzinfo=None)
    return e < s


def normalize_fields(raw, kind, source_url):
    """Validate + normalise a field dict (from the LLM or the heuristic).

    Always returns every key of the contract; fields that belong to another
    kind (job-only, scholarship-only, event-only) are forced to None.
    """
    raw = raw if isinstance(raw, dict) else {}
    out = {}
    for field in ALL_FIELDS:
        value = raw.get(field)
        if field == "deadline":
            out[field] = parse_date(value)
        elif field in ("eventDate", "eventEndDate"):
            out[field] = parse_event_datetime(value)
        elif field == "applyUrl":
            out[field] = _absolute_http_url(value, source_url)
        elif field == "posterUrl":
            out[field] = _poster_url(value, source_url)
        else:
            out[field] = _clean_text(value, field)
    own = KIND_FIELDS.get(kind, ())
    for fields in KIND_FIELDS.values():
        for f in fields:
            if f not in own:
                out[f] = None
    # Node rejects eventEndDate < eventDate; drop a nonsensical end rather
    # than make the admin's first Save fail.
    if out["eventDate"] and out["eventEndDate"] and _ends_before_start(out["eventDate"], out["eventEndDate"]):
        out["eventEndDate"] = None
    return out


def _finalize(fields, kind, source_url, fallback):
    """Fill required fields so Node can always create the draft."""
    merged = {
        key: fields.get(key) if fields.get(key) is not None else fallback.get(key)
        for key in ALL_FIELDS
    }
    out = normalize_fields(merged, kind, source_url)
    host = _host_label(source_url)
    if not out["title"]:
        out["title"] = f"{host} {'job' if kind == 'job' else kind}"
    if not out["organization"]:
        out["organization"] = host
    if not out["description"]:
        out["description"] = ""  # contract types description as str, never null
    if not out["applyUrl"]:
        out["applyUrl"] = source_url
    return out


def _host_label(url):
    host = (urlsplit(url).hostname or "").lower()
    return host[4:] if host.startswith("www.") else host


# =============================================================
# HEURISTIC EXTRACTION
# =============================================================

def _meta(soup, *names):
    for name in names:
        tag = soup.find("meta", attrs={"property": name}) or soup.find("meta", attrs={"name": name})
        if tag and tag.get("content") and tag["content"].strip():
            return tag["content"].strip()
    return None


def _iter_jsonld(soup):
    for script in soup.find_all("script", attrs={"type": re.compile(r"ld\+json", re.I)}):
        try:
            data = json.loads(script.string or script.get_text() or "")
        except (ValueError, TypeError):
            continue
        stack = [data]
        while stack:
            item = stack.pop()
            if isinstance(item, list):
                stack.extend(item)
            elif isinstance(item, dict):
                yield item
                if "@graph" in item:
                    stack.append(item["@graph"])


def _jsonld_types(item):
    t = item.get("@type")
    return {str(x).lower() for x in (t if isinstance(t, list) else [t]) if x}


_EMPLOYMENT_TYPES = {
    "full_time": "Full-time", "part_time": "Part-time", "contractor": "Contract",
    "temporary": "Temporary", "intern": "Internship", "volunteer": "Volunteer",
    "per_diem": "Per diem", "other": "Other",
}


def _job_posting_fields(item):
    out = {"title": item.get("title") or item.get("name")}
    org = item.get("hiringOrganization")
    if isinstance(org, dict):
        out["organization"] = org.get("name")
    elif isinstance(org, str):
        out["organization"] = org

    locs = item.get("jobLocation")
    names = []
    for loc in (locs if isinstance(locs, list) else [locs] if locs else []):
        if not isinstance(loc, dict):
            continue
        addr = loc.get("address")
        if isinstance(addr, dict):
            parts = []
            for k in ("addressLocality", "addressRegion", "addressCountry"):
                v = addr.get(k)
                if isinstance(v, dict):
                    v = v.get("name")
                if v and str(v) not in parts:
                    parts.append(str(v))
            if parts:
                names.append(", ".join(parts))
        elif isinstance(addr, str):
            names.append(addr)
    if str(item.get("jobLocationType", "")).upper() == "TELECOMMUTE":
        names.append("Remote")
    if names:
        out["location"] = "; ".join(dict.fromkeys(names))

    out["deadline"] = item.get("validThrough")
    emp = item.get("employmentType")
    if emp:
        emp_list = emp if isinstance(emp, list) else [emp]
        out["employmentType"] = ", ".join(
            _EMPLOYMENT_TYPES.get(str(e).lower().replace("-", "_"), str(e)) for e in emp_list
        )
    salary = item.get("baseSalary")
    if isinstance(salary, dict):
        cur = salary.get("currency") or ""
        val = salary.get("value")
        if isinstance(val, dict):
            lo, hi, single = val.get("minValue"), val.get("maxValue"), val.get("value")
            unit = val.get("unitText") or ""
            amount = f"{lo}–{hi}" if lo and hi else str(single or lo or hi or "")
            if amount:
                out["salary"] = " ".join(p for p in (cur, amount, f"per {unit.lower()}" if unit else "") if p)
        elif val:
            out["salary"] = f"{cur} {val}".strip()
    if item.get("description"):
        out["description"] = item["description"]
    reqs = item.get("qualifications") or item.get("experienceRequirements") or item.get("educationRequirements")
    if isinstance(reqs, (str, list)):
        out["requirements"] = reqs
    if item.get("url"):
        out["applyUrl"] = item["url"]
    return out


def _as_list(value):
    return value if isinstance(value, list) else [value] if value else []


def _ld_name(value):
    """A JSON-LD Organization/Person/Place (or plain string) -> its name."""
    if isinstance(value, dict):
        value = value.get("name")
    return str(value).strip() if isinstance(value, (str, int, float)) and str(value).strip() else None


def _address_text(addr):
    if isinstance(addr, str):
        return addr
    if not isinstance(addr, dict):
        return None
    parts = []
    for k in ("streetAddress", "addressLocality", "addressRegion", "addressCountry"):
        v = _ld_name(addr.get(k))
        if v and v not in parts:
            parts.append(v)
    return ", ".join(parts) or None


def _event_location(item):
    """Venue text from Event.location (Place / VirtualLocation / string)."""
    places = []
    for loc in _as_list(item.get("location")):
        if isinstance(loc, str):
            places.append(loc)
            continue
        if not isinstance(loc, dict):
            continue
        if "virtuallocation" in _jsonld_types(loc):
            places.append("Online")
            continue
        # Eventbrite-style data repeats the city in streetAddress and
        # addressLocality ("Club Road, Karachi, Sindh" + "Karachi"); keep
        # each comma-separated piece once.
        pieces = []
        for text in (_ld_name(loc), _address_text(loc.get("address"))):
            for piece in (text or "").split(","):
                piece = piece.strip()
                if piece and piece.lower() not in (p.lower() for p in pieces):
                    pieces.append(piece)
        if pieces:
            places.append(", ".join(pieces))
    mode = str(item.get("eventAttendanceMode") or "").lower()
    if ("online" in mode or "mixed" in mode) and "Online" not in places:
        places.append("Online")
    return "; ".join(dict.fromkeys(places)) or None


def _event_fields(item):
    """schema.org Event (or a subtype such as EducationEvent) -> raw fields."""
    out = {
        "title": item.get("name") or item.get("headline"),
        "organization": ", ".join(
            dict.fromkeys(n for n in map(_ld_name, _as_list(item.get("organizer"))) if n)
        ) or None,
        "location": _event_location(item),
        "eventDate": item.get("startDate"),
        "eventEndDate": item.get("endDate"),
        "posterUrl": item.get("image"),
        "description": item.get("description"),
    }
    for offer in _as_list(item.get("offers")):
        if isinstance(offer, dict) and offer.get("url"):
            out["applyUrl"] = offer["url"]
            # When tickets/registration stop being offered.
            out["deadline"] = offer.get("validThrough") or offer.get("availabilityEnds")
            break
    if not out.get("applyUrl") and isinstance(item.get("url"), str):
        out["applyUrl"] = item["url"]
    return out


def _is_event_item(item):
    # "Event" and its subtypes: EducationEvent, BusinessEvent, Hackathon ...
    return any(t.rsplit("/", 1)[-1].endswith("event") for t in _jsonld_types(item))


# A <time datetime> that is the article's publish/update stamp, or sits in a
# sidebar/footer listing *other* posts and events, is not this event's date.
_NOT_EVENT_TIME_RE = re.compile(
    r"publish|updated|modified|posted|entry-date|post-date|byline|sidebar|widget|related|recent",
    re.IGNORECASE,
)


def _time_element_dates(soup):
    """Parsed `<time datetime=...>` values, in page order, minus publish stamps."""
    found = []
    for tag in soup.find_all("time", attrs={"datetime": True}):
        context = [" ".join(tag.get("class") or []), tag.get("itemprop") or ""]
        for parent in list(tag.parents)[:6]:
            if parent.name in ("nav", "footer", "aside"):
                context.append("sidebar")
            if parent.name != "[document]":
                context.append(" ".join(parent.get("class") or []))
        if _NOT_EVENT_TIME_RE.search(" ".join(context)):
            continue
        parsed = parse_event_datetime(tag["datetime"])
        if parsed and parsed not in found:
            found.append(parsed)
    return found


_EVENT_DATE_KEYWORD_RE = re.compile(
    r"\b(event date|dates?|when|held on|will be held|(?:takes|taking) place|scheduled (?:for|on)|"
    r"starts? on|commenc\w* on)\b",
    re.IGNORECASE,
)
# "Last date to register: ..." / "Posted on ..." are dates, but not the event's.
_NOT_EVENT_DATE_PREFIX_RE = re.compile(r"last|deadline|regist|closing|posted|published|updated", re.IGNORECASE)
_EVENT_DEADLINE_RE = re.compile(
    r"\b(registration (?:deadline|closes?|ends?)|register (?:by|before)|"
    r"last date (?:to|for|of) regist\w*|rsvp by|deadline)\b",
    re.IGNORECASE,
)
_CLOCK = r"\d{1,2}(?:[:.]\d{2})?\s*[ap]\.?\s?m\b\.?"
_TIME_RANGE_RE = re.compile(rf"\b({_CLOCK})\s*(?:-|–|—|to|till|until)\s*({_CLOCK})", re.IGNORECASE)
_TIME_SINGLE_RE = re.compile(rf"\b(?:time|at|from|starts? at)\s*:?\s*({_CLOCK})", re.IGNORECASE)


# "December 28 – 29, 2022" / "28-29 December 2022": a day range is almost
# always the event itself (publish dates are single days).
_DATE_RANGE_RES = (
    re.compile(rf"\b({_MONTH_RE})\s+(\d{{1,2}})(?:st|nd|rd|th)?\s*(?:-|–|—|to)\s*(\d{{1,2}})(?:st|nd|rd|th)?,?\s+(\d{{4}})",
               re.IGNORECASE),
    re.compile(rf"\b(\d{{1,2}})(?:st|nd|rd|th)?\s*(?:-|–|—|to)\s*(\d{{1,2}})(?:st|nd|rd|th)?\s+(?:of\s+)?({_MONTH_RE}),?\s+(\d{{4}})",
               re.IGNORECASE),
)


def _find_event_date_range(text):
    """(start, end) "YYYY-MM-DD" pair from a same-month day range, else None."""
    for idx, pattern in enumerate(_DATE_RANGE_RES):
        for m in pattern.finditer(text):
            month, d1, d2, year = (m.group(1), m.group(2), m.group(3), m.group(4)) if idx == 0 else (
                m.group(3), m.group(1), m.group(2), m.group(4))
            start, end = parse_date(f"{d1} {month} {year}"), parse_date(f"{d2} {month} {year}")
            if start and end and end > start:
                return start, end
    return None


def _find_event_date(text):
    for m in _EVENT_DATE_KEYWORD_RE.finditer(text):
        if _NOT_EVENT_DATE_PREFIX_RE.search(text[max(0, m.start() - 14): m.start()]):
            continue
        dm = DATE_IN_TEXT_RE.search(text[m.end(): m.end() + 80])
        if dm:
            parsed = parse_date(dm.group(0))
            if parsed:
                return parsed
    return None


def _clock_text(value):
    """"10am" / "10.30 a.m." -> "10 AM" / "10:30 AM"."""
    value = re.sub(r"\s*([ap])\.?\s?m\.?$", lambda m: f" {m.group(1).upper()}M", value.strip(), flags=re.I)
    return re.sub(r"^(\d{1,2})\.(\d{2})", r"\1:\2", value)


def _find_event_time(text):
    m = _TIME_RANGE_RE.search(text)
    if m:
        return f"{_clock_text(m.group(1))} – {_clock_text(m.group(2))}"
    m = _TIME_SINGLE_RE.search(text)
    return _clock_text(m.group(1)) if m else None


_REQ_HEADING_RE = re.compile(
    r"requirement|qualification|what you.?ll need|what we.?re looking for|who you are|skills|experience",
    re.IGNORECASE,
)
_ELIG_HEADING_RE = re.compile(r"eligib|who can apply|criteria", re.IGNORECASE)


def _section_after_heading(elements, heading_re, cap):
    """Text of the first section whose heading matches `heading_re`."""
    for i, el in enumerate(elements):
        is_heading = el["tag"] in scraper.HEADING_TAGS or (
            len(el["text"]) <= 80 and el["text"].rstrip().endswith(":")
        )
        if not is_heading or not heading_re.search(el["text"]):
            continue
        lines = []
        for nxt in elements[i + 1:]:
            if nxt["tag"] in scraper.HEADING_TAGS:
                break
            lines.append(("- " if nxt["tag"] == "li" else "") + nxt["text"])
            if sum(len(x) for x in lines) > cap:
                break
        if lines:
            return "\n".join(lines)
    return None


def _clean_title(title, site_name):
    if not title:
        return None
    title = " ".join(title.split())
    if site_name:
        for sep in (" | ", " - ", " – ", " — ", " :: "):
            suffix = sep + site_name
            if title.lower().endswith(suffix.lower()) and len(title) > len(suffix):
                return title[: -len(suffix)].strip()
    for sep in (" | ", " – ", " — "):
        if sep in title:
            first = title.split(sep)[0].strip()
            if len(first) >= 5:
                return first
    return title


def _org_from_title(page_title, listing_title):
    """"Job Application for Account Executive at GitLab" -> "GitLab".

    Job boards (Greenhouse, Lever, Workable ...) usually set no
    og:site_name for the employer, but name it in <title>; without this the
    organisation fell back to the board's hostname.
    """
    page_title = " ".join((page_title or "").split())
    if not page_title or not listing_title or listing_title not in page_title:
        return None
    tail = page_title.split(listing_title, 1)[1]
    m = re.match(r"^\s*(?:at|@|\||-|–|—)\s+(.+?)\s*(?:[|–—]\s*.*)?$", tail)
    if not m:
        return None
    org = m.group(1).strip()
    return org if 1 < len(org) <= 80 else None


def _find_deadline(text, keyword_re=_DEADLINE_KEYWORD_RE):
    for m in keyword_re.finditer(text):
        window = text[m.start(): m.end() + 150]
        dm = DATE_IN_TEXT_RE.search(window)
        if dm:
            parsed = parse_date(dm.group(0))
            if parsed:
                return parsed
    return None


_DEGREE_PATTERNS = (
    ("Undergraduate", r"\b(undergraduate|bachelor'?s?)\b"),
    ("Masters", r"\b(master'?s?|postgraduate|msc|mphil|llm)\b"),
    ("PhD", r"\b(ph\.?d|doctoral|doctorate)\b"),
    ("Postdoctoral", r"\bpost-?doc"),
)
_AMOUNT_RE = re.compile(
    r"(?:[£$€]|USD|GBP|EUR|PKR|Rs\.?)\s?\d[\d,]*(?:\.\d+)?(?:\s?(?:k|million))?",
    re.IGNORECASE,
)


# Only call-to-action wording ("Apply now", "Apply online", "Start your
# application"). Matching "apply" anywhere in the link text also caught
# "How to apply" / news-article links and pointed applyUrl at the wrong page.
_APPLY_TEXT_RE = re.compile(
    r"^\s*(apply|start (?:your|an) application|submit (?:your|an) application)\b", re.IGNORECASE
)
# Events: "Register now", "RSVP", "Get tickets", "Book your seat".
_REGISTER_TEXT_RE = re.compile(
    r"^\s*(register|registration|rsvp|get (?:your )?tickets?|buy tickets?|book (?:now|your (?:seat|spot|place))|"
    r"sign up|reserve (?:a |your )?(?:seat|spot))\b",
    re.IGNORECASE,
)


def _apply_link(soup, base, text_re=_APPLY_TEXT_RE):
    for a in soup.find_all("a", href=True):
        text = " ".join(a.get_text(" ", strip=True).split())
        if not text or len(text) > 40 or not text_re.search(text):
            continue
        url = _absolute_http_url(a["href"], base)
        if url and url.split("#")[0] != base.split("#")[0]:
            return url
    return None


def heuristic_extract(html_bytes, encoding, source_url, kind):
    """Fields straight from the HTML (no LLM). Returns (fields, page_text)."""
    soup = scraper.parse_html(html_bytes, encoding)
    site_name = _meta(soup, "og:site_name", "application-name")
    raw = {}

    for item in _iter_jsonld(soup):
        if kind == "event":
            if _is_event_item(item):
                raw.update({k: v for k, v in _event_fields(item).items() if v})
                break
        elif "jobposting" in _jsonld_types(item):
            raw.update({k: v for k, v in _job_posting_fields(item).items() if v})
            break

    title_tag = soup.find("title")
    h1 = soup.find("h1")
    raw.setdefault("title", _clean_title(
        _meta(soup, "og:title", "twitter:title")
        or (h1.get_text(" ", strip=True) if h1 else None)
        or (title_tag.get_text(" ", strip=True) if title_tag else None),
        site_name,
    ))
    raw.setdefault("organization", site_name or _org_from_title(
        title_tag.get_text(" ", strip=True) if title_tag else "", raw.get("title")
    ) or _host_label(source_url))
    raw.setdefault("applyUrl", _apply_link(
        soup, source_url, _REGISTER_TEXT_RE if kind == "event" else _APPLY_TEXT_RE
    ) or source_url)

    # Structural text (nav/footer/sidebar stripped) via the shared scraper
    # rules. A separate parse: extract_structured_from_html mutates its soup.
    _title, elements = scraper.extract_structured_from_html(html_bytes, encoding)
    if not elements:
        body = soup.body or soup
        text = body.get_text("\n", strip=True)
        elements = [{"tag": "p", "text": " ".join(line.split())}
                    for line in text.splitlines() if len(line.strip()) > 2]
    page_text = "\n".join(
        ("## " + e["text"]) if e["tag"] in scraper.HEADING_TAGS else e["text"] for e in elements
    )

    if "description" not in raw:
        parts = []
        meta_desc = _meta(soup, "og:description", "description", "twitter:description")
        if meta_desc:
            parts.append(meta_desc)
        size = len(meta_desc or "")
        for e in elements:
            if e["tag"] in scraper.HEADING_TAGS or len(e["text"]) < 40:
                continue
            if meta_desc and e["text"] in meta_desc:
                continue
            parts.append(e["text"])
            size += len(e["text"]) + 2
            if size >= FIELD_MAX["description"]:
                break
        raw["description"] = "\n\n".join(parts)

    head_text = " ".join(e["text"] for e in elements)[:6000]
    if "deadline" not in raw:
        raw["deadline"] = _find_deadline(head_text, _EVENT_DEADLINE_RE if kind == "event" else _DEADLINE_KEYWORD_RE)

    if kind == "event":
        # Poster: JSON-LD image, else the page's social-preview image. The
        # first candidate that is a usable absolute http(s) URL wins.
        for candidate in (raw.get("posterUrl"),
                          _meta(soup, "og:image:secure_url", "og:image", "twitter:image", "twitter:image:src")):
            raw["posterUrl"] = _poster_url(candidate, source_url)
            if raw["posterUrl"]:
                break
        if "eventDate" not in raw:
            meta_start = parse_event_datetime(_meta(soup, "event:start_time", "og:event:start_time"))
            times = _time_element_dates(soup)
            if meta_start:
                raw["eventDate"] = meta_start
                raw["eventEndDate"] = _meta(soup, "event:end_time", "og:event:end_time")
            elif times:
                raw["eventDate"] = times[0]
                # A second <time> up to two months later is most likely the end.
                if len(times) > 1:
                    gap = (date.fromisoformat(times[1][:10]) - date.fromisoformat(times[0][:10])).days
                    if 0 <= gap <= 60:
                        raw["eventEndDate"] = times[1]
            else:
                day_range = _find_event_date_range(head_text)
                if day_range:
                    raw["eventDate"], raw["eventEndDate"] = day_range
                else:
                    raw["eventDate"] = _find_event_date(head_text)
        start = parse_event_datetime(raw.get("eventDate"))
        end = parse_event_datetime(raw.get("eventEndDate"))
        raw["eventTime"] = (_time_label(start, end) if start else None) or _find_event_time(head_text)
    elif kind == "job":
        raw.setdefault("requirements", _section_after_heading(elements, _REQ_HEADING_RE, 3000))
        if "employmentType" not in raw:
            probe = f"{raw.get('title') or ''} {head_text[:3000]}".lower()
            for label, pat in (("Full-time", r"\bfull[- ]time\b"), ("Part-time", r"\bpart[- ]time\b"),
                               ("Internship", r"\binternship\b"), ("Contract", r"\bcontract\b")):
                if re.search(pat, probe):
                    raw["employmentType"] = label
                    break
    else:
        raw["eligibility"] = _section_after_heading(elements, _ELIG_HEADING_RE, 3000)
        raw.setdefault("requirements", _section_after_heading(elements, _REQ_HEADING_RE, 3000))
        probe = f"{raw.get('title') or ''} {head_text[:4000]}"
        low = probe.lower()
        if re.search(r"fully[- ]funded|full scholarship|full funding", low):
            raw["fundingType"] = "Fully funded"
        elif re.search(r"partial(?:ly)?[- ]funded|partial scholarship|tuition (?:fee )?waiver", low):
            raw["fundingType"] = "Partially funded"
        levels = [label for label, pat in _DEGREE_PATTERNS if re.search(pat, low)]
        raw["degreeLevel"] = ", ".join(levels) or None
        for m in re.finditer(r"stipend|allowance|award|worth|valued at|grant of|amount", low):
            am = _AMOUNT_RE.search(probe, m.start(), m.end() + 120)
            if am:
                raw["amount"] = am.group(0).strip()
                break

    return normalize_fields(raw, kind, source_url), page_text


# =============================================================
# LLM EXTRACTION
# =============================================================

_SYSTEM_PROMPT = (
    "You extract structured data from the text of a single web page. "
    "Reply with ONE JSON object and nothing else — no markdown, no code fences, "
    "no commentary. Use null for anything the page does not state. Never invent "
    "facts, dates, amounts or URLs."
)

_SCHEMA = {
    "job": (
        '{"title": str, "organization": str, "location": str|null, '
        '"deadline": "YYYY-MM-DD"|null, "description": str, "requirements": str|null, '
        '"applyUrl": str|null, "employmentType": str|null, "salary": str|null}'
    ),
    "scholarship": (
        '{"title": str, "organization": str, "location": str|null, '
        '"deadline": "YYYY-MM-DD"|null, "description": str, "requirements": str|null, '
        '"applyUrl": str|null, "fundingType": str|null, "amount": str|null, '
        '"eligibility": str|null, "degreeLevel": str|null}'
    ),
    # No posterUrl: image URLs are not in the page text the LLM sees, so it
    # could only guess one. The poster always comes from the heuristic.
    "event": (
        '{"title": str, "organization": str|null, "location": str|null, '
        '"eventDate": "YYYY-MM-DD"|"YYYY-MM-DDTHH:MM"|null, '
        '"eventEndDate": "YYYY-MM-DD"|"YYYY-MM-DDTHH:MM"|null, "eventTime": str|null, '
        '"deadline": "YYYY-MM-DD"|null, "description": str, "applyUrl": str|null}'
    ),
}


def _event_llm_rules():
    return (
        '- "title": the event\'s name, not the website name.\n'
        '- "organization": who organises / hosts the event, else null.\n'
        '- "location": the venue (e.g. "Main Auditorium, MAJU Karachi"), "Online" for a virtual event, else null.\n'
        '- "eventDate": when the event starts — "YYYY-MM-DDTHH:MM" (24-hour, local time) if a start time is '
        'stated, else "YYYY-MM-DD"; null if the page states no date.\n'
        '- "eventEndDate": when a multi-day event ends, same format, else null.\n'
        '- "eventTime": the time as written, e.g. "10:00 AM – 1:00 PM", else null.\n'
        '- "deadline": the registration deadline as YYYY-MM-DD, or null if none is stated.\n'
        '- "description": a faithful plain-text description from the page (max ~3000 characters).\n'
        '- "applyUrl": the absolute registration / ticket URL, only if it appears in the text, else null.\n'
        "- A date written without a year takes the year from elsewhere on the page (e.g. its publish "
        f"date); if there is none, assume the current year (today is {date.today().isoformat()}).\n"
    )


def build_llm_messages(kind, source_url, page_title, page_text):
    noun = KIND_NOUN[kind]
    if kind == "event":
        rules = _event_llm_rules()
    else:
        rules = _job_scholarship_llm_rules(kind, noun)
    user = (
        f"The page below is a{'n' if noun[0] in 'aeiou' else ''} {noun}. Extract it into exactly this JSON shape:\n"
        f"{_SCHEMA[kind]}\n\n"
        "Rules:\n"
        f"{rules}\n"
        f"PAGE URL: {source_url}\n"
        f"PAGE TITLE: {page_title or ''}\n"
        f"PAGE TEXT:\n{page_text}"
    )
    return [{"role": "system", "content": _SYSTEM_PROMPT}, {"role": "user", "content": user}]


def _job_scholarship_llm_rules(kind, noun):
    extra = (
        '- "employmentType": e.g. "Full-time", "Part-time", "Internship", "Contract".\n'
        '- "salary": as written on the page (currency + amount/range), else null.\n'
        if kind == "job" else
        '- "fundingType": e.g. "Fully funded", "Partially funded", "Tuition waiver".\n'
        '- "amount": the monetary value as written (e.g. "£18,000 per year"), else null.\n'
        '- "eligibility": who can apply (nationality, degree, GPA, experience), plain text.\n'
        '- "degreeLevel": e.g. "Undergraduate", "Masters", "PhD" (comma-separated if several).\n'
    )
    return (
        f'- "title": the {noun}\'s name, not the website name.\n'
        f'- "organization": the employer / scholarship provider.\n'
        '- "deadline": the application deadline as YYYY-MM-DD, or null if none is stated.\n'
        '- "description": a faithful plain-text description from the page (max ~3000 characters).\n'
        '- "requirements": key requirements/qualifications as plain text lines, or null.\n'
        '- "applyUrl": the absolute URL to apply, only if it appears in the text, else null.\n'
        f"{extra}"
    )


def parse_llm_json(text):
    """Pull the JSON object out of an LLM reply; None if there isn't a valid one."""
    if not text or not isinstance(text, str):
        return None
    s = re.sub(r"(?is)<think>.*?</think>", "", text).strip()
    fence = re.search(r"```(?:json)?\s*(.*?)```", s, re.DOTALL | re.IGNORECASE)
    if fence:
        s = fence.group(1).strip()
    start, end = s.find("{"), s.rfind("}")
    if start == -1 or end <= start:
        return None
    try:
        data = json.loads(s[start:end + 1])
    except ValueError:
        return None
    return data if isinstance(data, dict) else None


def _looks_valid(fields):
    """Reject replies that parsed as JSON but carry nothing useful."""
    title = fields.get("title") or ""
    return len(title) >= 3 and bool(fields.get("description") or fields.get("organization"))


class _DaemonPool:
    """A tiny bounded thread pool whose workers are daemon threads.

    Same Future semantics as ThreadPoolExecutor (a queued call can still be
    cancelled), but a provider call stuck in a socket read can never hold up
    interpreter shutdown: ThreadPoolExecutor joins its workers at exit.
    Workers start on first use.
    """

    def __init__(self, max_workers, name):
        self._max_workers = max_workers
        self._name = name
        self._queue = queue.SimpleQueue()
        self._threads = []
        self._lock = threading.Lock()

    def submit(self, fn, *args, **kwargs):
        future = concurrent.futures.Future()
        with self._lock:
            while len(self._threads) < self._max_workers:
                worker = threading.Thread(
                    target=self._work, daemon=True, name=f"{self._name}-{len(self._threads)}"
                )
                worker.start()
                self._threads.append(worker)
        self._queue.put((future, fn, args, kwargs))
        return future

    def _work(self):
        while True:
            future, fn, args, kwargs = self._queue.get()
            if not future.set_running_or_notify_cancel():
                continue  # cancelled while it waited in the queue
            try:
                result = fn(*args, **kwargs)
            except BaseException as exc:
                future.set_exception(exc)
            else:
                future.set_result(result)


# Bounded pool: a hung LLM call keeps its worker busy until the provider's
# own timeout fires, but never more than two at once.
_llm_pool = _DaemonPool(2, "listing-llm")


def llm_configured():
    """Is there any LLM backend to try? (Ollama, or a cloud provider with a key.)"""
    if config.USE_LOCAL_LLM:
        return True
    for provider in config.CLOUD_LLM_ORDER:
        if provider == "groq" and config.GROQ_API_KEYS:
            return True
        if provider == "gemini" and config.GEMINI_API_KEY:
            return True
    return False


def llm_extract(kind, source_url, page_title, page_text, timeout):
    """Run the LLM extraction with a wall-clock cap. Returns fields or None."""
    if timeout <= 1:
        print("  /listings/extract: no time left for the LLM; using heuristic")
        return None
    max_chars = config.LISTING_LLM_MAX_CHARS_LOCAL if config.USE_LOCAL_LLM else config.LISTING_LLM_MAX_CHARS
    messages = build_llm_messages(kind, source_url, page_title, (page_text or "")[:max_chars])
    # The provider request itself is capped too (not just our wait for it), so
    # an abandoned call stops instead of running on for CLOUD_LLM_TIMEOUT.
    future = _llm_pool.submit(
        rag._llm_chat, messages, 0.0, config.LISTING_LLM_MAX_TOKENS,
        timeout=max(1.0, min(timeout, config.CLOUD_LLM_TIMEOUT)),
    )
    try:
        reply = future.result(timeout=timeout)
    except concurrent.futures.TimeoutError:
        future.cancel()  # still queued behind other calls -> never runs
        print(f"  /listings/extract: LLM took longer than {timeout:.0f}s; using heuristic")
        return None
    except Exception as exc:  # LLMUnavailableError and anything provider-side
        print(f"  /listings/extract: LLM unavailable ({type(exc).__name__}: {exc}); using heuristic")
        return None
    data = parse_llm_json(reply)
    if data is None:
        print("  /listings/extract: LLM reply was not valid JSON; using heuristic")
        return None
    # Never trust an LLM-supplied poster (it can't see image URLs); the
    # heuristic's og:image / JSON-LD image back-fills it in _finalize.
    data.pop("posterUrl", None)
    fields = normalize_fields(data, kind, source_url)
    if not _looks_valid(fields):
        print("  /listings/extract: LLM JSON had no usable title/description; using heuristic")
        return None
    return fields


# =============================================================
# ENTRY POINT
# =============================================================

def _prefer_precise_dates(llm_fields, heuristic):
    """Keep the heuristic's start/end when it is the same day but has a time.

    JSON-LD "2026-10-20T10:00:00+05:00" beats an LLM "2026-10-20" — the
    structured value carries the time of day and timezone the text lacked.
    """
    for key in ("eventDate", "eventEndDate"):
        llm_value, heur_value = llm_fields.get(key), heuristic.get(key)
        if (llm_value and heur_value and "T" not in llm_value and "T" in heur_value
                and heur_value[:10] == llm_value[:10]):
            llm_fields[key] = heur_value
    return llm_fields


KIND_ERROR = "kind must be 'job', 'scholarship' or 'event'"
# Stages reported to `progress`, in order ("extracting" only when an LLM is
# configured and there is time for it; "fallback" when the heuristic result
# is used because the LLM failed, timed out or isn't configured).
STAGES = ("fetching", "reading", "extracting", "fallback", "done")


def extract_listing(url, kind, progress=None):
    """Fetch `url` and extract a `kind` ("job" | "scholarship" | "event") listing.

    `progress(stage)` (optional) is called at the real boundaries — see
    STAGES. A failing callback never breaks the extraction.
    Raises url_safety.UnsafeURLError (-> 400) or url_safety.FetchError (-> 502).
    """
    def report(stage):
        if progress is not None:
            try:
                progress(stage)
            except Exception as exc:
                print(f"  /listings/extract: progress callback failed ({type(exc).__name__})")

    if kind not in LISTING_KINDS:
        raise url_safety.UnsafeURLError(KIND_ERROR)
    started = time.monotonic()
    report("fetching")
    page = url_safety.fetch_public_url(url)
    source_url = page.url

    report("reading")
    heuristic, page_text = heuristic_extract(page.content, page.encoding, source_url, kind)

    remaining = config.LISTING_TOTAL_BUDGET - (time.monotonic() - started)
    timeout = min(config.LISTING_LLM_TIMEOUT, remaining)
    llm_fields = None
    if not llm_configured():
        print("  /listings/extract: no LLM configured; using heuristic")
    elif timeout <= 1:
        print("  /listings/extract: no time left for the LLM; using heuristic")
    else:
        report("extracting")
        llm_fields = llm_extract(kind, source_url, heuristic.get("title"), page_text, timeout=timeout)
    if llm_fields is not None:
        if kind == "event":
            llm_fields = _prefer_precise_dates(llm_fields, heuristic)
        fields, extracted_by = _finalize(llm_fields, kind, source_url, heuristic), "llm"
    else:
        report("fallback")
        fields, extracted_by = _finalize(heuristic, kind, source_url, {}), "heuristic"

    report("done")
    return {"kind": kind, "sourceUrl": source_url, "extractedBy": extracted_by, "fields": fields}


# =============================================================
# BACKGROUND EXTRACT JOBS (/listings/extract-jobs)
# =============================================================
# Same extraction as above, run on a bounded daemon pool so Node can poll
# the current stage instead of holding one request open for up to a minute.
# In memory only: a restart forgets the jobs (Node then sees a 404).

class ExtractJobsBusy(Exception):
    """The registry is full of unfinished jobs (-> 429)."""


_jobs = {}                    # jobId -> job dict, insertion (= start) order
_jobs_lock = threading.Lock()
_job_pool = _DaemonPool(config.LISTING_JOB_WORKERS, "listing-job")


def _iso_now():
    return datetime.now(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def _public_job(job):
    return {k: v for k, v in job.items() if not k.startswith("_")}


def _prune_jobs_locked():
    """Drop jobs finished more than LISTING_JOB_TTL ago, then the oldest
    finished ones while the registry is at its cap. Caller holds _jobs_lock."""
    now = time.monotonic()
    for job_id in [j for j, job in _jobs.items()
                   if job["_finished"] is not None and now - job["_finished"] > config.LISTING_JOB_TTL]:
        del _jobs[job_id]
    if len(_jobs) >= config.LISTING_JOB_MAX:
        for job_id in [j for j, job in _jobs.items() if job["_finished"] is not None]:
            del _jobs[job_id]
            if len(_jobs) < config.LISTING_JOB_MAX:
                break


def start_extract_job(url, kind):
    """Validate, register and queue an extraction. Returns the job id.

    Validation happens now, with the same messages as the sync endpoint, so
    a bad kind/URL is a 400 immediately instead of a failed job.
    Raises url_safety.UnsafeURLError (400) or ExtractJobsBusy (429).
    """
    if kind not in LISTING_KINDS:
        raise url_safety.UnsafeURLError(KIND_ERROR)
    url_safety.validate_public_url(url)
    job_id = uuid.uuid4().hex
    now = _iso_now()
    with _jobs_lock:
        _prune_jobs_locked()
        if len(_jobs) >= config.LISTING_JOB_MAX:
            raise ExtractJobsBusy("Too many listing extractions are running. Try again shortly.")
        _jobs[job_id] = {
            "jobId": job_id, "status": "running", "stage": "queued",
            "startedAt": now, "updatedAt": now, "result": None, "error": None,
            "_finished": None,
        }
    _job_pool.submit(_run_extract_job, job_id, url, kind)
    return job_id


def get_extract_job(job_id):
    """Public snapshot of a job, or None (unknown / expired)."""
    with _jobs_lock:
        _prune_jobs_locked()
        job = _jobs.get(job_id)
        return _public_job(job) if job else None


def _update_job(job_id, **changes):
    with _jobs_lock:
        job = _jobs.get(job_id)
        if job is None:
            return
        if job["_finished"] is not None:
            return  # a late progress report must not rewrite a finished job
        job.update(changes, updatedAt=_iso_now())


def _run_extract_job(job_id, url, kind):
    def progress(stage):
        _update_job(job_id, stage=stage)

    try:
        result = extract_listing(url, kind, progress=progress)
    except url_safety.UnsafeURLError as exc:
        error = {"status": 400, "message": str(exc)}
    except url_safety.FetchError as exc:
        error = {"status": 502, "message": str(exc)}
    except Exception as exc:  # never leave a job stuck in "running"
        print(f"  /listings/extract-jobs {job_id[:8]}: internal error {type(exc).__name__}: {ascii(str(exc))}")
        error = {"status": 500, "message": "Internal error while extracting the listing"}
    else:
        _update_job(job_id, status="done", stage="done", result=result, _finished=time.monotonic())
        return
    _update_job(job_id, status="failed", error=error, _finished=time.monotonic())
