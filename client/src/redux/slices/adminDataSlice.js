import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import pythonAxios, { withAuth, withAuthMultipart } from "../../utils/pythonAxios";

// FastAPI puts errors in `detail`: a string for HTTPException, a list of
// {msg} objects for request-validation (422) errors.
const errorMessage = (error, fallback) => {
  const detail = error.response?.data?.detail;
  if (typeof detail === "string" && detail) return detail;
  if (Array.isArray(detail) && detail.length) {
    return detail.map((d) => d?.msg || String(d)).join("; ");
  }
  return error.response?.data?.message || error.message || fallback;
};

export const fetchChunks = createAsyncThunk(
  "adminData/list",
  async ({ search = "", limit = 25, offset = 0 } = {}, { getState }) => {
    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      if (search) params.set("search", search);
      const { data } = await pythonAxios.get(`/chunks?${params.toString()}`, withAuth(getState));
      return data;
    } catch (error) {
      return { success: false, message: errorMessage(error, "Failed to load chunks") };
    }
  }
);

export const getChunk = createAsyncThunk(
  "adminData/get",
  async (id, { getState }) => {
    try {
      const { data } = await pythonAxios.get(`/chunks/${id}`, withAuth(getState));
      return data;
    } catch (error) {
      return { success: false, message: errorMessage(error, "Failed to load chunk") };
    }
  }
);

export const addChunk = createAsyncThunk(
  "adminData/add",
  async ({ text, source }, { getState }) => {
    try {
      const { data } = await pythonAxios.post(`/chunks`, { text, source }, withAuth(getState));
      return data;
    } catch (error) {
      return { success: false, message: errorMessage(error, "Failed to add chunk") };
    }
  }
);

export const updateChunk = createAsyncThunk(
  "adminData/update",
  async ({ id, text }, { getState }) => {
    try {
      const { data } = await pythonAxios.patch(`/chunks/${id}`, { text }, withAuth(getState));
      return data;
    } catch (error) {
      return { success: false, message: errorMessage(error, "Failed to update chunk") };
    }
  }
);

export const deleteChunk = createAsyncThunk(
  "adminData/delete",
  async (id, { getState }) => {
    try {
      const { data } = await pythonAxios.delete(`/chunks/${id}`, withAuth(getState));
      return { ...data, id };
    } catch (error) {
      return { success: false, message: errorMessage(error, "Failed to delete chunk") };
    }
  }
);

// Two phases the Data page shows: the browser sending the file (upload %),
// then the AI service splitting + embedding it (no progress events — the
// page shows elapsed seconds instead).
export const uploadDocument = createAsyncThunk(
  "adminData/upload",
  async ({ file, source }, { getState, dispatch }) => {
    try {
      const fd = new FormData();
      fd.append("file", file);
      if (source) fd.append("source", source);
      let lastPct = -1;
      const { data } = await pythonAxios.post(`/documents`, fd, {
        ...withAuthMultipart(getState),
        onUploadProgress: (e) => {
          const pct = e.total ? Math.round((e.loaded / e.total) * 100) : null;
          if (pct === null || pct === lastPct) return;
          lastPct = pct;
          dispatch(adminDataSlice.actions.uploadProgress(pct));
        },
      });
      return data;
    } catch (error) {
      return { success: false, message: errorMessage(error, "Failed to upload document") };
    }
  }
);

// --- "Add from website": background crawl jobs + the sources they created ---

export const startKbIngest = createAsyncThunk(
  "adminData/ingestUrl",
  async ({ url, mode, maxPages }, { getState }) => {
    try {
      const body = { url, mode };
      if (mode === "site") body.maxPages = maxPages;
      const { data } = await pythonAxios.post(`/kb/ingest-url`, body, withAuth(getState));
      return { success: true, ...data };
    } catch (error) {
      return {
        success: false,
        status: error.response?.status,
        message: errorMessage(error, "Failed to start the import"),
      };
    }
  }
);

// Polled every 2s while a job runs; deliberately not stored in the slice so
// each poll doesn't re-render the whole Data page.
export const fetchKbJob = createAsyncThunk(
  "adminData/kbJob",
  async (jobId, { getState }) => {
    try {
      const { data } = await pythonAxios.get(
        `/kb/jobs/${encodeURIComponent(jobId)}`,
        withAuth(getState)
      );
      return { success: true, job: data };
    } catch (error) {
      return {
        success: false,
        status: error.response?.status,
        message: errorMessage(error, "Failed to load import progress"),
      };
    }
  }
);

export const fetchKbJobs = createAsyncThunk(
  "adminData/kbJobs",
  async (_, { getState }) => {
    try {
      const { data } = await pythonAxios.get(`/kb/jobs`, withAuth(getState));
      const jobs = Array.isArray(data) ? data : data?.jobs || [];
      return { success: true, jobs };
    } catch (error) {
      return { success: false, message: errorMessage(error, "Failed to load recent imports") };
    }
  }
);

// The contract fixes the content (distinct sources + chunk counts) but not
// the key names, so each row is normalised to { source, chunks }.
export const fetchKbSources = createAsyncThunk(
  "adminData/kbSources",
  async (_, { getState }) => {
    try {
      const { data } = await pythonAxios.get(`/kb/sources`, withAuth(getState));
      const rows = Array.isArray(data) ? data : data?.sources || data?.items || [];
      const sources = rows
        .map((r) =>
          typeof r === "string"
            ? { source: r, chunks: null }
            : {
                source: r.source ?? r.url,
                chunks: r.chunks ?? r.count ?? r.chunkCount ?? r.chunk_count ?? null,
              }
        )
        .filter((r) => r.source);
      return { success: true, sources };
    } catch (error) {
      return { success: false, message: errorMessage(error, "Failed to load website sources") };
    }
  }
);

export const deleteKbSource = createAsyncThunk(
  "adminData/deleteKbSource",
  async (source, { getState }) => {
    try {
      const { data } = await pythonAxios.delete(
        `/kb/sources?url=${encodeURIComponent(source)}`,
        withAuth(getState)
      );
      return { ...(data && typeof data === "object" ? data : {}), success: true, source };
    } catch (error) {
      return { success: false, message: errorMessage(error, "Failed to delete source") };
    }
  }
);

const adminDataSlice = createSlice({
  name: "adminData",
  initialState: {
    chunks: [],
    total: 0,
    selected: null,
    loading: false,
    detailLoading: false,
    submitting: false,
    kbSources: [],
    kbSourcesLoading: false,
    kbSourcesError: null,
    // Document upload: phase null | "uploading" | "processing".
    upload: { phase: null, percent: 0, processingStartedAt: null },
  },
  reducers: {
    clearSelectedChunk(state) { state.selected = null; },
    uploadProgress(state, action) {
      if (!state.upload.phase) return;
      state.upload.percent = action.payload;
      if (action.payload >= 100 && state.upload.phase === "uploading") {
        state.upload.phase = "processing";
        state.upload.processingStartedAt = Date.now();
      }
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchChunks.pending, (state) => { state.loading = true; })
      .addCase(fetchChunks.fulfilled, (state, action) => {
        state.loading = false;
        if (action.payload.success) {
          state.chunks = action.payload.items;
          state.total = action.payload.total ?? action.payload.items.length;
        }
      })
      .addCase(fetchChunks.rejected, (state) => { state.loading = false; })
      .addCase(getChunk.pending, (state) => { state.detailLoading = true; })
      .addCase(getChunk.fulfilled, (state, action) => {
        state.detailLoading = false;
        if (action.payload.success) state.selected = action.payload.chunk;
      })
      .addCase(getChunk.rejected, (state) => { state.detailLoading = false; })
      .addCase(addChunk.pending, (state) => { state.submitting = true; })
      .addCase(addChunk.fulfilled, (state) => { state.submitting = false; })
      .addCase(addChunk.rejected, (state) => { state.submitting = false; })
      .addCase(updateChunk.pending, (state) => { state.submitting = true; })
      .addCase(updateChunk.fulfilled, (state, action) => {
        state.submitting = false;
        if (action.payload.success) state.selected = action.payload.chunk;
      })
      .addCase(updateChunk.rejected, (state) => { state.submitting = false; })
      .addCase(uploadDocument.pending, (state) => {
        state.submitting = true;
        state.upload = { phase: "uploading", percent: 0, processingStartedAt: null };
      })
      .addCase(uploadDocument.fulfilled, (state) => {
        state.submitting = false;
        state.upload = { phase: null, percent: 0, processingStartedAt: null };
      })
      .addCase(uploadDocument.rejected, (state) => {
        state.submitting = false;
        state.upload = { phase: null, percent: 0, processingStartedAt: null };
      })
      .addCase(fetchKbSources.pending, (state) => { state.kbSourcesLoading = true; })
      .addCase(fetchKbSources.fulfilled, (state, action) => {
        state.kbSourcesLoading = false;
        if (action.payload.success) {
          state.kbSources = action.payload.sources;
          state.kbSourcesError = null;
        } else {
          state.kbSourcesError = action.payload.message;
        }
      })
      .addCase(fetchKbSources.rejected, (state) => { state.kbSourcesLoading = false; })
      .addCase(deleteKbSource.fulfilled, (state, action) => {
        if (action.payload.success) {
          state.kbSources = state.kbSources.filter((s) => s.source !== action.payload.source);
        }
      });
  },
});

export const { clearSelectedChunk } = adminDataSlice.actions;
export default adminDataSlice.reducer;
