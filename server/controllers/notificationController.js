import Notification from "../models/Notification.js";

export const listNotifications = async (req, res) => {
  try {
    const { unread } = req.query;
    const filter = { userId: req.user._id };
    if (unread === "true") filter.isRead = false;
    const notifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ success: true, notifications });
  } catch (error) {
    console.error("listNotifications error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch notifications" });
  }
};

export const getUnreadCount = async (req, res) => {
  try {
    const count = await Notification.countDocuments({
      userId: req.user._id,
      isRead: false,
    });
    res.json({ success: true, count });
  } catch (error) {
    console.error("getUnreadCount error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch unread count" });
  }
};

export const markRead = async (req, res) => {
  try {
    const notif = await Notification.findOne({
      _id: req.params.id,
      userId: req.user._id,
    });
    if (!notif) {
      return res.status(404).json({ success: false, message: "Notification not found" });
    }
    notif.isRead = true;
    await notif.save();
    res.json({ success: true, notification: notif });
  } catch (error) {
    console.error("markRead error:", error);
    res.status(500).json({ success: false, message: "Failed to mark as read" });
  }
};

export const markAllRead = async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user._id, isRead: false },
      { $set: { isRead: true } }
    );
    res.json({ success: true });
  } catch (error) {
    console.error("markAllRead error:", error);
    res.status(500).json({ success: false, message: "Failed to mark all as read" });
  }
};
