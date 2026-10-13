import express from "express";
import { protect } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/requireRole.js";
import { questionAskLimiter } from "../middlewares/rateLimit.js";
import { askAdmin, getMyQuestions } from "../controllers/questionController.js";

// Student "Ask an admin" + "My Questions". Admin side lives under
// /api/admin/questions.
const router = express.Router();

router.use(protect, requireRole("student"));
router.post("/", questionAskLimiter, askAdmin);
router.get("/my", getMyQuestions);

export default router;
