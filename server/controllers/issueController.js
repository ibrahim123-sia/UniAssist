import fs from "fs";
import path from "path";
import Issue from "../models/Issue.js";
import Department from "../models/Department.js";
import User from "../models/User.js";
import { notify } from "../services/notify.js";

const cleanupFiles = (files) => {
  if (!files) return;
  for (const f of files) {
    fs.unlink(f.path, () => {});
  }
};

const buildAttachmentRecords = (files) => {
  if (!files) return [];
  return files.map((f) => ({
    filename: f.filename,
    originalName: f.originalname,
    mimeType: f.mimetype,
    size: f.size,
    url: `/uploads/issues/${f.filename}`,
  }));
};

export const createIssue = async (req, res) => {
  const { title, description, category, departmentId } = req.body;

  if (!title || !description || !departmentId) {
    cleanupFiles(req.files);
    return res.status(400).json({
      success: false,
      message: "title, description, and departmentId are required",
    });
  }

  try {
    const dept = await Department.findById(departmentId);
    if (!dept || !dept.isActive) {
      cleanupFiles(req.files);
      return res.status(400).json({ success: false, message: "Invalid department" });
    }

    const issue = await Issue.create({
      studentId: req.user._id,
      studentName: req.user.name,
      studentEmail: req.user.email,
      department: dept._id,
      title: title.trim(),
      description: description.trim(),
      category: (category || "other").trim().toLowerCase(),
      attachments: buildAttachmentRecords(req.files),
    });

    const staff = await User.find({
      role: "staff",
      department: dept._id,
      isBlocked: false,
    });
    for (const s of staff) {
      notify(s, {
        type: "issue_created",
        issueId: issue._id,
        message: `New issue in ${dept.code}: ${issue.title}`,
        link: `/staff/issues/${issue._id}`,
        emailSubject: `[${dept.code}] New issue submitted`,
        emailHeading: "New issue assigned to your department",
        emailBody: `<strong>${issue.title}</strong><br/><br/>From: ${issue.studentName} (${issue.studentEmail})<br/>Category: ${issue.category}<br/><br/>${issue.description}`,
      });
    }

    res.status(201).json({ success: true, issue });
  } catch (error) {
    console.error("createIssue error:", error);
    cleanupFiles(req.files);
    res.status(500).json({ success: false, message: "Failed to create issue" });
  }
};

export const getMyIssues = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { studentId: req.user._id };
    if (status) filter.status = status;
    const issues = await Issue.find(filter)
      .populate("department", "code name")
      .sort({ updatedAt: -1 });
    res.json({ success: true, issues });
  } catch (error) {
    console.error("getMyIssues error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch issues" });
  }
};

export const getMyIssueById = async (req, res) => {
  try {
    const issue = await Issue.findById(req.params.id).populate(
      "department",
      "code name"
    );
    if (!issue) return res.status(404).json({ success: false, message: "Issue not found" });
    if (issue.studentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    res.json({ success: true, issue });
  } catch (error) {
    console.error("getMyIssueById error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch issue" });
  }
};

export const addStudentReply = async (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, message: "Reply message is required" });
  }
  try {
    const issue = await Issue.findById(req.params.id).populate("department", "code name");
    if (!issue) return res.status(404).json({ success: false, message: "Issue not found" });
    if (issue.studentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    issue.replies.push({
      authorId: req.user._id,
      authorName: req.user.name,
      authorRole: "student",
      message: message.trim(),
    });
    await issue.save();

    const staff = await User.find({
      role: "staff",
      department: issue.department._id,
      isBlocked: false,
    });
    for (const s of staff) {
      notify(s, {
        type: "issue_replied",
        issueId: issue._id,
        message: `Student replied on: ${issue.title}`,
        link: `/staff/issues/${issue._id}`,
        emailSubject: `[${issue.department.code}] Student replied`,
        emailHeading: "Student added a reply",
        emailBody: `<strong>${issue.title}</strong><br/><br/>${issue.studentName}: ${message.trim()}`,
      });
    }

    res.json({ success: true, issue });
  } catch (error) {
    console.error("addStudentReply error:", error);
    res.status(500).json({ success: false, message: "Failed to add reply" });
  }
};

export const getDeptStats = async (req, res) => {
  if (!req.user.department) {
    return res.status(400).json({ success: false, message: "Staff has no department assigned" });
  }
  try {
    const deptId = req.user.department;
    const startOfWeek = new Date();
    startOfWeek.setDate(startOfWeek.getDate() - 6);
    startOfWeek.setHours(0, 0, 0, 0);

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    sevenDaysAgo.setHours(0, 0, 0, 0);

    const [byStatus, resolvedThisWeek, repliesGiven, responseStats, last7d, recent] = await Promise.all([
      Issue.aggregate([
        { $match: { department: deptId } },
        { $group: { _id: "$status", count: { $sum: 1 } } },
      ]),
      Issue.countDocuments({
        department: deptId,
        status: { $in: ["Resolved", "Closed"] },
        updatedAt: { $gte: startOfWeek },
      }),
      Issue.aggregate([
        { $match: { department: deptId } },
        { $unwind: "$replies" },
        { $match: { "replies.authorId": req.user._id } },
        { $count: "count" },
      ]),
      // Avg time-to-first-staff-reply across this dept's issues that have one
      Issue.aggregate([
        { $match: { department: deptId, "replies.0": { $exists: true } } },
        {
          $project: {
            createdAt: 1,
            firstStaffReply: {
              $arrayElemAt: [
                {
                  $filter: {
                    input: "$replies",
                    as: "r",
                    cond: { $eq: ["$$r.authorRole", "staff"] },
                  },
                },
                0,
              ],
            },
          },
        },
        { $match: { firstStaffReply: { $ne: null } } },
        {
          $project: {
            durationMs: { $subtract: ["$firstStaffReply.createdAt", "$createdAt"] },
          },
        },
        { $group: { _id: null, avgMs: { $avg: "$durationMs" }, count: { $sum: 1 } } },
      ]),
      Issue.aggregate([
        { $match: { department: deptId, createdAt: { $gte: sevenDaysAgo } } },
        {
          $group: {
            _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
            count: { $sum: 1 },
          },
        },
        { $sort: { _id: 1 } },
      ]),
      Issue.find({ department: deptId })
        .sort({ updatedAt: -1 })
        .limit(5)
        .select("title status studentName updatedAt category"),
    ]);

    const statusMap = byStatus.reduce((acc, s) => ({ ...acc, [s._id]: s.count }), {});
    const total = Object.values(statusMap).reduce((a, b) => a + b, 0);

    // Build 7-day series (zero-fill)
    const series = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      const found = last7d.find((x) => x._id === key);
      series.push({ date: key, count: found ? found.count : 0 });
    }

    res.json({
      success: true,
      stats: {
        total,
        byStatus: {
          Pending: statusMap.Pending || 0,
          "In Progress": statusMap["In Progress"] || 0,
          Resolved: statusMap.Resolved || 0,
          Closed: statusMap.Closed || 0,
        },
        resolvedThisWeek,
        repliesGivenByMe: repliesGiven[0]?.count || 0,
        avgResponseHours: responseStats[0]?.avgMs
          ? +(responseStats[0].avgMs / 3600000).toFixed(1)
          : null,
        last7d: series,
        recent,
      },
    });
  } catch (error) {
    console.error("getDeptStats error:", error);
    res.status(500).json({ success: false, message: "Failed to load stats" });
  }
};

export const getDeptIssues = async (req, res) => {
  if (!req.user.department) {
    return res.status(400).json({ success: false, message: "Staff has no department assigned" });
  }
  try {
    const { status } = req.query;
    const filter = { department: req.user.department };
    if (status) filter.status = status;
    const issues = await Issue.find(filter)
      .populate("department", "code name")
      .sort({ updatedAt: -1 });
    res.json({ success: true, issues });
  } catch (error) {
    console.error("getDeptIssues error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch issues" });
  }
};

export const getDeptIssueById = async (req, res) => {
  if (!req.user.department) {
    return res.status(400).json({ success: false, message: "Staff has no department assigned" });
  }
  try {
    const issue = await Issue.findById(req.params.id).populate("department", "code name");
    if (!issue) return res.status(404).json({ success: false, message: "Issue not found" });
    if (issue.department._id.toString() !== req.user.department.toString()) {
      return res.status(403).json({ success: false, message: "Issue belongs to another department" });
    }
    res.json({ success: true, issue });
  } catch (error) {
    console.error("getDeptIssueById error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch issue" });
  }
};

const ALLOWED_STATUSES = ["Pending", "In Progress", "Resolved", "Closed"];

export const updateIssueStatus = async (req, res) => {
  const { status } = req.body;
  if (!ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `status must be one of: ${ALLOWED_STATUSES.join(", ")}`,
    });
  }
  try {
    const issue = await Issue.findById(req.params.id).populate("department", "code name");
    if (!issue) return res.status(404).json({ success: false, message: "Issue not found" });
    if (issue.department._id.toString() !== req.user.department.toString()) {
      return res.status(403).json({ success: false, message: "Issue belongs to another department" });
    }
    if (issue.status === status) {
      return res.json({ success: true, issue, message: "Status unchanged" });
    }
    const previous = issue.status;
    issue.status = status;
    if (!issue.assignedTo) issue.assignedTo = req.user._id;
    await issue.save();

    const student = await User.findById(issue.studentId);
    if (student) {
      notify(student, {
        type: "issue_status_changed",
        issueId: issue._id,
        message: `Your issue "${issue.title}" is now ${status}`,
        link: `/issues/${issue._id}`,
        emailSubject: `Issue update: ${status}`,
        emailHeading: "Your issue status has changed",
        emailBody: `<strong>${issue.title}</strong><br/><br/>Status: ${previous} → <strong>${status}</strong><br/>Department: ${issue.department.code}`,
      });
    }

    res.json({ success: true, issue });
  } catch (error) {
    console.error("updateIssueStatus error:", error);
    res.status(500).json({ success: false, message: "Failed to update status" });
  }
};

export const addStaffReply = async (req, res) => {
  const { message } = req.body;
  if (!message || !message.trim()) {
    return res.status(400).json({ success: false, message: "Reply message is required" });
  }
  try {
    const issue = await Issue.findById(req.params.id).populate("department", "code name");
    if (!issue) return res.status(404).json({ success: false, message: "Issue not found" });
    if (issue.department._id.toString() !== req.user.department.toString()) {
      return res.status(403).json({ success: false, message: "Issue belongs to another department" });
    }
    issue.replies.push({
      authorId: req.user._id,
      authorName: req.user.name,
      authorRole: "staff",
      message: message.trim(),
    });
    if (!issue.assignedTo) issue.assignedTo = req.user._id;
    await issue.save();

    const student = await User.findById(issue.studentId);
    if (student) {
      notify(student, {
        type: "issue_replied",
        issueId: issue._id,
        message: `${req.user.staffTitle || "Staff"} replied on: ${issue.title}`,
        link: `/issues/${issue._id}`,
        emailSubject: `New reply on your issue`,
        emailHeading: `${req.user.staffTitle || "Staff"} replied to your issue`,
        emailBody: `<strong>${issue.title}</strong><br/><br/>${req.user.name} (${issue.department.code}): ${message.trim()}`,
      });
    }

    res.json({ success: true, issue });
  } catch (error) {
    console.error("addStaffReply error:", error);
    res.status(500).json({ success: false, message: "Failed to add reply" });
  }
};
