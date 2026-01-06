// controllers/guestController.js
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import os from "os";
import { fileURLToPath } from "url";
import fetch from "node-fetch";
import { AssemblyAI } from 'assemblyai';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Python FastAPI backend URL
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || "http://localhost:8000";

// Initialize AssemblyAI for guest voice transcription
const assemblyClient = process.env.ASSEMBLYAI_API_KEY ? new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY,
}) : null;

// In-memory storage for guest sessions
const guestSessions = new Map();
const GUEST_SESSION_EXPIRY = 60 * 60 * 1000; // 1 hour

// Helper function to call Python backend
async function getPythonBackendResponse(question) {
  try {
    console.log(`📡 Calling Python backend at: ${PYTHON_BACKEND_URL}/ask`);
    
    const response = await fetch(`${PYTHON_BACKEND_URL}/ask`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question }),
      timeout: 30000, // 30 second timeout
    });

    if (!response.ok) {
      throw new Error(`Python backend responded with status: ${response.status}`);
    }

    const data = await response.json();
    return data.answer || "No response from Python backend";
  } catch (error) {
    console.error("❌ Error calling Python backend:", error.message);
    throw new Error(`Failed to get response from Python backend: ${error.message}`);
  }
}

// Get or create guest session
const getOrCreateGuestSession = (sessionId) => {
  if (!guestSessions.has(sessionId)) {
    guestSessions.set(sessionId, {
      id: sessionId,
      messages: [],
      createdAt: Date.now(),
      lastActivity: Date.now()
    });
  }
  
  const session = guestSessions.get(sessionId);
  session.lastActivity = Date.now();
  
  // Cleanup old sessions periodically
  cleanupOldSessions();
  
  return session;
};

// Cleanup expired sessions
const cleanupOldSessions = () => {
  const now = Date.now();
  for (const [sessionId, session] of guestSessions.entries()) {
    if (now - session.lastActivity > GUEST_SESSION_EXPIRY) {
      guestSessions.delete(sessionId);
    }
  }
};

// Helper function to save base64 audio to temporary file
const saveBase64ToTempFile = (base64Data, fileExtension = "webm") => {
  try {
    const base64String = base64Data.includes('base64,') 
      ? base64Data.split('base64,')[1] 
      : base64Data;
    
    const filename = `guest_audio_${uuidv4()}.${fileExtension}`;
    const tempDir = os.tmpdir();
    const filePath = path.join(tempDir, filename);
    
    fs.writeFileSync(filePath, base64String, 'base64');
    return filePath;
  } catch (error) {
    console.error("Error saving base64 to file:", error);
    throw new Error("Failed to save audio file");
  }
};

// Clean up temp files
const cleanupTempFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    try {
      fs.unlinkSync(filePath);
    } catch (error) {
      console.error("Error cleaning up temp file:", error.message);
    }
  }
};

// Validate audio quality
const validateAudioQuality = (audioPath) => {
  try {
    const stats = fs.statSync(audioPath);
    
    if (stats.size < 1024) {
      return { 
        valid: false, 
        error: "Audio file is too small. Please speak longer (at least 2-3 seconds)."
      };
    }
    
    if (stats.size > 5 * 1024 * 1024) {
      return { 
        valid: false, 
        error: "Audio file is too large. Maximum size is 5MB."
      };
    }
    
    return { valid: true };
  } catch (error) {
    return { valid: false, error: "Failed to validate audio file" };
  }
};

// Transcribe audio using AssemblyAI
async function transcribeWithAssemblyAI(audioPath) {
  try {
    console.log("=== ASSEMBLYAI TRANSCRIPTION START ===");
    
    if (!fs.existsSync(audioPath)) {
      return { 
        success: false, 
        error: "Audio file not found"
      };
    }
    
    // Upload file to AssemblyAI
    const audioUrl = await assemblyClient.files.upload(audioPath);
    
    // Transcribe
    const transcript = await assemblyClient.transcripts.transcribe({
      audio: audioUrl,
    });
    
    if (transcript.text && transcript.text.trim()) {
      const transcribedText = transcript.text.trim();
      console.log("✅ AssemblyAI transcription completed!");
      console.log("Text:", transcribedText);
      
      return {
        success: true,
        text: transcribedText,
        service: "assemblyai",
        language: transcript.language_code
      };
    } else {
      return {
        success: false,
        error: "AssemblyAI returned empty transcription"
      };
    }
  } catch (error) {
    console.error("💥 AssemblyAI transcription error:", error.message);
    
    return { 
      success: false, 
      error: `Transcription failed: ${error.message}`
    };
  }
}

// Simple fallback transcription
async function transcribeWithBasicFallback(audioPath) {
  try {
    const stats = fs.statSync(audioPath);
    const sizeKB = Math.round(stats.size / 1024);
    
    const placeholderText = `[Voice message received (${sizeKB}KB). Please try sending your message as text.]`;
    
    return {
      success: true,
      text: placeholderText,
      isFallback: true,
      service: "basic-fallback"
    };
  } catch (error) {
    return {
      success: false,
      error: "Fallback transcription failed"
    };
  }
}

// Guest text chat controller (UNLIMITED MESSAGES) - USING PYTHON BACKEND
export const guestTextChatController = async (req, res) => {
  try {
    const { message, sessionId = `guest_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` } = req.body;

    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Message is required and must be a non-empty string.",
      });
    }

    // Get or create guest session
    const session = getOrCreateGuestSession(sessionId);
    
    // Add user message to session
    session.messages.push({
      type: "text",
      role: "user",
      content: message.trim(),
      timestamp: Date.now(),
    });

    // Get response from Python backend
    console.log(`🤖 Guest sending to Python backend: "${message}"`);
    let botReply;
    try {
      botReply = await getPythonBackendResponse(message);
    } catch (error) {
      console.error("Failed to get response from Python backend:", error.message);
      botReply = "Sorry, I'm unable to connect to the university knowledge base at the moment. Please try again later.";
    }

    // Add bot response to session
    session.messages.push({
      type: "text",
      role: "assistant",
      content: botReply,
      timestamp: Date.now(),
    });

    // Save session
    guestSessions.set(sessionId, session);

    // Send response
    res.json({
      success: true,
      reply: {
        type: "text",
        role: "assistant",
        content: botReply,
        timestamp: Date.now(),
      },
      sessionId: sessionId,
      totalMessages: session.messages.length / 2, // Counts both user and bot messages
      note: "Guest users have unlimited text messages. Sign up for voice chat, email drafting, and saved chat history.",
      source: "python_backend"
    });

  } catch (error) {
    console.error("Guest chat error:", error.message);
    
    res.status(500).json({
      success: false,
      message: "Sorry, there was an error processing your request. Please try again.",
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
};

// Guest voice chat controller
export const guestVoiceChatController = async (req, res) => {
  let tempFilePath = null;
  
  try {
    const { audioUrl, duration, fileSize, sessionId = `guest_voice_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` } = req.body;

    if (!audioUrl) {
      return res.status(400).json({
        success: false,
        message: "Audio data is required",
      });
    }

    if (!audioUrl.startsWith('data:audio/')) {
      return res.status(400).json({
        success: false,
        message: "Invalid audio format. Expected base64 audio data.",
      });
    }

    // Get or create guest session
    const session = getOrCreateGuestSession(sessionId);

    console.log("=== GUEST VOICE MESSAGE PROCESSING START ===");

    // Determine file extension
    let fileExtension = 'webm';
    const mimeMatch = audioUrl.match(/data:audio\/([^;]+);/);
    if (mimeMatch) {
      const mimeType = mimeMatch[1];
      if (mimeType.includes('wav')) fileExtension = 'wav';
      else if (mimeType.includes('mp3')) fileExtension = 'mp3';
      else if (mimeType.includes('ogg')) fileExtension = 'ogg';
      else if (mimeType.includes('m4a')) fileExtension = 'm4a';
    }

    // Save to temp file
    tempFilePath = saveBase64ToTempFile(audioUrl, fileExtension);
    
    // Validate audio
    const validation = validateAudioQuality(tempFilePath);
    if (!validation.valid) {
      return res.status(400).json({
        success: false,
        message: validation.error,
      });
    }

    // Transcribe with AssemblyAI or fallback
    let transcription;
    if (assemblyClient) {
      transcription = await transcribeWithAssemblyAI(tempFilePath);
    }
    
    // If AssemblyAI fails or not available, use fallback
    if (!assemblyClient || !transcription || !transcription.success) {
      transcription = await transcribeWithBasicFallback(tempFilePath);
      
      if (!transcription.success) {
        return res.status(500).json({
          success: false,
          message: "Failed to process voice message. Please try again or use text input.",
        });
      }
    }

    const transcribedText = transcription.text.trim();
    
    // Enhanced validation for transcribed text
    if (!transcribedText || transcribedText === "") {
      return res.status(400).json({
        success: false,
        message: "No speech detected in your recording. Please speak clearly and try again.",
      });
    }

    // Check if transcription is just fallback placeholder
    if (transcription.isFallback && transcribedText.includes('[Voice message received')) {
      return res.status(400).json({
        success: false,
        message: "Could not transcribe voice message. Please speak more clearly or try text input.",
        suggestion: "Speak louder and more clearly, or reduce background noise."
      });
    }

    console.log("✅ Guest transcription completed:", transcribedText);

    // Create user voice message
    const userMessage = {
      type: "voice",
      role: "user",
      content: transcribedText,
      voiceMeta: {
        duration: duration || 0,
        fileSize: fileSize || 0,
        wasTranscribed: true,
        transcriptionService: transcription.service || "unknown",
        isFallback: transcription.isFallback || false,
        audioFormat: fileExtension,
      },
      timestamp: Date.now(),
    };
    
    // Add user voice message to session
    session.messages.push(userMessage);

    // Get response from Python backend
    console.log(`🤖 Guest voice sending to Python backend: "${transcribedText}"`);
    let aiResponse = "";
    try {
      aiResponse = await getPythonBackendResponse(transcribedText);
    } catch (error) {
      console.error("Python backend Error:", error.message);
      aiResponse = "I received your voice message, but I'm having trouble accessing the knowledge base. Please try again or use text input.";
    }

    const reply = {
      type: "text",
      role: "assistant",
      content: aiResponse,
      timestamp: Date.now(),
      isVoiceResponse: true,
    };

    // Save AI response
    session.messages.push(reply);
    
    // Save session
    guestSessions.set(sessionId, session);

    console.log("=== GUEST VOICE MESSAGE PROCESSING COMPLETE ===");
    
    // Send response
    res.json({
      success: true,
      reply: reply,
      transcription: transcribedText,
      transcriptionDetails: {
        service: transcription.service,
        isFallback: transcription.isFallback || false,
        audioFormat: fileExtension,
      },
      sessionId: sessionId,
      totalMessages: session.messages.length / 2,
      source: "python_backend",
      message: "Voice message processed successfully",
      note: "Guest users have unlimited text and voice messages. Sign up for email drafting and saved chat history."
    });

  } catch (error) {
    console.error("Guest voice message processing error:", error.message);
    res.status(500).json({
      success: false,
      message: "Error processing voice message: " + error.message,
    });
  } finally {
    // Clean up temporary file
    if (tempFilePath) {
      cleanupTempFile(tempFilePath);
    }
  }
};

// Guest email drafting controller
export const guestEmailController = async (req, res) => {
  try {
    const { prompt, recipient, subject, sessionId = `guest_email_${Date.now()}_${Math.random().toString(36).substr(2, 9)}` } = req.body;

    if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: "Prompt is required for email drafting.",
      });
    }

    // Get or create guest session
    const session = getOrCreateGuestSession(sessionId);
    
    // Add user message to session
    session.messages.push({
      type: "email",
      role: "user",
      content: prompt.trim(),
      emailData: {
        recipient: recipient || "",
        subject: subject || "",
        isSent: false,
      },
      timestamp: Date.now(),
    });

    // For email generation, format the prompt for the Python backend
    const emailPrompt = `Please help draft an email based on: ${prompt}
    Recipient: ${recipient || "Not specified"}
    Subject: ${subject || "No subject"}
    Please format the email professionally with salutation, body, and closing.`;
    
    console.log(`📧 Guest sending email request to Python backend: "${emailPrompt}"`);
    
    let aiResponse;
    try {
      aiResponse = await getPythonBackendResponse(emailPrompt);
    } catch (error) {
      console.error("Failed to get email response from Python backend:", error.message);
      aiResponse = "Sorry, I'm unable to draft emails at the moment. Please try again later.";
    }

    const reply = {
      type: "email",
      role: "assistant",
      content: aiResponse,
      emailData: {
        recipient: recipient || "",
        subject: subject || "Drafted Email",
        isSent: false,
      },
      timestamp: Date.now(),
    };

    // Save AI response
    session.messages.push(reply);
    
    // Save session
    guestSessions.set(sessionId, session);

    res.json({ 
      success: true, 
      reply,
      sessionId: sessionId,
      totalMessages: session.messages.length / 2,
      source: "python_backend",
      note: "Guest email drafting is available. Sign up to send emails and save them to your account."
    });

  } catch (error) {
    console.error("Error in guest email controller:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Error generating email",
    });
  }
};

// Get guest chat history
export const getGuestChatHistory = async (req, res) => {
  try {
    const { sessionId } = req.query;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required.",
      });
    }

    const session = guestSessions.get(sessionId);
    
    if (!session) {
      return res.status(404).json({
        success: false,
        message: "Session not found or expired.",
      });
    }

    res.json({
      success: true,
      sessionId: sessionId,
      messages: session.messages,
      createdAt: session.createdAt,
      lastActivity: session.lastActivity,
      messageCount: session.messages.length,
      sessionAge: Date.now() - session.createdAt,
      willExpireIn: GUEST_SESSION_EXPIRY - (Date.now() - session.lastActivity)
    });

  } catch (error) {
    console.error("Get guest history error:", error.message);
    res.status(500).json({
      success: false,
      message: "Error retrieving chat history.",
    });
  }
};

// Clear guest session
export const clearGuestSession = async (req, res) => {
  try {
    const { sessionId } = req.body;

    if (!sessionId) {
      return res.status(400).json({
        success: false,
        message: "Session ID is required.",
      });
    }

    if (guestSessions.has(sessionId)) {
      guestSessions.delete(sessionId);
    }

    res.json({
      success: true,
      message: "Session cleared successfully.",
    });

  } catch (error) {
    console.error("Clear session error:", error.message);
    res.status(500).json({
      success: false,
      message: "Error clearing session.",
    });
  }
};

// Guest health check
export const guestHealthCheck = async (req, res) => {
  try {
    // Test Python backend connection
    let pythonBackendHealthy = false;
    try {
      const testResponse = await fetch(`${PYTHON_BACKEND_URL}/ask`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ question: "test" }),
        timeout: 5000,
      });
      pythonBackendHealthy = testResponse.ok;
    } catch (error) {
      console.error("Python backend health check failed:", error.message);
    }
    
    const health = {
      pythonBackend: pythonBackendHealthy,
      pythonBackendUrl: PYTHON_BACKEND_URL,
      assemblyAI: !!assemblyClient,
      guestSessions: guestSessions.size,
      sessionExpiryMinutes: GUEST_SESSION_EXPIRY / (60 * 1000),
      timestamp: new Date().toISOString(),
      supportedFeatures: ["text_chat", "voice_chat", "email_drafting"],
      limits: {
        textMessages: "unlimited",
        voiceMessages: "unlimited",
        emailDrafts: "unlimited",
        sessionDuration: "1 hour"
      }
    };
    
    res.json({
      success: true,
      health,
      message: pythonBackendHealthy 
        ? "Guest services operational" 
        : "Python backend connection issue"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Guest health check failed"
    });
  }
};

// Cleanup all expired sessions (admin/cron endpoint)
export const cleanupAllGuestSessions = async (req, res) => {
  try {
    const beforeCount = guestSessions.size;
    cleanupOldSessions();
    const afterCount = guestSessions.size;
    const cleaned = beforeCount - afterCount;
    
    res.json({
      success: true,
      message: `Cleaned up ${cleaned} expired guest sessions.`,
      stats: {
        before: beforeCount,
        after: afterCount,
        cleaned: cleaned
      }
    });
  } catch (error) {
    console.error("Cleanup all sessions error:", error.message);
    res.status(500).json({
      success: false,
      message: "Error cleaning up sessions",
    });
  }
};

export default {
  guestTextChatController,
  guestVoiceChatController,
  guestEmailController,
  getGuestChatHistory,
  clearGuestSession,
  guestHealthCheck,
  cleanupAllGuestSessions
};