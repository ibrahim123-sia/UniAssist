import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../utils/axios";

const authHeader = (getState) => ({
  headers: { Authorization: getState().auth.token },
});

const errorMessage = (error, fallback) => {
  if (error.response?.data?.message) return error.response.data.message;
  if (error.code === "ERR_NETWORK") return "Couldn't reach the server";
  if (error.code === "ECONNABORTED") return "The server took too long to answer";
  return fallback;
};

// GET /api/admin/settings/email -> { success, settings: { senderEmail,
// senderName, smtpHost, smtpPort, secure, hasPassword, source, lastTestAt,
// lastTestOk, lastTestError } }
export const fetchEmailSettings = createAsyncThunk(
  "adminSettings/fetchEmail",
  async (_, { getState }) => {
    try {
      const { data } = await axios.get("/api/admin/settings/email", authHeader(getState));
      if (data.success) return { success: true, settings: data.settings };
      return { success: false, message: data.message || "Failed to load email settings" };
    } catch (error) {
      return { success: false, message: errorMessage(error, "Failed to load email settings") };
    }
  }
);

// PUT /api/admin/settings/email { senderEmail, senderName?, smtpHost?,
// smtpPort?, appPassword? } — the server signs in to the mail server (up to
// ~15 s) before saving; a failed sign-in is a 400 and nothing is saved.
export const saveEmailSettings = createAsyncThunk(
  "adminSettings/saveEmail",
  async (body, { getState }) => {
    try {
      const { data } = await axios.put("/api/admin/settings/email", body, {
        ...authHeader(getState),
        timeout: 30000,
      });
      if (data.success) return { success: true, settings: data.settings };
      return { success: false, message: data.message || "Failed to save email settings" };
    } catch (error) {
      return { success: false, message: errorMessage(error, "Failed to save email settings") };
    }
  }
);

// POST /api/admin/settings/email/test { to? } -> { success, message }
export const sendTestEmail = createAsyncThunk(
  "adminSettings/testEmail",
  async (body, { getState }) => {
    try {
      const { data } = await axios.post("/api/admin/settings/email/test", body || {}, {
        ...authHeader(getState),
        timeout: 30000,
      });
      return { success: !!data.success, message: data.message };
    } catch (error) {
      return { success: false, message: errorMessage(error, "Failed to send the test email") };
    }
  }
);

const adminSettingsSlice = createSlice({
  name: "adminSettings",
  initialState: {
    email: null,
    emailLoading: false,
    emailError: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchEmailSettings.pending, (state) => {
        state.emailLoading = true;
      })
      .addCase(fetchEmailSettings.fulfilled, (state, action) => {
        state.emailLoading = false;
        if (action.payload.success) {
          state.email = action.payload.settings;
          state.emailError = null;
        } else {
          state.emailError = action.payload.message;
        }
      })
      .addCase(fetchEmailSettings.rejected, (state) => {
        state.emailLoading = false;
      })
      .addCase(saveEmailSettings.fulfilled, (state, action) => {
        if (action.payload.success && action.payload.settings) {
          state.email = action.payload.settings;
          state.emailError = null;
        }
      });
  },
});

export default adminSettingsSlice.reducer;
