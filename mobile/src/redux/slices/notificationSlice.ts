import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  apiListNotifications, apiUnreadCount, apiMarkRead, apiMarkAllRead,
} from "../../api/notification";
import { errorMessage } from "../../api/client";

export const fetchNotifications = createAsyncThunk(
  "notif/list",
  async (_, { rejectWithValue }) => {
    try {
      const { data } = await apiListNotifications();
      return (data?.notifications || []) as any[];
    } catch (e) {
      return rejectWithValue(errorMessage(e, "Couldn't load notifications"));
    }
  }
);

// The list endpoint caps at 50 items, so the badge uses the real count.
export const fetchUnreadCount = createAsyncThunk("notif/unread", async () => {
  const { data } = await apiUnreadCount();
  return Number(data?.count) || 0;
});

export const markRead = createAsyncThunk("notif/read", async (id: string) => {
  await apiMarkRead(id);
  return id;
});

export const markAllRead = createAsyncThunk("notif/readAll", async () => {
  await apiMarkAllRead();
  return true;
});

const slice = createSlice({
  name: "notification",
  initialState: {
    items: [] as any[],
    unreadCount: 0,
    loading: false,
    error: null as string | null,
  },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchNotifications.pending, (s) => { s.loading = true; })
     .addCase(fetchNotifications.fulfilled, (s, a) => {
       s.loading = false;
       s.error = null;
       s.items = a.payload;
     })
     .addCase(fetchNotifications.rejected, (s, a) => {
       s.loading = false;
       s.error = (a.payload as string) || "Couldn't load notifications";
     })
     .addCase(fetchUnreadCount.fulfilled, (s, a) => { s.unreadCount = a.payload; })
     .addCase(markRead.fulfilled, (s, a) => {
       const item = s.items.find((n: any) => n._id === a.payload);
       if (item && !item.isRead) {
         item.isRead = true;
         s.unreadCount = Math.max(0, s.unreadCount - 1);
       }
     })
     .addCase(markAllRead.fulfilled, (s) => {
       s.items.forEach((n: any) => { n.isRead = true; });
       s.unreadCount = 0;
     });
  },
});

export default slice.reducer;
