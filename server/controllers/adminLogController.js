import AuditLog from "../models/AuditLog.js";
import LoginEvent from "../models/LoginEvent.js";
import Chat from "../models/Chat.js";
import mongoose from "mongoose";
import User from "../models/User.js";
import { escapeRegex } from "../utils/regex.js";

// Ignore unparseable dates instead of letting `Invalid Date` reach Mongo (500).
const applyDateRange = (filter, dateFrom, dateTo) => {
  const from = dateFrom ? new Date(dateFrom) : null;
  const to = dateTo ? new Date(dateTo) : null;
  const range = {};
  if (from && !isNaN(from)) range.$gte = from;
  if (to && !isNaN(to)) range.$lte = to;
  if (Object.keys(range).length) filter.createdAt = range;
};

const parsePaging = (req) => ({
  limit: Math.min(parseInt(req.query.limit) || 50, 200),
  offset: Math.max(parseInt(req.query.offset) || 0, 0),
});

export const listAuditLogs = async (req, res) => {
  try {
    const { limit, offset } = parsePaging(req);
    const { actor, action, dateFrom, dateTo } = req.query;
    const filter = {};
    if (actor && mongoose.isValidObjectId(actor)) filter.actor = actor;
    if (action) filter.action = { $regex: escapeRegex(action), $options: "i" };
    applyDateRange(filter, dateFrom, dateTo);
    const [items, total] = await Promise.all([
      AuditLog.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit),
      AuditLog.countDocuments(filter),
    ]);
    res.json({ success: true, items, total });
  } catch (error) {
    console.error("listAuditLogs error:", error);
    res.status(500).json({ success: false, message: "Failed to load audit logs" });
  }
};

export const listLoginEvents = async (req, res) => {
  try {
    const { limit, offset } = parsePaging(req);
    const { email, success, dateFrom, dateTo } = req.query;
    const filter = {};
    if (email) filter.email = { $regex: escapeRegex(email), $options: "i" };
    if (success !== undefined && success !== "") filter.success = success === "true";
    applyDateRange(filter, dateFrom, dateTo);
    const [items, total] = await Promise.all([
      LoginEvent.find(filter).sort({ createdAt: -1 }).skip(offset).limit(limit),
      LoginEvent.countDocuments(filter),
    ]);
    res.json({ success: true, items, total });
  } catch (error) {
    console.error("listLoginEvents error:", error);
    res.status(500).json({ success: false, message: "Failed to load login events" });
  }
};

export const listChatLogs = async (req, res) => {
  try {
    const { limit, offset } = parsePaging(req);
    const { studentId, flaggedOnly, search } = req.query;
    // With no user filter, list every chat. With a filter, list only the
    // matching users' chats — and nothing when no user matches (previously an
    // empty match silently fell back to "all chats").
    let filter = {};
    if (studentId || flaggedOnly === "true" || search) {
      let userFilter = {};
      if (studentId) {
        if (!mongoose.isValidObjectId(studentId)) return res.json({ success: true, items: [], total: 0 });
        userFilter = { _id: studentId };
      } else {
        if (flaggedOnly === "true") userFilter["flags.0"] = { $exists: true };
        if (search) {
          const pattern = escapeRegex(search);
          userFilter.$or = [
            { name: { $regex: pattern, $options: "i" } },
            { email: { $regex: pattern, $options: "i" } },
          ];
        }
      }
      const userIds = await User.find(userFilter).distinct("_id");
      if (!userIds.length) return res.json({ success: true, items: [], total: 0 });
      filter = { userId: { $in: userIds } };
    }
    const [chats, total] = await Promise.all([
      Chat.find(filter)
        .sort({ updatedAt: -1 })
        .skip(offset)
        .limit(limit)
        .select("userId userName name messages updatedAt createdAt"),
      Chat.countDocuments(filter),
    ]);

    const items = chats.map((c) => ({
      _id: c._id,
      userId: c.userId,
      userName: c.userName,
      name: c.name,
      messageCount: c.messages?.length || 0,
      lastMessage: c.messages?.[c.messages.length - 1]?.content?.slice(0, 200) || "",
      updatedAt: c.updatedAt,
      createdAt: c.createdAt,
    }));

    res.json({ success: true, items, total });
  } catch (error) {
    console.error("listChatLogs error:", error);
    res.status(500).json({ success: false, message: "Failed to load chats" });
  }
};

export const getChatLog = async (req, res) => {
  try {
    const chat = mongoose.isValidObjectId(req.params.id) && await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ success: false, message: "Chat not found" });
    const user = await User.findById(chat.userId).select("name email flags");
    res.json({ success: true, chat, user });
  } catch (error) {
    console.error("getChatLog error:", error);
    res.status(500).json({ success: false, message: "Failed to load chat" });
  }
};
