import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Search,
  Briefcase,
  GraduationCap,
  Link2,
  Loader2,
  Plus,
  X,
  Save,
  Send,
  Archive,
  Trash2,
  ExternalLink,
  AlertTriangle,
  Undo2,
  CalendarDays,
  Upload,
  ImageOff,
  RotateCcw,
  CheckCircle2,
  RefreshCw,
} from "lucide-react";
import toast from "react-hot-toast";
import moment from "moment";
import {
  fetchAdminListings,
  startScrapeJob,
  fetchScrapeJob,
  createListing,
  updateListing,
  deleteListing,
  uploadListingPoster,
} from "../../redux/slices/adminListingSlice";
import AdminTable, { AdminTableRow, AdminTableCell } from "../components/AdminTable";
import LoadingSkeleton from "../components/LoadingSkeleton";
import EmptyState from "../components/EmptyState";
import Pagination from "../components/Pagination";
import ConfirmDialog from "../components/ConfirmDialog";
import ProgressSteps, { UploadProgress } from "../../components/ProgressSteps";
import { C } from "../../theme/palette";
import { useDebouncedSearch } from "../utils/useDebouncedSearch";
import {
  KIND_LABELS,
  LISTING_FIELDS,
  deadlineDay,
  deadlineInfo,
  eventClock,
  eventDay,
  eventInfo,
  isHttpUrl,
  isPosterPath,
  posterSrc,
  safeHref,
} from "../../utils/listings";

const PAGE_SIZE = 25;

const TABS = [
  { key: "job", label: "Jobs", icon: Briefcase },
  { key: "scholarship", label: "Scholarships", icon: GraduationCap },
  { key: "event", label: "Events", icon: CalendarDays },
];

const KIND_ICONS = { job: Briefcase, scholarship: GraduationCap, event: CalendarDays };

const SCRAPE_PLACEHOLDERS = {
  job: "https://careers.example.com/jobs/123",
  scholarship: "https://example.org/scholarship",
  event: "https://example.org/events/tech-talk",
};

const POSTER_TYPES = ["image/jpeg", "image/png", "image/webp"];
const POSTER_MAX_BYTES = 3 * 1024 * 1024;

const STATUS_FILTERS = [
  { key: "", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "published", label: "Published" },
  { key: "archived", label: "Archived" },
];

const statusTone = (status) =>
  status === "published"
    ? { color: C.success, backgroundColor: C.successBg }
    : status === "draft"
      ? { color: C.warning, backgroundColor: C.warningBg }
      : { color: C.muted, backgroundColor: C.surfaceMuted };

const StatusBadge = ({ status }) => {
  return (
    <span
      className="inline-flex items-center px-2 py-0.5 text-xs rounded-full font-medium capitalize"
      style={statusTone(status)}
    >
      {status || "draft"}
    </span>
  );
};

const EVENT_DATE_KEYS = ["eventDate", "eventEndDate"];

// Form state is all strings; empty optional fields go to the API as null.
const toForm = (listing, kind) => {
  const form = { sourceUrl: listing?.sourceUrl || "" };
  LISTING_FIELDS[kind].forEach((f) => {
    if (EVENT_DATE_KEYS.includes(f.key)) form[f.key] = eventDay(listing?.[f.key]);
    else if (f.type === "date") form[f.key] = deadlineDay(listing?.[f.key]);
    else form[f.key] = listing?.[f.key] || "";
  });
  // The date pickers keep only the day, so carry a scraped start time over
  // into the free-text time field rather than losing it on save.
  if (kind === "event" && !form.eventTime) form.eventTime = eventClock(listing?.eventDate);
  return form;
};

const toPayload = (form, kind) => {
  const payload = {};
  LISTING_FIELDS[kind].forEach((f) => {
    const value = (form[f.key] || "").trim();
    payload[f.key] = value || (f.required ? "" : null);
  });
  return payload;
};

// `publishing` = the listing will be published after this save.
const validate = (form, kind, isNew, publishing) => {
  if (!form.title.trim()) return "Title is required.";
  if (isNew && !isHttpUrl(form.sourceUrl.trim())) return "Source link must be a valid http(s) URL.";
  if (form.applyUrl.trim() && !isHttpUrl(form.applyUrl.trim())) {
    return `${kind === "event" ? "Registration" : "Apply"} link must be a valid http(s) URL.`;
  }
  const tooLong = LISTING_FIELDS[kind].find((f) => f.max && (form[f.key] || "").length > f.max);
  if (tooLong) return `${tooLong.label} is too long (max ${tooLong.max} characters).`;
  if (kind === "event") {
    if (publishing && !form.eventDate) return "Set the event date before publishing.";
    if (form.eventEndDate && !form.eventDate) return "Set the event date as well as the end date.";
    if (form.eventEndDate && form.eventDate && form.eventEndDate < form.eventDate) {
      return "End date can't be before the event date.";
    }
    const poster = form.posterUrl.trim();
    if (poster && !isHttpUrl(poster) && !isPosterPath(poster)) {
      return "Poster must be an http(s) image link or an uploaded image.";
    }
  }
  return null;
};

// Poster field: paste an image link or upload one; previews either.
const PosterField = ({ value, onChange }) => {
  const dispatch = useDispatch();
  const fileRef = useRef(null);
  const [uploading, setUploading] = useState(false);
  const [percent, setPercent] = useState(0);
  const [broken, setBroken] = useState(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);
  const src = posterSrc(value.trim());

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (!POSTER_TYPES.includes(file.type)) {
      toast.error("Poster must be a JPG, PNG or WebP image.");
      return;
    }
    if (file.size > POSTER_MAX_BYTES) {
      toast.error("Poster is too large (max 3 MB).");
      return;
    }
    setPercent(0);
    setUploading(true);
    const result = await dispatch(
      uploadListingPoster(file, (pct) => mountedRef.current && setPercent(pct))
    );
    if (!mountedRef.current) return;
    setUploading(false);
    if (result.success && result.url) {
      setBroken(false);
      onChange(result.url);
      toast.success("Poster uploaded — save to keep it");
    } else {
      toast.error(result.message || "Failed to upload the poster");
    }
  };

  return (
    <div className="flex gap-3 items-start">
      <div
        className="w-20 h-24 rounded-control border shrink-0 flex items-center justify-center overflow-hidden"
        style={{ borderColor: C.border, backgroundColor: C.surfaceMuted }}
      >
        {src && !broken ? (
          <img src={src} alt="Poster preview" className="w-full h-full object-cover" onError={() => setBroken(true)} />
        ) : (
          <ImageOff className="w-5 h-5" style={{ color: C.muted }} />
        )}
      </div>
      <div className="flex-1 min-w-0 space-y-2">
        <input
          type="text"
          inputMode="url"
          value={value}
          onChange={(e) => {
            setBroken(false);
            onChange(e.target.value);
          }}
          placeholder="https://… image link, or upload one"
          className="w-full px-3 py-2 text-sm rounded-control border focus:outline-none bg-input-bg border-input-border text-text focus:border-primary focus-ring"
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="px-3 py-1.5 text-xs rounded-control border flex items-center gap-1.5 disabled:opacity-50 bg-surface border-border-strong text-label hover:bg-nav-hover transition-colors focus-ring"
          >
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? "Uploading..." : "Upload image"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              className="px-3 py-1.5 text-xs rounded-control border flex items-center gap-1.5 bg-surface border-border-strong text-muted hover:bg-nav-hover transition-colors focus-ring"
            >
              <X className="w-3.5 h-3.5" /> Remove
            </button>
          )}
          <span className="text-xs" style={{ color: broken ? C.danger : C.muted }}>
            {broken ? "Couldn't load this image." : "JPG, PNG or WebP, up to 3 MB."}
          </span>
        </div>
        {uploading && (
          <UploadProgress percent={percent} label={percent >= 100 ? "Saving poster" : "Uploading poster"} />
        )}
        <input ref={fileRef} type="file" accept={POSTER_TYPES.join(",")} onChange={onFile} className="hidden" />
      </div>
    </div>
  );
};

const EXTRACTED_BY = {
  llm: "Extracted automatically by AI — review before publishing.",
  heuristic:
    "AI extraction was unavailable, so only basic details were picked up. Check every field before publishing.",
  manual: "Added manually.",
};

const ListingEditor = ({ listing, kind, submitting, onClose, onSaved, onDeleted }) => {
  const dispatch = useDispatch();
  const isNew = !listing?._id;
  const fields = LISTING_FIELDS[kind];
  const [form, setForm] = useState(() => toForm(listing, kind));
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const initial = useMemo(() => JSON.stringify(toForm(listing, kind)), [listing, kind]);
  const dirty = JSON.stringify(form) !== initial;
  const status = listing?.status || "draft";

  // Closing (X, backdrop, Escape) with unsaved edits asks first.
  const requestClose = useCallback(() => {
    if (dirty) setConfirmDiscard(true);
    else onClose();
  }, [dirty, onClose]);

  // Escape closes the drawer — unless one of its dialogs is open (that
  // dialog handles Escape itself).
  useEffect(() => {
    if (confirmDelete || confirmDiscard) return undefined;
    const onKey = (e) => {
      if (e.key === "Escape") requestClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmDelete, confirmDiscard, requestClose]);

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const save = async (nextStatus) => {
    const publishing = nextStatus === "published" || (!nextStatus && status === "published");
    const problem = validate(form, kind, isNew, publishing);
    if (problem) {
      setError(problem);
      return;
    }
    setError("");
    const payload = toPayload(form, kind);

    let result;
    if (isNew) {
      const created = await dispatch(
        createListing({ ...payload, kind, sourceUrl: form.sourceUrl.trim() })
      ).unwrap();
      if (!created.success) {
        setError(created.message || "Save failed");
        return;
      }
      // Switch the editor to the saved draft first: if publishing fails
      // below, the admin keeps editing that draft instead of a "new" form
      // whose next save would create a duplicate.
      setForm(toForm(created.listing, kind));
      onSaved(created.listing);
      result = created;
      if (nextStatus && nextStatus !== "draft") {
        result = await dispatch(
          updateListing({ id: created.listing._id, changes: { status: nextStatus } })
        ).unwrap();
        if (!result.success) {
          toast.success("Draft saved");
          setError(`Saved as a draft, but it couldn't be published: ${result.message || "unknown error"}`);
          return;
        }
      }
    } else {
      const changes = { ...payload };
      if (nextStatus) changes.status = nextStatus;
      result = await dispatch(updateListing({ id: listing._id, changes })).unwrap();
    }

    if (result.success) {
      const messages = {
        published: "Listing published",
        archived: "Listing archived",
        draft: status === "published" ? "Listing unpublished" : "Draft saved",
      };
      toast.success(messages[nextStatus] || "Changes saved");
      setForm(toForm(result.listing, kind));
      onSaved(result.listing);
    } else {
      setError(result.message || "Save failed");
    }
  };

  const doDelete = async () => {
    const result = await dispatch(deleteListing(listing._id)).unwrap();
    if (result.success) {
      toast.success("Listing deleted");
      setConfirmDelete(false);
      onDeleted();
    } else {
      toast.error(result.message || "Delete failed");
    }
  };

  const btn = "px-3 py-1.5 text-sm rounded-control flex items-center gap-1.5 disabled:opacity-50 transition-colors focus-ring";

  return (
    <>
      <div className="fixed inset-0 z-50 flex" onClick={requestClose}>
        <div className="flex-1" style={{ backgroundColor: C.overlay }} />
        <aside
          className="w-full sm:w-[600px] h-full border-l flex flex-col"
          style={{ backgroundColor: C.surface, borderColor: C.border }}
          onClick={(e) => e.stopPropagation()}
          role="dialog"
          aria-modal="true"
          aria-label={isNew ? `New ${KIND_LABELS[kind].one.toLowerCase()}` : listing.title || "Listing"}
        >
          <header
            className="px-5 py-3 border-b flex items-center justify-between gap-3"
            style={{ borderColor: C.border }}
          >
            <div className="min-w-0">
              <h2 className="text-base font-semibold truncate" style={{ color: C.heading }}>
                {isNew ? `New ${KIND_LABELS[kind].one.toLowerCase()}` : listing.title || "Untitled"}
              </h2>
              {!isNew && (
                <div className="flex items-center gap-2 mt-0.5 text-xs" style={{ color: C.muted }}>
                  <StatusBadge status={status} />
                  <span>{KIND_LABELS[kind].one}</span>
                  {listing.publishedAt && status === "published" && (
                    <span>· published {moment(listing.publishedAt).fromNow()}</span>
                  )}
                </div>
              )}
            </div>
            <button onClick={requestClose} className="p-1 rounded shrink-0" style={{ color: C.muted }} aria-label="Close">
              <X className="w-5 h-5" />
            </button>
          </header>
  
          <div className="p-5 space-y-3 flex-1 overflow-y-auto">
            {!isNew && listing.extractedBy && (
              <p
                className="text-xs px-3 py-2 rounded-control border flex items-start gap-2"
                style={{
                  borderColor: listing.extractedBy === "heuristic" ? C.warningBorder : C.border,
                  backgroundColor: listing.extractedBy === "heuristic" ? C.warningBg : C.surfaceMuted,
                  color: listing.extractedBy === "heuristic" ? C.text : C.muted,
                }}
              >
                {listing.extractedBy === "heuristic" && (
                  <AlertTriangle className="w-3.5 h-3.5 mt-0.5 shrink-0" style={{ color: C.warning }} />
                )}
                {EXTRACTED_BY[listing.extractedBy] || ""}
              </p>
            )}
  
            <div>
              <label className="block text-xs font-semibold mb-1" style={{ color: C.label }}>
                Source link{isNew && " *"}
              </label>
              {isNew ? (
                <input
                  type="url"
                  value={form.sourceUrl}
                  onChange={set("sourceUrl")}
                  placeholder="https://… (where this was posted)"
                  className="w-full px-3 py-2 text-sm rounded-control border focus:outline-none bg-input-bg border-input-border text-text focus:border-primary focus-ring"
                />
              ) : (
                <a
                  href={safeHref(listing.sourceUrl) || undefined}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm inline-flex items-center gap-1 break-all"
                  style={{ color: C.link }}
                >
                  {listing.sourceUrl}
                  <ExternalLink className="w-3.5 h-3.5 shrink-0" />
                </a>
              )}
            </div>
  
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {fields.map((f) => {
                const value = form[f.key] || "";
                const wide = f.long || f.key === "title" || f.type === "url" || f.type === "poster";
                return (
                  <div key={f.key} className={wide ? "sm:col-span-2" : ""}>
                    <label className="flex items-baseline justify-between text-xs font-medium mb-1" style={{ color: C.muted }}>
                      <span>
                        {f.label}
                        {f.required && " *"}
                        {f.publishRequired && (
                          <span title="Required to publish"> * <span className="font-normal">(to publish)</span></span>
                        )}
                      </span>
                      {f.max && f.long && (
                        <span style={{ color: value.length > f.max ? C.danger : C.muted }}>
                          {value.length}/{f.max}
                        </span>
                      )}
                    </label>
                    {f.type === "poster" ? (
                      <PosterField
                        value={value}
                        onChange={(v) => setForm((cur) => ({ ...cur, [f.key]: v }))}
                      />
                    ) : f.long ? (
                      <textarea
                        value={value}
                        onChange={set(f.key)}
                        rows={f.rows}
                        className="w-full px-3 py-2 text-sm rounded-control border focus:outline-none bg-input-bg border-input-border text-text focus:border-primary focus-ring"
                      />
                    ) : (
                      <input
                        type={f.type || "text"}
                        value={value}
                        onChange={set(f.key)}
                        placeholder={f.placeholder}
                        maxLength={f.max}
                        className="w-full px-3 py-2 text-sm rounded-control border focus:outline-none bg-input-bg border-input-border text-text focus:border-primary focus-ring"
                      />
                    )}
                  </div>
                );
              })}
            </div>
  
            {error && (
              <p
                className="text-sm px-3 py-2 rounded-control border"
                role="alert"
                style={{ borderColor: C.dangerBorder, backgroundColor: C.dangerBg, color: C.danger }}
              >
                {error}
              </p>
            )}
          </div>
  
          <footer
            className="px-5 py-3 border-t flex flex-wrap items-center justify-end gap-2"
            style={{ borderColor: C.border }}
          >
            {!isNew && (
              <button
                onClick={() => setConfirmDelete(true)}
                disabled={submitting}
                className={`${btn} border mr-auto bg-surface border-danger-border text-danger hover:bg-danger-bg`}
              >
                <Trash2 className="w-4 h-4" /> Delete
              </button>
            )}
            {!isNew && status !== "archived" && (
              <button
                onClick={() => save("archived")}
                disabled={submitting}
                className={`${btn} border bg-surface border-border-strong text-label hover:bg-nav-hover`}
              >
                <Archive className="w-4 h-4" /> Archive
              </button>
            )}
            {!isNew && status !== "draft" && (
              <button
                onClick={() => save("draft")}
                disabled={submitting}
                className={`${btn} border bg-surface border-border-strong text-label hover:bg-nav-hover`}
                title={status === "archived" ? "Restore as a draft" : "Hide from students"}
              >
                <Undo2 className="w-4 h-4" /> {status === "archived" ? "Restore" : "Unpublish"}
              </button>
            )}
            <button
              onClick={() => save(isNew ? "draft" : undefined)}
              disabled={submitting || (!isNew && !dirty)}
              className={`${btn} border bg-surface border-border-strong text-label hover:bg-nav-hover`}
            >
              <Save className="w-4 h-4" /> {isNew ? "Save draft" : "Save"}
            </button>
            {status !== "published" && (
              <button
                onClick={() => save("published")}
                disabled={submitting}
                className={`${btn} font-bold text-on-primary bg-primary border-primary hover:bg-primary-hover`}
              >
                <Send className="w-4 h-4" /> {submitting ? "Saving..." : "Publish"}
              </button>
            )}
          </footer>
        </aside>
      </div>

      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        onConfirm={doDelete}
        loading={submitting}
        destructive
        title="Delete listing?"
        message="This permanently removes the listing. Students will no longer see it. Use Archive instead to keep a record."
        confirmLabel="Delete"
      />

      <ConfirmDialog
        open={confirmDiscard}
        onClose={() => setConfirmDiscard(false)}
        onConfirm={() => {
          setConfirmDiscard(false);
          onClose();
        }}
        destructive
        title="Discard changes?"
        message="You have unsaved edits in this listing. Close without saving them?"
        confirmLabel="Discard"
        cancelLabel="Keep editing"
      />
    </>
  );
};

// Scrape progress: the server reports a stage; the stepper shows the four
// steps an admin cares about. "fallback" stays on the extract step and adds
// a note; "done" (Python finished) means Node is saving the draft.
const SCRAPE_STEPS = [
  { key: "fetch", label: "Fetch page" },
  { key: "read", label: "Read content" },
  { key: "extract", label: "Extract details (AI)" },
  { key: "save", label: "Save draft" },
];
const STAGE_STEP = {
  queued: "fetch",
  fetching: "fetch",
  reading: "read",
  extracting: "extract",
  fallback: "extract",
  done: "save",
  saved: "save",
};
const SCRAPE_POLL_MS = 1000;
// Consecutive failed polls (network blips, 5xx) tolerated before giving up.
const SCRAPE_MAX_MISSES = 5;
const FALLBACK_NOTE = "AI unavailable — reading the page structure…";

const jobErrorMessage = (job) => {
  const err = job?.error;
  if (err && typeof err === "object" && err.message) return err.message;
  if (typeof err === "string" && err) return err;
  return "Could not scrape that link.";
};

// "Add from link": starts a server-side scrape job, polls it every second and
// shows its stages. Polling stops on unmount; the job itself keeps running on
// the server, so the draft is still created if the admin leaves the page.
const ScrapePanel = ({ kind, onDraft, onOpen }) => {
  const dispatch = useDispatch();
  const [url, setUrl] = useState("");
  const [starting, setStarting] = useState(false);
  // { type: "error" | "duplicate", message, listing? } — form-level notices.
  const [notice, setNotice] = useState(null);
  // The tracked job:
  // { jobId, kind, url, startedAt, endedAt, synced, job, fallback, failure, duplicate }
  const [run, setRun] = useState(null);
  const mountedRef = useRef(true);
  const onDraftRef = useRef(onDraft);
  useEffect(() => {
    onDraftRef.current = onDraft;
  });
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const jobId = run?.jobId;
  const running = !!run && !run.endedAt;

  useEffect(() => {
    if (!jobId) return undefined;
    let cancelled = false;
    let timer = null;
    let misses = 0;

    const finish = (patch) =>
      setRun((cur) => (cur && cur.jobId === jobId ? { ...cur, ...patch, endedAt: Date.now() } : cur));

    const tick = async () => {
      const res = await dispatch(fetchScrapeJob(jobId)).unwrap();
      if (cancelled) return;
      if (res.success && res.job) {
        misses = 0;
        const job = res.job;
        setRun((cur) => {
          if (!cur || cur.jobId !== jobId) return cur;
          const next = { ...cur, job };
          // Anchor the clock to the server's elapsed time on the first reply.
          if (!cur.synced && typeof job.elapsedMs === "number") {
            next.startedAt = Date.now() - job.elapsedMs;
            next.synced = true;
          }
          if (job.stage === "fallback") next.fallback = job.stageLabel || FALLBACK_NOTE;
          return next;
        });
        if (job.status === "done" && job.listing) {
          finish({});
          toast.success("Draft created — review it and publish");
          setUrl("");
          onDraftRef.current?.(job.listing);
          return;
        }
        if (job.status === "failed") {
          if (job.duplicate) {
            finish({ duplicate: job.duplicate });
            setNotice({
              type: "duplicate",
              message: "Already added — this link is already a listing.",
              listing: job.duplicate,
            });
          } else {
            finish({ failure: jobErrorMessage(job) });
          }
          return;
        }
      } else if (res.status === 404) {
        finish({ failure: "This scrape is no longer tracked (the server may have restarted). Try again." });
        return;
      } else if (res.status === 401 || res.status === 403) {
        finish({ failure: res.message || "You're not allowed to check this scrape." });
        return;
      } else {
        misses += 1;
        if (misses >= SCRAPE_MAX_MISSES) {
          finish({ failure: res.message || "Lost contact with the server while scraping." });
          return;
        }
      }
      timer = setTimeout(tick, SCRAPE_POLL_MS);
    };

    timer = setTimeout(tick, SCRAPE_POLL_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [dispatch, jobId]);

  const start = async (target, scrapeKind) => {
    setNotice(null);
    setRun(null);
    setStarting(true);
    const res = await dispatch(startScrapeJob({ url: target, kind: scrapeKind })).unwrap();
    if (!mountedRef.current) return;
    setStarting(false);
    if (res.success && res.jobId) {
      setRun({
        jobId: res.jobId,
        kind: scrapeKind,
        url: target,
        startedAt: Date.now(),
        endedAt: null,
        job: { status: "running", stage: "queued", stageLabel: "Starting…" },
      });
    } else if (res.status === 409 && res.listing) {
      setNotice({
        type: "duplicate",
        message: res.message || "Already added — this link is already a listing.",
        listing: res.listing,
      });
    } else {
      setNotice({ type: "error", message: res.message || "Could not scrape that link." });
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    const target = url.trim();
    if (!isHttpUrl(target)) {
      setNotice({ type: "error", message: "Enter a full link starting with http:// or https://" });
      return;
    }
    start(target, kind);
  };

  // Switching tabs clears a stale notice, but never a job that is running.
  useEffect(() => {
    setNotice(null);
    setRun((cur) => (cur && !cur.endedAt ? cur : null));
  }, [kind]);

  const kindLabel = KIND_LABELS[kind];
  const busy = starting || running;
  const job = run?.job;
  const failed = !!run?.failure;
  const succeeded = !!run?.endedAt && !failed && !run?.duplicate;
  const stepStatus = failed ? "failed" : succeeded ? "done" : "running";
  const runKindLabel = run ? KIND_LABELS[run.kind].one.toLowerCase() : "";

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-card border p-4 space-y-3 shadow-card"
      style={{ backgroundColor: C.surface, borderColor: C.border }}
    >
      <div>
        <h3 className="text-sm font-semibold" style={{ color: C.heading }}>
          Add {kindLabel.one.toLowerCase()} from link
        </h3>
        <p className="text-xs mt-0.5" style={{ color: C.muted }}>
          Paste the page where the {kindLabel.one.toLowerCase()} is posted. Its details are extracted into a
          draft you can review before students see it.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[220px]">
          <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.muted }} />
          <input
            type="text"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={busy}
            placeholder={SCRAPE_PLACEHOLDERS[kind]}
            aria-label={`Link to the ${kindLabel.one.toLowerCase()} page`}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-control border focus:outline-none focus:border-primary focus-ring disabled:opacity-60 bg-input-bg border-input-border text-text"
          />
        </div>
        <button
          type="submit"
          disabled={busy || !url.trim()}
          className="px-4 py-2 text-sm rounded-control font-bold text-on-primary flex items-center gap-2 disabled:opacity-50 bg-primary hover:bg-primary-hover transition-colors focus-ring"
        >
          {busy ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
          {starting ? "Starting..." : running ? "Scraping..." : "Scrape"}
        </button>
      </div>

      {run && !run.duplicate && (
        <div className="rounded-control border px-3 py-2.5" style={{ borderColor: C.border, backgroundColor: C.surfaceMuted }}>
          <ProgressSteps
            title={
              succeeded
                ? `Draft ${runKindLabel} ready`
                : failed
                ? `Couldn't scrape this ${runKindLabel}`
                : `Scraping ${runKindLabel}…`
            }
            steps={SCRAPE_STEPS}
            current={STAGE_STEP[job?.stage] || "fetch"}
            status={stepStatus}
            startedAt={run.startedAt}
            endedAt={run.endedAt}
            detail={running ? job?.stageLabel : null}
            note={run.fallback}
            error={failed ? run.failure : null}
          />
          {(failed || succeeded) && (
            <div className="flex flex-wrap items-center gap-2 mt-2">
              {failed && (
                <button
                  type="button"
                  onClick={() => start(run.url, run.kind)}
                  className="px-3 py-1 text-xs rounded-control font-bold text-on-primary inline-flex items-center gap-1.5 bg-primary hover:bg-primary-hover transition-colors focus-ring"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Retry
                </button>
              )}
              {succeeded && job?.listing && (
                <button
                  type="button"
                  onClick={() => onOpen(job.listing)}
                  className="px-3 py-1 text-xs rounded-control font-bold text-on-primary inline-flex items-center gap-1.5 bg-primary hover:bg-primary-hover transition-colors focus-ring"
                >
                  <CheckCircle2 className="w-3.5 h-3.5" /> Open draft
                </button>
              )}
              <button
                type="button"
                onClick={() => setRun(null)}
                className="px-3 py-1 text-xs rounded-control border bg-surface border-border-strong text-muted hover:bg-nav-hover transition-colors focus-ring"
              >
                Dismiss
              </button>
            </div>
          )}
        </div>
      )}

      {notice?.type === "error" && (
        <p
          role="alert"
          className="text-sm px-3 py-2 rounded-control border"
          style={{ borderColor: C.dangerBorder, backgroundColor: C.dangerBg, color: C.danger }}
        >
          {notice.message}
        </p>
      )}

      {notice?.type === "duplicate" && (
        <div
          className="text-sm px-3 py-2 rounded-control border flex flex-wrap items-center gap-2"
          style={{ borderColor: C.warningBorder, backgroundColor: C.warningBg, color: C.text }}
        >
          <AlertTriangle className="w-4 h-4 shrink-0" style={{ color: C.warning }} />
          <span className="flex-1 min-w-[200px]">
            <span className="font-medium">Already added.</span>{" "}
            {notice.message && !/^already added/i.test(notice.message) ? `${notice.message} ` : ""}
            {notice.listing?.title && (
              <span style={{ color: C.muted }}>
                Existing: “{notice.listing.title}” ({notice.listing.status || "draft"})
              </span>
            )}
          </span>
          {notice.listing?._id && (
            <button
              type="button"
              onClick={() => onOpen(notice.listing)}
              className="px-3 py-1 text-xs rounded-control font-bold text-on-primary bg-primary hover:bg-primary-hover transition-colors focus-ring"
            >
              Open existing
            </button>
          )}
        </div>
      )}
    </form>
  );
};

const Listings = () => {
  const dispatch = useDispatch();
  const { listings, total, loading, error, submitting } = useSelector((s) => s.adminListing);

  const [kind, setKind] = useState("job");
  const [status, setStatus] = useState("");
  const [page, setPage] = useState(1);
  const {
    input: searchInput,
    setInput: setSearchInput,
    search,
    reset: resetSearch,
  } = useDebouncedSearch(() => setPage(1));
  // { listing, kind, session } — `session` keys the drawer so saving a new
  // listing (which gives it an _id) keeps the same editor mounted.
  const [editing, setEditing] = useState(null);
  const sessionRef = useRef(0);

  const query = useMemo(
    () => ({ kind, status, search, limit: PAGE_SIZE, offset: (page - 1) * PAGE_SIZE }),
    [kind, status, search, page]
  );

  useEffect(() => {
    dispatch(fetchAdminListings(query));
  }, [dispatch, query]);

  const reload = useCallback(() => dispatch(fetchAdminListings(query)), [dispatch, query]);

  const switchKind = (next) => {
    if (next === kind) return;
    setKind(next);
    setPage(1);
    resetSearch();
  };

  const openEditor = useCallback((listing, listingKind) => {
    sessionRef.current += 1;
    setEditing({ listing, kind: listingKind, session: sessionRef.current });
  }, []);

  const openListing = useCallback(
    (listing) => openEditor(listing, listing.kind || kind),
    [openEditor, kind]
  );

  const onDraft = useCallback(
    (listing) => {
      openEditor(listing, listing.kind || kind);
      reload();
    },
    [openEditor, kind, reload]
  );

  const onSaved = (listing) => {
    setEditing((cur) => (cur ? { ...cur, listing } : cur));
    reload();
  };

  const onDeleted = () => {
    setEditing(null);
    reload();
  };

  const kindLabel = KIND_LABELS[kind];
  const KindIcon = KIND_ICONS[kind];
  const isEvent = kind === "event";

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {TABS.map((t) => {
          const Icon = t.icon;
          const active = kind === t.key;
          return (
            <button
              key={t.key}
              onClick={() => switchKind(t.key)}
              className="px-3 py-2 text-sm rounded-control border flex items-center gap-2 transition-colors"
              style={{
                backgroundColor: active ? C.primary : C.surface,
                color: active ? C.onPrimary : C.label,
                borderColor: active ? C.primary : C.borderStrong,
              }}
            >
              <Icon className="w-4 h-4" />
              {t.label}
            </button>
          );
        })}
        <button
          onClick={() => openEditor(null, kind)}
          className="ml-auto px-3 py-2 text-sm rounded-control border flex items-center gap-2 bg-surface border-border-strong text-label hover:bg-nav-hover transition-colors focus-ring"
        >
          <Plus className="w-4 h-4" />
          Add manually
        </button>
      </div>

      <ScrapePanel kind={kind} onDraft={onDraft} onOpen={openListing} />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: C.muted }} />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder={`Search ${kindLabel.many.toLowerCase()}...`}
            className="w-full pl-10 pr-4 py-2 text-sm rounded-control border focus:outline-none focus:border-primary focus-ring bg-input-bg border-input-border text-text"
          />
        </div>
        <div className="flex items-center gap-2">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.key || "all"}
              onClick={() => {
                setStatus(f.key);
                setPage(1);
              }}
              className="px-3 py-1.5 text-sm rounded-control border transition-colors"
              style={{
                backgroundColor: status === f.key ? C.primary : C.surface,
                color: status === f.key ? C.onPrimary : C.label,
                borderColor: status === f.key ? C.primary : C.borderStrong,
              }}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      <AdminTable
        columns={[
          { key: "title", label: kindLabel.one },
          { key: "location", label: isEvent ? "Venue" : "Location" },
          { key: "deadline", label: isEvent ? "Date" : "Deadline" },
          { key: "status", label: "Status" },
          { key: "updated", label: "Updated" },
        ]}
      >
        {loading && listings.length === 0 ? (
          <LoadingSkeleton cols={5} />
        ) : error ? (
          <tbody>
            <tr>
              <td colSpan={5}>
                <div className="py-10 text-center" role="alert">
                  <p className="text-sm" style={{ color: C.danger }}>
                    {error}
                  </p>
                  <button
                    type="button"
                    onClick={reload}
                    className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium"
                    style={{ color: C.link }}
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} /> Try again
                  </button>
                </div>
              </td>
            </tr>
          </tbody>
        ) : loading ? (
          <LoadingSkeleton cols={5} />
        ) : listings.length === 0 ? (
          <tbody>
            <tr>
              <td colSpan={5}>
                <EmptyState
                  icon={KindIcon}
                  title={`No ${kindLabel.many.toLowerCase()} found`}
                  description={
                    search || status
                      ? "Try a different search or filter."
                      : `Paste a link above to add the first ${kindLabel.one.toLowerCase()}.`
                  }
                />
              </td>
            </tr>
          </tbody>
        ) : (
          <tbody>
            {listings.map((l) => {
              const ev = isEvent ? eventInfo(l) : null;
              const dl = isEvent
                ? ev && {
                    date: ev.start.format("MMM D, YYYY"),
                    label: ev.label,
                    tone: ev.tone,
                  }
                : deadlineInfo(l.deadline);
              return (
                <AdminTableRow key={l._id} onClick={() => openListing(l)}>
                  <AdminTableCell>
                    <div className="min-w-0 max-w-[360px]">
                      <div className="font-medium truncate" style={{ color: C.text }}>
                        {l.title}
                      </div>
                      <div className="text-xs truncate" style={{ color: C.muted }}>
                        {l.organization || "—"}
                      </div>
                    </div>
                  </AdminTableCell>
                  <AdminTableCell>
                    <span className="text-sm" style={{ color: C.muted }}>
                      {l.location || "—"}
                    </span>
                  </AdminTableCell>
                  <AdminTableCell>
                    {dl ? (
                      <div className="text-sm whitespace-nowrap">
                        <span style={{ color: C.text }}>{dl.date}</span>
                        <div
                          className="text-xs"
                          style={{ color: dl.tone === "closed" ? C.danger : dl.tone === "open" ? C.muted : C.warning }}
                        >
                          {dl.label}
                        </div>
                      </div>
                    ) : (
                      <span className="text-sm" style={{ color: C.muted }}>—</span>
                    )}
                  </AdminTableCell>
                  <AdminTableCell>
                    <StatusBadge status={l.status} />
                  </AdminTableCell>
                  <AdminTableCell>
                    <span className="text-xs whitespace-nowrap" style={{ color: C.muted }}>
                      {moment(l.updatedAt || l.createdAt).fromNow()}
                    </span>
                  </AdminTableCell>
                </AdminTableRow>
              );
            })}
          </tbody>
        )}
      </AdminTable>

      <Pagination page={page} pageSize={PAGE_SIZE} total={total} onChange={setPage} />

      {editing && (
        <ListingEditor
          key={editing.session}
          listing={editing.listing}
          kind={editing.kind}
         
          submitting={submitting}
          onClose={() => setEditing(null)}
          onSaved={onSaved}
          onDeleted={onDeleted}
        />
      )}
    </div>
  );
};

export default Listings;
