import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../utils/axios";

const authHeader = (getState) => ({
  headers: { Authorization: getState().auth.token },
});

// Student-facing feed of admin-published jobs, scholarships and events.
// Jobs/scholarships hide closed deadlines unless `includeExpired`; events show
// upcoming ones by default and only past ones with `past` (same params as the
// mobile app).
export const fetchListings = createAsyncThunk(
  "listing/fetch",
  async (
    { kind, search = "", includeExpired = false, past = false, limit = 20, offset = 0 },
    { getState }
  ) => {
    try {
      const params = new URLSearchParams();
      params.set("kind", kind);
      if (search) params.set("search", search);
      if (includeExpired) params.set("includeExpired", "true");
      if (past) params.set("past", "true");
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      const { data } = await axios.get(`/api/listings?${params.toString()}`, authHeader(getState));
      return { ...data, kind, append: offset > 0 };
    } catch (error) {
      return {
        success: false,
        kind,
        message:
          error.response?.data?.message ||
          (error.code === "ERR_NETWORK" ? "Network error" : "Failed to load listings"),
      };
    }
  }
);

const emptyFeed = () => ({
  items: [],
  total: 0,
  loading: false,
  error: null,
  loaded: false,
  requestId: null,
});

const listingSlice = createSlice({
  name: "listing",
  initialState: {
    job: emptyFeed(),
    scholarship: emptyFeed(),
    event: emptyFeed(),
  },
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(fetchListings.pending, (state, action) => {
        const feed = state[action.meta.arg.kind];
        if (!feed) return;
        feed.loading = true;
        feed.requestId = action.meta.requestId;
      })
      .addCase(fetchListings.fulfilled, (state, action) => {
        const feed = state[action.payload.kind];
        // Ignore a slower, superseded response (e.g. an older search term).
        if (!feed || feed.requestId !== action.meta.requestId) return;
        feed.loading = false;
        feed.loaded = true;
        if (action.payload.success) {
          const incoming = action.payload.listings || [];
          feed.items = action.payload.append ? [...feed.items, ...incoming] : incoming;
          feed.total = action.payload.total ?? feed.items.length;
          feed.error = null;
        } else {
          feed.error = action.payload.message;
        }
      })
      .addCase(fetchListings.rejected, (state, action) => {
        const feed = state[action.meta.arg.kind];
        if (feed && feed.requestId === action.meta.requestId) {
          feed.loading = false;
          feed.loaded = true;
          feed.error = action.error?.message || "Failed to load listings";
        }
      });
  },
});

export default listingSlice.reducer;
