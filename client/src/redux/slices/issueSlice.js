import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../utils/axios";

const authHeader = (getState) => ({
  headers: { Authorization: getState().auth.token },
});

const errorMessage = (error, fallback) => {
  if (error.response?.status === 401) return "Session expired";
  if (error.response?.status === 403) return error.response?.data?.message || "Access denied";
  if (error.code === "ERR_NETWORK") return "Network error";
  return error.response?.data?.message || fallback;
};

// 409 responses carry the freshest issue payload so the UI can show "Sara just
// resolved this" and let the user retry against the new state.
const conflictPayload = (error) => ({
  success: false,
  conflict: true,
  message: error.response?.data?.message || "This issue was just updated by another staff member.",
  issue: error.response?.data?.issue || null,
});

export const createIssue = createAsyncThunk(
  "issue/create",
  async ({ title, description, category, departmentId, files }, { getState }) => {
    try {
      const fd = new FormData();
      fd.append("title", title);
      fd.append("description", description);
      fd.append("category", category || "other");
      fd.append("departmentId", departmentId);
      if (files && files.length) {
        for (const f of files) fd.append("attachments", f);
      }
      const { data } = await axios.post("/api/issue", fd, {
        headers: {
          Authorization: getState().auth.token,
          "Content-Type": "multipart/form-data",
        },
      });
      return data;
    } catch (error) {
      return { success: false, message: errorMessage(error, "Failed to create issue") };
    }
  }
);

// Best-guess department for a chat complaint. `suggestion` may be null.
export const fetchDepartmentSuggestion = createAsyncThunk(
  "issue/departmentSuggestion",
  async (text, { getState }) => {
    try {
      const params = new URLSearchParams();
      params.set("text", text);
      const { data } = await axios.get(
        `/api/issue/department-suggestion?${params.toString()}`,
        authHeader(getState)
      );
      return data;
    } catch (error) {
      return { success: false, suggestion: null, message: errorMessage(error, "No suggestion") };
    }
  }
);

// "Register a complaint" from the chatbot: the server attaches the chat
// transcript. 409 = a complaint from this chat is still open; it comes back
// as `existing` so the UI can link to it.
export const createIssueFromChat = createAsyncThunk(
  "issue/createFromChat",
  async ({ chatId, departmentId, details }, { getState }) => {
    try {
      const body = { chatId, departmentId };
      if (details) body.details = details;
      const { data } = await axios.post("/api/issue/from-chat", body, authHeader(getState));
      return data;
    } catch (error) {
      const status = error.response?.status;
      if (status === 409) {
        return {
          success: false,
          duplicate: true,
          message: error.response?.data?.message || "You already registered a complaint from this chat",
          existing: error.response?.data?.issue || null,
        };
      }
      if (status === 429 && !error.response?.data?.message) {
        return { success: false, message: "Too many complaints in a short time. Please try again later." };
      }
      return { success: false, message: errorMessage(error, "Failed to register the complaint") };
    }
  }
);

// One-time 1–5 star rating once the issue is Resolved/Closed.
export const submitIssueFeedback = createAsyncThunk(
  "issue/feedback",
  async ({ id, rating, comment }, { getState }) => {
    try {
      const body = { rating };
      if (comment) body.comment = comment;
      const { data } = await axios.post(`/api/issue/${id}/feedback`, body, authHeader(getState));
      return data;
    } catch (error) {
      return {
        success: false,
        status: error.response?.status,
        message: errorMessage(error, "Failed to submit your feedback"),
      };
    }
  }
);

export const fetchMyIssues = createAsyncThunk(
  "issue/fetchMy",
  async (status, { getState }) => {
    try {
      const params = status ? `?status=${encodeURIComponent(status)}` : "";
      const { data } = await axios.get(`/api/issue/my${params}`, authHeader(getState));
      return data;
    } catch (error) {
      return { success: false, message: errorMessage(error, "Failed to load issues") };
    }
  }
);

export const fetchIssueById = createAsyncThunk(
  "issue/fetchById",
  async (id, { getState }) => {
    try {
      const { data } = await axios.get(`/api/issue/${id}`, authHeader(getState));
      return data;
    } catch (error) {
      return {
        success: false,
        status: error.response?.status,
        message: errorMessage(error, "Failed to load issue"),
      };
    }
  }
);

export const addStudentReply = createAsyncThunk(
  "issue/replyStudent",
  async ({ id, message }, { getState }) => {
    try {
      const { data } = await axios.post(
        `/api/issue/${id}/reply`,
        { message },
        authHeader(getState)
      );
      return data;
    } catch (error) {
      return { success: false, message: errorMessage(error, "Failed to send reply") };
    }
  }
);

export const fetchDeptStats = createAsyncThunk(
  "issue/fetchDeptStats",
  async (_, { getState }) => {
    try {
      const { data } = await axios.get("/api/issue/department/stats", authHeader(getState));
      return data;
    } catch (error) {
      return { success: false, message: errorMessage(error, "Failed to load stats") };
    }
  }
);

export const fetchDeptIssues = createAsyncThunk(
  "issue/fetchDept",
  async (status, { getState }) => {
    try {
      const params = status ? `?status=${encodeURIComponent(status)}` : "";
      const { data } = await axios.get(
        `/api/issue/department${params}`,
        authHeader(getState)
      );
      return data;
    } catch (error) {
      return { success: false, message: errorMessage(error, "Failed to load department issues") };
    }
  }
);

export const fetchDeptIssueById = createAsyncThunk(
  "issue/fetchDeptById",
  async (id, { getState }) => {
    try {
      const { data } = await axios.get(
        `/api/issue/department/${id}`,
        authHeader(getState)
      );
      return data;
    } catch (error) {
      return {
        success: false,
        status: error.response?.status,
        message: errorMessage(error, "Failed to load issue"),
      };
    }
  }
);

export const updateIssueStatus = createAsyncThunk(
  "issue/updateStatus",
  async ({ id, status, reason, expectedUpdatedAt }, { getState }) => {
    try {
      const { data } = await axios.patch(
        `/api/issue/department/${id}/status`,
        { status, reason, expectedUpdatedAt },
        authHeader(getState)
      );
      return data;
    } catch (error) {
      if (error.response?.status === 409) return conflictPayload(error);
      return { success: false, message: errorMessage(error, "Failed to update status") };
    }
  }
);

export const addStaffReply = createAsyncThunk(
  "issue/replyStaff",
  async ({ id, message, status, reason, expectedUpdatedAt }, { getState }) => {
    try {
      const { data } = await axios.post(
        `/api/issue/department/${id}/sfo-reply`,
        { message, status, reason, expectedUpdatedAt },
        authHeader(getState)
      );
      return data;
    } catch (error) {
      if (error.response?.status === 409) return conflictPayload(error);
      return { success: false, message: errorMessage(error, "Failed to send reply") };
    }
  }
);

export const assignIssue = createAsyncThunk(
  "issue/assign",
  async ({ id, assigneeId, expectedUpdatedAt }, { getState }) => {
    try {
      const { data } = await axios.patch(
        `/api/issue/department/${id}/assign`,
        { assigneeId, expectedUpdatedAt },
        authHeader(getState)
      );
      return data;
    } catch (error) {
      if (error.response?.status === 409) return conflictPayload(error);
      return { success: false, message: errorMessage(error, "Failed to reassign issue") };
    }
  }
);

export const fetchDeptStaff = createAsyncThunk(
  "issue/fetchDeptStaff",
  async (_, { getState }) => {
    try {
      const { data } = await axios.get("/api/issue/department/staff", authHeader(getState));
      return data;
    } catch (error) {
      return { success: false, message: errorMessage(error, "Failed to load staff") };
    }
  }
);

const initialState = {
  myIssues: [],
  deptIssues: [],
  selectedIssue: null,
  // { id, status, message } for the last failed load of an issue detail page.
  issueError: null,
  deptStats: null,
  deptStatsLoading: false,
  deptStaff: [],
  loading: false,
  submitting: false,
};

// Shared by the student and staff detail fetches. Results are tagged with the
// requested id so a slow response for a previous URL can't be shown (or
// reported as an error) on the page the user has since navigated to.
const issueLoaded = (state, action) => {
  const id = action.meta.arg;
  const { success, issue, status, message } = action.payload;
  if (success && issue) {
    if (String(issue._id) !== String(id)) return;
    state.selectedIssue = issue;
    if (state.issueError?.id === id) state.issueError = null;
    return;
  }
  state.issueError = { id, status, message: message || "Failed to load issue" };
  // Gone or forbidden: stop showing the stale copy. A network blip during
  // polling keeps the last good version on screen.
  if ((status === 403 || status === 404) && String(state.selectedIssue?._id) === String(id)) {
    state.selectedIssue = null;
  }
};

const issueSlice = createSlice({
  name: "issue",
  initialState,
  reducers: {
    clearSelectedIssue(state) {
      state.selectedIssue = null;
      state.issueError = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchMyIssues.pending, (state) => { state.loading = true; })
      .addCase(fetchMyIssues.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.success) state.myIssues = action.payload.issues;
      })
      .addCase(fetchMyIssues.rejected, (state) => { state.loading = false; })
      .addCase(fetchDeptIssues.pending, (state) => { state.loading = true; })
      .addCase(fetchDeptIssues.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.success) state.deptIssues = action.payload.issues;
      })
      .addCase(fetchDeptIssues.rejected, (state) => { state.loading = false; })
      .addCase(fetchIssueById.fulfilled, issueLoaded)
      .addCase(fetchDeptIssueById.fulfilled, issueLoaded)
      .addCase(addStudentReply.fulfilled, (state, action) => {
        if (action.payload.success) state.selectedIssue = action.payload.issue;
      })
      .addCase(submitIssueFeedback.fulfilled, (state, action) => {
        const issue = action.payload.success && action.payload.issue;
        if (issue && String(issue._id) === String(state.selectedIssue?._id)) {
          state.selectedIssue = issue;
        }
      })
      .addCase(addStaffReply.fulfilled, (state, action) => {
        // Refresh the selected issue on success AND on conflict — server
        // returned the latest version either way, so the UI stays in sync.
        if (action.payload.issue) state.selectedIssue = action.payload.issue;
      })
      .addCase(updateIssueStatus.fulfilled, (state, action) => {
        if (action.payload.issue) state.selectedIssue = action.payload.issue;
      })
      .addCase(assignIssue.fulfilled, (state, action) => {
        if (action.payload.issue) state.selectedIssue = action.payload.issue;
      })
      .addCase(fetchDeptStaff.fulfilled, (state, action) => {
        if (action.payload.success) state.deptStaff = action.payload.staff;
      })
      .addCase(createIssue.pending, (state) => { state.submitting = true; })
      .addCase(createIssue.fulfilled, (state) => { state.submitting = false; })
      .addCase(createIssue.rejected, (state) => { state.submitting = false; })
      .addCase(fetchDeptStats.pending, (state) => { state.deptStatsLoading = true; })
      .addCase(fetchDeptStats.fulfilled, (state, action) => {
        state.deptStatsLoading = false;
        if (action.payload.success) state.deptStats = action.payload.stats;
      })
      .addCase(fetchDeptStats.rejected, (state) => { state.deptStatsLoading = false; });
  },
});

export const { clearSelectedIssue } = issueSlice.actions;
export default issueSlice.reducer;
