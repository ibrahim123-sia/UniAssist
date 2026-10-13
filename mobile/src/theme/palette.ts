// Same brand tokens as the web client (client/src/index.css): MAJU navy
// #1E2A66, red #E63027, lavender surface #E7E8F0; the dark theme uses the
// web's night surfaces with the brushed-copper accent #C48A4A.
export const palette = {
  light: {
    bg: "#F2F3F8",
    surface: "#FFFFFF",
    surfaceAlt: "#E7E8F0",
    input: "#FFFFFF",
    border: "#D8DAE6",
    text: "#1F2330",
    muted: "#5A6372",
    // Primary accent (buttons, links, active tab) and the text/icons on it.
    navy: "#1E2A66",
    navyHover: "#16204D",
    onNavy: "#FFFFFF",
    // The student's own chat bubble.
    bubbleUser: "#1E2A66",
    onBubbleUser: "#FFFFFF",
    // Errors / destructive actions.
    red: "#E63027",
    green: "#2F7D4F",
    // Warnings (kept clearly apart from red).
    amber: "#A16207",
    // "In Progress" and other neutral-informative states.
    info: "#1E2A66",
  },
  dark: {
    bg: "#0E1422",
    surface: "#16203A",
    surfaceAlt: "#1E2A47",
    input: "#0B1120",
    border: "#2A3656",
    text: "#ECEEF5",
    muted: "#9AA5BD",
    navy: "#C48A4A",
    navyHover: "#D29E66",
    onNavy: "#0E1422",
    bubbleUser: "#1E2A47",
    onBubbleUser: "#ECEEF5",
    red: "#F26A5F",
    green: "#6FB58A",
    amber: "#E8C170",
    info: "#8EA6EE",
  },
};

export type Palette = typeof palette.light;
export const getPalette = (isDark: boolean): Palette =>
  isDark ? palette.dark : palette.light;
