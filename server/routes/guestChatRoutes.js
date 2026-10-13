import express from "express";
import {
  guestTextChatController,
  getGuestChatHistory,
  clearGuestSession
} from "../controllers/guestChatController.js";
import { guestChatLimiter, guestIpLimiter } from "../middlewares/rateLimit.js";

const router = express.Router();

// Guest chat routes (no authentication required — rate limited instead)
router.post("/chat", guestIpLimiter, guestChatLimiter, guestTextChatController); // Send message
router.get("/history", guestIpLimiter, getGuestChatHistory); // Get chat history
router.post("/clear", guestIpLimiter, clearGuestSession); // Clear session

export default router;
