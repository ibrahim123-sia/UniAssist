import User from "../models/User.js";
import Notification from "../models/Notification.js";

const requireInternal = (req) => {
  const provided = req.headers["x-internal-secret"];
  if (!process.env.INTERNAL_SECRET) return false;
  return provided && provided === process.env.INTERNAL_SECRET;
};

export const verifyAdmin = async (req, res) => {
  // Header check first — Python supplies it, raw clients won't.
  if (!requireInternal(req)) {
    return res.status(403).json({ success: false, message: "Internal secret missing or invalid" });
  }
  // Auth header carries the JWT, which `protect` already validated upstream
  if (!req.user || req.user.role !== "admin") {
    return res.status(403).json({ success: false, message: "Not an admin" });
  }
  res.json({
    success: true,
    user: { id: req.user._id, email: req.user.email, role: req.user.role },
  });
};

export const flagUser = async (req, res) => {
  if (!requireInternal(req)) {
    return res.status(403).json({ success: false, message: "Internal secret missing or invalid" });
  }
  const { userId, message, matches, chatId } = req.body || {};
  if (!userId || !message) {
    return res.status(400).json({ success: false, message: "userId and message are required" });
  }
  try {
    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    user.flags = user.flags || [];
    user.flags.push({
      type: "inappropriate_language",
      message: String(message).slice(0, 500),
      matches: Array.isArray(matches) ? matches.slice(0, 20) : [],
      chatId: chatId || null,
      timestamp: new Date(),
    });
    await user.save();

    // Notify all admins
    const admins = await User.find({ role: "admin" }).select("_id email");
    if (admins.length) {
      const docs = admins.map((a) => ({
        userId: a._id,
        type: "user_flagged",
        message: `${user.name} flagged for inappropriate language`,
        link: `/admin/users`,
        issueId: null,
      }));
      await Notification.insertMany(docs);
    }

    res.json({ success: true, flagCount: user.flags.length });
  } catch (error) {
    console.error("flagUser error:", error);
    res.status(500).json({ success: false, message: "Failed to flag user" });
  }
};
