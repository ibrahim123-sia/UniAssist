import express from 'express'
import { 
  textMessageController,
    emailMessageController,
    voiceMessageController,
    transcriptionHealth
} from '../controllers/messageController.js'
import { protect } from '../middlewares/auth.js'

const messageRouter = express.Router()

// Apply protection to all routes
messageRouter.use(protect)

// Text messages (1 credit)
messageRouter.post('/text', textMessageController)

// Email messages (2 credits)
messageRouter.post('/email', emailMessageController)

// Voice messages with Groq transcription (3 credits) - MAIN ENDPOINT
messageRouter.post('/voice', voiceMessageController)

// Health check
messageRouter.get('/health', transcriptionHealth)

export default messageRouter