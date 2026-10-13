import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import { apiListIssues } from "../../api/issue";
import { errorMessage } from "../../api/client";

// The student's issue list only; the detail screen keeps its issue in local
// state so one screen never renders another issue's stale data.
export const fetchMyIssues = createAsyncThunk("issue/mine", async (_, { rejectWithValue }) => {
  try {
    const { data } = await apiListIssues();
    return (data?.issues || []) as any[];
  } catch (e) {
    return rejectWithValue(errorMessage(e, "Couldn't load your issues"));
  }
});

const slice = createSlice({
  name: "issue",
  initialState: {
    mine: [] as any[],
    mineLoading: false,
    mineError: null as string | null,
  },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchMyIssues.pending, (s) => { s.mineLoading = true; })
     .addCase(fetchMyIssues.fulfilled, (s, a) => {
       s.mineLoading = false;
       s.mineError = null;
       s.mine = a.payload;
     })
     .addCase(fetchMyIssues.rejected, (s, a) => {
       s.mineLoading = false;
       s.mineError = (a.payload as string) || "Couldn't load your issues";
     });
  },
});

export default slice.reducer;
