import express from 'express'
import { 
  textMessageController, 
  emailMessageController, 
  voiceMessageController,
  uploadAudio,
  testTranscription,
  quickVoiceResponse,
  transcribeOnlyController
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

// Simple transcription only endpoint (for testing)
messageRouter.post('/transcribe', transcribeOnlyController)

// Audio upload validation endpoint
messageRouter.post('/upload-audio', uploadAudio)

// Test endpoint for AssemblyAI
messageRouter.get('/test-transcription', testTranscription)

// Quick voice response (for testing without AssemblyAI)
messageRouter.post('/quick-voice', quickVoiceResponse)

export default messageRouter