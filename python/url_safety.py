"""
========================================================
URL_SAFETY.PY - SSRF-safe URL validation and fetching
========================================================

Every scraper that fetches an admin-supplied URL (job/scholarship
extraction, knowledge-base ingestion) goes through this module. An admin
typing a link must never be able to make this server talk to itself, the
LAN, or a cloud metadata endpoint (169.254.169.254) — this process holds the
INTERNAL_SECRET and sits next to Node and MongoDB.

Defences, in order:
  1. `validate_public_url`: only http/https, a real hostname, no
     user:pass@, only ports 80/443/8080/8443, and EVERY address the host
     resolves to must be globally routable.
  2. `fetch_public_url` follows redirects by hand (max 5) and re-validates
     each hop, so a public page can't bounce us to http://127.0.0.1/.
  3. The connection itself re-checks the peer address of the socket it
     actually opened. That closes the DNS-rebinding gap between step 1's
     lookup and the HTTP library's own lookup (a hostile DNS server can
     answer "public IP" the first time and "127.0.0.1" the second).
  4. Size (5 MB), wall-clock (20 s) and content-type limits. The body is
     read with `raw.read1` and the deadline checked after every read, so a
     server trickling bytes can't hold a worker past the deadline.

Errors:
  - `UnsafeURLError` (a ValueError): the URL/response is not acceptable —
    the endpoint should answer 400 with the message.
  - `FetchError`: the URL was fine but the page could not be fetched
    (network error, timeout, non-2xx status) — the endpoint should answer 502.
"""

import ipaddress      # For classifying resolved addresses (private, loopback, link-local, ...)
import socket         # For DNS resolution and peer-address checks on opened sockets
import time           # For the overall wall-clock deadline of a fetch
from dataclasses import dataclass  # For the FetchResult record
from typing import Iterable, Optional  # For type hints
from urllib.parse import urljoin, urlsplit, urlunsplit  # For URL parsing/normalisation and redirect resolution

import requests       # HTTP client used for the actual fetch
from requests.adapters import HTTPAdapter  # Hook point to install the peer-checking connection classes
from urllib3 import exceptions as urllib3_exceptions  # Read errors raised by resp.raw.read1
from urllib3.connection import HTTPConnection, HTTPSConnection  # Connection classes we subclass
from urllib3.connectionpool import HTTPConnectionPool, HTTPSConnectionPool  # Pools that use our connections


# =============================================================
# LIMITS
# =============================================================

ALLOWED_SCHEMES = ("http", "https")
ALLOWED_PORTS = {80, 443, 8080, 8443}
MAX_REDIRECTS = 5
FETCH_TIMEOUT = 20                  # seconds, whole fetch including redirects
MAX_BODY_BYTES = 5 * 1024 * 1024    # 5 MB
MAX_URL_LENGTH = 2048

HTML_CONTENT_TYPES = ("text/html", "application/xhtml+xml")
XML_CONTENT_TYPES = ("application/xml", "text/xml", "application/rss+xml", "text/plain")

# A real browser UA: several university / job sites serve a 403 or a
# stripped page to python-requests' default UA.
USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36"
)
DEFAULT_HEADERS = {
    "User-Agent": USER_AGENT,
    "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
    "Accept-Language": "en-US,en;q=0.9",
}

_REDIRECT_STATUSES = {301, 302, 303, 307, 308}


class UnsafeURLError(ValueError):
    """The URL (or what it redirected to / returned) is not allowed. -> HTTP 400."""


class FetchError(RuntimeError):
    """The URL is acceptable but the page could not be fetched. -> HTTP 502."""


# =============================================================
# VALIDATION
# =============================================================

def _is_public_ip(ip):
    """True only for globally routable unicast addresses."""
    if isinstance(ip, str):
        try:
            ip = ipaddress.ip_address(ip.split("%", 1)[0])  # drop an IPv6 zone id
        except ValueError:
            return False
    # ::ffff:127.0.0.1 must be judged as the IPv4 address it really is.
    mapped = getattr(ip, "ipv4_mapped", None)
    if mapped is not None:
        ip = mapped
    if (
        ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_multicast
        or ip.is_reserved or ip.is_unspecified
    ):
        return False
    # `is_global` additionally excludes carrier-grade NAT (100.64.0.0/10),
    # documentation and benchmarking ranges that the flags above miss.
    return ip.is_global


def _resolve(host, port):
    try:
        infos = socket.getaddrinfo(host, port, type=socket.SOCK_STREAM)
    except (socket.gaierror, UnicodeError, OSError) as exc:
        raise UnsafeURLError(f"Could not resolve host '{host}'") from exc
    addrs = {info[4][0] for info in infos}
    if not addrs:
        raise UnsafeURLError(f"Could not resolve host '{host}'")
    return addrs


def is_public_host(host):
    """False when `host` is local or private, without fetching anything.

    For URLs we only STORE (an event poster that every viewer's browser will
    load): a localhost name, a bare IP in a non-public range, or a name that
    resolves to any non-public address is refused. A name that does not
    resolve at all is let through — there is nothing internal to reach, the
    image simply won't load.
    """
    host = (host or "").strip().strip("[]").rstrip(".").lower()
    if not host:
        return False
    if host == "localhost" or host.endswith(".localhost"):
        return False
    try:
        ipaddress.ip_address(host.split("%", 1)[0])
    except ValueError:
        pass
    else:
        return _is_public_ip(host)
    try:
        infos = socket.getaddrinfo(host, None, type=socket.SOCK_STREAM)
    except (socket.gaierror, UnicodeError, OSError):
        return True
    return all(_is_public_ip(info[4][0]) for info in infos)


def validate_public_url(url):
    """Return the normalised URL if it is safe to fetch, else raise UnsafeURLError.

    Normalisation: scheme/host lower-cased, fragment dropped. DNS is resolved
    here and the URL is rejected if ANY of the host's addresses is non-public
    (an attacker controlling DNS could otherwise mix one public and one
    private record and hope the client picks the private one).
    """
    if not isinstance(url, str):
        raise UnsafeURLError("URL must be a string")
    url = url.strip()
    if not url:
        raise UnsafeURLError("URL is required")
    if len(url) > MAX_URL_LENGTH:
        raise UnsafeURLError("URL is too long")
    if any(c.isspace() or ord(c) < 32 for c in url):
        raise UnsafeURLError("URL must not contain whitespace or control characters")

    try:
        parts = urlsplit(url)
    except ValueError as exc:
        raise UnsafeURLError(f"Invalid URL: {exc}") from exc

    scheme = (parts.scheme or "").lower()
    if scheme not in ALLOWED_SCHEMES:
        raise UnsafeURLError("Only http:// and https:// URLs are allowed")
    if parts.username is not None or parts.password is not None:
        raise UnsafeURLError("URLs with embedded credentials are not allowed")

    host = parts.hostname  # lower-cased, brackets stripped for IPv6
    if not host:
        raise UnsafeURLError("URL must include a hostname")

    try:
        port = parts.port
    except ValueError as exc:
        raise UnsafeURLError("URL has an invalid port") from exc
    if port is not None and port not in ALLOWED_PORTS:
        raise UnsafeURLError(f"Port {port} is not allowed (use 80, 443, 8080 or 8443)")

    if host == "localhost" or host.endswith(".localhost"):
        raise UnsafeURLError("URL points to a private or local address")

    effective_port = port or (443 if scheme == "https" else 80)
    for addr in _resolve(host, effective_port):
        if not _is_public_ip(addr):
            raise UnsafeURLError("URL points to a private or local address")

    netloc = parts.netloc.rsplit("@", 1)[-1]
    # Lower-case only the host part; keep an explicit port as typed.
    if parts.port is not None:
        netloc = f"{netloc.rsplit(':', 1)[0].lower()}:{parts.port}"
    else:
        netloc = netloc.lower()
    return urlunsplit((scheme, netloc, parts.path or "/", parts.query, ""))


# =============================================================
# PEER-CHECKING CONNECTIONS (DNS-rebinding defence)
# =============================================================

def _check_peer(sock):
    try:
        peer = sock.getpeername()[0]
    except OSError:
        return  # not connected yet / no peer — nothing to judge
    if not _is_public_ip(peer):
        try:
            sock.close()
        finally:
            raise UnsafeURLError("URL points to a private or local address")


class _SafeHTTPConnection(HTTPConnection):
    def _new_conn(self):
        sock = super()._new_conn()
        _check_peer(sock)
        return sock


class _SafeHTTPSConnection(HTTPSConnection):
    def _new_conn(self):
        sock = super()._new_conn()
        _check_peer(sock)
        return sock


class _SafeHTTPConnectionPool(HTTPConnectionPool):
    ConnectionCls = _SafeHTTPConnection


class _SafeHTTPSConnectionPool(HTTPSConnectionPool):
    ConnectionCls = _SafeHTTPSConnection


class _SafeAdapter(HTTPAdapter):
    def init_poolmanager(self, *args, **kwargs):
        super().init_poolmanager(*args, **kwargs)
        self.poolmanager.pool_classes_by_scheme = {
            "http": _SafeHTTPConnectionPool,
            "https": _SafeHTTPSConnectionPool,
        }


def make_session():
    """A requests Session whose every connection is peer-checked.

    trust_env=False: an HTTP(S)_PROXY in the environment would make the
    "peer" the proxy (defeating the check) and .netrc credentials must never
    be sent to an admin-chosen host.
    """
    session = requests.Session()
    session.trust_env = False
    adapter = _SafeAdapter(max_retries=0)
    session.mount("http://", adapter)
    session.mount("https://", adapter)
    session.headers.update(DEFAULT_HEADERS)
    return session


# =============================================================
# FETCH
# =============================================================

@dataclass
class FetchResult:
    url: str                    # final URL after redirects
    status: int
    content_type: str           # bare media type, lower-case ("text/html")
    encoding: Optional[str]     # charset from the Content-Type header, if any
    content: bytes

    @property
    def text(self):
        enc = self.encoding or "utf-8"
        try:
            return self.content.decode(enc, errors="replace")
        except LookupError:
            return self.content.decode("utf-8", errors="replace")


def _parse_content_type(header):
    media, _, params = (header or "").partition(";")
    charset = None
    for p in params.split(";"):
        k, _, v = p.strip().partition("=")
        if k.lower() == "charset" and v:
            charset = v.strip().strip('"\'') or None
    return media.strip().lower(), charset


def _looks_like_html(body):
    head = body[:512].lstrip().lower()
    return head.startswith((b"<!doctype html", b"<html", b"<head", b"<body", b"<?xml"))


def _set_read_timeout(resp, seconds):
    """Make the next socket recv give up after `seconds` (the time left).

    requests' read timeout applies per recv, so on its own it never stops a
    server that trickles one byte every few seconds; shrinking it to the
    remaining budget before each read does.
    """
    conn = getattr(resp.raw, "_connection", None)
    sock = getattr(conn, "sock", None)
    if sock is not None:
        try:
            sock.settimeout(max(0.05, seconds))
        except OSError:
            pass


def _read_capped(resp, max_bytes, deadline):
    """Read the body, enforcing `max_bytes` and the overall wall-clock `deadline`.

    `raw.read1` returns as soon as ANY bytes arrive (iter_content blocks
    until a full 64 KB chunk or EOF), so the deadline is checked after every
    read even against a server trickling a few bytes at a time.
    """
    declared = resp.headers.get("Content-Length")
    if declared and declared.isdigit() and int(declared) > max_bytes:
        raise UnsafeURLError(f"Page is larger than {max_bytes // (1024 * 1024)} MB")
    buf = bytearray()
    while True:
        remaining = deadline - time.monotonic()
        if remaining <= 0:
            raise FetchError("Timed out while downloading the page")
        _set_read_timeout(resp, remaining)
        try:
            chunk = resp.raw.read1(65536, decode_content=True)
        except (urllib3_exceptions.HTTPError, OSError) as exc:
            if time.monotonic() >= deadline or "timed out" in str(exc).lower():
                raise FetchError("Timed out while downloading the page") from exc
            raise FetchError(f"Could not read the page: {type(exc).__name__}") from exc
        if not chunk:
            break
        buf.extend(chunk)
        if len(buf) > max_bytes:
            raise UnsafeURLError(f"Page is larger than {max_bytes // (1024 * 1024)} MB")
        if time.monotonic() > deadline:
            raise FetchError("Timed out while downloading the page")
    return bytes(buf)


def fetch_public_url(
    url,
    *,
    allowed_types: Iterable[str] = HTML_CONTENT_TYPES,
    max_bytes: int = MAX_BODY_BYTES,
    timeout: float = FETCH_TIMEOUT,
    max_redirects: int = MAX_REDIRECTS,
    session: Optional[requests.Session] = None,
):
    """Fetch an untrusted URL safely and return a FetchResult.

    Redirects are followed manually (each hop validated). Only a 2xx final
    response with one of `allowed_types` is accepted. Raises UnsafeURLError
    (-> 400) or FetchError (-> 502).
    """
    allowed_types = tuple(t.lower() for t in allowed_types)
    own_session = session is None
    session = session or make_session()
    deadline = time.monotonic() + timeout
    current = validate_public_url(url)
    try:
        for _hop in range(max_redirects + 1):
            remaining = deadline - time.monotonic()
            if remaining <= 0:
                raise FetchError("Timed out fetching the page")
            try:
                resp = session.get(
                    current,
                    allow_redirects=False,
                    stream=True,
                    timeout=(min(10.0, remaining), remaining),
                )
            except UnsafeURLError:
                raise
            except requests.RequestException as exc:
                # A peer-check rejection can surface wrapped in urllib3/requests errors.
                cause = exc
                for _ in range(10):  # bounded: exception chains can be cyclic
                    if cause is None:
                        break
                    if isinstance(cause, UnsafeURLError):
                        raise UnsafeURLError(str(cause)) from exc
                    cause = cause.__cause__ or cause.__context__
                raise FetchError(f"Could not fetch the page: {type(exc).__name__}") from exc

            try:
                if resp.status_code in _REDIRECT_STATUSES:
                    location = resp.headers.get("Location")
                    if not location:
                        raise FetchError(f"Redirect (HTTP {resp.status_code}) without a Location header")
                    current = validate_public_url(urljoin(current, location))
                    continue

                if not 200 <= resp.status_code < 300:
                    raise FetchError(f"Page returned HTTP {resp.status_code}")

                media, charset = _parse_content_type(resp.headers.get("Content-Type"))
                if media and media not in allowed_types:
                    raise UnsafeURLError(
                        f"Unsupported content type '{media}' (expected {', '.join(allowed_types)})"
                    )
                body = _read_capped(resp, max_bytes, deadline)
                if not media:
                    # No header at all: accept only if the body is plainly markup.
                    if not _looks_like_html(body):
                        raise UnsafeURLError("Response has no content type and does not look like HTML")
                    media = allowed_types[0] if allowed_types else "text/html"
                return FetchResult(
                    url=current, status=resp.status_code, content_type=media,
                    encoding=charset, content=body,
                )
            except requests.RequestException as exc:
                raise FetchError(f"Could not read the page: {type(exc).__name__}") from exc
            finally:
                resp.close()
        raise FetchError(f"Too many redirects (more than {max_redirects})")
    finally:
        if own_session:
            session.close()
