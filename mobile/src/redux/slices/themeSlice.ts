import { createSlice } from "@reduxjs/toolkit";

type Theme = "light" | "dark";

const slice = createSlice({
  name: "theme",
  initialState: { theme: "light" as Theme },
  reducers: {
    toggleTheme(s) { s.theme = s.theme === "dark" ? "light" : "dark"; },
  },
});

export const { toggleTheme } = slice.actions;
export default slice.reducer;
