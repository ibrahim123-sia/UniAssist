import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../utils/axios";

const authHeader = (getState) => ({
  headers: { Authorization: getState().auth.token },
});

// System health for the admin Health page. A degraded system may still answer
// with an error status, so a body that carries the report is used as-is.
export const fetchSystemHealth = createAsyncThunk(
  "adminHealth/fetch",
  async (_, { getState }) => {
    try {
      const { data } = await axios.get("/api/admin/health", authHeader(getState));
      return data;
    } catch (error) {
      const body = error.response?.data;
      if (body?.checkedAt) return { ...body, success: true };
      return {
        success: false,
        message:
          body?.message ||
          (error.code === "ERR_NETWORK" ? "Couldn't reach the server" : "Failed to check system health"),
      };
    }
  }
);

const adminHealthSlice = createSlice({
  name: "adminHealth",
  initialState: {
    health: null,
    loading: false,
    error: null,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchSystemHealth.pending, (state) => { state.loading = true; })
      .addCase(fetchSystemHealth.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.success) {
          const { success: _ok, ...health } = action.payload;
          state.health = health;
          state.error = null;
        } else {
          state.error = action.payload.message;
        }
      })
      .addCase(fetchSystemHealth.rejected, (state) => { state.loading = false; });
  },
});

export default adminHealthSlice.reducer;
