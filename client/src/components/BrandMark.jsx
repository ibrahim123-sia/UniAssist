import React from "react";

// The UniAssist "M" mark: white letter in a primary-blue box.
// size is the box edge in px (34 by default, per the design spec).
const BrandMark = ({ size = 34, className = "" }) => (
  <div
    className={`shrink-0 rounded-logo bg-primary text-on-primary flex items-center justify-center font-extrabold leading-none ${className}`}
    style={{ width: size, height: size, fontSize: Math.round(size * 0.53) }}
    aria-hidden="true"
  >
    M
  </div>
);

export default BrandMark;
