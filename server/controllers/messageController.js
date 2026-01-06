import Chat from "../models/Chat.js";
import User from "../models/User.js";
import { AssemblyAI } from 'assemblyai';
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";
import fetch from "node-fetch"; // You might need to install this: npm install node-fetch

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Initialize APIs - Remove Groq, add Python backend URL
const assemblyClient = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY,
});

// Python FastAPI backend URL
const PYTHON_BACKEND_URL = process.env.PYTHON_BACKEND_URL || "http://localhost:8000";

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

// Text Message Controller - UPDATED TO USE PYTHON BACKEND
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

    // Get response from Python backend
    console.log(`🤖 Sending to Python backend: "${prompt}"`);
    let replyContent;
    try {
      replyContent = await getPythonBackendResponse(prompt);
    } catch (error) {
      console.error("Failed to get response from Python backend:", error.message);
      replyContent = "Sorry, I'm unable to connect to the university knowledge base at the moment. Please try again later.";
    }

    const reply = {
      type: "text",
      role: "assistant",
      content: replyContent,
      timestamp: Date.now(),
    };

    // Save AI response
    chat.messages.push(reply);
    await chat.save();

    // Update chat title if this is the first real message
    if (chat.messages.filter(m => m.role === "user").length === 1) {
      // Use first 5 words of the question as title
      const title = prompt.split(' ').slice(0, 5).join(' ') + (prompt.split(' ').length > 5 ? '...' : '');
      chat.title = title;
      await chat.save();
    }

    // Deduct credits
    await User.updateOne({ _id: userId }, { $inc: { credits: -1 } });

    res.json({ 
      success: true, 
      reply,
      userMessage: userMessage,
      source: "python_backend"
    });

  } catch (error) {
    console.error("Error in textMessageController:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Error processing your request",
    });
  }
};

// Email Message Controller - You can keep using Groq or modify for Python backend
// For now, I'll show how to modify it for Python backend too
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

    // For email generation, you might want to create a separate endpoint in Python
    // For now, we'll use the same /ask endpoint with modified prompt
    const emailPrompt = `Please help draft an email based on: ${prompt}
    Recipient: ${recipient || "Not specified"}
    Subject: ${subject || "No subject"}
    Please format the email professionally with salutation, body, and closing.`;
    
    console.log(`📧 Sending email request to Python backend: "${emailPrompt}"`);
    
    let replyContent;
    try {
      replyContent = await getPythonBackendResponse(emailPrompt);
    } catch (error) {
      console.error("Failed to get email response from Python backend:", error.message);
      replyContent = "Sorry, I'm unable to draft emails at the moment. Please try again later.";
    }

    const reply = {
      type: "email",
      role: "assistant",
      content: replyContent,
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
      userMessage: userMessage,
      source: "python_backend"
    });

  } catch (error) {
    console.error("Error in emailMessageController:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Error generating email",
    });
  }
};

// Voice Message Controller - UPDATED TO USE PYTHON BACKEND
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
    
    // Get response from Python backend
    console.log(`🤖 Sending voice transcription to Python backend: "${transcribedText}"`);
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
    chat.messages.push(reply);
    
    // Save chat once with both messages
    await chat.save();

    // Update chat title if this is the first real message
    if (chat.messages.filter(m => m.role === "user" && !m.content.includes("[Processing")).length === 1) {
      // Use first few words as title
      chat.title = transcribedText.split(' ').slice(0, 5).join(' ') + (transcribedText.split(' ').length > 5 ? '...' : '');
      await chat.save();
    }

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
      source: "python_backend",
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

// Health check - Updated to check Python backend
export const transcriptionHealth = async (req, res) => {
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
      assemblyAI: !!process.env.ASSEMBLYAI_API_KEY,
      timestamp: new Date().toISOString(),
      audioFormats: ["webm", "wav", "mp3", "ogg", "m4a"]
    };
    
    res.json({
      success: true,
      health,
      message: pythonBackendHealthy 
        ? "All systems operational" 
        : "Python backend connection issue"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Health check failed"
    });
  }
};

// You might also want to add a direct test endpoint
export const testPythonBackend = async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question) {
      return res.status(400).json({
        success: false,
        message: "Question is required"
      });
    }
    
    const response = await getPythonBackendResponse(question);
    
    res.json({
      success: true,
      question,
      response,
      source: "python_backend"
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
};

export default {
  textMessageController,
  emailMessageController,
  voiceMessageController,
  transcriptionHealth,
  testPythonBackend
};