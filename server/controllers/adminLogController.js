import AuditLog from "../models/AuditLog.js";
import LoginEvent from "../models/LoginEvent.js";
import Chat from "../models/Chat.js";
import User from "../models/User.js";

const parsePaging = (req) => ({
  limit: Math.min(parseInt(req.query.limit) || 50, 200),
  offset: Math.max(parseInt(req.query.offset) || 0, 0),
});

export const listAuditLogs = async (req, res) => {
  try {
    const { limit, offset } = parsePaging(req);
    const { actor, action, dateFrom, dateTo } = req.query;
    const filter = {};
    if (actor) filter.actor = actor;
    if (action) filter.action = { $regex: action, $options: "i" };
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }
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
    if (email) filter.email = { $regex: email, $options: "i" };
    if (success !== undefined && success !== "") filter.success = success === "true";
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }
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
    const matchUser = {};
    if (flaggedOnly === "true") matchUser["flags.0"] = { $exists: true };
    if (search) {
      matchUser.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }

    let userFilter = matchUser;
    if (studentId) userFilter = { _id: studentId };

    const matchingUsers = await User.find(userFilter).select("_id").limit(500);
    const userIds = matchingUsers.map((u) => u._id);

    const filter = userIds.length ? { userId: { $in: userIds } } : {};
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
    const chat = await Chat.findById(req.params.id);
    if (!chat) return res.status(404).json({ success: false, message: "Chat not found" });
    const user = await User.findById(chat.userId).select("name email flags");
    res.json({ success: true, chat, user });
  } catch (error) {
    console.error("getChatLog error:", error);
    res.status(500).json({ success: false, message: "Failed to load chat" });
  }
};
