import React, { useState } from "react";
import { Star } from "lucide-react";

// Amber from the chart scale (no dedicated rating token).
const STAR_COLOR = "var(--chart-3)";

// 1–5 stars. Pass `onChange` for an input, omit it for a read-only display.
// Empty stars default to the placeholder tone so they stay visible on both
// themes; callers may pass another token (e.g. C.muted).
const StarRating = ({ value = 0, onChange, size = 20, emptyColor = "var(--placeholder)", disabled = false }) => {
  const [hover, setHover] = useState(0);
  const interactive = typeof onChange === "function" && !disabled;
  const shown = interactive && hover ? hover : value;
  const labels = ["Very poor", "Poor", "Okay", "Good", "Excellent"];

  return (
    <div
      className="inline-flex items-center gap-0.5"
      role={interactive ? "radiogroup" : "img"}
      aria-label={interactive ? "Rating" : `${value} out of 5 stars`}
      onMouseLeave={() => setHover(0)}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const filled = n <= Math.round(shown);
        const star = (
          <Star
            style={{
              width: size,
              height: size,
              color: filled ? STAR_COLOR : emptyColor,
              fill: filled ? STAR_COLOR : "none",
            }}
            strokeWidth={1.75}
          />
        );
        return interactive ? (
          <button
            key={n}
            type="button"
            role="radio"
            aria-checked={value === n}
            aria-label={`${n} star${n > 1 ? "s" : ""} — ${labels[n - 1]}`}
            title={labels[n - 1]}
            onClick={() => onChange(n)}
            onMouseEnter={() => setHover(n)}
            className="p-0.5 rounded transition-transform hover:scale-110 focus-ring"
          >
            {star}
          </button>
        ) : (
          <span key={n} className="p-px">
            {star}
          </span>
        );
      })}
    </div>
  );
};

export default StarRating;
