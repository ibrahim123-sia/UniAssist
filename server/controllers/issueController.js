import fs from "fs";
import mongoose from "mongoose";
import Issue from "../models/Issue.js";
import Department from "../models/Department.js";
import User from "../models/User.js";
import Chat from "../models/Chat.js";
import { notify } from "../services/notify.js";
import { suggestDepartment, forgetDepartmentTitles } from "../services/departmentSuggestion.js";
import { withKeyLock } from "../utils/keyedLock.js";

const cleanupFiles = (files) => {
  if (!files) return;
  for (const f of files) {
    fs.unlink(f.path, () => {});
  }
};

const MAX_TITLE_CHARS = 200;
const MAX_TEXT_CHARS = 5000;
const MAX_DETAILS_CHARS = 2000;
const MAX_FEEDBACK_COMMENT_CHARS = 1000;
const MAX_REJECTION_REASON_CHARS = 1000;
const MAX_MY_ISSUES = 200;    // student "My Issues" (newest first)
const MAX_DEPT_ISSUES = 500;  // staff department list (most recently updated first)
const TRANSCRIPT_MESSAGES = 20;
const TRANSCRIPT_ITEM_CHARS = 600;
const OPEN_STATUSES = ["Pending", "In Progress"];
const CLOSED_STATUSES = ["Resolved", "Closed"];

const nonEmptyString = (v) => typeof v === "string" && v.trim().length > 0;

// Malformed ids → null (404) instead of a Mongoose CastError (500). Returns a
// query (chainable with ?.populate) or plain null.
const findIssueById = (id) => (mongoose.isValidObjectId(id) ? Issue.findById(id) : null);

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

// In-app + email to every active staff member of the issue's department.
const notifyDeptOfNewIssue = async (issue, dept) => {
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
      emailBody: `${issue.title}\n\nFrom: ${issue.studentName} (${issue.studentEmail})\nCategory: ${issue.category}\n\n${issue.description}`,
    });
  }
};

// The SLA clock stops at the first staff reply / status change / assign.
const markFirstStaffResponse = (issue, user) => {
  if (issue.firstStaffResponseAt) return;
  issue.firstStaffResponseAt = new Date();
  issue.firstResponderId = user._id;
};

export const createIssue = async (req, res) => {
  const { title, description, category, departmentId } = req.body ?? {};

  if (!nonEmptyString(title) || !nonEmptyString(description) || !departmentId) {
    cleanupFiles(req.files);
    return res.status(400).json({
      success: false,
      message: "title, description, and departmentId are required",
    });
  }
  if (title.trim().length > MAX_TITLE_CHARS || description.trim().length > MAX_TEXT_CHARS) {
    cleanupFiles(req.files);
    return res.status(400).json({
      success: false,
      message: `Title must be at most ${MAX_TITLE_CHARS} and description at most ${MAX_TEXT_CHARS} characters`,
    });
  }

  try {
    const dept = mongoose.isValidObjectId(departmentId) && await Department.findById(departmentId);
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
      category: (typeof category === "string" && category.trim() ? category : "other").trim().toLowerCase().slice(0, 50),
      attachments: buildAttachmentRecords(req.files),
    });

    forgetDepartmentTitles(dept._id);
    await notifyDeptOfNewIssue(issue, dept);

    res.status(201).json({ success: true, issue });
  } catch (error) {
    console.error("createIssue error:", error);
    cleanupFiles(req.files);
    res.status(500).json({ success: false, message: "Failed to create issue" });
  }
};

// ---------------------------------------------------------------------------
// GET /api/issue/department-suggestion?text=
//   Best-guess department for a complaint (may be null).
// ---------------------------------------------------------------------------

export const getDepartmentSuggestion = async (req, res) => {
  try {
    const text = typeof req.query.text === "string" ? req.query.text : "";
    const suggestion = text.trim() ? await suggestDepartment(text) : null;
    res.json({ success: true, suggestion });
  } catch (error) {
    console.error("getDepartmentSuggestion error:", error);
    res.status(500).json({ success: false, message: "Failed to suggest a department" });
  }
};

// First ~10 words of a message, as an issue title.
const titleFromText = (text) => {
  const words = String(text ?? "").trim().split(/\s+/).filter(Boolean);
  const title = words.slice(0, 10).join(" ") + (words.length > 10 ? "..." : "");
  return title.slice(0, MAX_TITLE_CHARS);
};

const buildTranscript = (messages) =>
  (messages || [])
    .filter((m) => m && (m.role === "user" || m.role === "assistant") && m.content)
    .slice(-TRANSCRIPT_MESSAGES)
    .map((m) => {
      const text = String(m.content).replace(/\s+/g, " ").trim();
      const clipped = text.length > TRANSCRIPT_ITEM_CHARS ? `${text.slice(0, TRANSCRIPT_ITEM_CHARS - 1)}…` : text;
      return `${m.role === "user" ? "Student" : "Assistant"}: ${clipped}`;
    })
    .join("\n");

// ---------------------------------------------------------------------------
// POST /api/issue/from-chat
//   Body: { chatId, departmentId, details? }
//   Turns one of the student's chats into an Issue (source "chatbot") with
//   the transcript attached. One open complaint per chat.
// ---------------------------------------------------------------------------

export const createIssueFromChat = async (req, res) => {
  const { chatId, departmentId, details } = req.body ?? {};
  if (details !== undefined && details !== null && typeof details !== "string") {
    return res.status(400).json({ success: false, message: "details must be a string" });
  }
  const extra = typeof details === "string" ? details.trim() : "";
  if (extra.length > MAX_DETAILS_CHARS) {
    return res.status(400).json({
      success: false,
      message: `Details must be at most ${MAX_DETAILS_CHARS} characters`,
    });
  }
  try {
    const chat = mongoose.isValidObjectId(chatId)
      ? await Chat.findOne({ _id: chatId, userId: req.user._id })
      : null;
    if (!chat) return res.status(404).json({ success: false, message: "Chat not found" });

    const dept = mongoose.isValidObjectId(departmentId) && await Department.findById(departmentId);
    if (!dept || !dept.isActive) {
      return res.status(400).json({ success: false, message: "Invalid department" });
    }

    // One request per student+chat at a time, so a double click can't slip
    // two complaints past the duplicate check below.
    await withKeyLock(`complaint:${req.user._id}:${chat._id}`, () => registerChatComplaint(req, res, chat, dept, extra));
  } catch (error) {
    console.error("createIssueFromChat error:", error);
    if (!res.headersSent) res.status(500).json({ success: false, message: "Failed to register the complaint" });
  }
};

// Duplicate check + create for createIssueFromChat (runs under its lock).
async function registerChatComplaint(req, res, chat, dept, extra) {
  const existing = await Issue.findOne({
    studentId: req.user._id,
    chatId: chat._id,
    status: { $in: OPEN_STATUSES },
  }).populate("department", "code name");
  if (existing) {
    return res.status(409).json({
      success: false,
      message: "You already registered a complaint from this chat",
      issue: existing,
    });
  }

  const lastUserMessage = [...(chat.messages || [])]
    .reverse()
    .find((m) => m.role === "user" && String(m.content ?? "").trim());
  const title = titleFromText(lastUserMessage ? lastUserMessage.content : extra);
  if (!title) {
    return res.status(400).json({ success: false, message: "Please describe your complaint" });
  }
  const transcript = buildTranscript(chat.messages);
  const intro = extra || "Registered from a chatbot conversation.";
  const description = `${intro}${transcript ? `\n\n--- Chat transcript ---\n${transcript}` : ""}`.slice(0, MAX_TEXT_CHARS);

  const issue = await Issue.create({
    studentId: req.user._id,
    studentName: req.user.name,
    studentEmail: req.user.email,
    department: dept._id,
    title,
    description,
    category: "chatbot",
    source: "chatbot",
    chatId: chat._id,
  });

  forgetDepartmentTitles(dept._id);
  await notifyDeptOfNewIssue(issue, dept);

  res.status(201).json({ success: true, issue });
}

// ---------------------------------------------------------------------------
// POST /api/issue/:id/feedback
//   Body: { rating: 1-5, comment? } — owner only, once, after Resolved/Closed.
// ---------------------------------------------------------------------------

export const submitIssueFeedback = async (req, res) => {
  const { rating, comment } = req.body ?? {};
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return res.status(400).json({ success: false, message: "rating must be a whole number from 1 to 5" });
  }
  if (comment !== undefined && comment !== null && typeof comment !== "string") {
    return res.status(400).json({ success: false, message: "comment must be a string" });
  }
  const text = typeof comment === "string" ? comment.trim() : "";
  if (text.length > MAX_FEEDBACK_COMMENT_CHARS) {
    return res.status(400).json({
      success: false,
      message: `Comment must be at most ${MAX_FEEDBACK_COMMENT_CHARS} characters`,
    });
  }
  try {
    const issue = await findIssueById(req.params.id);
    if (!issue) return res.status(404).json({ success: false, message: "Issue not found" });
    if (issue.studentId.toString() !== req.user._id.toString()) {
      return res.status(403).json({ success: false, message: "Access denied" });
    }
    if (!CLOSED_STATUSES.includes(issue.status)) {
      return res.status(400).json({
        success: false,
        message: "You can rate an issue once it is Resolved or Closed",
      });
    }
    if (issue.feedback?.rating) {
      return res.status(409).json({ success: false, message: "Feedback was already submitted for this issue" });
    }

    // Conditional update so two quick submits can't both land.
    const updated = await Issue.findOneAndUpdate(
      { _id: issue._id, studentId: req.user._id, status: { $in: CLOSED_STATUSES }, feedback: null },
      { $set: { feedback: { rating, comment: text, submittedAt: new Date() } } },
      { returnDocument: "after", runValidators: true }
    ).populate("department", "code name");
    if (!updated) {
      return res.status(409).json({ success: false, message: "Feedback was already submitted for this issue" });
    }

    const staffId = updated.assignedTo || updated.firstResponderId;
    if (staffId) {
      const staffUser = await User.findById(staffId).select("_id");
      if (staffUser) {
        notify(staffUser, {
          type: "issue_feedback",
          issueId: updated._id,
          message: `${updated.studentName} rated "${updated.title}" ${rating}/5`,
          link: `/staff/issues/${updated._id}`,
          sendEmail: false,
        }).catch(() => {});
      }
    }

    res.json({ success: true, issue: updated });
  } catch (error) {
    console.error("submitIssueFeedback error:", error);
    res.status(500).json({ success: false, message: "Failed to submit feedback" });
  }
};

export const getMyIssues = async (req, res) => {
  try {
    const { status } = req.query;
    const filter = { studentId: req.user._id };
    if (status) filter.status = String(status);
    const issues = await Issue.find(filter)
      .populate("department", "code name")
      .sort({ updatedAt: -1 })
      .limit(MAX_MY_ISSUES);
    res.json({ success: true, issues });
  } catch (error) {
    console.error("getMyIssues error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch issues" });
  }
};

export const getMyIssueById = async (req, res) => {
  try {
    const issue = await findIssueById(req.params.id)?.populate("department", "code name");
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
  const { message } = req.body ?? {};
  if (!nonEmptyString(message)) {
    return res.status(400).json({ success: false, message: "Reply message is required" });
  }
  if (message.trim().length > MAX_TEXT_CHARS) {
    return res.status(400).json({ success: false, message: `Reply must be at most ${MAX_TEXT_CHARS} characters` });
  }
  try {
    const issue = await findIssueById(req.params.id)?.populate("department", "code name");
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
        emailBody: `${issue.title}\n\n${issue.studentName}: ${message.trim()}`,
      });
    }

    res.json({ success: true, issue });
  } catch (error) {
    if (isVersionError(error)) {
      return res.status(409).json({ success: false, message: "This issue was just updated. Please try again." });
    }
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
          Rejected: statusMap.Rejected || 0,
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

const STAFF_ISSUE_POPULATE = [
  { path: "department", select: "code name" },
  { path: "assignedTo", select: "name email staffTitle" },
  { path: "lastEvent.byUserId", select: "name staffTitle" },
];

const ALLOWED_STATUSES = ["Pending", "In Progress", "Resolved", "Closed", "Rejected"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const sameDept = (issue, user) =>
  !!user.department && issue.department._id.toString() === user.department.toString();

const NO_DEPT = { success: false, message: "Staff has no department assigned" };

// Concurrency check: client passes the `updatedAt` it last saw; if the issue
// has changed since then, reject with 409 so the UI can show "updated by X".
// An unparseable timestamp is treated as stale rather than crashing.
const versionConflict = (issue, expectedUpdatedAt) => {
  if (!expectedUpdatedAt) return false;
  const expected = new Date(expectedUpdatedAt);
  if (isNaN(expected)) return true;
  return new Date(issue.updatedAt).getTime() !== expected.getTime();
};

// The read-check-save above isn't atomic on its own; `optimisticConcurrency`
// on the schema makes the save itself fail if another write landed in between.
const isVersionError = (error) => error?.name === "VersionError";

const conflictResponse = async (res, issueId) => {
  const fresh = await Issue.findById(issueId).populate(STAFF_ISSUE_POPULATE);
  const ev = fresh?.lastEvent || {};
  const who = ev.byName ? `${ev.byName}${ev.byRole === "staff" ? " (staff)" : ""}` : "another staff member";
  return res.status(409).json({
    success: false,
    code: "VERSION_CONFLICT",
    message: `This issue was just updated by ${who}. Refresh to see the latest before retrying.`,
    issue: fresh,
  });
};

const recordEvent = (issue, user, type, note = "") => {
  issue.lastEvent = {
    type,
    byUserId: user._id,
    byName: user.name,
    byRole: user.role,
    at: new Date(),
    note,
  };
};

const notifyDeptStaffOthers = async (issue, currentUserId, payload) => {
  const others = await User.find({
    role: "staff",
    department: issue.department._id,
    isBlocked: false,
    _id: { $ne: currentUserId },
  });
  for (const s of others) notify(s, payload).catch(() => {});
};

// ---------------------------------------------------------------------------
// GET /api/issue/department
// ---------------------------------------------------------------------------

export const getDeptIssues = async (req, res) => {
  if (!req.user.department) {
    return res.status(400).json({ success: false, message: "Staff has no department assigned" });
  }
  try {
    const { status } = req.query;
    const filter = { department: req.user.department };
    if (status) filter.status = String(status);
    const issues = await Issue.find(filter)
      .populate(STAFF_ISSUE_POPULATE)
      .sort({ updatedAt: -1 })
      .limit(MAX_DEPT_ISSUES);
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
    const issue = await findIssueById(req.params.id)?.populate(STAFF_ISSUE_POPULATE);
    if (!issue) return res.status(404).json({ success: false, message: "Issue not found" });
    if (!sameDept(issue, req.user)) {
      return res.status(403).json({ success: false, message: "Issue belongs to another department" });
    }
    res.json({ success: true, issue });
  } catch (error) {
    console.error("getDeptIssueById error:", error);
    res.status(500).json({ success: false, message: "Failed to fetch issue" });
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/issue/department/:id/status
//   Status-only update. Accepts optional `reason` (required for Rejected) and
//   optional `expectedUpdatedAt` for concurrency safety.
// ---------------------------------------------------------------------------

export const updateIssueStatus = async (req, res) => {
  if (!req.user.department) return res.status(400).json(NO_DEPT);
  const { status, reason, expectedUpdatedAt } = req.body ?? {};
  if (!ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `status must be one of: ${ALLOWED_STATUSES.join(", ")}`,
    });
  }
  if (status === "Rejected" && !nonEmptyString(reason)) {
    return res.status(400).json({
      success: false,
      message: "A reason is required when rejecting an issue.",
    });
  }
  if (status === "Rejected" && reason.trim().length > MAX_REJECTION_REASON_CHARS) {
    return res.status(400).json({
      success: false,
      message: `The rejection reason must be at most ${MAX_REJECTION_REASON_CHARS} characters`,
    });
  }
  try {
    const issue = await findIssueById(req.params.id)?.populate("department", "code name");
    if (!issue) return res.status(404).json({ success: false, message: "Issue not found" });
    if (!sameDept(issue, req.user)) {
      return res.status(403).json({ success: false, message: "Issue belongs to another department" });
    }
    if (versionConflict(issue, expectedUpdatedAt)) return conflictResponse(res, issue._id);
    if (issue.status === status) {
      const populated = await Issue.findById(issue._id).populate(STAFF_ISSUE_POPULATE);
      return res.json({ success: true, issue: populated, message: "Status unchanged" });
    }

    const previous = issue.status;
    issue.status = status;
    if (status === "Rejected") issue.rejectionReason = reason.trim();
    if (!issue.assignedTo) issue.assignedTo = req.user._id;
    markFirstStaffResponse(issue, req.user);
    recordEvent(issue, req.user, "status", `${previous} → ${status}`);
    await issue.save();

    // Notify the student
    const student = await User.findById(issue.studentId);
    if (student) {
      const reasonLine =
        status === "Rejected" && issue.rejectionReason
          ? `\n\nReason: ${issue.rejectionReason}`
          : "";
      notify(student, {
        type: "issue_status_changed",
        issueId: issue._id,
        message: `Your issue "${issue.title}" is now ${status}`,
        link: `/issues/${issue._id}`,
        emailSubject: `Issue update: ${status}`,
        emailHeading: "Your issue status has changed",
        emailBody: `${issue.title}\n\nStatus: ${previous} → ${status}\nDepartment: ${issue.department.code}${reasonLine}`,
      });
    }

    // Notify other dept staff (so they don't waste effort on a resolved item)
    await notifyDeptStaffOthers(issue, req.user._id, {
      type: "issue_status_changed",
      issueId: issue._id,
      message: `${req.user.name} marked "${issue.title}" as ${status}`,
      link: `/staff/issues/${issue._id}`,
    });

    const populated = await Issue.findById(issue._id).populate(STAFF_ISSUE_POPULATE);
    res.json({ success: true, issue: populated });
  } catch (error) {
    if (isVersionError(error)) return conflictResponse(res, req.params.id);
    console.error("updateIssueStatus error:", error);
    res.status(500).json({ success: false, message: "Failed to update status" });
  }
};

// ---------------------------------------------------------------------------
// POST /api/issue/department/:id/sfo-reply
//   Combined reply + optional status change. Reply text is required; if
//   `status` is also provided, it's applied in the same save (one DB round
//   trip, one student notification).
// ---------------------------------------------------------------------------

export const addStaffReply = async (req, res) => {
  if (!req.user.department) return res.status(400).json(NO_DEPT);
  const { message, status, reason, expectedUpdatedAt } = req.body ?? {};
  if (!nonEmptyString(message)) {
    return res.status(400).json({ success: false, message: "Reply message is required" });
  }
  if (message.trim().length > MAX_TEXT_CHARS) {
    return res.status(400).json({ success: false, message: `Reply must be at most ${MAX_TEXT_CHARS} characters` });
  }
  if (status !== undefined && !ALLOWED_STATUSES.includes(status)) {
    return res.status(400).json({
      success: false,
      message: `status must be one of: ${ALLOWED_STATUSES.join(", ")}`,
    });
  }
  if (status === "Rejected" && !nonEmptyString(reason)) {
    return res.status(400).json({
      success: false,
      message: "A reason is required when rejecting an issue.",
    });
  }
  if (status === "Rejected" && reason.trim().length > MAX_REJECTION_REASON_CHARS) {
    return res.status(400).json({
      success: false,
      message: `The rejection reason must be at most ${MAX_REJECTION_REASON_CHARS} characters`,
    });
  }
  try {
    const issue = await findIssueById(req.params.id)?.populate("department", "code name");
    if (!issue) return res.status(404).json({ success: false, message: "Issue not found" });
    if (!sameDept(issue, req.user)) {
      return res.status(403).json({ success: false, message: "Issue belongs to another department" });
    }
    if (versionConflict(issue, expectedUpdatedAt)) return conflictResponse(res, issue._id);

    const statusChanged = status && status !== issue.status;
    const previous = issue.status;

    issue.replies.push({
      authorId: req.user._id,
      authorName: req.user.name,
      authorRole: "staff",
      message: message.trim(),
    });
    if (statusChanged) {
      issue.status = status;
      if (status === "Rejected") issue.rejectionReason = reason.trim();
    }
    if (!issue.assignedTo) issue.assignedTo = req.user._id;
    markFirstStaffResponse(issue, req.user);

    recordEvent(
      issue,
      req.user,
      statusChanged ? "status" : "reply",
      statusChanged ? `${previous} → ${status} + reply` : "replied"
    );
    await issue.save();

    // ONE combined notification to the student
    const student = await User.findById(issue.studentId);
    if (student) {
      const titlePrefix = statusChanged
        ? `${req.user.staffTitle || "Staff"} marked your issue ${status}`
        : `${req.user.staffTitle || "Staff"} replied on: ${issue.title}`;
      const reasonLine =
        statusChanged && status === "Rejected" && issue.rejectionReason
          ? `\n\nReason: ${issue.rejectionReason}`
          : "";
      const statusLine = statusChanged
        ? `\n\nStatus: ${previous} → ${status}${reasonLine}`
        : "";
      notify(student, {
        type: statusChanged ? "issue_status_changed" : "issue_replied",
        issueId: issue._id,
        message: titlePrefix,
        link: `/issues/${issue._id}`,
        emailSubject: statusChanged ? `Issue update: ${status}` : "New reply on your issue",
        emailHeading: titlePrefix,
        emailBody: `${issue.title}${statusLine}\n\n${req.user.name} (${issue.department.code}): ${message.trim()}`,
      });
    }

    // If status changed, let other dept staff know so two people don't
    // both try to handle the same item.
    if (statusChanged) {
      await notifyDeptStaffOthers(issue, req.user._id, {
        type: "issue_status_changed",
        issueId: issue._id,
        message: `${req.user.name} marked "${issue.title}" as ${status}`,
        link: `/staff/issues/${issue._id}`,
      });
    }

    const populated = await Issue.findById(issue._id).populate(STAFF_ISSUE_POPULATE);
    res.json({ success: true, issue: populated });
  } catch (error) {
    if (isVersionError(error)) return conflictResponse(res, req.params.id);
    console.error("addStaffReply error:", error);
    res.status(500).json({ success: false, message: "Failed to add reply" });
  }
};

// ---------------------------------------------------------------------------
// PATCH /api/issue/department/:id/assign
//   Body: { assigneeId: <userId> | null, expectedUpdatedAt? }
//   Assigns the issue to a staff member in the same department, or unassigns
//   with null. The newly-assigned staff member gets a notification.
// ---------------------------------------------------------------------------

export const assignIssue = async (req, res) => {
  const { assigneeId, expectedUpdatedAt } = req.body ?? {};
  if (!req.user.department) return res.status(400).json(NO_DEPT);
  try {
    const issue = await findIssueById(req.params.id)?.populate("department", "code name");
    if (!issue) return res.status(404).json({ success: false, message: "Issue not found" });
    if (!sameDept(issue, req.user)) {
      return res.status(403).json({ success: false, message: "Issue belongs to another department" });
    }
    if (versionConflict(issue, expectedUpdatedAt)) return conflictResponse(res, issue._id);

    let assigneeUser = null;
    if (assigneeId) {
      assigneeUser = mongoose.isValidObjectId(assigneeId) ? await User.findById(assigneeId) : null;
      if (
        !assigneeUser ||
        assigneeUser.role !== "staff" ||
        !assigneeUser.department ||
        assigneeUser.department.toString() !== req.user.department.toString() ||
        assigneeUser.isBlocked
      ) {
        return res
          .status(400)
          .json({ success: false, message: "Assignee must be an active staff member in this department" });
      }
    }

    const previousId = issue.assignedTo ? issue.assignedTo.toString() : null;
    issue.assignedTo = assigneeUser ? assigneeUser._id : null;
    const note = assigneeUser
      ? `assigned to ${assigneeUser.name}`
      : "unassigned";
    markFirstStaffResponse(issue, req.user);
    recordEvent(issue, req.user, "assign", note);
    await issue.save();

    // Notify the new assignee (unless it's themselves)
    if (assigneeUser && assigneeUser._id.toString() !== req.user._id.toString()) {
      notify(assigneeUser, {
        type: "issue_assigned",
        issueId: issue._id,
        message: `${req.user.name} assigned "${issue.title}" to you`,
        link: `/staff/issues/${issue._id}`,
        emailSubject: `[${issue.department.code}] Issue assigned to you`,
        emailHeading: "An issue was assigned to you",
        emailBody: `${issue.title}\n\nAssigned by: ${req.user.name}\nDepartment: ${issue.department.code}`,
      }).catch(() => {});
    }
    // Also tell the previous assignee (if any) it's been taken off their plate
    if (previousId && previousId !== req.user._id.toString() && previousId !== (assigneeUser?._id.toString() || "")) {
      const prev = await User.findById(previousId);
      if (prev) {
        notify(prev, {
          type: "issue_assigned",
          issueId: issue._id,
          message: `${req.user.name} reassigned "${issue.title}"`,
          link: `/staff/issues/${issue._id}`,
        }).catch(() => {});
      }
    }

    const populated = await Issue.findById(issue._id).populate(STAFF_ISSUE_POPULATE);
    res.json({ success: true, issue: populated });
  } catch (error) {
    if (isVersionError(error)) return conflictResponse(res, req.params.id);
    console.error("assignIssue error:", error);
    res.status(500).json({ success: false, message: "Failed to assign issue" });
  }
};

// ---------------------------------------------------------------------------
// GET /api/issue/department/staff
//   Returns the list of staffers in the current user's department, for the
//   reassign dropdown.
// ---------------------------------------------------------------------------

export const listDeptStaff = async (req, res) => {
  if (!req.user.department) {
    return res.status(400).json({ success: false, message: "Staff has no department assigned" });
  }
  try {
    const staff = await User.find({
      role: "staff",
      department: req.user.department,
      isBlocked: false,
    })
      .select("name email staffTitle")
      .sort({ name: 1 });
    res.json({ success: true, staff });
  } catch (error) {
    console.error("listDeptStaff error:", error);
    res.status(500).json({ success: false, message: "Failed to load staff" });
  }
};
