"""
Keeps the ChromaDB folder in Cloudflare R2 when the disk is ephemeral.

On Cloudflare Containers the disk is wiped whenever the container sleeps,
restarts or is redeployed, and ChromaDB (chroma_db/) is the only copy of the
knowledge base the admin builds from the panel. With R2 configured:

  - restore()  on startup downloads the last snapshot into chroma_db/ (only
               when chroma_db/ is missing or empty, so local data wins);
  - mark_dirty() is called after every successful knowledge-base write;
  - a background thread uploads a new snapshot once writes have been quiet
    for QUIET_SECONDS and no website import is still running;
  - flush()    on shutdown uploads any change not saved yet (the container
               gets SIGTERM before it sleeps).

Env: R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET
(R2_ENDPOINT instead of R2_ACCOUNT_ID for another S3-compatible store;
optional KB_SNAPSHOT_KEY, default "kb/chroma_db.tar.gz"). Without them every
function here is a no-op, so local development is unchanged.
"""

import os
import shutil
import sqlite3
import tarfile
import tempfile
import threading
import time

import config

SNAPSHOT_KEY = os.getenv("KB_SNAPSHOT_KEY", "kb/chroma_db.tar.gz")
QUIET_SECONDS = 30      # wait this long after the last write before uploading
CHECK_EVERY = 10        # background thread poll interval (seconds)

_R2 = {name: os.getenv(name) for name in ("R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_BUCKET")}
_ENDPOINT = (os.getenv("R2_ENDPOINT") or (
    f"https://{os.getenv('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com" if os.getenv("R2_ACCOUNT_ID") else ""
)).rstrip("/")

_lock = threading.Lock()          # one snapshot at a time
_dirty_since = None               # monotonic time of the oldest unsaved write
_last_write = 0.0
_thread = None


def enabled():
    return bool(_ENDPOINT) and all(_R2.values())


def _client():
    import boto3  # only needed when R2 is configured
    from botocore.config import Config
    return boto3.client(
        "s3",
        endpoint_url=_ENDPOINT,
        aws_access_key_id=_R2["R2_ACCESS_KEY_ID"],
        aws_secret_access_key=_R2["R2_SECRET_ACCESS_KEY"],
        region_name="auto",
        # R2 doesn't take the checksum trailers newer boto3 sends by default.
        config=Config(request_checksum_calculation="when_required", response_checksum_validation="when_required"),
    )


def _ingest_busy():
    try:
        import kb_ingest
        return kb_ingest.active_job_count() > 0
    except Exception:
        return False


def restore():
    """Download the last snapshot into an empty chroma_db/. Never raises."""
    if not enabled():
        return
    target = config.CHROMA_DB_PATH
    if os.path.isdir(target) and os.listdir(target):
        print("KB snapshot: local chroma_db/ already has data, not restoring")
        return
    try:
        with tempfile.TemporaryDirectory() as tmp:
            archive = os.path.join(tmp, "snapshot.tar.gz")
            try:
                _client().download_file(_R2["R2_BUCKET"], SNAPSHOT_KEY, archive)
            except Exception as exc:
                if "404" in str(exc) or "NoSuchKey" in str(exc) or "Not Found" in str(exc):
                    print("KB snapshot: none in R2 yet (fresh knowledge base)")
                    return
                raise
            staging = os.path.join(tmp, "chroma_db")
            with tarfile.open(archive, "r:gz") as tar:
                tar.extractall(staging, filter="data")
            if os.path.isdir(target):
                shutil.rmtree(target)
            shutil.move(staging, target)
        print(f"KB snapshot: restored chroma_db/ from r2://{_R2['R2_BUCKET']}/{SNAPSHOT_KEY}")
    except Exception as exc:
        print(f"KB snapshot: restore failed ({exc}); starting with an empty knowledge base")


def _copy_consistent(src, dst):
    """Copy chroma_db/ with SQLite files taken through the backup API, so a
    write landing mid-copy can't leave a torn database file."""
    os.makedirs(dst, exist_ok=True)
    for name in os.listdir(src):
        s, d = os.path.join(src, name), os.path.join(dst, name)
        if name.endswith(("-wal", "-shm", "-journal")):
            continue  # folded into the backup copy below
        if name.endswith(".sqlite3"):
            with sqlite3.connect(s) as source, sqlite3.connect(d) as dest:
                source.backup(dest)
        elif os.path.isdir(s):
            shutil.copytree(s, d)
        else:
            shutil.copy2(s, d)


def snapshot():
    """Upload chroma_db/ to R2 now. Returns True on success. Never raises."""
    global _dirty_since
    if not enabled() or not os.path.isdir(config.CHROMA_DB_PATH):
        return False
    with _lock:
        started_dirty = _dirty_since
        try:
            with tempfile.TemporaryDirectory() as tmp:
                copy = os.path.join(tmp, "chroma_db")
                _copy_consistent(config.CHROMA_DB_PATH, copy)
                archive = os.path.join(tmp, "snapshot.tar.gz")
                with tarfile.open(archive, "w:gz") as tar:
                    tar.add(copy, arcname=".")
                _client().upload_file(archive, _R2["R2_BUCKET"], SNAPSHOT_KEY)
            # A write that arrived during the upload keeps the flag set.
            if _dirty_since == started_dirty:
                _dirty_since = None
            print("KB snapshot: saved to R2")
            return True
        except Exception as exc:
            print(f"KB snapshot: upload failed ({exc}); will retry")
            return False


def mark_dirty():
    global _dirty_since, _last_write
    if not enabled():
        return
    now = time.monotonic()
    _last_write = now
    if _dirty_since is None:
        _dirty_since = now


def _loop():
    while True:
        time.sleep(CHECK_EVERY)
        if _dirty_since is None or _ingest_busy():
            continue
        if time.monotonic() - _last_write >= QUIET_SECONDS:
            snapshot()


def start():
    """Start the background uploader (once)."""
    global _thread
    if not enabled() or _thread is not None:
        return
    _thread = threading.Thread(target=_loop, name="kb-snapshot", daemon=True)
    _thread.start()


def flush():
    """Save unsaved changes before the process exits."""
    if _dirty_since is not None:
        snapshot()
