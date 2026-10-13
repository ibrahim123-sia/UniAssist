import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../utils/axios";

const authHeader = (getState) => ({
  headers: { Authorization: getState().auth.token },
});

const errorMessage = (error, fallback) => {
  if (error.response?.status === 429 && !error.response?.data?.message) {
    return "You've sent a lot of questions recently. Please try again later.";
  }
  return error.response?.data?.message || (error.code === "ERR_NETWORK" ? "Network error" : fallback);
};

// Student "Ask an admin": forwards a chat question to the university admins.
export const askAdmin = createAsyncThunk(
  "question/ask",
  async ({ question, chatId }, { getState }) => {
    try {
      const body = { question };
      if (chatId) body.chatId = chatId;
      const { data } = await axios.post("/api/question", body, authHeader(getState));
      return data;
    } catch (error) {
      return { success: false, message: errorMessage(error, "Failed to send your question") };
    }
  }
);

export const fetchMyQuestions = createAsyncThunk(
  "question/fetchMine",
  async (_, { getState }) => {
    try {
      const { data } = await axios.get("/api/question/my", authHeader(getState));
      return data;
    } catch (error) {
      return { success: false, message: errorMessage(error, "Failed to load your questions") };
    }
  }
);

const questionSlice = createSlice({
  name: "question",
  initialState: {
    myQuestions: [],
    loading: false,
    loaded: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyQuestions.pending, (state) => { state.loading = true; })
      .addCase(fetchMyQuestions.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.success) {
          state.myQuestions = action.payload.questions || [];
          state.loaded = true;
          state.error = null;
        } else {
          state.error = action.payload.message || "Failed to load your questions";
        }
      })
      .addCase(fetchMyQuestions.rejected, (state) => {
        state.loading = false;
        state.error = "Failed to load your questions";
      })
      .addCase(askAdmin.fulfilled, (state, action) => {
        const q = action.payload.success && action.payload.question;
        if (q && state.loaded) {
          state.myQuestions = [q, ...state.myQuestions.filter((x) => x._id !== q._id)];
        }
      });
  },
});

export default questionSlice.reducer;
