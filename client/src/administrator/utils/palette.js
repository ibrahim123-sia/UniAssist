export const getPalette = (isDark) => ({
  bg: isDark ? "#0F1626" : "#FFFFFF",
  surface: isDark ? "#17203A" : "#FFFFFF",
  surfaceAlt: isDark ? "#1E2A47" : "#F5F6F8",
  input: isDark ? "#121A2E" : "#F5F6F8",
  border: isDark ? "#273350" : "#E2E5EA",
  text: isDark ? "#ECEEF3" : "#222222",
  muted: isDark ? "#A9B2C7" : "#5A6372",
  navy: isDark ? "#6E8BE0" : "#1E2E6E",
  navyHover: isDark ? "#8AA3E8" : "#162356",
  red: isDark ? "#E57A63" : "#D0321E",
  green: isDark ? "#6FB58A" : "#2F8A56",
  amber: isDark ? "#E0B467" : "#B8860B",
});

export const usePalette = () => {
  // Lightweight hook-style helper for components that already import from React-Redux
  // Callers do: const C = usePalette(); — where they have access to theme via useSelector.
  // Kept as a getter so consumers control re-render via their own useSelector.
  return getPalette;
};
