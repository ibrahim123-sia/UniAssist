import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../utils/axios";
import { validateMajuEmail } from "../../utils/validation";

const authHeader = (getState) => ({
  headers: { Authorization: getState().auth.token },
});

export const createNewChat = createAsyncThunk(
  "chat/createNew",
  async (_, { getState, dispatch }) => {
    try {
      const { user } = getState().auth;
      if (!user) return { success: false, message: "Please login first" };

      const { data } = await axios.post("/api/chat/create", {}, authHeader(getState));

      if (data.success) {
        await dispatch(fetchUsersChats());
        return { success: true, chatId: data.chatId };
      }
      return { success: false, message: data.message };
    } catch (error) {
      let message = "Failed to create chat";
      if (error.response?.status === 401) message = "Session expired";
      else if (error.code === "ERR_NETWORK") message = "Network error";
      return { success: false, message };
    }
  }
);

export const fetchUsersChats = createAsyncThunk(
  "chat/fetchAll",
  async (_, { getState, dispatch }) => {
    try {
      const { token, user } = getState().auth;
      if (!token || !user) return { success: false };

      const { data } = await axios.get("/api/chat/all", authHeader(getState));

      if (data.success) {
        if (data.chats.length === 0) {
          await dispatch(createNewChat());
          return { success: true, refetch: true };
        }
        return { success: true, chats: data.chats };
      }
      return { success: false, message: data.message };
    } catch (error) {
      const unauthorized = error.response?.status === 401;
      return { success: false, unauthorized };
    }
  }
);

export const deleteChat = createAsyncThunk(
  "chat/delete",
  async ({ chatId }, { getState, dispatch }) => {
    try {
      const { data } = await axios.delete("/api/chat/delete", {
        headers: { Authorization: getState().auth.token },
        data: { chatId },
      });

      if (data.success) {
        await dispatch(fetchUsersChats());
        return { success: true };
      }
      return { success: false, message: data.message };
    } catch (error) {
      let message = "Failed to delete chat";
      if (error.response?.status === 401) message = "Session expired";
      else if (error.code === "ERR_NETWORK") message = "Network error";
      return { success: false, message };
    }
  }
);

export const sendTextMessage = createAsyncThunk(
  "chat/sendText",
  async ({ chatId, prompt }, { getState }) => {
    try {
      const { user } = getState().auth;
      if (!user) return { success: false, message: "Please login to continue" };
      if (!prompt || prompt.trim().length === 0) {
        return { success: false, message: "Message cannot be empty" };
      }

      const { data } = await axios.post(
        "/api/message/text",
        { chatId, prompt },
        authHeader(getState)
      );
      return data;
    } catch (error) {
      let message = "Failed to send message";
      if (error.response?.status === 401) message = "Session expired";
      else if (error.response?.status === 429) message = "Too many requests";
      else if (error.code === "ERR_NETWORK") message = "Network error";
      return { success: false, message };
    }
  }
);

export const sendEmailMessage = createAsyncThunk(
  "chat/sendEmail",
  async ({ chatId, prompt, recipient, subject }, { getState }) => {
    try {
      const { user } = getState().auth;
      if (!user) return { success: false, message: "Please login to continue" };

      const emailValidation = validateMajuEmail(recipient);
      if (!emailValidation.isValid) {
        return { success: false, message: "Invalid recipient email" };
      }
      if (!prompt || prompt.trim().length === 0) {
        return { success: false, message: "Email content cannot be empty" };
      }
      if (!subject || subject.trim().length === 0) {
        return { success: false, message: "Email subject cannot be empty" };
      }

      const { data } = await axios.post(
        "/api/message/email",
        { chatId, prompt, recipient: emailValidation.email, subject },
        authHeader(getState)
      );
      return data;
    } catch (error) {
      let message = "Failed to send email";
      if (error.response?.status === 401) message = "Session expired";
      else if (error.response?.status === 400) message = "Invalid email data";
      else if (error.code === "ERR_NETWORK") message = "Network error";
      return { success: false, message };
    }
  }
);

export const sendVoiceMessage = createAsyncThunk(
  "chat/sendVoice",
  async ({ chatId, audioUrl, duration, fileSize }, { getState }) => {
    try {
      const { user } = getState().auth;
      if (!user) return { success: false, message: "Please login to continue" };
      if (!audioUrl || audioUrl.length === 0) {
        return { success: false, message: "Audio file is required" };
      }
      if (fileSize > 10 * 1024 * 1024) {
        return { success: false, message: "Audio file too large (max 10MB)" };
      }

      const { data } = await axios.post(
        "/api/message/voice",
        { chatId, audioUrl, duration, fileSize },
        {
          headers: {
            Authorization: getState().auth.token,
            "Content-Type": "application/json",
          },
        }
      );
      return data;
    } catch (error) {
      let message = "Failed to send voice message";
      if (error.response?.status === 413) message = "Audio file too large";
      else if (error.response?.status === 400) message = "Invalid audio format";
      else if (error.response?.status === 401) message = "Session expired";
      else if (error.code === "ERR_NETWORK") message = "Network error";
      return { success: false, message };
    }
  }
);

const initialState = {
  chats: [],
  selectedChat: null,
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setSelectedChat(state, action) {
      state.selectedChat = action.payload;
    },
    setChats(state, action) {
      state.chats = action.payload;
    },
    resetChat(state) {
      state.chats = [];
      state.selectedChat = null;
    },
  },
  extraReducers: (builder) => {
    builder.addCase(fetchUsersChats.fulfilled, (state, action) => {
      if (action.payload.success && action.payload.chats) {
        state.chats = action.payload.chats;
        if (!state.selectedChat) {
          state.selectedChat = action.payload.chats[0];
        }
      }
    });
  },
});

export const { setSelectedChat, setChats, resetChat } = chatSlice.actions;
export default chatSlice.reducer;
