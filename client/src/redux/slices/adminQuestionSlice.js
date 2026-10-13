import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../utils/axios";

const authHeader = (getState) => ({
  headers: { Authorization: getState().auth.token },
});

const errorMessage = (error, fallback) =>
  error.response?.data?.message || (error.code === "ERR_NETWORK" ? "Network error" : fallback);

export const fetchAdminQuestions = createAsyncThunk(
  "adminQuestion/fetch",
  async ({ status = "open", source, search = "", limit = 20, offset = 0 } = {}, { getState }) => {
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (source) params.set("source", source);
      if (search) params.set("search", search);
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      const { data } = await axios.get(`/api/admin/questions?${params.toString()}`, authHeader(getState));
      return data;
    } catch (error) {
      return { success: false, message: errorMessage(error, "Failed to load questions") };
    }
  }
);

// The answer is saved even when adding it to the knowledge base fails; the
// server then reports that separately as `kbError`.
export const answerQuestion = createAsyncThunk(
  "adminQuestion/answer",
  async ({ id, answer, addToKB }, { getState }) => {
    try {
      const { data } = await axios.patch(
        `/api/admin/questions/${id}/answer`,
        { answer, addToKB },
        authHeader(getState)
      );
      return data;
    } catch (error) {
      return { success: false, message: errorMessage(error, "Failed to save the answer") };
    }
  }
);

export const dismissQuestion = createAsyncThunk(
  "adminQuestion/dismiss",
  async (id, { getState }) => {
    try {
      const { data } = await axios.patch(`/api/admin/questions/${id}/dismiss`, {}, authHeader(getState));
      return data;
    } catch (error) {
      return { success: false, message: errorMessage(error, "Failed to dismiss question") };
    }
  }
);

export const deleteQuestion = createAsyncThunk(
  "adminQuestion/delete",
  async (id, { getState }) => {
    try {
      const { data } = await axios.delete(`/api/admin/questions/${id}`, authHeader(getState));
      return { ...data, id };
    } catch (error) {
      return { success: false, message: errorMessage(error, "Failed to delete question") };
    }
  }
);

// Similar questions clustered on the server (semantic, or exact-text when the
// similarity service is down — `grouping` says which).
export const fetchQuestionGroups = createAsyncThunk(
  "adminQuestion/fetchGroups",
  async ({ status = "open", source } = {}, { getState }) => {
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (source) params.set("source", source);
      const { data } = await axios.get(
        `/api/admin/questions/groups?${params.toString()}`,
        authHeader(getState)
      );
      return data;
    } catch (error) {
      return { success: false, message: errorMessage(error, "Failed to load question groups") };
    }
  }
);

// One answer for every open question in `ids` (max 200 per call); the KB gets
// a single entry.
export const answerQuestionGroup = createAsyncThunk(
  "adminQuestion/answerGroup",
  async ({ ids, answer, addToKB }, { getState }) => {
    try {
      const { data } = await axios.patch(
        "/api/admin/questions/answer-group",
        { ids, answer, addToKB },
        authHeader(getState)
      );
      return data;
    } catch (error) {
      return { success: false, message: errorMessage(error, "Failed to answer the group") };
    }
  }
);

export const dismissQuestionGroup = createAsyncThunk(
  "adminQuestion/dismissGroup",
  async (ids, { getState }) => {
    try {
      const { data } = await axios.patch(
        "/api/admin/questions/dismiss-group",
        { ids },
        authHeader(getState)
      );
      return data;
    } catch (error) {
      return { success: false, message: errorMessage(error, "Failed to dismiss the group") };
    }
  }
);

const adminQuestionSlice = createSlice({
  name: "adminQuestion",
  initialState: {
    questions: [],
    total: 0,
    counts: { open: 0, answered: 0, dismissed: 0 },
    loading: false,
    error: null,
    loaded: false,
    requestId: null,
    submitting: false,
    groups: [],
    grouping: null,
    groupsLoading: false,
    groupsError: null,
    groupsRequestId: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminQuestions.pending, (state, action) => {
        state.loading = true;
        state.requestId = action.meta.requestId;
      })
      .addCase(fetchAdminQuestions.fulfilled, (state, action) => {
        // Ignore a slower, superseded response (older tab / search term).
        if (state.requestId !== action.meta.requestId) return;
        state.loading = false;
        state.loaded = true;
        if (action.payload.success) {
          state.questions = action.payload.questions || [];
          state.total = action.payload.total ?? state.questions.length;
          if (action.payload.counts) state.counts = { ...state.counts, ...action.payload.counts };
          state.error = null;
        } else {
          state.error = action.payload.message || "Failed to load questions";
        }
      })
      .addCase(fetchAdminQuestions.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) return;
        state.loading = false;
        state.error = "Failed to load questions";
      })
      .addCase(fetchQuestionGroups.pending, (state, action) => {
        state.groupsLoading = true;
        state.groupsRequestId = action.meta.requestId;
      })
      .addCase(fetchQuestionGroups.fulfilled, (state, action) => {
        if (state.groupsRequestId !== action.meta.requestId) return;
        state.groupsLoading = false;
        if (action.payload.success) {
          state.groups = action.payload.groups || [];
          state.grouping = action.payload.grouping || null;
          state.groupsError = null;
        } else {
          state.groupsError = action.payload.message || "Failed to load question groups";
        }
      })
      .addCase(fetchQuestionGroups.rejected, (state, action) => {
        if (state.groupsRequestId !== action.meta.requestId) return;
        state.groupsLoading = false;
        state.groupsError = "Failed to load question groups";
      });

    [
      answerQuestion,
      dismissQuestion,
      deleteQuestion,
      answerQuestionGroup,
      dismissQuestionGroup,
    ].forEach((thunk) => {
      builder
        .addCase(thunk.pending, (state) => { state.submitting = true; })
        .addCase(thunk.fulfilled, (state) => { state.submitting = false; })
        .addCase(thunk.rejected, (state) => { state.submitting = false; });
    });
  },
});

export default adminQuestionSlice.reducer;
