import { createSlice } from "@reduxjs/toolkit";

const STORAGE_KEY = "uniassist-theme";

// index.html sets data-theme before React loads; read it back so the store
// starts in sync. Day Desk (light) is the default for every new visitor.
const readInitial = () =>
  document.documentElement.getAttribute("data-theme") === "dark" ? "dark" : "light";

// Applied inside the reducer (not an effect) so anything rendering after the
// dispatch, e.g. charts reading CSS variables, already sees the new mode.
const applyTheme = (theme) => {
  document.documentElement.setAttribute("data-theme", theme);
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute("content", theme === "dark" ? "#0A0F1E" : "#F7F8FC");
  try {
    localStorage.setItem(STORAGE_KEY, theme);
  } catch {
    // Private mode / blocked storage: the choice just won't persist.
  }
};

const initialState = {
  theme: readInitial(),
};

const themeSlice = createSlice({
  name: "theme",
  initialState,
  reducers: {
    setTheme(state, action) {
      state.theme = action.payload === "dark" ? "dark" : "light";
      applyTheme(state.theme);
    },
    toggleTheme(state) {
      state.theme = state.theme === "light" ? "dark" : "light";
      applyTheme(state.theme);
    },
  },
});

export const { setTheme, toggleTheme } = themeSlice.actions;
export default themeSlice.reducer;
