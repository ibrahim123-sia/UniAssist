import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import {
  apiListChats, apiCreateChat, apiSendMessage, apiGetChat, apiDeleteChat, apiRenameChat,
  type ChatMode,
} from "../../api/chat";
import { errorMessage } from "../../api/client";

export interface ChatMessage {
  _id?: string;
  role: "user" | "assistant" | string;
  content: string;
  type?: "text" | "email" | "voice";
  timestamp?: number;
  // Client-generated id of a message this device sent. Kept after the server
  // confirms it so the list key stays stable.
  localId?: string;
  // True on the optimistic copy until the server confirms it.
  sending?: boolean;
  // Assistant replies: the bot couldn't answer (answered === false) and the
  // question was forwarded to the admin's Unanswered Questions list
  // (escalated in the send response; questionId is also stored on the chat).
  answered?: boolean;
  escalated?: boolean;
  questionId?: string;
  // Assistant replies: the student's message looked like a personal complaint,
  // so "Register a complaint" is highlighted. Stored on the server's chat too.
  suggestComplaint?: boolean;
}

// Stable list key for a message (also keys per-message UI state).
export const messageKey = (m: ChatMessage, index: number) =>
  m.localId || m._id || (m.timestamp ? `${m.timestamp}-${m.role}` : `i${index}-${m.role}`);

// Same rule as the web client: the "sent to the admin" note shows for an
// unanswered reply that was escalated in this session or carries the
// question it was forwarded to (so it survives reloads).
export const isEscalated = (m: ChatMessage) =>
  m.role !== "user" && m.answered === false && (m.escalated === true || !!m.questionId);

export interface Chat {
  _id: string;
  name: string;
  messages: ChatMessage[];
  createdAt?: string;
  updatedAt?: string;
}

const fail = (fallback: string) => (e: any) => errorMessage(e, fallback);

export const fetchChats = createAsyncThunk("chat/list", async (_, { rejectWithValue }) => {
  try {
    const { data } = await apiListChats();
    return (data?.chats || []) as Chat[];
  } catch (e) {
    return rejectWithValue(fail("Couldn't load chats")(e));
  }
});

export const createChat = createAsyncThunk("chat/create", async (_, { rejectWithValue }) => {
  try {
    const { data } = await apiCreateChat();
    if (!data?.success || !data.chat) return rejectWithValue("Couldn't start a new chat");
    return data.chat as Chat;
  } catch (e) {
    return rejectWithValue(fail("Couldn't start a new chat")(e));
  }
});

export const loadChat = createAsyncThunk("chat/load", async (id: string, { rejectWithValue }) => {
  try {
    const { data } = await apiGetChat(id);
    return data.chat as Chat;
  } catch (e) {
    return rejectWithValue(fail("Couldn't load this chat")(e));
  }
});

export const deleteChat = createAsyncThunk("chat/delete", async (id: string, { rejectWithValue }) => {
  try {
    await apiDeleteChat(id);
    return id;
  } catch (e) {
    return rejectWithValue(fail("Couldn't delete the chat")(e));
  }
});

export const renameChat = createAsyncThunk(
  "chat/rename",
  async ({ id, name }: { id: string; name: string }, { rejectWithValue }) => {
    try {
      const { data } = await apiRenameChat(id, name);
      return { id, name: (data?.chat?.name as string) || name };
    } catch (e) {
      return rejectWithValue(fail("Couldn't rename the chat")(e));
    }
  }
);

export const sendMessage = createAsyncThunk(
  "chat/send",
  async (
    { chatId, prompt, mode }: { chatId: string; prompt: string; mode: ChatMode; localId: string },
    { rejectWithValue }
  ) => {
    try {
      const { data } = await apiSendMessage(chatId, prompt, mode);
      if (!data?.success) return rejectWithValue(data?.message || "Failed to send message");
      return data as {
        reply: ChatMessage;
        userMessage: ChatMessage;
        chatName?: string;
        answered?: boolean;
        escalated?: boolean;
        suggestComplaint?: boolean;
        questionId?: string | null;
      };
    } catch (e: any) {
      if (e?.response?.status === 429) {
        return rejectWithValue("You're sending messages too fast. Please wait a moment.");
      }
      return rejectWithValue(fail("Failed to send message")(e));
    }
  }
);

const upsert = (chats: Chat[], chat: Chat) => {
  const i = chats.findIndex((c) => c._id === chat._id);
  if (i >= 0) chats[i] = { ...chats[i], ...chat };
  else chats.unshift(chat);
};

const slice = createSlice({
  name: "chat",
  initialState: {
    chats: [] as Chat[],
    loading: false,
    error: null as string | null,
    // chatId -> when its reply wait started (ms). Several chats can wait at
    // once; each chat sends one message at a time.
    pending: {} as Record<string, number>,
  },
  reducers: {},
  extraReducers: (b) => {
    b.addCase(fetchChats.pending, (s) => { s.loading = true; })
     .addCase(fetchChats.fulfilled, (s, a) => {
       s.loading = false;
       s.error = null;
       s.chats = a.payload;
     })
     .addCase(fetchChats.rejected, (s, a) => {
       s.loading = false;
       s.error = (a.payload as string) || "Couldn't load chats";
     })
     .addCase(createChat.fulfilled, (s, a) => { upsert(s.chats, a.payload); })
     .addCase(loadChat.fulfilled, (s, a) => {
       // A load that started before a send would drop the optimistic message.
       if (a.payload && !s.pending[a.payload._id]) upsert(s.chats, a.payload);
     })
     .addCase(deleteChat.fulfilled, (s, a) => {
       s.chats = s.chats.filter((c) => c._id !== a.payload);
     })
     .addCase(renameChat.fulfilled, (s, a) => {
       const c = s.chats.find((x) => x._id === a.payload.id);
       if (c) c.name = a.payload.name;
     })
     .addCase(sendMessage.pending, (s, a) => {
       const { chatId, prompt, mode, localId } = a.meta.arg;
       s.pending[chatId] = Date.now();
       const c = s.chats.find((x) => x._id === chatId);
       c?.messages.push({ role: "user", content: prompt, type: mode, timestamp: Date.now(), localId, sending: true });
     })
     .addCase(sendMessage.fulfilled, (s, a) => {
       const { chatId, localId, prompt, mode } = a.meta.arg;
       delete s.pending[chatId];
       const i = s.chats.findIndex((x) => x._id === chatId);
       if (i < 0) return;
       const c = s.chats[i];
       const confirmed: ChatMessage = {
         ...(a.payload.userMessage || { role: "user", content: prompt, type: mode, timestamp: Date.now() }),
         localId,
         sending: false,
       };
       const mi = c.messages.findIndex((m) => m.localId === localId);
       if (mi >= 0) {
         c.messages[mi] = confirmed;
       } else {
         // A chat-list refresh replaced the chat (dropping the optimistic copy)
         // while the reply was pending. Re-add the question unless that
         // refresh already brought the server's copy.
         const u = a.payload.userMessage;
         const already = !!u && c.messages.some((m) =>
           m.role === "user" && m.content === u.content && m.timestamp === u.timestamp);
         if (!already) c.messages.push(confirmed);
       }
       if (a.payload.reply) {
         const { answered, escalated, suggestComplaint, questionId } = a.payload;
         c.messages.push({
           ...a.payload.reply,
           timestamp: a.payload.reply.timestamp || Date.now(),
           ...(typeof answered === "boolean" ? { answered } : {}),
           ...(typeof escalated === "boolean" ? { escalated } : {}),
           ...(typeof suggestComplaint === "boolean" ? { suggestComplaint } : {}),
           ...(questionId ? { questionId: String(questionId) } : {}),
         });
       }
       if (a.payload.chatName) c.name = a.payload.chatName;
       c.updatedAt = new Date().toISOString();
       // Most recently used chat first, like the server's ordering.
       s.chats.splice(i, 1);
       s.chats.unshift(c);
     })
     .addCase(sendMessage.rejected, (s, a) => {
       const { chatId, localId } = a.meta.arg;
       delete s.pending[chatId];
       const c = s.chats.find((x) => x._id === chatId);
       if (c) c.messages = c.messages.filter((m) => m.localId !== localId);
     });
  },
});

export default slice.reducer;
