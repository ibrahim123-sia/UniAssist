"""
========================================================
KB_INGEST.PY - Admin-driven knowledge-base ingestion
========================================================

Lets an administrator feed the chatbot from the admin panel instead of a
developer running `run.py scrape` + `run.py build`:

  - URL ingestion (`/kb/ingest-url`): one page, or a whole site (sitemap
    first, else a same-host BFS crawl), runs as an in-memory background job
    the admin panel polls (`/kb/jobs/{id}`). Chunks get ids
    `web_<sha1(url)[:12]>_<n>` and `origin: "admin_url"` metadata.
    Re-ingesting a URL replaces that URL's previous chunks.
  - Admin Q&A (`/kb/qa`): an admin's answer to an unanswered student
    question, stored as one `qa_<uuid>` chunk with `origin: "admin_qa"`.
    `DELETE /kb/qa/{id}` removes one again (Node replaces the chunk when an
    admin edits an answer).

Both kinds survive `run.py build` (see database.PRESERVED_ID_PREFIXES).

Every fetch goes through url_safety (SSRF-safe). Jobs live in memory only:
a restart forgets them (the chunks they wrote stay), which is acceptable
for an admin progress view.
"""

import hashlib        # For stable per-URL chunk id prefixes
import threading      # For background jobs and the shared write/job locks
import time           # For the polite crawl delay
import uuid           # For job ids and Q&A chunk ids
from collections import deque  # For the BFS frontier / sitemap queue
from datetime import datetime, timezone  # For startedAt/finishedAt/added_at timestamps
from urllib.parse import parse_qsl, urlencode, urljoin, urlsplit, urlunsplit  # For link canonicalisation

from bs4 import BeautifulSoup  # For sitemap XML and link extraction

import config         # KB_* limits
import database       # Chroma client/collection + keyword cache
import rag            # Shared embedding model
import scraper        # Shared extraction / chunking / URL filters
import url_safety     # SSRF-safe fetching

ORIGIN_URL = "admin_url"
ORIGIN_QA = "admin_qa"
MAX_JOB_ERRORS = 50
MAX_JOBS_KEPT = 50
RECENT_JOBS = 20
MAX_SITEMAP_FETCHES = 30
MAX_SITEMAP_URLS = 10000


class IngestConflict(Exception):
    """A site crawl is already queued/running (-> 409)."""


class IngestBusy(Exception):
    """Too many ingest jobs at once (-> 429)."""


_jobs = {}                      # jobId -> job dict (mutated only under _jobs_lock)
_job_order = deque()            # jobIds, oldest first
_jobs_lock = threading.Lock()
# Serialises collection writes from this module: the delete-then-add that
# replaces a URL's chunks must not interleave with another job writing the
# same URL (two "page" jobs for one link would otherwise double its chunks).
_write_lock = threading.Lock()


def active_job_count():
    """Queued or running ingest jobs (the KB snapshot waits for them)."""
    with _jobs_lock:
        return sum(1 for j in _jobs.values() if j["status"] in ("queued", "running"))


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds").replace("+00:00", "Z")


def _collection():
    return database.get_or_create_collection(database.get_chroma_client())


def _existing_collection():
    """Read/delete paths: never create chroma_db just to find nothing."""
    return database.get_existing_collection()


def url_chunk_prefix(url):
    return "web_" + hashlib.sha1(url.encode("utf-8")).hexdigest()[:12]


# =============================================================
# WRITES
# =============================================================

def _doc_text(page_title, chunk):
    """Same self-contained "title / heading / text" layout as build_database."""
    text = chunk["text"]
    parts = []
    if page_title:
        parts.append(page_title)
    heading = chunk.get("heading") or ""
    # chunk_elements already opens most chunks with their heading.
    if heading and heading != page_title and not text.startswith(heading):
        parts.append(heading)
    return "\n\n".join(parts + [text]) if parts else text


def replace_url_chunks(source_url, page_title, chunks):
    """Embed `chunks` and store them as `source_url`'s web_ chunks, replacing
    any earlier ingestion of the same URL. Returns the number added."""
    if not chunks:
        return 0
    docs = [_doc_text(page_title, c) for c in chunks]
    model = rag.get_embedding_model()
    embeddings = model.encode(docs)
    embeddings = [e.tolist() if hasattr(e, "tolist") else list(e) for e in embeddings]
    prefix = url_chunk_prefix(source_url)
    added_at = _now()
    ids = [f"{prefix}_{i}" for i in range(len(docs))]
    metas = [
        {
            "source": source_url,
            "title": page_title or "",
            "heading": c.get("heading") or "",
            "origin": ORIGIN_URL,
            "added_at": added_at,
            "chunk_id": cid,
        }
        for cid, c in zip(ids, chunks)
    ]
    with _write_lock:
        col = _collection()
        # Drop every earlier chunk of this URL first (a previous run may have
        # produced more chunks than this one, so overwriting by id isn't
        # enough). PATCH /chunks merges metadata, so source/origin survive
        # admin edits and this filter still finds them.
        col.delete(where={"$and": [{"source": source_url}, {"origin": ORIGIN_URL}]})
        col.add(ids=ids, documents=docs, metadatas=metas, embeddings=embeddings)
    database.clear_keyword_cache()
    return len(ids)


def add_qa(question, answer, source_label):
    """Store an admin's answer as one searchable chunk. Returns its id."""
    cid = f"qa_{uuid.uuid4().hex}"
    text = f"Q: {question}\nA: {answer}"
    embedding = rag.get_embedding_model().encode(text)
    embedding = embedding.tolist() if hasattr(embedding, "tolist") else list(embedding)
    with _write_lock:
        _collection().add(
            ids=[cid],
            documents=[text],
            metadatas=[{
                "source": source_label,
                "origin": ORIGIN_QA,
                "added_at": _now(),
                "chunk_id": cid,
            }],
            embeddings=[embedding],
        )
    database.clear_keyword_cache()
    return cid


def delete_qa(chunk_id):
    """Delete one admin Q&A chunk. Returns True if it existed.

    Only `qa_` ids — the caller (api) enforces that before calling.
    """
    with _write_lock:
        col = _existing_collection()
        if col is None:
            return False
        found = col.get(ids=[chunk_id], include=[]).get("ids") or []
        if found:
            col.delete(ids=found)
    if found:
        database.clear_keyword_cache()
    return bool(found)


def list_sources():
    """Distinct admin-ingested URLs with chunk counts, newest first."""
    col = _existing_collection()
    if col is None:
        return []
    data = col.get(where={"origin": ORIGIN_URL}, include=["metadatas"])
    by_source = {}
    for meta in data.get("metadatas") or []:
        meta = meta or {}
        src = meta.get("source") or ""
        entry = by_source.setdefault(src, {"source": src, "title": "", "chunks": 0, "addedAt": None})
        entry["chunks"] += 1
        if not entry["title"] and meta.get("title"):
            entry["title"] = meta["title"]
        added = meta.get("added_at")
        if added and (entry["addedAt"] is None or added > entry["addedAt"]):
            entry["addedAt"] = added
    return sorted(by_source.values(), key=lambda e: e["addedAt"] or "", reverse=True)


def delete_source(source_url):
    """Delete every admin-ingested chunk of `source_url`. Returns how many."""
    with _write_lock:
        col = _existing_collection()
        if col is None:
            return 0
        found = col.get(
            where={"$and": [{"source": source_url}, {"origin": ORIGIN_URL}]}, include=[]
        )
        ids = found.get("ids") or []
        if ids:
            col.delete(ids=ids)
    if ids:
        database.clear_keyword_cache()
    return len(ids)


# =============================================================
# JOBS
# =============================================================

def _snapshot(job):
    out = dict(job)
    out["errors"] = list(job["errors"])
    return out


def get_job(job_id):
    with _jobs_lock:
        job = _jobs.get(job_id)
        return _snapshot(job) if job else None


def list_jobs(limit=RECENT_JOBS):
    with _jobs_lock:
        ids = list(_job_order)[-limit:]
        return [_snapshot(_jobs[i]) for i in reversed(ids) if i in _jobs]


def _update(job_id, **changes):
    with _jobs_lock:
        _jobs[job_id].update(changes)


def _record_error(job_id, url, error):
    # Record first: the admin's error list must not depend on the console.
    # ascii(): a non-cp1252 URL (Urdu slug, emoji) used to crash the print on
    # a Windows console and lose the error entirely.
    with _jobs_lock:
        errors = _jobs[job_id]["errors"]
        if len(errors) < MAX_JOB_ERRORS:
            errors.append({"url": url, "error": str(error)[:300]})
    print(f"  KB ingest: {ascii(url)} -> {ascii(str(error)[:300])}")


def _bump(job_id, **deltas):
    with _jobs_lock:
        job = _jobs[job_id]
        for key, delta in deltas.items():
            job[key] = (job.get(key) or 0) + delta


def start_ingest(url, mode, max_pages):
    """Validate, register and start an ingest job. Returns its snapshot.

    Raises url_safety.UnsafeURLError (400), IngestConflict (409) or
    IngestBusy (429). The URL is validated up front so an obviously bad
    link is a 400 now, not a "failed" job later.
    """
    if mode not in ("page", "site"):
        raise url_safety.UnsafeURLError("mode must be 'page' or 'site'")
    start_url = url_safety.validate_public_url(url)
    max_pages = max(1, min(int(max_pages or config.KB_INGEST_DEFAULT_PAGES), config.KB_INGEST_MAX_PAGES))
    if mode == "page":
        max_pages = 1

    job_id = uuid.uuid4().hex
    with _jobs_lock:
        active = [j for j in _jobs.values() if j["status"] in ("queued", "running")]
        if mode == "site" and any(j["mode"] == "site" for j in active):
            raise IngestConflict("A website crawl is already running. Wait for it to finish.")
        if len(active) >= config.KB_MAX_RUNNING_JOBS:
            raise IngestBusy("Too many ingest jobs are running. Try again shortly.")
        job = {
            "jobId": job_id,
            "status": "queued",
            "url": start_url,
            "mode": mode,
            "maxPages": max_pages,
            "pagesDone": 0,
            "pagesTotal": 1 if mode == "page" else None,
            "pagesSucceeded": 0,
            "chunksAdded": 0,
            "errors": [],
            "startedAt": _now(),
            "finishedAt": None,
        }
        _jobs[job_id] = job
        _job_order.append(job_id)
        # Forget the oldest finished jobs beyond the cap.
        while len(_job_order) > MAX_JOBS_KEPT:
            oldest = _job_order[0]
            if _jobs.get(oldest, {}).get("status") in ("queued", "running"):
                break
            _job_order.popleft()
            _jobs.pop(oldest, None)
        snapshot = _snapshot(job)

    thread = threading.Thread(target=_run_job, args=(job_id,), daemon=True, name=f"kb-ingest-{job_id[:8]}")
    thread.start()
    return snapshot


def _run_job(job_id):
    job = get_job(job_id)
    _update(job_id, status="running")
    session = url_safety.make_session()
    try:
        if job["mode"] == "page":
            _ingest_one(job_id, canonical_url(job["url"]), session, site_host=None)
        else:
            _crawl_site(job_id, job["url"], job["maxPages"], session)
    except Exception as exc:  # never leave a job stuck in "running"
        _record_error(job_id, job["url"], f"Internal error: {type(exc).__name__}: {exc}")
    finally:
        session.close()
        final = get_job(job_id)
        _update(
            job_id,
            status="done" if final["chunksAdded"] > 0 else "failed",
            finishedAt=_now(),
        )
        print(f"  KB ingest job {job_id[:8]} finished: {final['pagesSucceeded']}/{final['pagesDone']} pages, "
              f"{final['chunksAdded']} chunks, {len(final['errors'])} errors")


# =============================================================
# PAGE INGESTION
# =============================================================

def _same_host(a, b):
    a = (a or "").lower()
    b = (b or "").lower()
    return a.removeprefix("www.") == b.removeprefix("www.")


def _ingest_one(job_id, url, session, site_host, collect_links=False):
    """Fetch + chunk + store one page. Returns the page's same-host links
    (when collect_links) so the BFS crawl reuses the fetch."""
    _bump(job_id, pagesDone=1)
    try:
        page = url_safety.fetch_public_url(url, session=session)
    except (url_safety.UnsafeURLError, url_safety.FetchError) as exc:
        _record_error(job_id, url, exc)
        return []
    final_url = canonical_url(page.url)
    if site_host and not _same_host(urlsplit(final_url).hostname, site_host):
        _record_error(job_id, url, f"Redirected off-site to {urlsplit(final_url).hostname}")
        return []

    links = _extract_links(page.content, page.encoding, final_url, site_host) if collect_links else []

    title, elements = scraper.extract_structured_from_html(page.content, page.encoding)
    if not elements:
        _record_error(job_id, final_url, "No readable content (archive/search page, or text is rendered by JavaScript)")
        return links
    chunks = scraper.chunk_elements(elements, page_title=title)
    if not chunks:
        _record_error(job_id, final_url, "Page has no usable text after cleaning")
        return links
    added = replace_url_chunks(final_url, title, chunks)
    _bump(job_id, chunksAdded=added, pagesSucceeded=1)
    return links


# Query parameters that never change page content (tracking, share widgets).
_DROP_PARAMS = ("utm_", "fbclid", "gclid", "mc_cid", "mc_eid", "replytocom", "share", "amp")


def canonical_url(url):
    """Drop the fragment and tracking params; lower-case scheme/host.

    Keeps meaningful query strings (WordPress `?page_id=12` permalinks are
    real pages) but sorts them so `?a=1&b=2` and `?b=2&a=1` dedupe.
    """
    parts = urlsplit(url)
    query = [
        (k, v) for k, v in parse_qsl(parts.query, keep_blank_values=True)
        if not k.lower().startswith(_DROP_PARAMS)
    ]
    return urlunsplit((
        parts.scheme.lower(), parts.netloc.lower(), parts.path or "/",
        urlencode(sorted(query)), "",
    ))


def _crawlable(url, site_host):
    try:
        parts = urlsplit(url)
    except ValueError:
        return False
    if parts.scheme not in ("http", "https") or not _same_host(parts.hostname, site_host):
        return False
    # Reuse the bulk scraper's filters: binary/asset extensions, uploads,
    # WordPress listing pages (author/tag/category/page/feed/search).
    return scraper.should_include_url(url, parts.hostname)


def _extract_links(content, encoding, base_url, site_host):
    soup = scraper.parse_html(content, encoding)
    links = []
    for a in soup.find_all("a", href=True):
        href = a["href"].strip()
        if not href or href.startswith(("mailto:", "tel:", "javascript:", "#")):
            continue
        try:
            absolute = canonical_url(urljoin(base_url, href))
        except ValueError:
            continue
        if _crawlable(absolute, site_host):
            links.append(absolute)
    return links


# =============================================================
# SITE CRAWL
# =============================================================

def _sitemap_roots(base, session):
    roots = []
    try:
        robots = url_safety.fetch_public_url(
            base + "/robots.txt", allowed_types=("text/plain",), session=session, max_bytes=512 * 1024
        )
        for line in robots.text.splitlines():
            key, _, value = line.partition(":")
            if key.strip().lower() == "sitemap" and value.strip():
                roots.append(value.strip())
    except (url_safety.UnsafeURLError, url_safety.FetchError):
        pass
    roots += [base + "/sitemap.xml", base + "/sitemap_index.xml", base + "/wp-sitemap.xml"]
    return list(dict.fromkeys(roots))


def _walk_sitemap(root, site_host, session, budget):
    """Page URLs reachable from one sitemap (index) root."""
    urls, queue, seen = [], deque([root]), set()
    while queue and budget["fetches"] < MAX_SITEMAP_FETCHES and len(urls) < MAX_SITEMAP_URLS:
        sitemap_url = queue.popleft()
        if sitemap_url in seen:
            continue
        seen.add(sitemap_url)
        try:
            parts = urlsplit(sitemap_url)
        except ValueError:
            continue
        if not _same_host(parts.hostname, site_host):
            continue
        budget["fetches"] += 1
        try:
            page = url_safety.fetch_public_url(
                sitemap_url,
                allowed_types=url_safety.XML_CONTENT_TYPES + url_safety.HTML_CONTENT_TYPES,
                session=session,
            )
        except (url_safety.UnsafeURLError, url_safety.FetchError):
            continue
        seen.add(page.url)
        soup = BeautifulSoup(page.content, "xml")
        if soup.find("sitemapindex"):
            for loc in soup.select("sitemap > loc"):
                child = (loc.get_text() or "").strip()
                if child and child not in seen:
                    queue.append(child)
            continue
        for loc in soup.select("url > loc"):
            u = (loc.get_text() or "").strip()
            if u:
                urls.append(u)
    return urls


def _discover_from_sitemaps(start_url, site_host, session):
    parts = urlsplit(start_url)
    base = f"{parts.scheme}://{parts.netloc}"
    budget = {"fetches": 0}
    for root in _sitemap_roots(base, session):
        found = _walk_sitemap(root, site_host, session, budget)
        candidates = []
        seen = set()
        for u in found:
            try:
                cu = canonical_url(u)
            except ValueError:
                continue
            if cu not in seen and _crawlable(cu, site_host):
                seen.add(cu)
                candidates.append(cu)
        if candidates:
            return candidates
        if budget["fetches"] >= MAX_SITEMAP_FETCHES:
            break
    return []


def _depth_key(url):
    path = urlsplit(url).path
    return (len([seg for seg in path.split("/") if seg]), len(url))


def _crawl_site(job_id, start_url, max_pages, session):
    site_host = urlsplit(start_url).hostname
    start = canonical_url(start_url)
    candidates = _discover_from_sitemaps(start, site_host, session)

    if candidates:
        # Shallow pages first (home, /admissions/, /fee-structure/ ...): with a
        # small maxPages budget those carry far more than deep blog posts,
        # which sitemap indexes tend to list first.
        ordered = [start] + sorted((u for u in candidates if u != start), key=_depth_key)
        plan = ordered[:max_pages]
        _update(job_id, pagesTotal=len(plan))
        for i, url in enumerate(plan):
            if i:
                time.sleep(config.KB_CRAWL_DELAY)
            _ingest_one(job_id, url, session, site_host)
        return

    # No usable sitemap: breadth-first over same-host links.
    frontier, seen, done = deque([start]), {start}, 0
    while frontier and done < max_pages:
        url = frontier.popleft()
        if done:
            time.sleep(config.KB_CRAWL_DELAY)
        links = _ingest_one(job_id, url, session, site_host, collect_links=True)
        done += 1
        for link in links:
            if link not in seen:
                seen.add(link)
                frontier.append(link)
