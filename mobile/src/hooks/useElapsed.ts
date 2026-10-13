import { useEffect, useState } from "react";

// Whole seconds since `startedAt` (ms), re-rendering once a second while it
// is set; 0 when it is null. For "still working" feedback on slow actions.
export const useElapsed = (startedAt: number | null | undefined): number => {
  const calc = () => (startedAt ? Math.max(0, Math.floor((Date.now() - startedAt) / 1000)) : 0);
  const [seconds, setSeconds] = useState(calc);
  useEffect(() => {
    setSeconds(calc());
    if (!startedAt) return;
    const id = setInterval(() => setSeconds(calc()), 1000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startedAt]);
  return seconds;
};
