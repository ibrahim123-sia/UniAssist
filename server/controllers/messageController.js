import Chat from "../models/Chat.js";
import User from "../models/User.js";
import Groq from "groq-sdk";
import { AssemblyAI } from "assemblyai";
import { v4 as uuidv4 } from "uuid";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import os from "os";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || "your-groq-api-key",
});

// Initialize AssemblyAI with latest SDK
const client = new AssemblyAI({
  apiKey: process.env.ASSEMBLYAI_API_KEY || "your-assemblyai-api-key",
});

const GROQ_MODELS = {
  DEFAULT: "llama-3.1-8b-instant",
  FAST: "llama-3.2-1b-preview",
  SMART: "mixtral-8x7b-32768",
};

// Helper function to save base64 audio to temporary file
const saveBase64ToTempFile = (base64Data, fileExtension = "webm") => {
  try {
    // Remove data URL prefix if present
    const base64String = base64Data.includes('base64,') 
      ? base64Data.split('base64,')[1] 
      : base64Data;
    
    // Generate unique filename
    const filename = `audio_${uuidv4()}.${fileExtension}`;
    const tempDir = os.tmpdir();
    const filePath = path.join(tempDir, filename);
    
    // Save base64 to file
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
      console.log("Cleaned up temp file:", filePath);
    } catch (error) {
      console.error("Error cleaning up temp file:", error.message);
    }
  }
};

// Transcribe audio using AssemblyAI
async function transcribeAudio(audioPath) {
  try {
    console.log("Uploading audio to AssemblyAI...");
    const audioUrl = await client.files.upload(fs.readFileSync(audioPath));
    console.log("Audio uploaded to URL:", audioUrl);
    
    console.log("Starting transcription...");
    const transcript = await client.transcripts.transcribe({
      audio: audioUrl,
      language_code: "en",
    });
    
    console.log("Transcript created with ID:", transcript.id);
    
    // Wait for transcription to complete
    let transcriptData = transcript;
    let attempts = 0;
    const maxAttempts = 60; // 60 seconds max wait
    
    while (
      transcriptData.status !== 'completed' &&
      transcriptData.status !== 'error' &&
      attempts < maxAttempts
    ) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
      transcriptData = await client.transcripts.get(transcript.id);
      attempts++;
      console.log(`Polling transcription (${attempts}/${maxAttempts}): ${transcriptData.status}`);
    }
    
    if (transcriptData.status === 'completed' && transcriptData.text) {
      console.log("Transcription completed successfully!");
      return {
        success: true,
        text: transcriptData.text,
        language: transcriptData.language_code,
      };
    } else {
      const errorMsg = transcriptData.error || "Transcription timed out";
      console.error("Transcription failed:", errorMsg);
      return { 
        success: false, 
        error: errorMsg 
      };
    }
    
  } catch (error) {
    console.error("AssemblyAI transcription error:", error.message);
    return { 
      success: false, 
      error: error.message 
    };
  }
}

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

    // Save user message immediately
    await chat.save();

    // Call Groq API for response
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
      top_p: 0.9,
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

    // Send response with both messages
    res.json({ 
      success: true, 
      reply,
      userMessage: userMessage
    });

  } catch (error) {
    console.error("Groq API Error:", error.message);

    if (
      error.message.includes("decommissioned") ||
      error.message.includes("model not found")
    ) {
      return res.json({
        success: false,
        message: "Model configuration issue. Please try again or contact support.",
        error: "Model not available",
      });
    }

    res.status(500).json({
      success: false,
      message: error.message || "Error processing your request",
    });
  }
};

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

    // Call Groq API for email response
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
      top_p: 0.9,
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

    // Send response
    res.json({ 
      success: true, 
      reply,
      userMessage: userMessage
    });

  } catch (error) {
    console.error("Groq API Error:", error.message);
    res.status(500).json({
      success: false,
      message: error.message || "Error generating email",
    });
  }
};

// UPDATED VOICE MESSAGE CONTROLLER - Simplified and optimized
export const voiceMessageController = async (req, res) => {
  let tempFilePath = null;
  
  try {
    const userId = req.user._id;

    // Check credits - voice costs 3 credits
    if (req.user.credits < 3) {
      return res.json({
        success: false,
        message: "Insufficient credits for voice processing.",
      });
    }

    const { chatId, audioUrl, duration, fileSize } = req.body;

    if (!audioUrl) {
      return res.status(400).json({
        success: false,
        message: "Audio data is required",
      });
    }

    // Validate audioUrl format
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
    console.log("Audio data size:", audioUrl.length, "characters");
    console.log("Duration:", duration, "seconds");

    // Step 1: Determine file extension from MIME type
    let fileExtension = 'webm';
    const mimeType = audioUrl.match(/data:(audio\/[^;]+)/);
    if (mimeType) {
      const type = mimeType[1];
      if (type.includes('wav')) fileExtension = 'wav';
      else if (type.includes('mp3') || type.includes('mpeg')) fileExtension = 'mp3';
      else if (type.includes('ogg')) fileExtension = 'ogg';
      else if (type.includes('m4a')) fileExtension = 'm4a';
    }
    console.log("File extension:", fileExtension);

    // Step 2: Save base64 to temporary file
    tempFilePath = saveBase64ToTempFile(audioUrl, fileExtension);
    console.log("Audio saved to temp file:", tempFilePath);

    // Step 3: Transcribe audio using AssemblyAI
    console.log("Starting transcription...");
    const transcription = await transcribeAudio(tempFilePath);
    
    if (!transcription.success) {
      console.error("Transcription failed:", transcription.error);
      return res.status(500).json({
        success: false,
        message: "Failed to transcribe audio. Please try again.",
        error: transcription.error
      });
    }

    const transcribedText = transcription.text.trim();
    
    if (!transcribedText || transcribedText === "") {
      console.error("Transcription returned empty text");
      return res.status(500).json({
        success: false,
        message: "Audio transcription returned empty. Please speak clearly and try again.",
      });
    }

    console.log("Transcription successful!");
    console.log("Transcribed text:", transcribedText);

    // Step 4: Create user voice message object
    const userMessage = {
      type: "voice",
      role: "user",
      content: transcribedText,
      voiceMeta: {
        duration: duration || 0,
        fileSize: fileSize || 0,
        wasTranscribed: true,
        transcribedAt: new Date(),
      },
      timestamp: Date.now(),
    };
    
    // Add user voice message to chat
    chat.messages.push(userMessage);
    console.log("Saving user message to chat...");
    await chat.save();

    console.log("User voice message saved to chat successfully");

    // Step 5: Generate AI response based on transcription
    console.log("Generating AI response based on transcription...");
    
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
            If the transcription seems unclear, ask for clarification politely.
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
        top_p: 0.9,
        stream: false,
      });
      
      aiResponse = completion.choices[0]?.message?.content ||
        "I received your voice message! How can I help you with this?";
    } catch (groqError) {
      console.error("Groq API Error:", groqError.message);
      aiResponse = "I received your voice message, but I'm having trouble generating a detailed response right now. Please try again or rephrase your question.";
    }

    // Ensure aiResponse is not empty
    if (!aiResponse || aiResponse.trim() === "") {
      aiResponse = "I received your voice message! Please let me know how I can help you further.";
    }

    const reply = {
      type: "text",
      role: "assistant",
      content: aiResponse,
      timestamp: Date.now(),
      isVoiceResponse: true,
    };

    console.log("AI response generated successfully");
    
    // Save AI response
    chat.messages.push(reply);
    console.log("Saving AI response to chat...");
    await chat.save();

    // Deduct credits
    await User.updateOne({ _id: userId }, { $inc: { credits: -3 } });

    console.log("=== VOICE MESSAGE PROCESSING COMPLETE ===");
    
    // Send response
    res.json({
      success: true,
      reply: reply,
      userMessage: userMessage,
      transcription: transcribedText,
      message: "Voice message transcribed and processed successfully",
    });

  } catch (error) {
    console.error("=== VOICE MESSAGE PROCESSING ERROR ===");
    console.error("Error:", error.message);
    console.error("Error stack:", error.stack);
    
    // Check if headers already sent
    if (res.headersSent) {
      console.error("Headers already sent, cannot send error response");
      return;
    }
    
    res.status(500).json({
      success: false,
      message: "Error processing voice message: " + error.message,
      error: error.message,
    });
  } finally {
    // Clean up temporary file
    if (tempFilePath) {
      setTimeout(() => cleanupTempFile(tempFilePath), 1000);
    }
  }
};

// Audio upload validation endpoint
export const uploadAudio = async (req, res) => {
  try {
    const { audioUrl } = req.body;
    
    if (!audioUrl) {
      return res.status(400).json({
        success: false,
        message: "Audio data is required",
      });
    }

    // Validate base64 format
    if (!audioUrl.startsWith('data:audio/')) {
      return res.status(400).json({
        success: false,
        message: "Invalid audio format. Expected base64 audio data.",
      });
    }

    res.json({
      success: true,
      message: "Audio format is valid",
      audioSize: audioUrl.length,
    });

  } catch (error) {
    console.error("Audio upload validation error:", error);
    res.status(500).json({
      success: false,
      message: "Error validating audio",
    });
  }
};

// Get audio by message ID
export const getAudioMessage = async (req, res) => {
  try {
    const { chatId, messageId } = req.params;
    const userId = req.user._id;

    const chat = await Chat.findOne({ userId, _id: chatId });
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }

    // Find the voice message
    const voiceMessage = chat.messages.find(
      msg => msg._id.toString() === messageId && msg.type === "voice"
    );

    if (!voiceMessage) {
      return res.status(404).json({
        success: false,
        message: "Voice message not found",
      });
    }

    // Send the transcription data
    res.json({
      success: true,
      transcription: voiceMessage.content,
      voiceMeta: voiceMessage.voiceMeta,
      timestamp: voiceMessage.timestamp,
    });

  } catch (error) {
    console.error("Get audio error:", error);
    res.status(500).json({
      success: false,
      message: "Error retrieving audio message",
    });
  }
};

// Test endpoint for AssemblyAI
export const testTranscription = async (req, res) => {
  try {
    console.log("Testing AssemblyAI connection...");
    
    const testAudioUrl = "https://storage.googleapis.com/aai-web-samples/5_common_phrases.mp3";
    
    const transcript = await client.transcripts.transcribe({
      audio_url: testAudioUrl,
    });
    
    console.log("Test transcription ID:", transcript.id);
    
    // Wait for completion
    let result = transcript;
    let attempts = 0;
    while (result.status !== 'completed' && attempts < 10) {
      await new Promise(resolve => setTimeout(resolve, 1000));
      result = await client.transcripts.get(transcript.id);
      attempts++;
    }
    
    res.json({
      success: true,
      message: "AssemblyAI connection successful",
      status: result.status,
      text: result.text || "Still processing...",
      testId: transcript.id,
    });
  } catch (error) {
    console.error("AssemblyAI test failed:", error.message);
    res.json({
      success: false,
      message: "AssemblyAI test failed: " + error.message,
      error: error.message,
    });
  }
};

// Quick voice response (for testing without AssemblyAI)
export const quickVoiceResponse = async (req, res) => {
  try {
    const userId = req.user._id;
    
    if (req.user.credits < 2) {
      return res.json({
        success: false,
        message: "Insufficient credits",
      });
    }
    
    const { chatId, audioUrl, duration } = req.body;
    
    const chat = await Chat.findOne({ userId, _id: chatId });
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }
    
    // Mock transcription
    const mockTranscription = "This is a test voice message. [Voice-to-text transcription would appear here]";
    
    const userMessage = {
      type: "voice",
      role: "user",
      content: mockTranscription,
      voiceMeta: {
        duration: duration || 3,
        fileSize: (audioUrl?.length || 0) / (1024 * 1024),
        wasTranscribed: true,
        transcribedAt: new Date(),
      },
      timestamp: Date.now(),
    };
    
    chat.messages.push(userMessage);
    
    // Generate response
    const reply = {
      type: "text",
      role: "assistant",
      content: "I received your voice message! This is a test response. In production, your voice would be transcribed automatically.",
      timestamp: Date.now(),
      isVoiceResponse: true,
    };
    
    chat.messages.push(reply);
    await chat.save();
    
    // Deduct credits
    await User.updateOne({ _id: userId }, { $inc: { credits: -2 } });
    
    res.json({
      success: true,
      reply,
      userMessage: userMessage,
      transcription: mockTranscription,
      note: "This is a mock response for testing. Enable AssemblyAI for real transcription.",
    });
    
  } catch (error) {
    console.error("Quick voice error:", error);
    res.status(500).json({
      success: false,
      message: "Error in quick voice response",
    });
  }
};