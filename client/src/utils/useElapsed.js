import { useEffect, useState } from "react";

const toMs = (value) => {
  if (value === null || value === undefined || value === false) return null;
  const ms = typeof value === "number" ? value : new Date(value).getTime();
  return Number.isFinite(ms) ? ms : null;
};

// Whole seconds since `startedAt` (ms timestamp, Date or ISO string), ticking
// once a second while it is set; 0 when it isn't. Pass null to stop the clock
// (e.g. when the action finished) — the component then stops re-rendering.
export const useElapsed = (startedAt) => {
  const start = toMs(startedAt);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (start === null) return undefined;
    setNow(Date.now());
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [start]);

  if (start === null) return 0;
  return Math.max(0, Math.floor((now - start) / 1000));
};

// "8 s", "1 min 05 s".
export const formatElapsed = (seconds) => {
  const s = Math.max(0, Math.floor(seconds || 0));
  if (s < 60) return `${s} s`;
  return `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, "0")} s`;
};

export default useElapsed;
