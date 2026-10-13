import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../utils/axios";

export const MAX_GUEST_MESSAGE_CHARS = 2000;

export const sendGuestMessage = createAsyncThunk(
  "guest/sendMessage",
  async ({ message }, { getState }) => {
    try {
      if (!message || message.trim().length === 0) {
        return { success: false, message: "Message cannot be empty" };
      }

      if (message.length > MAX_GUEST_MESSAGE_CHARS) {
        return {
          success: false,
          message: `Message is too long (max ${MAX_GUEST_MESSAGE_CHARS} characters).`,
        };
      }

      // The server owns the session id: omit it when we have none rather
      // than sending null, and adopt whatever id comes back.
      const sessionId = getState().guest.guestSessionId;
      const body = { message: message.trim() };
      if (sessionId) body.sessionId = sessionId;

      const { data } = await axios.post("/api/guest/chat", body);

      if (data.success) {
        return {
          success: true,
          reply: data.reply,
          sessionId: data.sessionId,
          messagesRemaining: data.messagesRemaining,
          note: data.note,
          answered: data.answered ?? data.reply?.answered,
          userMessage: message.trim(),
        };
      }
      return { success: false, message: data.message };
    } catch (error) {
      let message = error.response?.data?.message || "Failed to send message";
      if (error.response?.status === 429 && !error.response?.data?.message) {
        message = "Too many messages. Please wait a moment.";
      } else if (error.code === "ERR_NETWORK") message = "Network error";
      return { success: false, message };
    }
  }
);

export const fetchGuestChatHistory = createAsyncThunk(
  "guest/fetchHistory",
  async (sessionIdArg, { getState, dispatch }) => {
    try {
      const sessionId = sessionIdArg || getState().guest.guestSessionId;
      if (!sessionId) return { success: false, message: "No session ID" };

      const { data } = await axios.get(
        `/api/guest/history?sessionId=${encodeURIComponent(sessionId)}`
      );

      if (data.success) {
        return {
          success: true,
          messages: data.messages || [],
          sessionId: data.sessionId,
          messageCount: data.messageCount,
        };
      }
      const expired =
        data.message?.includes("expired") || data.message?.includes("not found");
      if (expired) dispatch(clearGuestSession());
      return { success: false, message: data.message };
    } catch (error) {
      dispatch(clearGuestSession());
      return { success: false, message: error.message };
    }
  }
);

export const clearGuestSession = createAsyncThunk(
  "guest/clearSession",
  async (_, { getState }) => {
    const sessionId = getState().guest.guestSessionId;
    if (sessionId) {
      try {
        await axios.post("/api/guest/clear", { sessionId });
      } catch (clearError) {
        console.log("Server session clear failed:", clearError.message);
      }
    }
    localStorage.removeItem("guestSessionId");
    return true;
  }
);

// Lazy so a logout reset (see store.js) re-reads storage.
const initialState = () => ({
  guestSessionId: localStorage.getItem("guestSessionId") || null,
  guestMessages: [],
});

const guestSlice = createSlice({
  name: "guest",
  initialState,
  reducers: {},
  extraReducers: (builder) => {
    builder
      .addCase(sendGuestMessage.fulfilled, (state, action) => {
        if (!action.payload.success) return;
        // Always adopt the server's id: if ours had expired, the server
        // started a fresh session and returned a different one.
        const { sessionId } = action.payload;
        if (sessionId && sessionId !== state.guestSessionId) {
          localStorage.setItem("guestSessionId", sessionId);
          state.guestSessionId = sessionId;
        }
        state.guestMessages = [
          ...state.guestMessages,
          {
            role: "user",
            content: action.payload.userMessage,
            timestamp: Date.now(),
            type: "text",
          },
          {
            role: "assistant",
            content: action.payload.reply.content,
            timestamp: action.payload.reply.timestamp,
            type: "text",
            // false → the bot had no answer; the UI suggests registering.
            ...(typeof action.payload.answered === "boolean" && {
              answered: action.payload.answered,
            }),
          },
        ];
      })
      .addCase(fetchGuestChatHistory.fulfilled, (state, action) => {
        if (action.payload.success) {
          state.guestMessages = action.payload.messages;
        }
      })
      .addCase(clearGuestSession.fulfilled, (state) => {
        state.guestSessionId = null;
        state.guestMessages = [];
      });
  },
});

export default guestSlice.reducer;
