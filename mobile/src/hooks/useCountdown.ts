import { useEffect, useState } from "react";

// Seconds-remaining counter for OTP resend cooldowns; the interval only runs
// while there is time left and is cleared on unmount.
export const useCountdown = (initial = 0) => {
  const [left, setLeft] = useState(initial);
  const running = left > 0;
  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => setLeft((s) => (s > 1 ? s - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [running]);
  return [left, setLeft] as const;
};
