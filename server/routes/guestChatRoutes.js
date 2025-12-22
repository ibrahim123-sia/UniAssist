import express from "express";
import {
  guestTextChatController,
  getGuestChatHistory,
  clearGuestSession
} from "../controllers/guestChatController.js";

const router = express.Router();

// Guest chat route (no authentication required)
router.post("/chat", guestTextChatController); // Send message
router.get("/history", getGuestChatHistory); // Get chat history
router.post("/clear", clearGuestSession); // Clear session

export default router;