import mongoose from "mongoose";
import Issue from "../models/Issue.js";
import User from "../models/User.js";
import { escapeRegex } from "../utils/regex.js";

export const listAllIssues = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 25, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const { departmentId, status, category, search, dateFrom, dateTo, escalated } = req.query;
    const filter = {};
    if (departmentId) {
      if (!mongoose.isValidObjectId(departmentId)) return res.json({ success: true, issues: [], total: 0 });
      filter.department = departmentId;
    }
    if (status) filter.status = String(status);
    if (category) filter.category = String(category);
    // Escalated by the SLA scheduler (services/scheduler.js).
    if (escalated === "true") filter.escalated = true;
    else if (escalated === "false") filter.escalated = { $ne: true };
    const from = dateFrom ? new Date(dateFrom) : null;
    const to = dateTo ? new Date(dateTo) : null;
    if ((from && !isNaN(from)) || (to && !isNaN(to))) {
      filter.createdAt = {};
      if (from && !isNaN(from)) filter.createdAt.$gte = from;
      if (to && !isNaN(to)) filter.createdAt.$lte = to;
    }
    if (search) {
      const pattern = escapeRegex(search);
      filter.$or = [
        { title: { $regex: pattern, $options: "i" } },
        { description: { $regex: pattern, $options: "i" } },
        { studentName: { $regex: pattern, $options: "i" } },
        { studentEmail: { $regex: pattern, $options: "i" } },
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
        {
          $group: {
            _id: "$department",
            count: { $sum: 1 },
            // Student feedback (1-5) on resolved/closed issues.
            avgRating: { $avg: "$feedback.rating" },
            ratingsCount: { $sum: { $cond: [{ $isNumber: "$feedback.rating" }, 1, 0] } },
          },
        },
        { $lookup: { from: "departments", localField: "_id", foreignField: "_id", as: "dept" } },
        { $unwind: "$dept" },
        {
          $project: {
            _id: 0,
            code: "$dept.code",
            name: "$dept.name",
            count: 1,
            avgRating: { $round: ["$avgRating", 2] },
            ratingsCount: 1,
          },
        },
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

// ---------------------------------------------------------------------------
// GET /api/admin/staff/performance
//   Per staff member: assigned / resolved / open counts, mean time to first
//   response (on issues they responded to first) and mean student rating (on
//   issues assigned to them, else first responded to by them). Three
//   aggregations, merged in memory — no per-staff queries.
// ---------------------------------------------------------------------------

const round = (n, digits) => (typeof n === "number" ? +n.toFixed(digits) : null);

export const getStaffPerformance = async (req, res) => {
  try {
    const [staff, workload, responses, ratings] = await Promise.all([
      User.find({ role: "staff" })
        .select("name email department isBlocked")
        .populate("department", "code name")
        .sort({ name: 1 })
        .lean(),
      Issue.aggregate([
        { $match: { assignedTo: { $ne: null } } },
        {
          $group: {
            _id: "$assignedTo",
            assigned: { $sum: 1 },
            resolved: { $sum: { $cond: [{ $in: ["$status", ["Resolved", "Closed"]] }, 1, 0] } },
            open: { $sum: { $cond: [{ $in: ["$status", ["Pending", "In Progress"]] }, 1, 0] } },
          },
        },
      ]),
      Issue.aggregate([
        { $match: { firstResponderId: { $ne: null }, firstStaffResponseAt: { $ne: null } } },
        {
          $group: {
            _id: "$firstResponderId",
            avgMs: { $avg: { $subtract: ["$firstStaffResponseAt", "$createdAt"] } },
          },
        },
      ]),
      Issue.aggregate([
        { $match: { "feedback.rating": { $gte: 1 } } },
        { $project: { rating: "$feedback.rating", staffId: { $ifNull: ["$assignedTo", "$firstResponderId"] } } },
        { $match: { staffId: { $ne: null } } },
        { $group: { _id: "$staffId", avgRating: { $avg: "$rating" }, ratingsCount: { $sum: 1 } } },
      ]),
    ]);

    const byId = (rows) => new Map(rows.map((r) => [String(r._id), r]));
    const workloadMap = byId(workload);
    const responseMap = byId(responses);
    const ratingMap = byId(ratings);

    res.json({
      success: true,
      staff: staff.map((s) => {
        const id = String(s._id);
        const w = workloadMap.get(id);
        const r = responseMap.get(id);
        const f = ratingMap.get(id);
        return {
          _id: s._id,
          name: s.name,
          email: s.email,
          department: s.department || null,
          isBlocked: Boolean(s.isBlocked),
          assigned: w?.assigned || 0,
          resolved: w?.resolved || 0,
          open: w?.open || 0,
          avgFirstResponseHours: r ? round(r.avgMs / 3600000, 1) : null,
          avgRating: f ? round(f.avgRating, 2) : null,
          ratingsCount: f?.ratingsCount || 0,
        };
      }),
    });
  } catch (error) {
    console.error("getStaffPerformance error:", error);
    res.status(500).json({ success: false, message: "Failed to load staff performance" });
  }
};
