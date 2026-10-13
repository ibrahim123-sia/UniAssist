import mongoose from "mongoose";
import Chat from "../models/Chat.js";

const MAX_CHAT_NAME = 100;
const MAX_CHATS_LISTED = 200; // sidebar: newest 200 chats

const notFound = (res) => res.status(404).json({ success: false, message: "Chat not found" });

// Malformed ids would otherwise surface as a CastError (500).
const validId = (id) => mongoose.isValidObjectId(id);

const serverError = (res, label, error) => {
  console.error(`${label} error:`, error);
  return res.status(500).json({ success: false, message: "Something went wrong. Please try again." });
};

// Create a new chat
export const createChat = async (req, res) => {
  try {
    const rawName = typeof req.body?.name === "string" ? req.body.name.trim() : "";

    const chat = await Chat.create({
      userId: req.user._id,
      messages: [],
      name: rawName.slice(0, MAX_CHAT_NAME) || "New Chat",
      userName: req.user.name,
    });

    res.json({
      success: true,
      message: "Chat Created",
      chat: {
        _id: chat._id,
        name: chat.name,
        messages: chat.messages,
        createdAt: chat.createdAt,
        updatedAt: chat.updatedAt
      }
    });
  } catch (error) {
    serverError(res, "createChat", error);
  }
};

// Get all chats for user
export const getChats = async (req, res) => {
  try {
    const chats = await Chat.find({ userId: req.user._id })
      .sort({ updatedAt: -1 })
      .limit(MAX_CHATS_LISTED)
      .select('_id name messages createdAt updatedAt');

    res.json({ success: true, chats });
  } catch (error) {
    serverError(res, "getChats", error);
  }
};

// Get single chat by ID
export const getChatById = async (req, res) => {
  try {
    const { chatId } = req.params;
    if (!validId(chatId)) return notFound(res);

    const chat = await Chat.findOne({ _id: chatId, userId: req.user._id });
    if (!chat) return notFound(res);

    res.json({ success: true, chat });
  } catch (error) {
    serverError(res, "getChatById", error);
  }
};

// Delete chat
export const deleteChat = async (req, res) => {
  try {
    const { chatId } = req.body ?? {};
    if (!validId(chatId)) return notFound(res);

    const result = await Chat.deleteOne({ _id: chatId, userId: req.user._id });
    if (result.deletedCount === 0) return notFound(res);

    res.json({ success: true, message: "Chat deleted" });
  } catch (error) {
    serverError(res, "deleteChat", error);
  }
};

// Update chat name
export const updateChatName = async (req, res) => {
  try {
    const { chatId, name } = req.body ?? {};

    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ success: false, message: "Chat name is required" });
    }
    if (!validId(chatId)) return notFound(res);

    const chat = await Chat.findOneAndUpdate(
      { _id: chatId, userId: req.user._id },
      { name: name.trim().slice(0, MAX_CHAT_NAME) },
      { returnDocument: "after", runValidators: true }
    );
    if (!chat) return notFound(res);

    res.json({
      success: true,
      message: "Chat name updated",
      chat: { _id: chat._id, name: chat.name }
    });
  } catch (error) {
    serverError(res, "updateChatName", error);
  }
};

// Clear all messages in a chat (keep chat record)
export const clearChatMessages = async (req, res) => {
  try {
    const { chatId } = req.body ?? {};
    if (!validId(chatId)) return notFound(res);

    const chat = await Chat.findOneAndUpdate(
      { _id: chatId, userId: req.user._id },
      { messages: [] },
      { returnDocument: "after" }
    );
    if (!chat) return notFound(res);

    res.json({ success: true, message: "Chat messages cleared", chat });
  } catch (error) {
    serverError(res, "clearChatMessages", error);
  }
};

// Get chat statistics (voice count, email count, etc.)
export const getChatStats = async (req, res) => {
  try {
    const { chatId } = req.params;
    if (!validId(chatId)) return notFound(res);

    const chat = await Chat.findOne({ _id: chatId, userId: req.user._id });
    if (!chat) return notFound(res);

    const stats = chat.messages.reduce((acc, message) => {
      acc.totalMessages++;
      if (message.type === 'voice') acc.voiceMessages++;
      if (message.type === 'email') acc.emailMessages++;
      if (message.type === 'text') acc.textMessages++;
      if (message.role === 'user') acc.userMessages++;
      if (message.role === 'assistant') acc.aiMessages++;
      return acc;
    }, {
      totalMessages: 0,
      voiceMessages: 0,
      emailMessages: 0,
      textMessages: 0,
      userMessages: 0,
      aiMessages: 0
    });

    res.json({ success: true, stats });
  } catch (error) {
    serverError(res, "getChatStats", error);
  }
};
