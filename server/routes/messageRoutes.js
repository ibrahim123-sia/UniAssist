import express from 'express'
import { 
  textMessageController, 
  emailMessageController, 
  voiceMessageController,
  uploadAudio
} from '../controllers/messageController.js'
import { protect } from '../middlewares/auth.js'

const messageRouter = express.Router()

// Text messages
messageRouter.post('/text', protect, textMessageController)

// Email messages
messageRouter.post('/email', protect, emailMessageController)

// Voice messages (with AssemblyAI transcription)
messageRouter.post('/voice', protect, voiceMessageController)

// Audio upload endpoint (optional)
messageRouter.post('/upload-audio', protect, uploadAudio)

export default messageRouter