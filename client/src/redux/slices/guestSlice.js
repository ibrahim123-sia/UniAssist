import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../utils/axios";

export const sendGuestMessage = createAsyncThunk(
  "guest/sendMessage",
  async ({ message }, { getState }) => {
    try {
      if (!message || message.trim().length === 0) {
        return { success: false, message: "Message cannot be empty" };
      }

      const sessionId = getState().guest.guestSessionId;

      const { data } = await axios.post("/api/guest/chat", {
        message: message.trim(),
        sessionId,
      });

      if (data.success) {
        return {
          success: true,
          reply: data.reply,
          sessionId: data.sessionId,
          messagesRemaining: data.messagesRemaining,
          note: data.note,
          userMessage: message.trim(),
        };
      }
      return { success: false, message: data.message };
    } catch (error) {
      let message = "Failed to send message";
      if (error.response?.status === 429) message = "Too many messages";
      else if (error.code === "ERR_NETWORK") message = "Network error";
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
        `/api/guest/history?sessionId=${sessionId}`
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

const initialState = {
  guestSessionId: localStorage.getItem("guestSessionId") || null,
  guestMessages: [],
};

const guestSlice = createSlice({
  name: "guest",
  initialState,
  reducers: {
    setGuestMessages(state, action) {
      state.guestMessages = action.payload;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(sendGuestMessage.fulfilled, (state, action) => {
        if (!action.payload.success) return;
        if (!state.guestSessionId && action.payload.sessionId) {
          localStorage.setItem("guestSessionId", action.payload.sessionId);
          state.guestSessionId = action.payload.sessionId;
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

export const { setGuestMessages } = guestSlice.actions;
export default guestSlice.reducer;
