import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import axios from "../../utils/axios";

const authHeader = (getState) => ({
  headers: { Authorization: getState().auth.token },
});

export const createNewChat = createAsyncThunk(
  "chat/createNew",
  async (_, { getState }) => {
    try {
      const { user } = getState().auth;
      if (!user) return { success: false, message: "Please login first" };

      const { data } = await axios.post("/api/chat/create", {}, authHeader(getState));

      if (data.success) return { success: true, chat: data.chat };
      return { success: false, message: data.message };
    } catch (error) {
      let message = "Failed to create chat";
      if (error.response?.status === 401) message = "Session expired";
      else if (error.code === "ERR_NETWORK") message = "Network error";
      return { success: false, message };
    }
  },
  {
    // A double click on "New chat" (or the empty-list auto-create racing a
    // click) must not create two empty chats.
    condition: (_, { getState }) => !getState().chat.creatingChat,
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
          const created = await dispatch(createNewChat()).unwrap();
          return created.success
            ? { success: true, chats: [created.chat] }
            : { success: false, message: created.message };
        }
        return { success: true, chats: data.chats };
      }
      return { success: false, message: data.message };
    } catch (error) {
      const unauthorized = error.response?.status === 401;
      return { success: false, unauthorized };
    }
  },
  {
    // A second concurrent fetch for a brand-new user would also see zero
    // chats and create a duplicate empty one.
    condition: (_, { getState }) => !getState().chat.fetchingChats,
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

// PUT /api/chat/rename { chatId, name } -> { success, chat: { _id, name } }
export const renameChat = createAsyncThunk(
  "chat/rename",
  async ({ chatId, name }, { getState }) => {
    try {
      const { data } = await axios.put(
        "/api/chat/rename",
        { chatId, name },
        authHeader(getState)
      );
      if (data.success) return { success: true, chatId, name: data.chat?.name ?? name };
      return { success: false, message: data.message };
    } catch (error) {
      let message = error.response?.data?.message || "Failed to rename chat";
      if (error.code === "ERR_NETWORK") message = "Network error";
      return { success: false, message };
    }
  }
);

export const MAX_CHAT_NAME = 100;

const initialState = {
  chats: [],
  selectedChat: null,
  fetchingChats: false,
  creatingChat: false,
};

const chatSlice = createSlice({
  name: "chat",
  initialState,
  reducers: {
    setSelectedChat(state, action) {
      state.selectedChat = action.payload;
    },
    resetChat(state) {
      state.chats = [];
      state.selectedChat = null;
    },
    // Persist a completed exchange so it survives switching chats; the
    // server may also have auto-named the chat after its first question.
    appendMessages(state, action) {
      const { chatId, messages, chatName } = action.payload;
      const apply = (chat) => {
        chat.messages = [...(chat.messages || []), ...messages];
        if (chatName) chat.name = chatName;
        chat.updatedAt = new Date().toISOString();
      };
      const listed = state.chats.find((c) => c._id === chatId);
      if (listed) apply(listed);
      if (state.selectedChat?._id === chatId) apply(state.selectedChat);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchUsersChats.pending, (state) => {
        state.fetchingChats = true;
      })
      .addCase(fetchUsersChats.rejected, (state) => {
        state.fetchingChats = false;
      })
      .addCase(fetchUsersChats.fulfilled, (state, action) => {
        state.fetchingChats = false;
        if (action.payload.success && action.payload.chats) {
          state.chats = action.payload.chats;
          const current = state.selectedChat
            && action.payload.chats.find((c) => c._id === state.selectedChat._id);
          state.selectedChat = current || action.payload.chats[0] || null;
        }
      })
      .addCase(createNewChat.pending, (state) => {
        state.creatingChat = true;
      })
      .addCase(createNewChat.rejected, (state) => {
        state.creatingChat = false;
      })
      .addCase(renameChat.fulfilled, (state, action) => {
        const { success, chatId, name } = action.payload;
        if (!success) return;
        const listed = state.chats.find((c) => c._id === chatId);
        if (listed) listed.name = name;
        if (state.selectedChat?._id === chatId) state.selectedChat.name = name;
      })
      .addCase(createNewChat.fulfilled, (state, action) => {
        state.creatingChat = false;
        const { success, chat } = action.payload;
        if (!success || !chat) return;
        state.chats = [chat, ...state.chats.filter((c) => c._id !== chat._id)];
        state.selectedChat = chat;
      });
  },
});

export const { setSelectedChat, resetChat, appendMessages } = chatSlice.actions;
export default chatSlice.reducer;
