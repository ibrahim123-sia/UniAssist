import React from "react";
import { useDispatch, useSelector } from "react-redux";
import { Moon, Sun } from "lucide-react";
import { toggleTheme } from "../redux/slices/themeSlice";

// 44px square theme button: moon in Day Desk, sun in Night Desk.
const ThemeToggle = ({ className = "" }) => {
  const dispatch = useDispatch();
  const isDark = useSelector((s) => s.theme.theme) === "dark";

  return (
    <button
      type="button"
      onClick={() => dispatch(toggleTheme())}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      className={`w-11 h-11 shrink-0 rounded-control bg-surface border border-border text-label flex items-center justify-center hover:bg-nav-hover transition-colors focus-ring ${className}`}
    >
      {isDark ? <Sun className="w-5 h-5" strokeWidth={2} /> : <Moon className="w-5 h-5" strokeWidth={2} />}
    </button>
  );
};

export default ThemeToggle;
