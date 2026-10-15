// "Day Desk" (light, default) / "Night Desk" (dark) tokens — the same values
// as the web client's client/src/theme/tokens.css. Change a color in both
// places. Don't invent new hues: mix the closest token toward bg (lighter)
// or text (darker) and add it here as a named key in BOTH modes.
const light = {
  // Core
  bg: "#F7F8FC",
  surface: "#FFFFFF",
  surface2: "#FFFFFF",
  surfaceMuted: "#F5F7FC", // filled block inside a card (web --surface-muted)
  border: "#E3E7F2",
  borderStrong: "#D9DEEC",
  inputBg: "#F5F7FC",
  inputBorder: "#DCE2EF",
  text: "#0B1230",
  heading: "#0B1230",
  muted: "#5B6584",
  label: "#3A4466",
  pill: "#3A4466",
  placeholder: "#8A93AD",
  primary: "#3B63E8",
  primaryHover: "#2A4BC4",
  primaryPressed: "#223C9E",
  onPrimary: "#FFFFFF",
  link: "#3B63E8",
  linkHover: "#2A4BC4",
  aiBubble: "#EEF2FF",
  aiBubbleText: "#0B1230",
  aiBubbleLink: "#223C9E",
  accent: "#10B3A3",
  accentStrong: "#0F8F84",
  accentSoft: "#E7F7F5",
  iconBox: "#EEF2FF",

  // Layout
  navHover: "#F2F4FA",
  navActiveBg: "#EEF2FF",
  navActiveText: "#3B63E8",
  overlay: "rgba(11,18,48,0.45)",

  // Status: text / bg / border
  success: "#0F7A43",
  successBg: "#E6F6EC",
  successBorder: "#BDE5CB",
  warning: "#9A5B00",
  warningBg: "#FFF4DE",
  warningBorder: "#F5D9A3",
  danger: "#C2293A",
  dangerBg: "#FDECEE",
  dangerBorder: "#F5C2C9",
  info: "#3B63E8",
  infoBg: "#EEF2FF",
  infoBorder: "#BCCBFD",

  // States
  focusRing: "rgba(59,99,232,0.25)",
  disabledBg: "#E9ECF4",
  disabledText: "#A3ABC2",

  // Charts, in order
  chart: ["#3B63E8", "#10B3A3", "#F59E0B", "#E5487D", "#8B5CF6", "#64748B"],
};

export type Palette = typeof light;

const dark: Palette = {
  bg: "#0A0F1E",
  surface: "#10172C",
  surface2: "#111833",
  surfaceMuted: "#131B33",
  border: "#1E2747",
  borderStrong: "#26304F",
  inputBg: "#0B1124",
  inputBorder: "#253055",
  text: "#E6EAF5",
  heading: "#FFFFFF",
  muted: "#9AA4BF",
  label: "#B8C1DA",
  pill: "#C9D1E8",
  placeholder: "#6B7699",
  primary: "#3B63E8",
  primaryHover: "#2A4BC4",
  primaryPressed: "#223C9E",
  onPrimary: "#FFFFFF",
  link: "#9DB4FF",
  linkHover: "#C3D1FF",
  aiBubble: "#182246",
  aiBubbleText: "#E6EAF5",
  aiBubbleLink: "#9DB4FF",
  accent: "#5EEAD4",
  accentStrong: "#5EEAD4",
  accentSoft: "#1B254A",
  iconBox: "#16204A",

  navHover: "#131B33",
  navActiveBg: "#16204A",
  navActiveText: "#9DB4FF",
  overlay: "rgba(0,0,0,0.60)",

  success: "#4ADE95",
  successBg: "#0F2A22",
  successBorder: "#1D4D3B",
  warning: "#FBBF4C",
  warningBg: "#2B2210",
  warningBorder: "#4D3B17",
  danger: "#F87185",
  dangerBg: "#2E1520",
  dangerBorder: "#552333",
  info: "#9DB4FF",
  infoBg: "#16204A",
  infoBorder: "#26304F",

  focusRing: "rgba(59,99,232,0.45)",
  disabledBg: "#161D33",
  disabledText: "#4F5A78",

  chart: ["#6886F2", "#5EEAD4", "#FBBF4C", "#F472A6", "#A78BFA", "#94A3B8"],
};

export const palette = { light, dark };

export const getPalette = (isDark: boolean): Palette => (isDark ? dark : light);

// Shape (same as the web): controls 12, logo 10, cards 18, sheets/modals 22.
export const radius = { control: 12, logo: 10, card: 18, panel: 22, pill: 999 } as const;

// Light mode separates surfaces with a soft shadow; dark mode uses borders only.
export const cardShadow = (isDark: boolean) =>
  isDark
    ? {}
    : {
        shadowColor: "#0B1230",
        shadowOpacity: 0.06,
        shadowRadius: 14,
        shadowOffset: { width: 0, height: 6 },
        elevation: 2,
      };

export type Tone = "success" | "warning" | "danger" | "info" | "neutral";

// Text / background / border for a status badge or alert. Status colors are
// only for status — never decoration.
export const tone = (C: Palette, t: Tone) =>
  t === "neutral"
    ? { text: C.muted, bg: C.surfaceMuted, border: C.borderStrong }
    : { text: C[t], bg: C[`${t}Bg`], border: C[`${t}Border`] };
