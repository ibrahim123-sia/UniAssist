import express from "express";
import { protect } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/requireRole.js";
import { issueUpload, handleUploadError } from "../middlewares/upload.js";
import { complaintFromChatLimiter } from "../middlewares/rateLimit.js";
import {
  createIssue,
  getMyIssues,
  getMyIssueById,
  addStudentReply,
  getDeptIssues,
  getDeptIssueById,
  updateIssueStatus,
  addStaffReply,
  getDeptStats,
  assignIssue,
  listDeptStaff,
  getDepartmentSuggestion,
  createIssueFromChat,
  submitIssueFeedback,
} from "../controllers/issueController.js";

const router = express.Router();

router.get("/department/stats", protect, requireRole("staff"), getDeptStats);
router.get("/department/staff", protect, requireRole("staff"), listDeptStaff);
router.get("/department", protect, requireRole("staff"), getDeptIssues);
router.get("/department/:id", protect, requireRole("staff"), getDeptIssueById);
router.patch("/department/:id/status", protect, requireRole("staff"), updateIssueStatus);
router.patch("/department/:id/assign", protect, requireRole("staff"), assignIssue);
router.post("/department/:id/sfo-reply", protect, requireRole("staff"), addStaffReply);

// "Register a complaint" from the student chat. Must stay above /:id.
router.get("/department-suggestion", protect, requireRole("student"), getDepartmentSuggestion);
router.post("/from-chat", protect, requireRole("student"), complaintFromChatLimiter, createIssueFromChat);

router.post(
  "/",
  protect,
  requireRole("student", "staff", "admin"),
  issueUpload.array("attachments", 3),
  handleUploadError,
  createIssue
);
router.get("/my", protect, getMyIssues);
router.get("/:id", protect, getMyIssueById);
router.post("/:id/reply", protect, addStudentReply);
router.post("/:id/feedback", protect, requireRole("student"), submitIssueFeedback);

export default router;
