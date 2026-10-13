import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../utils/axios";

const authHeader = (getState) => ({
  headers: { Authorization: getState().auth.token },
});

const errorMessage = (error, fallback) =>
  error.response?.data?.message || (error.code === "ERR_NETWORK" ? "Network error" : fallback);

export const fetchAdminListings = createAsyncThunk(
  "adminListing/fetch",
  async ({ kind, status, search = "", limit = 25, offset = 0 } = {}, { getState }) => {
    try {
      const params = new URLSearchParams();
      if (kind) params.set("kind", kind);
      if (status) params.set("status", status);
      if (search) params.set("search", search);
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      const { data } = await axios.get(`/api/admin/listings?${params.toString()}`, authHeader(getState));
      return data;
    } catch (error) {
      return { success: false, message: errorMessage(error, "Failed to load listings") };
    }
  }
);

// Scraping runs the page through the LLM on the Python side, so it can take
// up to a minute: start a background job (202 {jobId}) and poll it. 409 means
// the link was already added and carries that listing so the UI can open it.
export const startScrapeJob = createAsyncThunk(
  "adminListing/startScrapeJob",
  async ({ url, kind }, { getState }) => {
    try {
      const { data } = await axios.post(
        "/api/admin/listings/scrape-jobs",
        { url, kind },
        authHeader(getState)
      );
      return data;
    } catch (error) {
      return {
        success: false,
        status: error.response?.status,
        message: errorMessage(error, "Failed to start scraping the link"),
        listing: error.response?.data?.listing || null,
      };
    }
  }
);

// → { success, job: { jobId, status, stage, stageLabel, elapsedMs, listing,
// duplicate, error } }. 404 = unknown/expired job (or started by another admin).
export const fetchScrapeJob = createAsyncThunk(
  "adminListing/fetchScrapeJob",
  async (jobId, { getState }) => {
    try {
      const { data } = await axios.get(
        `/api/admin/listings/scrape-jobs/${encodeURIComponent(jobId)}`,
        authHeader(getState)
      );
      return data;
    } catch (error) {
      return {
        success: false,
        status: error.response?.status,
        message: errorMessage(error, "Failed to check the scrape progress"),
      };
    }
  }
);

export const createListing = createAsyncThunk(
  "adminListing/create",
  async (fields, { getState }) => {
    try {
      const { data } = await axios.post("/api/admin/listings", fields, authHeader(getState));
      return data;
    } catch (error) {
      return { success: false, message: errorMessage(error, "Failed to create listing") };
    }
  }
);

export const updateListing = createAsyncThunk(
  "adminListing/update",
  async ({ id, changes }, { getState }) => {
    try {
      const { data } = await axios.patch(`/api/admin/listings/${id}`, changes, authHeader(getState));
      return data;
    } catch (error) {
      return { success: false, message: errorMessage(error, "Failed to update listing") };
    }
  }
);

export const deleteListing = createAsyncThunk(
  "adminListing/delete",
  async (id, { getState }) => {
    try {
      const { data } = await axios.delete(`/api/admin/listings/${id}`, authHeader(getState));
      return { ...data, id };
    } catch (error) {
      return { success: false, message: errorMessage(error, "Failed to delete listing") };
    }
  }
);

// Event poster image (jpeg/png/webp, max 3 MB). Returns the server-relative
// `url` the editor then saves as the listing's posterUrl. A plain thunk (not
// createAsyncThunk) so the progress callback never ends up inside an action.
// Usage: `await dispatch(uploadListingPoster(file, (pct) => ...))`.
export const uploadListingPoster = (file, onProgress) => async (_dispatch, getState) => {
  try {
    const fd = new FormData();
    fd.append("poster", file);
    const { data } = await axios.post("/api/admin/listings/poster", fd, {
      headers: {
        Authorization: getState().auth.token,
        "Content-Type": "multipart/form-data",
      },
      onUploadProgress: (e) => {
        if (onProgress && e.total) onProgress(Math.round((e.loaded / e.total) * 100));
      },
    });
    return data;
  } catch (error) {
    return { success: false, message: errorMessage(error, "Failed to upload the poster") };
  }
};

const adminListingSlice = createSlice({
  name: "adminListing",
  initialState: {
    listings: [],
    total: 0,
    loading: false,
    error: null,
    // Only the latest list request may update the table (a slow response for
    // an older tab/search must not overwrite a newer one).
    requestId: null,
    submitting: false,
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchAdminListings.pending, (state, action) => {
        state.loading = true;
        state.requestId = action.meta.requestId;
      })
      .addCase(fetchAdminListings.fulfilled, (state, action) => {
        if (state.requestId !== action.meta.requestId) return;
        state.loading = false;
        if (action.payload.success) {
          state.listings = action.payload.listings || [];
          state.total = action.payload.total ?? state.listings.length;
          state.error = null;
        } else {
          state.error = action.payload.message || "Failed to load listings";
        }
      })
      .addCase(fetchAdminListings.rejected, (state, action) => {
        if (state.requestId !== action.meta.requestId) return;
        state.loading = false;
        state.error = action.error?.message || "Failed to load listings";
      })
      .addCase(createListing.pending, (state) => { state.submitting = true; })
      .addCase(createListing.fulfilled, (state) => { state.submitting = false; })
      .addCase(createListing.rejected, (state) => { state.submitting = false; })
      .addCase(updateListing.pending, (state) => { state.submitting = true; })
      .addCase(updateListing.fulfilled, (state, action) => {
        state.submitting = false;
        const updated = action.payload.success && action.payload.listing;
        if (updated) {
          state.listings = state.listings.map((l) => (l._id === updated._id ? updated : l));
        }
      })
      .addCase(updateListing.rejected, (state) => { state.submitting = false; })
      .addCase(deleteListing.pending, (state) => { state.submitting = true; })
      .addCase(deleteListing.fulfilled, (state) => { state.submitting = false; })
      .addCase(deleteListing.rejected, (state) => { state.submitting = false; });
  },
});

export default adminListingSlice.reducer;
