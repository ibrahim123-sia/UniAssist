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
  bg: isDark ? "#0E1422" : "#FFFFFF",
  surface: isDark ? "#16203A" : "#FFFFFF",
  surfaceAlt: isDark ? "#1E2A47" : "#F2F3F8",
  input: isDark ? "#0B1120" : "#F2F3F8",
  border: isDark ? "#2A3656" : "#D8DAE6",

  // Type
  text: isDark ? "#ECEEF5" : "#1F2330",
  muted: isDark ? "#9AA5BD" : "#5A6372",

  // Brand primary — MAJU navy in light, MAJU red in dark
  navy: isDark ? "#E63027" : "#1E2A66",
  navyHover: isDark ? "#C81E15" : "#16204D",

  // Secondary accent — MAJU red in light, brushed copper in dark
  red: isDark ? "#C48A4A" : "#E63027",

  // Status colors
  green: isDark ? "#6FB58A" : "#2F8A56",
  amber: isDark ? "#C48A4A" : "#B8860B",
});

export const usePalette = () => {
  // Lightweight hook-style helper for components that already import from React-Redux
  // Callers do: const C = usePalette(); — where they have access to theme via useSelector.
  // Kept as a getter so consumers control re-render via their own useSelector.
  return getPalette;
};
