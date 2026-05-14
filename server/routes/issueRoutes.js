import express from "express";
import { protect } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/requireRole.js";
import { issueUpload, handleUploadError } from "../middlewares/upload.js";
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
} from "../controllers/issueController.js";

const router = express.Router();

router.get("/department/stats", protect, requireRole("staff"), getDeptStats);
router.get("/department", protect, requireRole("staff"), getDeptIssues);
router.get("/department/:id", protect, requireRole("staff"), getDeptIssueById);
router.patch("/department/:id/status", protect, requireRole("staff"), updateIssueStatus);
router.post("/department/:id/sfo-reply", protect, requireRole("staff"), addStaffReply);

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

export default router;
