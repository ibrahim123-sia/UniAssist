import express from 'express'
import { 
  textMessageController, 
  emailMessageController, 
  voiceMessageController,
  uploadAudio
} from '../controllers/messageController.js'
import { protect } from '../middlewares/auth.js'

const messageRouter = express.Router()

// Apply protection to all routes
messageRouter.use(protect)

// Text messages (1 credit)
messageRouter.post('/text', textMessageController)

// Email messages (2 credits)
messageRouter.post('/email', emailMessageController)

// Voice messages with AssemblyAI transcription (3 credits) - MAIN ENDPOINT
messageRouter.post('/voice', voiceMessageController)

// Audio upload validation endpoint
messageRouter.post('/upload-audio', uploadAudio)

export default messageRouter