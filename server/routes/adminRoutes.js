import express from "express";
import { protect } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/requireRole.js";
import {
  listUsers,
  updateUser,
  blockUser,
  createStaffUser,
  updateStaffUser,
  deleteStaffUser,
  getUserActivity,
} from "../controllers/adminController.js";
import { getAdminStats } from "../controllers/adminStatsController.js";
import {
  listAllIssues,
  getIssueAnalytics,
  getAdminIssue,
} from "../controllers/adminIssueController.js";
import { verifyAdmin, flagUser } from "../controllers/internalController.js";
import {
  listAuditLogs,
  listLoginEvents,
  listChatLogs,
  getChatLog,
} from "../controllers/adminLogController.js";
import { auditAdminWrites } from "../middlewares/audit.js";

const router = express.Router();

// Internal Python<->Node bridge. flag-user uses INTERNAL_SECRET only (no JWT).
// verify-admin requires the JWT to be valid AND role=admin AND internal secret.
router.post("/internal/flag-user", flagUser);
router.get("/internal/verify-admin", protect, verifyAdmin);

router.use(protect, requireRole("admin"));
router.use(auditAdminWrites);

router.get("/stats", getAdminStats);
router.get("/issues", listAllIssues);
router.get("/issues/analytics", getIssueAnalytics);
router.get("/issues/:id", getAdminIssue);
router.get("/users", listUsers);
router.get("/users/:id/activity", getUserActivity);
router.patch("/users/:id", updateUser);
router.patch("/users/:id/block", blockUser);
router.post("/staff", createStaffUser);
router.patch("/staff/:id", updateStaffUser);
router.delete("/staff/:id", deleteStaffUser);

router.get("/logs/audit", listAuditLogs);
router.get("/logs/logins", listLoginEvents);
router.get("/logs/chats", listChatLogs);
router.get("/logs/chats/:id", getChatLog);

export default router;
