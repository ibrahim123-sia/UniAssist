import React from "react";
import { useSelector } from "react-redux";
import { CheckCircle2, Circle, Loader2, XCircle, Info } from "lucide-react";
import { getPalette } from "../administrator/utils/palette";
import { useElapsed, formatElapsed } from "../utils/useElapsed";

const usePaletteFromTheme = () => {
  const theme = useSelector((s) => s.theme.theme);
  return getPalette(theme === "dark");
};

// Seconds shown next to a long action: live while it runs, frozen once
// `endedAt` is set.
const useShownSeconds = (startedAt, endedAt) => {
  const live = useElapsed(endedAt ? null : startedAt);
  if (!startedAt) return null;
  if (endedAt) {
    const start = new Date(startedAt).getTime();
    const end = new Date(endedAt).getTime();
    return Number.isFinite(start) && Number.isFinite(end) ? Math.max(0, Math.round((end - start) / 1000)) : null;
  }
  return live;
};

/**
 * Vertical stepper for a multi-stage server job (listing scrape, website
 * import...). Steps before `current` are ticked, `current` spins while
 * `status` is "running" (or turns red when "failed"), later ones are hollow;
 * `status: "done"` ticks everything.
 *
 * steps:     [{ key, label }]
 * current:   key of the active (or failed) step
 * status:    "running" | "done" | "failed"
 * startedAt / endedAt: timestamps for the "12 s" counter
 * note:      extra line under the steps (e.g. "AI unavailable — ...")
 * detail:    text under the active step (e.g. the server's stage label)
 */
const ProgressSteps = ({ title, steps, current, status = "running", startedAt, endedAt, note, detail, error }) => {
  const C = usePaletteFromTheme();
  const seconds = useShownSeconds(startedAt, endedAt);
  const currentIndex = Math.max(0, steps.findIndex((s) => s.key === current));

  return (
    <div role="status" aria-live="polite" className="text-sm">
      {(title || seconds !== null) && (
        <div className="flex items-center justify-between gap-3 mb-2">
          {title && (
            <span className="font-medium" style={{ color: C.text }}>
              {title}
            </span>
          )}
          {seconds !== null && (
            <span className="text-xs tabular-nums ml-auto" style={{ color: C.muted }}>
              {formatElapsed(seconds)}
            </span>
          )}
        </div>
      )}
      <ol className="space-y-1.5">
        {steps.map((step, i) => {
          const done = status === "done" || i < currentIndex;
          const active = !done && i === currentIndex;
          const failed = active && status === "failed";
          const Icon = done ? CheckCircle2 : failed ? XCircle : active ? Loader2 : Circle;
          const color = done ? C.green : failed ? C.danger : active ? C.navy : C.border;
          return (
            <li key={step.key} className="flex items-start gap-2">
              <Icon
                className={`w-4 h-4 mt-0.5 shrink-0 ${active && !failed ? "animate-spin" : ""}`}
                style={{ color }}
                aria-hidden="true"
              />
              <div className="min-w-0">
                <span
                  className={active ? "font-medium" : ""}
                  style={{ color: active || done ? C.text : C.muted }}
                >
                  {step.label}
                  <span className="sr-only">{done ? " (done)" : failed ? " (failed)" : active ? " (in progress)" : ""}</span>
                </span>
                {active && detail && (
                  <p className="text-xs" style={{ color: C.muted }}>
                    {detail}
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
      {note && (
        <p className="flex items-start gap-1.5 text-xs mt-2" style={{ color: C.amber }}>
          <Info className="w-3.5 h-3.5 mt-px shrink-0" aria-hidden="true" />
          <span>{note}</span>
        </p>
      )}
      {error && (
        <p className="text-xs mt-2 wrap-break-word" style={{ color: C.danger }}>
          {error}
        </p>
      )}
    </div>
  );
};

/**
 * One-line "something is happening" indicator: spinner + stage text +
 * elapsed seconds. For single-request actions (transcribing, embedding,
 * signing in to the mail server...).
 */
export const ProgressLine = ({ label, startedAt, className = "", showSpinner = true }) => {
  const C = usePaletteFromTheme();
  const seconds = useElapsed(startedAt);
  return (
    <span
      role="status"
      aria-live="polite"
      className={`inline-flex items-center gap-1.5 text-xs ${className}`}
      style={{ color: C.muted }}
    >
      {showSpinner && <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" style={{ color: C.navy }} aria-hidden="true" />}
      <span>{label}</span>
      {startedAt ? <span className="tabular-nums">· {formatElapsed(seconds)}</span> : null}
    </span>
  );
};

/** Upload progress bar (axios onUploadProgress percentage, 0–100). */
export const UploadProgress = ({ percent, label = "Uploading" }) => {
  const C = usePaletteFromTheme();
  const pct = Math.max(0, Math.min(100, Math.round(percent || 0)));
  return (
    <div role="status" aria-live="polite" className="text-xs space-y-1">
      <div className="flex items-center justify-between" style={{ color: C.muted }}>
        <span>{label}…</span>
        <span className="tabular-nums">{pct}%</span>
      </div>
      <div
        className="h-1.5 rounded-full overflow-hidden"
        style={{ backgroundColor: C.surfaceAlt }}
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
      >
        <div className="h-full transition-all" style={{ width: `${pct}%`, backgroundColor: C.navy }} />
      </div>
    </div>
  );
};

export default ProgressSteps;
