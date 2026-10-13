import express from 'express'
import {
  textMessageController,
  emailMessageController,
  voiceMessageController,
  transcribeMessageController,
  transcriptionHealth
} from '../controllers/messageController.js'
import { protect } from '../middlewares/auth.js'
import { userChatLimiter } from '../middlewares/rateLimit.js'

const messageRouter = express.Router()

// Audio arrives as a base64 data URL (5MB audio ≈ 6.7MB base64), so only the
// voice routes get a body limit larger than the app-wide default.
const audioJson = express.json({ limit: '8mb' })

messageRouter.use(protect)

messageRouter.post('/text', userChatLimiter, textMessageController)
messageRouter.post('/email', userChatLimiter, emailMessageController)
messageRouter.post('/voice', audioJson, userChatLimiter, voiceMessageController)
// Transcribe only — returns text for the user to review/edit before sending
messageRouter.post('/transcribe', audioJson, userChatLimiter, transcribeMessageController)
// Health check
messageRouter.get('/health', transcriptionHealth)

export default messageRouter
