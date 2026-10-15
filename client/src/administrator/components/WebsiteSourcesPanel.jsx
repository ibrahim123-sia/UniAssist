import React, { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import {
  Globe,
  Loader2,
  Trash2,
  ExternalLink,
  CheckCircle2,
  XCircle,
  X,
  ChevronDown,
  ChevronRight,
  RefreshCw,
  AlertTriangle,
} from "lucide-react";
import toast from "react-hot-toast";
import moment from "moment";
import {
  startKbIngest,
  fetchKbJob,
  fetchKbJobs,
  fetchKbSources,
  deleteKbSource,
} from "../../redux/slices/adminDataSlice";
import ConfirmDialog from "./ConfirmDialog";
import { C } from "../../theme/palette";
import { isHttpUrl } from "../../utils/listings";
import { ProgressLine } from "../../components/ProgressSteps";
import { formatElapsed } from "../../utils/useElapsed";

const POLL_MS = 2000;
const MAX_PAGES_LIMIT = 500;
const ACTIVE = new Set(["queued", "running"]);
// Consecutive network failures (AI service unreachable) before polling stops.
const MAX_NETWORK_FAILURES = 5;

// The job reports counters, not a stage, so the stage text is derived from
// them (a `stage` string from the server wins if it ever sends one).
const stageText = (job) => {
  if (job.stage && typeof job.stage === "string") return job.stage;
  if (job.status === "queued") return "Waiting to start…";
  if (job.mode !== "site") return "Fetching the page and adding it to the knowledge base…";
  if (!job.pagesTotal) return "Finding the site's pages (sitemap / links)…";
  const next = Math.min((job.pagesDone || 0) + 1, job.pagesTotal);
  return `Importing page ${next} of ${job.pagesTotal}…`;
};

const durationSec = (job) => {
  const start = new Date(job.startedAt).getTime();
  const end = new Date(job.finishedAt).getTime();
  return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, Math.round((end - start) / 1000)) : null;
};

const JobStatus = ({ job }) => {
  const map = {
    queued: { label: "Queued", color: C.muted, bg: C.surface },
    running: { label: "Importing", color: C.warning, bg: C.warningBg },
    done: { label: "Done", color: C.success, bg: C.successBg },
    failed: { label: "Failed", color: C.danger, bg: C.dangerBg },
  };
  const s = map[job.status] || map.queued;
  const Icon = job.status === "done" ? CheckCircle2 : job.status === "failed" ? XCircle : Loader2;
  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 text-xs rounded-full font-medium"
      style={{ backgroundColor: s.bg, color: s.color }}
    >
      <Icon className={`w-3 h-3 ${ACTIVE.has(job.status) ? "animate-spin" : ""}`} />
      {s.label}
    </span>
  );
};

// "Add from website": queue a page / whole-site import on the Python side,
// poll its progress, and list the website sources already in the KB.
const WebsiteSourcesPanel = ({ onImported }) => {
  const dispatch = useDispatch();
  const { kbSources, kbSourcesLoading, kbSourcesError } = useSelector((s) => s.adminData);

  const [url, setUrl] = useState("");
  const [mode, setMode] = useState("page");
  const [maxPages, setMaxPages] = useState(50);
  const [starting, setStarting] = useState(false);
  const [formError, setFormError] = useState("");
  const [jobId, setJobId] = useState(null);
  const [job, setJob] = useState(null);
  const [showErrors, setShowErrors] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  // Set when progress polling stopped on an error (403 / 5xx / unreachable);
  // bumping pollKey restarts it.
  const [pollError, setPollError] = useState("");
  const [pollKey, setPollKey] = useState(0);

  // Set once the admin starts an import here, so a slow "resume running
  // job" lookup on mount can't replace the job they just started.
  const startedRef = useRef(false);
  const onImportedRef = useRef(onImported);
  useEffect(() => {
    onImportedRef.current = onImported;
  });

  // Load sources, and pick up an import that is still running (e.g. the
  // admin navigated away and came back) so its progress keeps showing.
  useEffect(() => {
    dispatch(fetchKbSources());
    let cancelled = false;
    dispatch(fetchKbJobs())
      .unwrap()
      .then((res) => {
        if (cancelled || startedRef.current || !res.success) return;
        const running = res.jobs.find((j) => ACTIVE.has(j.status));
        if (running?.jobId) {
          setJob(running);
          setJobId(running.jobId);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [dispatch]);

  // Poll the tracked job every 2s until it finishes; stops on unmount, and on
  // errors that won't fix themselves (403, 5xx, service unreachable for a
  // while) — the admin gets the message and a Retry button instead.
  useEffect(() => {
    if (!jobId) return undefined;
    let cancelled = false;
    let timer = null;
    let networkFailures = 0;
    setPollError("");

    const tick = async () => {
      const res = await dispatch(fetchKbJob(jobId)).unwrap();
      if (cancelled) return;
      if (res.success && res.job) {
        networkFailures = 0;
        setJob(res.job);
        if (!ACTIVE.has(res.job.status)) {
          if (res.job.status === "done") {
            toast.success(
              `Website import finished: ${res.job.pagesDone ?? 0} page(s), ${res.job.chunksAdded ?? 0} chunk(s) added`
            );
          } else {
            const first = res.job.errors?.[0]?.error;
            toast.error(first ? `Website import failed: ${first}` : "Website import failed");
          }
          dispatch(fetchKbSources());
          onImportedRef.current?.();
          return;
        }
      } else if (res.status === 404) {
        // Jobs live in memory on the Python side and vanish on restart.
        setJob((cur) => (cur ? { ...cur, status: "failed", lost: true } : cur));
        return;
      } else if (res.status === 401 || res.status === 403 || res.status >= 500) {
        setPollError(res.message || "Couldn't check the import's progress.");
        return;
      } else {
        networkFailures += 1;
        if (networkFailures >= MAX_NETWORK_FAILURES) {
          setPollError(res.message || "The AI service isn't reachable, so progress can't be checked.");
          return;
        }
      }
      timer = setTimeout(tick, POLL_MS);
    };

    tick();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [dispatch, jobId, pollKey]);

  const running = !!job && ACTIVE.has(job.status);
  // While polling is stopped the job may be done already — don't lock the form.
  const locked = running && !pollError;

  const doStart = async (e) => {
    e.preventDefault();
    const target = url.trim();
    if (!isHttpUrl(target)) {
      setFormError("Enter a full link starting with http:// or https://");
      return;
    }
    const pages = Math.min(MAX_PAGES_LIMIT, Math.max(1, Number(maxPages) || 50));
    setFormError("");
    startedRef.current = true;
    setStarting(true);
    const res = await dispatch(startKbIngest({ url: target, mode, maxPages: pages })).unwrap();
    setStarting(false);
    if (!res.success || !res.jobId) {
      setFormError(res.message || "Failed to start the import");
      return;
    }
    setUrl("");
    setShowErrors(false);
    setJob({
      jobId: res.jobId,
      status: res.status || "queued",
      url: target,
      mode,
      pagesDone: 0,
      pagesTotal: mode === "page" ? 1 : null,
      chunksAdded: 0,
      errors: [],
    });
    setJobId(res.jobId);
  };

  const doDelete = async () => {
    setDeleting(true);
    const res = await dispatch(deleteKbSource(confirmDelete.source)).unwrap();
    setDeleting(false);
    if (res.success) {
      toast.success("Website source removed from the knowledge base");
      setConfirmDelete(null);
      onImportedRef.current?.();
    } else {
      toast.error(res.message || "Delete failed");
    }
  };

  const pct =
    job && job.pagesTotal ? Math.min(100, Math.round(((job.pagesDone || 0) / job.pagesTotal) * 100)) : null;
  const errors = job?.errors || [];

  return (
    <section
      className="rounded-card border grid grid-cols-1 lg:grid-cols-2 shadow-card"
      style={{ backgroundColor: C.surface, borderColor: C.border }}
    >
      <div className="p-4 space-y-3 border-b lg:border-b-0 lg:border-r" style={{ borderColor: C.border }}>
        <div>
          <h3 className="text-sm font-semibold flex items-center gap-2" style={{ color: C.heading }}>
            <Globe className="w-4 h-4" style={{ color: C.link }} />
            Add from website
          </h3>
          <p className="text-xs mt-0.5" style={{ color: C.muted }}>
            Import a university web page, or crawl a whole site, into the chatbot&apos;s knowledge base.
            Re-importing a page replaces its old content.
          </p>
        </div>

        <form onSubmit={doStart} className="space-y-2">
          <input
            type="text"
            inputMode="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            disabled={starting || locked}
            placeholder="https://www.jinnah.edu/admissions"
            className="w-full px-3 py-2 text-sm rounded-control border focus:outline-none bg-input-bg border-input-border text-text focus:border-primary focus-ring disabled:opacity-60"
          />
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={mode}
              onChange={(e) => setMode(e.target.value)}
              disabled={starting || locked}
              className="px-3 py-2 text-sm rounded-control border focus:outline-none bg-input-bg border-input-border text-text focus:border-primary focus-ring"
            >
              <option value="page">Single page</option>
              <option value="site">Whole site</option>
            </select>
            {mode === "site" && (
              <label className="flex items-center gap-2 text-xs" style={{ color: C.muted }}>
                Max pages
                <input
                  type="number"
                  min={1}
                  max={MAX_PAGES_LIMIT}
                  value={maxPages}
                  onChange={(e) => setMaxPages(e.target.value)}
                  disabled={starting || locked}
                  className="w-20 px-2 py-2 text-sm rounded-control border focus:outline-none bg-input-bg border-input-border text-text focus:border-primary focus-ring"
                />
              </label>
            )}
            <button
              type="submit"
              disabled={starting || locked || !url.trim()}
              className="ml-auto px-4 py-2 text-sm rounded-control font-bold text-on-primary flex items-center gap-2 disabled:opacity-50 bg-primary hover:bg-primary-hover transition-colors focus-ring"
            >
              {starting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Globe className="w-4 h-4" />}
              {starting ? "Starting..." : "Import"}
            </button>
          </div>
          {formError && (
            <p className="text-xs" role="alert" style={{ color: C.danger }}>
              {formError}
            </p>
          )}
        </form>

        {job && (
          <div className="rounded-control border p-3 space-y-2" style={{ borderColor: C.border, backgroundColor: C.surfaceMuted }}>
            <div className="flex items-center gap-2">
              <JobStatus job={job} />
              <span className="text-xs" style={{ color: C.muted }}>
                {job.mode === "site" ? "Whole site" : "Single page"}
              </span>
              {(!running || pollError) && (
                <button
                  onClick={() => {
                    setJob(null);
                    setJobId(null);
                    setPollError("");
                  }}
                  className="ml-auto p-0.5 rounded"
                  style={{ color: C.muted }}
                  aria-label="Dismiss"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
            <p className="text-xs break-all" style={{ color: C.text }}>
              {job.url}
            </p>
            {running && !pollError && (
              <ProgressLine label={stageText(job)} startedAt={job.startedAt || null} />
            )}
            <div className="h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: C.border }}>
              <div
                className={`h-full rounded-full transition-all ${pct === null && running ? "animate-pulse" : ""}`}
                style={{
                  width: pct !== null ? `${pct}%` : running ? "100%" : job.status === "done" ? "100%" : "0%",
                  backgroundColor: job.status === "failed" ? C.danger : job.status === "done" ? C.success : C.primary,
                  opacity: pct === null && running ? 0.4 : 1,
                }}
              />
            </div>
            <p className="text-xs" style={{ color: C.muted }}>
              {job.lost
                ? "This import is no longer tracked (the chatbot server may have restarted)."
                : running
                ? `${job.pagesDone ?? 0}${job.pagesTotal ? ` / ${job.pagesTotal}` : ""} page(s) done · ${
                    job.chunksAdded ?? 0
                  } chunk(s) added so far`
                : `${
                    typeof job.pagesSucceeded === "number"
                      ? `${job.pagesSucceeded} of ${job.pagesDone ?? 0} page(s) imported`
                      : `${job.pagesDone ?? 0} page(s) processed`
                  } · ${job.chunksAdded ?? 0} chunk(s) added${
                    errors.length ? ` · ${errors.length} error(s)` : ""
                  }${durationSec(job) !== null ? ` · took ${formatElapsed(durationSec(job))}` : ""}${
                    job.finishedAt ? ` · ${moment(job.finishedAt).fromNow()}` : ""
                  }`}
            </p>
            {pollError && (
              <div className="flex items-start gap-2 text-xs" role="alert" style={{ color: C.danger }}>
                <AlertTriangle className="w-3.5 h-3.5 mt-px shrink-0" />
                <span className="flex-1 wrap-break-word">
                  {pollError} The import may still be running on the server.
                </span>
                <button
                  onClick={() => setPollKey((k) => k + 1)}
                  className="font-medium inline-flex items-center gap-1 shrink-0"
                  style={{ color: C.link }}
                >
                  <RefreshCw className="w-3 h-3" /> Retry
                </button>
              </div>
            )}
            {errors.length > 0 && (
              <div>
                <button
                  onClick={() => setShowErrors((v) => !v)}
                  className="text-xs flex items-center gap-1 font-medium"
                  style={{ color: job.status === "failed" ? C.danger : C.warning }}
                >
                  {showErrors ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                  {errors.length} page(s) skipped
                </button>
                {showErrors && (
                  <ul className="mt-1 max-h-40 overflow-y-auto space-y-1">
                    {errors.map((er, i) => (
                      <li key={`${er.url}-${i}`} className="text-xs break-all" style={{ color: C.muted }}>
                        <span style={{ color: C.text }}>{er.url}</span> — {er.error}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col min-h-0">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-sm font-semibold" style={{ color: C.heading }}>
            Website sources{" "}
            <span className="font-normal" style={{ color: C.muted }}>
              ({kbSources.length})
            </span>
          </h3>
          <button
            onClick={() => dispatch(fetchKbSources())}
            className="p-1 rounded"
            style={{ color: C.muted }}
            aria-label="Refresh sources"
            title="Refresh"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${kbSourcesLoading ? "animate-spin" : ""}`} />
          </button>
        </div>
        {kbSourcesError && !kbSourcesLoading && (
          <p className="text-xs mb-2 wrap-break-word" role="alert" style={{ color: C.danger }}>
            Couldn&apos;t load website sources: {kbSourcesError}
          </p>
        )}
        {kbSources.length === 0 ? (
          <p className="text-xs py-6 text-center" style={{ color: C.muted }}>
            {kbSourcesLoading ? "Loading..." : kbSourcesError ? "" : "No website pages imported yet."}
          </p>
        ) : (
          <ul className="max-h-64 overflow-y-auto divide-y">
            {kbSources.map((s) => (
              <li key={s.source} className="flex items-center gap-2 py-1.5" style={{ borderColor: C.border }}>
                {isHttpUrl(s.source) ? (
                  <a
                    href={s.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 min-w-0 text-xs truncate inline-flex items-center gap-1 hover:underline"
                    style={{ color: C.text }}
                    title={s.source}
                  >
                    <span className="truncate">{s.source}</span>
                    <ExternalLink className="w-3 h-3 shrink-0" style={{ color: C.muted }} />
                  </a>
                ) : (
                  <span className="flex-1 min-w-0 text-xs truncate" style={{ color: C.text }} title={s.source}>
                    {s.source}
                  </span>
                )}
                {s.chunks !== null && s.chunks !== undefined && (
                  <span className="text-xs whitespace-nowrap" style={{ color: C.muted }}>
                    {s.chunks} chunk{s.chunks === 1 ? "" : "s"}
                  </span>
                )}
                <button
                  onClick={() => setConfirmDelete(s)}
                  className="p-1 rounded transition-colors"
                  style={{ color: C.muted }}
                  onMouseEnter={(e) => (e.currentTarget.style.color = C.danger)}
                  onMouseLeave={(e) => (e.currentTarget.style.color = C.muted)}
                  aria-label="Delete source"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <ConfirmDialog
        open={!!confirmDelete}
        onClose={() => setConfirmDelete(null)}
        onConfirm={doDelete}
        loading={deleting}
        destructive
        title="Remove website source?"
        message={`All knowledge-base chunks imported from ${confirmDelete?.source || "this page"} will be deleted. The chatbot will no longer use them.`}
        confirmLabel="Remove"
      />
    </section>
  );
};

export default WebsiteSourcesPanel;
