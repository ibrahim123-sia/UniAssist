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

messageRouter.post('/text', textMessageController)

messageRouter.post('/email', emailMessageController)

messageRouter.post('/voice', voiceMessageController)

// Health check
messageRouter.get('/health', transcriptionHealth)

export default messageRouter