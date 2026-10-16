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
  getStaffPerformance,
} from "../controllers/adminIssueController.js";
import { getSystemHealth } from "../controllers/adminHealthController.js";
import { verifyAdmin, flagUser, runJobs } from "../controllers/internalController.js";
import {
  listAuditLogs,
  listLoginEvents,
  listChatLogs,
  getChatLog,
} from "../controllers/adminLogController.js";
import { auditAdminWrites } from "../middlewares/audit.js";
import { listingScrapeLimiter, emailTestLimiter } from "../middlewares/rateLimit.js";
import { listingPosterUpload, handleUploadError } from "../middlewares/upload.js";
import {
  scrapeListing,
  createListing,
  listAdminListings,
  updateListing,
  deleteListing,
  uploadListingPoster,
  startScrapeJob,
  getScrapeJob,
} from "../controllers/listingController.js";
import {
  getEmailSettings,
  updateEmailSettings,
  sendTestEmail,
} from "../controllers/settingsController.js";
import {
  listQuestions,
  answerQuestion,
  dismissQuestion,
  deleteQuestion,
  listQuestionGroups,
  answerQuestionGroup,
  dismissQuestionGroup,
} from "../controllers/questionController.js";

const router = express.Router();

// Internal Python<->Node bridge. flag-user uses INTERNAL_SECRET only (no JWT).
// verify-admin requires the JWT to be valid AND role=admin AND internal secret.
router.post("/internal/flag-user", flagUser);
router.post("/internal/run-jobs", runJobs);
router.get("/internal/verify-admin", protect, verifyAdmin);

router.use(protect, requireRole("admin"));
router.use(auditAdminWrites);

router.get("/stats", getAdminStats);
router.get("/health", getSystemHealth);
router.get("/issues", listAllIssues);
router.get("/issues/analytics", getIssueAnalytics);
router.get("/issues/:id", getAdminIssue);
router.get("/users", listUsers);
router.get("/users/:id/activity", getUserActivity);
router.patch("/users/:id", updateUser);
router.patch("/users/:id/block", blockUser);
router.get("/staff/performance", getStaffPerformance);
router.post("/staff", createStaffUser);
router.patch("/staff/:id", updateStaffUser);
router.delete("/staff/:id", deleteStaffUser);

router.get("/logs/audit", listAuditLogs);
router.get("/logs/logins", listLoginEvents);
router.get("/logs/chats", listChatLogs);
router.get("/logs/chats/:id", getChatLog);

// Jobs, scholarships + events (scraped from a link or entered by hand)
router.post("/listings/scrape", listingScrapeLimiter, scrapeListing);
// Same, as a background job with progress stages (the admin UI polls it).
router.post("/listings/scrape-jobs", listingScrapeLimiter, startScrapeJob);
router.get("/listings/scrape-jobs/:jobId", getScrapeJob);
router.post("/listings/poster", listingPosterUpload.single("poster"), handleUploadError, uploadListingPoster);
router.post("/listings", createListing);
router.get("/listings", listAdminListings);
router.patch("/listings/:id", updateListing);
router.delete("/listings/:id", deleteListing);

// Unanswered chatbot questions + student "Ask an admin" questions
router.get("/questions", listQuestions);
router.get("/questions/groups", listQuestionGroups);
router.patch("/questions/answer-group", answerQuestionGroup);
router.patch("/questions/dismiss-group", dismissQuestionGroup);
router.patch("/questions/:id/answer", answerQuestion);
router.patch("/questions/:id/dismiss", dismissQuestion);
router.delete("/questions/:id", deleteQuestion);

// University email account (sends OTPs + notifications)
router.get("/settings/email", getEmailSettings);
router.put("/settings/email", updateEmailSettings);
router.post("/settings/email/test", emailTestLimiter, sendTestEmail);

export default router;
