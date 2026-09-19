import express from 'express'
import {
  textMessageController,
    emailMessageController,
    voiceMessageController,
    transcribeMessageController,
    transcriptionHealth
} from '../controllers/messageController.js'
import { protect } from '../middlewares/auth.js'

const messageRouter = express.Router()

// Apply protection to all routes
messageRouter.use(protect)

messageRouter.post('/text', textMessageController)

messageRouter.post('/email', emailMessageController)

messageRouter.post('/voice', voiceMessageController)

// Transcribe only — returns text for the user to review/edit before sending
messageRouter.post('/transcribe', transcribeMessageController)

// Health check
messageRouter.get('/health', transcriptionHealth)

export default messageRouter