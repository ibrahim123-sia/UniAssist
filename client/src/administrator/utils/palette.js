/**
 * Centralized colour tokens for the admin UI.
 *
 * Light theme = MAJU institutional palette (navy + brick red on white).
 * Dark theme  = "Founder's Block at dusk" — navy lineage but with MAJU red
 *               leading as the primary action so the dark surface still
 *               reads as MAJU-branded, with a sandstone amber for highlights.
 *
 * NOTE on names: `navy` is the *primary action* token (lead button, active
 * nav). In dark mode it deliberately becomes red — that's the design intent,
 * not a typo. `red` is the *secondary accent* — destructive/warning in light,
 * sandstone highlight in dark.
 */
export const getPalette = (isDark) => ({
  // Surfaces
  bg: isDark ? "#131A2C" : "#FFFFFF",
  surface: isDark ? "#1A2238" : "#FFFFFF",
  surfaceAlt: isDark ? "#232C46" : "#F5F6F8",
  input: isDark ? "#0E1525" : "#F5F6F8",
  border: isDark ? "#2A3550" : "#E2E5EA",

  // Type
  text: isDark ? "#E8EAF1" : "#1F2330",
  muted: isDark ? "#9CA7BD" : "#5A6372",

  // Brand primary — MAJU navy in light, MAJU red in dark
  navy: isDark ? "#C8102E" : "#1B2D5C",
  navyHover: isDark ? "#A50D26" : "#142347",

  // Secondary accent — MAJU red in light, sandstone amber in dark
  red: isDark ? "#F4B860" : "#C8102E",

  // Status colors
  green: isDark ? "#6FB58A" : "#2F8A56",
  amber: isDark ? "#E0B467" : "#B8860B",
});

export const usePalette = () => {
  // Lightweight hook-style helper for components that already import from React-Redux
  // Callers do: const C = usePalette(); — where they have access to theme via useSelector.
  // Kept as a getter so consumers control re-render via their own useSelector.
  return getPalette;
};
