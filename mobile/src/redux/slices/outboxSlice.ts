import { createSlice, PayloadAction } from "@reduxjs/toolkit";

// Issues submitted while offline (text only — picked attachments live in a
// cache directory the OS may clear). hooks/useConnectivity drains this when
// the network returns. Each item belongs to the student who queued it: it is
// kept if their session ends before it could be sent (and sent after they
// sign in again), but never posted as, or shown to, another account.
export interface OutboxItem {
  id: string;
  kind: "issue";
  userId: string;
  payload: { title: string; description: string; category: string; departmentId: string };
  createdAt: string;
}

const slice = createSlice({
  name: "outbox",
  initialState: { items: [] as OutboxItem[] },
  reducers: {
    enqueue(s, a: PayloadAction<OutboxItem>) { s.items.push(a.payload); },
    remove(s, a: PayloadAction<string>) {
      s.items = s.items.filter((i) => i.id !== a.payload);
    },
  },
});

export const { enqueue, remove } = slice.actions;
export default slice.reducer;
