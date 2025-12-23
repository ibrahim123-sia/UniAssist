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
  apiKey: process.env.GROQ_API_KEY,
});

// Initialize AssemblyAI with error handling
let assemblyClient = null;
try {
  // Use your actual API key directly for now
  const assemblyApiKey=process.env.ASSEMBLYAI_API_KEY;
  
  if (assemblyApiKey && assemblyApiKey.length === 32) {
    assemblyClient = new AssemblyAI({
      apiKey: assemblyApiKey,
    });
    console.log("✅ AssemblyAI client initialized successfully");
  } else {
    console.error("❌ Invalid AssemblyAI API key format");
  }
} catch (error) {
  console.error("❌ Failed to initialize AssemblyAI:", error.message);
}

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

// Transcribe audio using AssemblyAI - IMPROVED VERSION
async function transcribeAudio(audioPath) {
  if (!assemblyClient) {
    console.log("AssemblyAI client not available");
    return {
      success: false,
      error: "AssemblyAI service not available",
      isFallback: true
    };
  }

  try {
    console.log("=== TRANSCRIPTION START ===");
    console.log("Audio file:", audioPath);
    
    // Check file exists and has content
    if (!fs.existsSync(audioPath)) {
      console.error("Audio file does not exist");
      return { 
        success: false, 
        error: "Audio file not found" 
      };
    }
    
    const stats = fs.statSync(audioPath);
    console.log("File size:", stats.size, "bytes");
    console.log("File modified:", stats.mtime);
    
    if (stats.size < 100) {
      console.error("File is too small or empty");
      return { 
        success: false, 
        error: "Audio file is too small or empty" 
      };
    }
    
    // Read file
    const audioBuffer = fs.readFileSync(audioPath);
    console.log("Buffer size:", audioBuffer.length, "bytes");
    
    // Upload to AssemblyAI
    console.log("Uploading to AssemblyAI...");
    const audioUrl = await assemblyClient.files.upload(audioBuffer);
    console.log("Upload successful. Audio URL:", audioUrl);
    
    // Start transcription
    console.log("Starting transcription...");
    const transcript = await assemblyClient.transcripts.transcribe({
      audio: audioUrl,
      language_code: "en",
    });
    
    console.log("Transcript ID:", transcript.id);
    console.log("Initial status:", transcript.status);
    
    // Poll for completion
    let transcriptData = transcript;
    let attempts = 0;
    const maxAttempts = 30; // 60 seconds max (30 * 2 seconds)
    
    while (
      transcriptData.status !== 'completed' &&
      transcriptData.status !== 'error' &&
      attempts < maxAttempts
    ) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      transcriptData = await assemblyClient.transcripts.get(transcript.id);
      attempts++;
      console.log(`Polling (${attempts}/${maxAttempts}): ${transcriptData.status}`);
      
      if (transcriptData.status === 'error') {
        console.error("Transcription error:", transcriptData.error);
        break;
      }
    }
    
    if (transcriptData.status === 'completed') {
      console.log("✅ Transcription completed successfully!");
      console.log("Text length:", transcriptData.text?.length || 0, "characters");
      
      if (transcriptData.text && transcriptData.text.trim()) {
        return {
          success: true,
          text: transcriptData.text.trim(),
          language: transcriptData.language_code,
          confidence: transcriptData.confidence,
          words: transcriptData.words?.length || 0
        };
      } else {
        console.error("Transcription returned empty text");
        return { 
          success: false, 
          error: "Transcription returned empty text" 
        };
      }
    } else if (transcriptData.status === 'error') {
      const errorMsg = transcriptData.error || "Unknown transcription error";
      console.error("❌ Transcription failed:", errorMsg);
      return { 
        success: false, 
        error: errorMsg 
      };
    } else {
      console.error("⏰ Transcription timed out");
      return { 
        success: false, 
        error: "Transcription timed out after 60 seconds" 
      };
    }
    
  } catch (error) {
    console.error("💥 AssemblyAI transcription error:", error.message);
    console.error("Error details:", error);
    
    // Specific error handling
    if (error.message.includes("Authentication") || error.message.includes("401")) {
      return { 
        success: false, 
        error: "AssemblyAI authentication failed. Please check your API key." 
      };
    } else if (error.message.includes("network") || error.message.includes("ECONNREFUSED")) {
      return { 
        success: false, 
        error: "Network error. Please check your internet connection." 
      };
    } else if (error.message.includes("413") || error.message.includes("too large")) {
      return { 
        success: false, 
        error: "Audio file too large. Maximum size is 10MB." 
      };
    }
    
    return { 
      success: false, 
      error: `Transcription failed: ${error.message}` 
    };
  } finally {
    console.log("=== TRANSCRIPTION END ===");
  }
}

// Simple fallback transcription for testing
async function transcribeWithFallback(audioPath) {
  console.log("Using fallback transcription");
  
  try {
    const stats = fs.statSync(audioPath);
    const sizeKB = Math.round(stats.size / 1024);
    
    // Create a mock transcription based on file size
    const mockText = `This is a mock transcription of a ${sizeKB}KB audio file. 
    Since AssemblyAI transcription failed, this is a placeholder response.
    
    You said something in your voice message. Please try sending it again 
    or use text input for more reliable results.`;
    
    return {
      success: true,
      text: mockText,
      isFallback: true,
      note: "Mock transcription - AssemblyAI service unavailable"
    };
    
  } catch (error) {
    console.error("Fallback transcription error:", error);
    return {
      success: false,
      error: "Fallback transcription failed",
      isFallback: true
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

// UPDATED VOICE MESSAGE CONTROLLER - WITH PROPER ERROR HANDLING
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
    console.log("User ID:", userId);
    console.log("Chat ID:", chatId);
    console.log("Audio data length:", audioUrl.length, "characters");
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
      else if (type.includes('flac')) fileExtension = 'flac';
    }
    console.log("File extension:", fileExtension);

    // Step 2: Save base64 to temporary file
    tempFilePath = saveBase64ToTempFile(audioUrl, fileExtension);
    console.log("Audio saved to temp file:", tempFilePath);
    
    try {
      const stats = fs.statSync(tempFilePath);
      console.log("Actual file size:", stats.size, "bytes");
    } catch (fsError) {
      console.error("Error getting file stats:", fsError.message);
    }

    // Step 3: Try transcription with AssemblyAI
    console.log("\nAttempting AssemblyAI transcription...");
    let transcription = await transcribeAudio(tempFilePath);
    
    // Step 4: If AssemblyAI fails, use fallback
    if (!transcription.success && !transcription.isFallback) {
      console.log("\nAssemblyAI failed, trying fallback...");
      transcription = await transcribeWithFallback(tempFilePath);
    }
    
    if (!transcription.success) {
      console.error("All transcription attempts failed:", transcription.error);
      return res.status(500).json({
        success: false,
        message: "Failed to process voice message. Please try again or use text input.",
        error: transcription.error,
        suggestion: "Try recording a shorter message (5-10 seconds) first"
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

    console.log("\n✅ Transcription successful!");
    console.log("Text length:", transcribedText.length, "characters");
    console.log("Preview:", transcribedText.substring(0, 200) + "...");
    console.log("Is fallback?", transcription.isFallback || false);

    // Step 5: Create user voice message object
    const userMessage = {
      type: "voice",
      role: "user",
      content: transcribedText,
      voiceMeta: {
        duration: duration || 0,
        fileSize: fileSize || 0,
        wasTranscribed: true,
        transcriptionService: transcription.isFallback ? "fallback" : "assemblyai",
        transcribedAt: new Date(),
        confidence: transcription.confidence || null,
        wordCount: transcription.words || 0
      },
      timestamp: Date.now(),
    };
    
    // Add user voice message to chat
    chat.messages.push(userMessage);
    console.log("Saving user message to chat...");
    await chat.save();

    console.log("User voice message saved to chat successfully");

    // Step 6: Generate AI response based on transcription
    console.log("\nGenerating AI response...");
    
    let aiResponse = "";
    try {
      const systemPrompt = transcription.isFallback 
        ? `You are UniAssist, an AI assistant for MAJU University students.
           The user sent a voice message, but the transcription service had issues.
           Here's what was captured: "${transcribedText}"
           
           Please respond naturally and helpfully. If the transcription seems incomplete,
           ask them to clarify or try sending the message again.`
        : `You are UniAssist, an AI assistant for MAJU University students.
           The user sent a voice message. Here's what they said:
           
           "${transcribedText}"
           
           Respond helpfully and naturally to their voice message.
           Keep your response concise and relevant to their query.`;
      
      const completion = await groq.chat.completions.create({
        messages: [
          {
            role: "system",
            content: systemPrompt,
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

    console.log("✅ AI response generated");
    
    // Save AI response
    chat.messages.push(reply);
    console.log("Saving AI response to chat...");
    await chat.save();

    // Deduct credits (only 1 credit if using fallback)
    const creditsToDeduct = transcription.isFallback ? 1 : 3;
    await User.updateOne({ _id: userId }, { $inc: { credits: -creditsToDeduct } });

    console.log("=== VOICE MESSAGE PROCESSING COMPLETE ===");
    
    // Send response
    res.json({
      success: true,
      reply: reply,
      userMessage: userMessage,
      transcription: transcribedText,
      usedFallback: transcription.isFallback || false,
      creditsUsed: creditsToDeduct,
      message: "Voice message processed successfully",
    });

  } catch (error) {
    console.error("\n=== VOICE MESSAGE PROCESSING ERROR ===");
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
      cleanupTempFile(tempFilePath);
    }
  }
};

// Simple transcription endpoint for testing
export const transcribeOnlyController = async (req, res) => {
  let tempFilePath = null;
  
  try {
    const { audioUrl } = req.body;

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

    console.log("=== TRANSCRIPTION TEST ===");

    // Determine file extension
    let fileExtension = 'webm';
    const mimeType = audioUrl.match(/data:(audio\/[^;]+)/);
    if (mimeType) {
      const type = mimeType[1];
      if (type.includes('wav')) fileExtension = 'wav';
      else if (type.includes('mp3')) fileExtension = 'mp3';
      else if (type.includes('ogg')) fileExtension = 'ogg';
      else if (type.includes('m4a')) fileExtension = 'm4a';
    }

    // Save file
    tempFilePath = saveBase64ToTempFile(audioUrl, fileExtension);
    console.log("Test file saved:", tempFilePath);

    // Try transcription
    const transcription = await transcribeAudio(tempFilePath);
    
    if (!transcription.success) {
      // Try fallback
      const fallback = await transcribeWithFallback(tempFilePath);
      return res.json({
        success: fallback.success,
        transcription: fallback.text,
        isFallback: true,
        error: transcription.error,
        message: "Using fallback transcription"
      });
    }

    res.json({
      success: true,
      transcription: transcription.text,
      language: transcription.language,
      confidence: transcription.confidence,
      wordCount: transcription.words,
      message: "Audio transcribed successfully",
    });

  } catch (error) {
    console.error("Transcription test error:", error);
    res.status(500).json({
      success: false,
      message: "Error transcribing audio",
      error: error.message,
    });
  } finally {
    if (tempFilePath) {
      cleanupTempFile(tempFilePath);
    }
  }
};

// Test AssemblyAI connection
export const testTranscription = async (req, res) => {
  try {
    console.log("=== ASSEMBLYAI CONNECTION TEST ===");
    
    if (!assemblyClient) {
      return res.json({
        success: false,
        message: "AssemblyAI client not initialized",
        suggestion: "Check your API key and server logs"
      });
    }
    
    const testAudioUrl = "https://storage.googleapis.com/aai-web-samples/5_common_phrases.mp3";
    console.log("Testing with sample audio:", testAudioUrl);
    
    const transcript = await assemblyClient.transcripts.transcribe({
      audio_url: testAudioUrl,
    });
    
    console.log("Transcript ID:", transcript.id);
    console.log("Initial status:", transcript.status);
    
    // Quick poll
    let result = transcript;
    let attempts = 0;
    while (result.status !== 'completed' && result.status !== 'error' && attempts < 5) {
      await new Promise(resolve => setTimeout(resolve, 2000));
      result = await assemblyClient.transcripts.get(transcript.id);
      attempts++;
      console.log(`Poll ${attempts}: ${result.status}`);
    }
    
    res.json({
      success: true,
      message: "AssemblyAI connection successful",
      status: result.status,
      text: result.text ? result.text.substring(0, 100) + "..." : "Processing...",
      testId: transcript.id,
      clientStatus: "Initialized"
    });
  } catch (error) {
    console.error("AssemblyAI test failed:", error.message);
    res.json({
      success: false,
      message: "AssemblyAI test failed",
      error: error.message,
      suggestion: "Check API key and internet connection"
    });
  }
};

// Quick voice response (for testing)
export const quickVoiceResponse = async (req, res) => {
  try {
    const userId = req.user._id;
    
    if (req.user.credits < 1) {
      return res.json({
        success: false,
        message: "Insufficient credits",
      });
    }
    
    const { chatId, transcriptionText } = req.body;
    
    const chat = await Chat.findOne({ userId, _id: chatId });
    if (!chat) {
      return res.status(404).json({
        success: false,
        message: "Chat not found",
      });
    }
    
    const userMessage = {
      type: "voice",
      role: "user",
      content: transcriptionText || "Test voice message",
      voiceMeta: {
        duration: 3,
        fileSize: 0.1,
        wasTranscribed: true,
        isTest: true,
      },
      timestamp: Date.now(),
    };
    
    chat.messages.push(userMessage);
    
    const reply = {
      type: "text",
      role: "assistant",
      content: "I received your test voice message! This confirms voice functionality is working.",
      timestamp: Date.now(),
      isVoiceResponse: true,
    };
    
    chat.messages.push(reply);
    await chat.save();
    
    await User.updateOne({ _id: userId }, { $inc: { credits: -1 } });
    
    res.json({
      success: true,
      reply,
      userMessage,
      transcription: transcriptionText,
      isTest: true,
      message: "Test voice message processed"
    });
    
  } catch (error) {
    console.error("Quick voice error:", error);
    res.status(500).json({
      success: false,
      message: "Error in quick voice response",
    });
  }
};

// Audio validation
export const uploadAudio = async (req, res) => {
  try {
    const { audioUrl } = req.body;
    
    if (!audioUrl) {
      return res.status(400).json({
        success: false,
        message: "Audio data is required",
      });
    }

    if (!audioUrl.startsWith('data:audio/')) {
      return res.status(400).json({
        success: false,
        message: "Invalid audio format",
      });
    }

    res.json({
      success: true,
      message: "Audio format is valid",
      size: audioUrl.length,
    });

  } catch (error) {
    console.error("Audio validation error:", error);
    res.status(500).json({
      success: false,
      message: "Error validating audio",
    });
  }
};

// Get voice message
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

    const voiceMessage = chat.messages.find(
      msg => msg._id.toString() === messageId && msg.type === "voice"
    );

    if (!voiceMessage) {
      return res.status(404).json({
        success: false,
        message: "Voice message not found",
      });
    }

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
      message: "Error retrieving voice message",
    });
  }
};

// Health check
export const transcriptionHealth = async (req, res) => {
  try {
    const health = {
      assemblyai: !!assemblyClient,
      groq: true,
      timestamp: new Date().toISOString()
    };
    
    res.json({
      success: true,
      health,
      message: "Transcription services health check"
    });
    
  } catch (error) {
    console.error("Health check error:", error);
    res.status(500).json({
      success: false,
      message: "Health check failed"
    });
  }
};