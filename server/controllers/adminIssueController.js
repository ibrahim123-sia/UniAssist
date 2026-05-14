import mongoose from "mongoose";
import Issue from "../models/Issue.js";

export const listAllIssues = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 25, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const { departmentId, status, category, search, dateFrom, dateTo } = req.query;
    const filter = {};
    if (departmentId) filter.department = departmentId;
    if (status) filter.status = status;
    if (category) filter.category = category;
    if (dateFrom || dateTo) {
      filter.createdAt = {};
      if (dateFrom) filter.createdAt.$gte = new Date(dateFrom);
      if (dateTo) filter.createdAt.$lte = new Date(dateTo);
    }
    if (search) {
      filter.$or = [
        { title: { $regex: search, $options: "i" } },
        { description: { $regex: search, $options: "i" } },
        { studentName: { $regex: search, $options: "i" } },
        { studentEmail: { $regex: search, $options: "i" } },
      ];
    }

    const [issues, total] = await Promise.all([
      Issue.find(filter)
        .populate("department", "code name")
        .populate("assignedTo", "name email staffTitle")
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit),
      Issue.countDocuments(filter),
    ]);

    res.json({ success: true, issues, total });
  } catch (error) {
    console.error("listAllIssues error:", error);
    res.status(500).json({ success: false, message: "Failed to load issues" });
  }
};

export const getIssueAnalytics = async (req, res) => {
  try {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    thirtyDaysAgo.setHours(0, 0, 0, 0);

    const [byCategory, byDepartment, byStatus, resolved, volume30d] = await Promise.all([
      Issue.aggregate([
        { $group: { _id: "$category", count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 10 },
      ]),
      Issue.aggregate([
        { $group: { _id: "$department", count: { $sum: 1 } } },
        { $lookup: { from: "departments", localField: "_id", foreignField: "_id", as: "dept" } },
        { $unwind: "$dept" },
        { $project: { _id: 0, code: "$dept.code", name: "$dept.name", count: 1 } },
        { $sort: { count: -1 } },
      ]),
      Issue.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      Issue.aggregate([
        { $match: { status: { $in: ["Resolved", "Closed"] } } },
        {
          $project: {
            durationMs: { $subtract: ["$updatedAt", "$createdAt"] },
          },
        },
        { $group: { _id: null, avgMs: { $avg: "$durationMs" }, count: { $sum: 1 } } },
      ]),
      Issue.aggregate([
        { $match: { createdAt: { $gte: thirtyDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
    ]);

    const series = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const found = volume30d.find((x) => x._id === key);
      series.push({ date: key, count: found ? found.count : 0 });
    }

    res.json({
      success: true,
      analytics: {
        byCategory: byCategory.map((c) => ({ category: c._id || "other", count: c.count })),
        byDepartment,
        byStatus: byStatus.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {}),
        avgResolutionHours: resolved[0]?.avgMs ? +(resolved[0].avgMs / 3600000).toFixed(1) : null,
        resolvedCount: resolved[0]?.count || 0,
        volume30d: series,
      },
    });
  } catch (error) {
    console.error("getIssueAnalytics error:", error);
    res.status(500).json({ success: false, message: "Failed to load analytics" });
  }
};

export const getAdminIssue = async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ success: false, message: "Invalid id" });
    }
    const issue = await Issue.findById(req.params.id)
      .populate("department", "code name")
      .populate("assignedTo", "name email staffTitle");
    if (!issue) return res.status(404).json({ success: false, message: "Issue not found" });
    res.json({ success: true, issue });
  } catch (error) {
    console.error("getAdminIssue error:", error);
    res.status(500).json({ success: false, message: "Failed to load issue" });
  }
};
