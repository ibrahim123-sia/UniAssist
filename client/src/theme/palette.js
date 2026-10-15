import { useMemo } from "react";
import { useSelector } from "react-redux";

/**
 * Theme tokens as var() strings for inline styles (style={{ color: C.text }}).
 * The values live in src/theme/tokens.css and follow <html data-theme>, so
 * nothing here depends on the current mode. Prefer Tailwind token classes
 * (bg-surface, text-muted ...) where a className is possible.
 */
export const C = {
  bg: "var(--bg)",
  surface: "var(--surface)",
  surface2: "var(--surface-2)",
  surfaceMuted: "var(--surface-muted)",
  border: "var(--border)",
  borderStrong: "var(--border-strong)",
  inputBg: "var(--input-bg)",
  inputBorder: "var(--input-border)",
  text: "var(--text)",
  heading: "var(--text-heading)",
  muted: "var(--text-muted)",
  label: "var(--text-label)",
  pill: "var(--text-pill)",
  placeholder: "var(--placeholder)",
  primary: "var(--primary)",
  primaryHover: "var(--primary-hover)",
  primary50: "var(--primary-50)",
  primary100: "var(--primary-100)",
  primary200: "var(--primary-200)",
  onPrimary: "var(--on-primary)",
  link: "var(--link)",
  linkHover: "var(--link-hover)",
  accent: "var(--accent)",
  accentStrong: "var(--accent-strong)",
  accentSoft: "var(--accent-soft)",
  sidebarBg: "var(--sidebar-bg)",
  sidebarBorder: "var(--sidebar-border)",
  navHover: "var(--nav-hover)",
  navActiveBg: "var(--nav-active-bg)",
  navActiveText: "var(--nav-active-text)",
  tableHeader: "var(--table-header-bg)",
  rowHover: "var(--row-hover)",
  overlay: "var(--overlay)",
  success: "var(--success)",
  successBg: "var(--success-bg)",
  successBorder: "var(--success-border)",
  warning: "var(--warning)",
  warningBg: "var(--warning-bg)",
  warningBorder: "var(--warning-border)",
  danger: "var(--danger)",
  dangerBg: "var(--danger-bg)",
  dangerBorder: "var(--danger-border)",
  info: "var(--info)",
  infoBg: "var(--info-bg)",
  infoBorder: "var(--info-border)",
  disabledBg: "var(--disabled-bg)",
  disabledText: "var(--disabled-text)",
  shadowSm: "var(--shadow-sm)",
  shadowLg: "var(--shadow-lg)",
  focusRing: "var(--focus-ring)",
};

/** A token at reduced opacity, e.g. alpha(C.primary, 10) → 10% primary. */
export const alpha = (color, percent) =>
  `color-mix(in srgb, ${color} ${percent}%, transparent)`;

const CHART_VARS = ["--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5", "--chart-6"];

/** Reads CSS variables as resolved colors (for SVG attributes / Recharts). */
export const readCssVars = (names) => {
  const styles = getComputedStyle(document.documentElement);
  return names.map((n) => styles.getPropertyValue(n).trim());
};

/**
 * Resolved token colors for charts, recomputed when the theme changes.
 * Returns { series: [6 chart colors], <name>: color } — pass extra token
 * names (without "--") to get them too, e.g. useChartColors("border", "text-muted").
 */
export const useChartColors = (...extra) => {
  const theme = useSelector((s) => s.theme.theme);
  const key = extra.join(",");
  return useMemo(() => {
    const names = key ? key.split(",") : [];
    const series = readCssVars(CHART_VARS);
    const values = readCssVars(names.map((n) => `--${n}`));
    const out = { series };
    names.forEach((n, i) => {
      out[n] = values[i];
    });
    return out;
    // theme is the trigger: the CSS variables change with it
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme, key]);
};
