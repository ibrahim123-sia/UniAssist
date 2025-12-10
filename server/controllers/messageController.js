import Chat from "../models/Chat.js";
import User from "../models/User.js";
import openai from "../config/openai.js";
import assemblyai from "../config/assemblyai.js";

// Text message controller (for chat queries)
export const textMessageController = async (req, res) => {
  try {
    const userId = req.user._id;

    // Check credits - text costs 1 credit
    if (req.user.credits < 1) {
      return res.json({
        success: false,
        message: "Insufficient credits. Please purchase more credits.",
      });
    }

    const { chatId, prompt } = req.body;

    const chat = await Chat.findOne({ userId, _id: chatId });
    
    // Add user message
    chat.messages.push({
      type: "text",
      role: "user",
      content: prompt,
      timestamp: Date.now(),
    });

    // Call OpenAI for response
    const { choices } = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are UniAssist, a helpful university assistant for MAJU University. 
          Help students with academic queries, course information, assignment help, 
          email drafting, and university procedures. Be concise and accurate.`
        },
        {
          role: "user",
          content: prompt,
        },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const reply = {
      type: "text",
      role: "assistant",
      content: choices[0].message.content,
      timestamp: Date.now(),
    };

    // Send response immediately
    res.json({ success: true, reply });
    
    // Save messages to chat
    chat.messages.push(reply);
    await chat.save();

    // Deduct credits
    await User.updateOne({ _id: userId }, { $inc: { credits: -1 } });

  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Email message controller (for email drafting)
export const emailMessageController = async (req, res) => {
  try {
    const userId = req.user._id;

    // Check credits - email costs 2 credits
    if (req.user.credits < 2) {
      return res.json({
        success: false,
        message: "Insufficient credits for email generation.",
      });
    }

    const { chatId, prompt, recipient, subject } = req.body;

    const chat = await Chat.findOne({ userId, _id: chatId });
    
    // Add user message
    chat.messages.push({
      type: "email",
      role: "user",
      content: prompt,
      emailData: {
        recipient: recipient || "",
        subject: subject || "",
        isSent: false
      },
      timestamp: Date.now(),
    });

    // Call OpenAI for email response
    const { choices } = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are an email drafting assistant for university students.
          Draft professional emails for professors, administration, or other students.
          Include proper salutations, clear subject, professional tone, and closing remarks.
          Format the email properly with paragraphs.`
        },
        {
          role: "user",
          content: `Draft an email: ${prompt}\nRecipient: ${recipient || "Not specified"}\nSubject: ${subject || "No subject"}`,
        },
      ],
      max_tokens: 1500,
      temperature: 0.7,
    });

    const reply = {
      type: "email",
      role: "assistant",
      content: choices[0].message.content,
      emailData: {
        recipient: recipient || "",
        subject: subject || "Drafted Email",
        isSent: false
      },
      timestamp: Date.now(),
    };

    // Send response immediately
    res.json({ success: true, reply });
    
    // Save messages to chat
    chat.messages.push(reply);
    await chat.save();

    // Deduct credits
    await User.updateOne({ _id: userId }, { $inc: { credits: -2 } });

  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};

// Voice message controller with AssemblyAI transcription
export const voiceMessageController = async (req, res) => {
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
        message: "Audio URL is required",
      });
    }

    const chat = await Chat.findOne({ userId, _id: chatId });
    
    // Step 1: Transcribe audio using AssemblyAI
    let transcribedText = "";
    try {
      const transcript = await assemblyai.transcripts.transcribe({
        audio_url: audioUrl,
        language_code: 'en',
        punctuate: true,
        format_text: true,
      });

      if (transcript.text) {
        transcribedText = transcript.text;
      } else {
        throw new Error("Could not transcribe audio");
      }
    } catch (transcriptionError) {
      console.error("AssemblyAI transcription error:", transcriptionError);
      return res.json({
        success: false,
        message: "Failed to transcribe audio. Please try again.",
      });
    }

    // Step 2: Add user voice message to chat
    chat.messages.push({
      type: "voice",
      role: "user",
      content: transcribedText,  // Transcribed text
      voiceNote: {
        audioUrl: audioUrl,
        duration: duration || 0,
        fileSize: fileSize || 0,
        transcriptionId: "", // You can store AssemblyAI transcript ID if needed
      },
      timestamp: Date.now(),
    });

    // Step 3: Call OpenAI for response (same as text)
    const { choices } = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        {
          role: "system",
          content: `You are UniAssist, a helpful university assistant.
          The user sent a voice message. Respond helpfully and concisely.`
        },
        {
          role: "user",
          content: transcribedText,
        },
      ],
      max_tokens: 1000,
      temperature: 0.7,
    });

    const reply = {
      type: "text", // AI response is text
      role: "assistant",
      content: choices[0].message.content,
      timestamp: Date.now(),
    };

    // Send response immediately
    res.json({ 
      success: true, 
      reply,
      transcription: transcribedText 
    });
    
    // Save messages to chat
    chat.messages.push(reply);
    await chat.save();

    // Deduct credits (3 for voice processing)
    await User.updateOne({ _id: userId }, { $inc: { credits: -3 } });

  } catch (error) {
    console.error("Voice message error:", error);
    res.json({ success: false, message: error.message });
  }
};

// Upload audio file and get URL (helper endpoint)
export const uploadAudio = async (req, res) => {
  try {
    // This would handle file upload and return URL
    // You can use multer or any file upload service
    // For now, returning the provided URL
    
    const { audioUrl } = req.body;
    
    if (!audioUrl) {
      return res.status(400).json({
        success: false,
        message: "Audio URL is required",
      });
    }
    
    res.json({
      success: true,
      audioUrl: audioUrl,
      message: "Audio URL received"
    });
    
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
};