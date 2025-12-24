import Chat from "../models/Chat.js";
import User from "../models/User.js";
import Groq from "groq-sdk";
import { AssemblyAI } from 'assemblyai';
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize APIs
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

const assemblyClient = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY,
});

// Constants
const GROQ_MODELS = {
  DEFAULT: "llama-3.1-8b-instant",
  SMART: "mixtral-8x7b-32768",
};

// Helper function to save base64 audio to temporary file
const saveBase64ToTempFile = (base64Data, fileExtension = "webm") => {
  try {
    const base64String = base64Data.includes('base64,') 
      ? base64Data.split('base64,')[1] 
      : base64Data;
    
    const filename = `audio_${uuidv4()}.${fileExtension}`;
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

// Text Message Controller
export const textMessageController = async (req, res) => {
  try {
    const userId = req.user._id;

    if (req.user.credits < 1) {
      return res.json({
        success: false,
        message: "Insufficient credits. Please purchase more credits.",
      });
    }

    const { chatId, prompt } = req.body;

    const chat = await Chat.findOne({ userId, _id: chatId });
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    // Add user message
    const userMessage = {
      type: "text",
      role: "user",
      content: prompt,
      timestamp: Date.now(),
    };
    chat.messages.push(userMessage);
    await chat.save();

    // Get AI response
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are UniAssist, a helpful university assistant for MAJU University. 
          Help students with academic queries, course information, assignment help, 
          email drafting, and university procedures. Be concise and accurate.`,
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      model: GROQ_MODELS.DEFAULT,
      temperature: 0.7,
      max_tokens: 1024,
      stream: false,
    });

    const reply = {
      type: "text",
      role: "assistant",
      content: completion.choices[0]?.message?.content || "No response generated.",
      timestamp: Date.now(),
    };

    // Save AI response
    chat.messages.push(reply);
    await chat.save();

    // Deduct credits
    await User.updateOne({ _id: userId }, { $inc: { credits: -1 } });

    res.json({ 
      success: true, 
      reply,
      userMessage: userMessage
    });

  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Error processing your request",
    });
  }
};

// Email Message Controller
export const emailMessageController = async (req, res) => {
  try {
    const userId = req.user._id;

    if (req.user.credits < 2) {
      return res.json({
        success: false,
        message: "Insufficient credits for email generation.",
      });
    }

    const { chatId, prompt, recipient, subject } = req.body;

    const chat = await Chat.findOne({ userId, _id: chatId });
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    // Add user message
    const userMessage = {
      type: "email",
      role: "user",
      content: prompt,
      emailData: {
        recipient: recipient || "",
        subject: subject || "",
        isSent: false,
      },
      timestamp: Date.now(),
    };
    chat.messages.push(userMessage);
    await chat.save();

    // Generate email
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: "system",
          content: `You are an email drafting assistant for university students.
          Draft professional emails for professors, administration, or other students.
          Include proper salutations, clear subject, professional tone, and closing remarks.
          Format the email properly with paragraphs.
          Provide ONLY the email content without explanations.`,
        },
        {
          role: "user",
          content: `Draft an email based on: ${prompt}\nRecipient: ${
            recipient || "Not specified"
          }\nSubject: ${subject || "No subject"}`,
        },
      ],
      model: GROQ_MODELS.DEFAULT,
      temperature: 0.7,
      max_tokens: 2048,
      stream: false,
    });

    const reply = {
      type: "email",
      role: "assistant",
      content: completion.choices[0]?.message?.content || "No email generated.",
      emailData: {
        recipient: recipient || "",
        subject: subject || "Drafted Email",
        isSent: false,
      },
      timestamp: Date.now(),
    };

    // Save AI response
    chat.messages.push(reply);
    await chat.save();

    // Deduct credits
    await User.updateOne({ _id: userId }, { $inc: { credits: -2 } });

    res.json({ 
      success: true, 
      reply,
      userMessage: userMessage
    });

  } catch (error) {
    console.error("Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Error generating email",
    });
  }
};

// Voice Message Controller using AssemblyAI
export const voiceMessageController = async (req, res) => {
  let tempFilePath = null;
  
  try {
    const userId = req.user._id;

    if (req.user.credits < 3) {
      return res.json({
        success: false,
        message: "Insufficient credits for voice processing. Voice messages require 3 credits.",
      });
    }

    const { chatId, audioUrl, duration, fileSize } = req.body;

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

    const chat = await Chat.findOne({ userId, _id: chatId });
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    console.log("=== VOICE MESSAGE PROCESSING START ===");

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

    // Transcribe with AssemblyAI
    let transcription = await transcribeWithAssemblyAI(tempFilePath);
    
    // If AssemblyAI fails, use fallback
    if (!transcription.success) {
      transcription = await transcribeWithBasicFallback(tempFilePath);
      
      if (!transcription.success) {
        return res.status(500).json({
          success: false,
          message: "Failed to process voice message. Please try again or use text input.",
        });
      }
    }

    const transcribedText = transcription.text.trim();
    
    if (!transcribedText || transcribedText === "") {
      return res.status(400).json({
        success: false,
        message: "No speech detected in your recording. Please speak clearly and try again.",
      });
    }

    console.log("✅ Transcription completed:", transcribedText);

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
    
    // Add user voice message to chat
    chat.messages.push(userMessage);
    await chat.save();

    // Generate AI response
    let aiResponse = "";
    try {
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: `You are UniAssist, an AI assistant for MAJU University students.
               The user sent a voice message. Here's what they said:
               
               "${transcribedText}"
               
               Respond helpfully and naturally to their voice message.
               Keep your response concise and relevant to their query.`,
          },
          {
            role: "user",
            content: transcribedText,
          },
        ],
        model: GROQ_MODELS.DEFAULT,
        temperature: 0.7,
        max_tokens: 1024,
        stream: false,
      });
      
      aiResponse = completion.choices[0]?.message?.content ||
        "I received your voice message! How can I help you with this?";
    } catch (error) {
      console.error("Groq API Error:", error.message);
      aiResponse = "I received your voice message. How can I assist you further?";
    }

    const reply = {
      type: "text",
      role: "assistant",
      content: aiResponse,
      timestamp: Date.now(),
      isVoiceResponse: true,
    };

    // Save AI response
    chat.messages.push(reply);
    await chat.save();

    // Deduct credits
    const creditsToDeduct = transcription.isFallback ? 1 : 3;
    await User.updateOne({ _id: userId }, { $inc: { credits: -creditsToDeduct } });

    console.log("=== VOICE MESSAGE PROCESSING COMPLETE ===");
    
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
      creditsUsed: creditsToDeduct,
      message: "Voice message processed successfully",
    });

  } catch (error) {
    console.error("Voice message processing error:", error.message);
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

// Health check
export const transcriptionHealth = async (req, res) => {
  try {
    const health = {
      groq: !!process.env.GROQ_API_KEY,
      assemblyAI: !!process.env.ASSEMBLYAI_API_KEY,
      timestamp: new Date().toISOString(),
      models: GROQ_MODELS,
      audioFormats: ["webm", "wav", "mp3", "ogg", "m4a"]
    };
    
    res.json({
      success: true,
      health,
      message: "Transcription services health check"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Health check failed"
    });
  }
};

export default {
  textMessageController,
  emailMessageController,
  voiceMessageController,
  transcriptionHealth
};