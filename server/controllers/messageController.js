import mongoose from "mongoose";
import Chat from "../models/Chat.js";
import {
  askPython,
  buildHistoryPayload,
  decodeAudioDataUrl,
  transcribeWithPython,
  pythonIsHealthy,
  MAX_PROMPT_CHARS,
} from "../services/pythonClient.js";
import { handleAskResult } from "../services/unansweredQuestions.js";
import { looksLikeComplaint } from "../services/departmentSuggestion.js";

const KB_UNAVAILABLE =
  "Sorry, I'm unable to connect to the university knowledge base at the moment. Please try again later.";

// Shown instead of "I don't have information about that" when a complaint-like
// message finds nothing in the knowledge base — the department, not the KB,
// has to handle it.
const COMPLAINT_REPLY =
  "This sounds like something the relevant department needs to look into. Tap \"Register a complaint\" below to send it to them — this chat is attached automatically, and you can track it in My Issues.";

// First ~5 words of the opening question become the chat's sidebar name.
const titleFrom = (text) => {
  const words = text.trim().split(/\s+/);
  return words.slice(0, 5).join(" ") + (words.length > 5 ? "..." : "");
};

const findUserChat = (userId, chatId) =>
  mongoose.isValidObjectId(chatId) ? Chat.findOne({ userId, _id: chatId }) : null;

const validatePrompt = (prompt) => {
  if (typeof prompt !== "string" || !prompt.trim()) return "Message is required";
  if (prompt.length > MAX_PROMPT_CHARS) return `Message is too long (max ${MAX_PROMPT_CHARS} characters)`;
  return null;
};

// Ask Python and work out the reply metadata. A Python outage is reported as
// not answered but is NOT captured as an unanswered question (it's not a
// knowledge gap, and an outage would flood the admin tab). Neither is a
// complaint: it goes to a department via "Register a complaint" instead.
async function askAndCapture(question, { user, chatId, history, captureText, fallback, logLabel, complaint }) {
  try {
    const result = await askPython(question, { userId: user._id, chatId, history });
    if (complaint) {
      const answered = result.answered !== false;
      const content = answered || result.flagged ? result.answer : COMPLAINT_REPLY;
      return { content, answered, escalated: false, questionId: null };
    }
    const meta = await handleAskResult(result, { question: captureText ?? question, user, chatId });
    return { content: result.answer, ...meta };
  } catch (error) {
    console.error(`${logLabel}:`, error.message);
    return { content: fallback, answered: false, escalated: false, questionId: null };
  }
}

// Top-level fields every chat reply JSON carries (clients render the
// "forwarded to admin" note from these).
const replyMeta = (ask) => ({
  answered: ask.answered,
  escalated: ask.escalated,
  questionId: ask.questionId,
});

// Students only: does the question read like a personal complaint? Clients
// then highlight "Register a complaint" under the reply.
const complaintHint = (user, text) => user?.role === "student" && looksLikeComplaint(text);

// Push the user turn + assistant reply, name a fresh chat after its first
// question, and save once.
async function appendTurn(chat, userMessage, reply) {
  const isFirstQuestion = !chat.messages.some((m) => m.role === "user");
  chat.messages.push(userMessage, reply);
  if (isFirstQuestion && chat.name === "New Chat") {
    chat.name = titleFrom(userMessage.content);
  }
  await chat.save();
}

export const textMessageController = async (req, res) => {
  try {
    const userId = req.user._id;
    const { chatId, prompt } = req.body ?? {};

    const invalid = validatePrompt(prompt);
    if (invalid) return res.status(400).json({ success: false, message: invalid });

    const chat = await findUserChat(userId, chatId);
    if (!chat) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }

    // History is snapshotted BEFORE the new question is added, so the
    // question isn't sent to Python twice.
    const history = buildHistoryPayload(chat.messages);
    const question = prompt.trim();
    const suggestComplaint = complaintHint(req.user, question);

    const ask = await askAndCapture(question, {
      user: req.user,
      chatId: chat._id,
      history,
      fallback: KB_UNAVAILABLE,
      logLabel: "Failed to get response from Python backend",
      complaint: suggestComplaint,
    });

    const userMessage = { type: "text", role: "user", content: question, timestamp: Date.now() };
    const reply = {
      type: "text",
      role: "assistant",
      content: ask.content,
      answered: ask.answered,
      questionId: ask.questionId ?? undefined,
      suggestComplaint,
      timestamp: Date.now(),
    };
    await appendTurn(chat, userMessage, reply);

    res.json({
      success: true,
      reply,
      userMessage,
      chatName: chat.name,
      source: "python_backend",
      ...replyMeta(ask),
      suggestComplaint,
    });
  } catch (error) {
    console.error("Error in textMessageController:", error.message);
    res.status(500).json({ success: false, message: "Error processing your request" });
  }
};

// Email drafting — routed through the same Python /ask endpoint.
export const emailMessageController = async (req, res) => {
  try {
    const userId = req.user._id;
    const { chatId, prompt } = req.body ?? {};
    const recipient = typeof req.body?.recipient === "string" ? req.body.recipient.slice(0, 200) : "";
    const subject = typeof req.body?.subject === "string" ? req.body.subject.slice(0, 200) : "";

    const invalid = validatePrompt(prompt);
    if (invalid) return res.status(400).json({ success: false, message: invalid });

    const chat = await findUserChat(userId, chatId);
    if (!chat) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }

    const history = buildHistoryPayload(chat.messages);
    const emailPrompt = `Please help draft an email based on: ${prompt.trim()}
    Recipient: ${recipient || "Not specified"}
    Subject: ${subject || "No subject"}
    Please format the email professionally with salutation, body, and closing.`;

    // The wrapped drafting prompt goes to Python, but the student's own words
    // are what gets captured if the bot can't help.
    const ask = await askAndCapture(emailPrompt, {
      user: req.user,
      chatId: chat._id,
      history,
      captureText: prompt.trim(),
      fallback: "Sorry, I'm unable to draft emails at the moment. Please try again later.",
      logLabel: "Failed to get email response from Python backend",
    });

    const userMessage = {
      type: "email",
      role: "user",
      content: prompt.trim(),
      emailData: { recipient, subject, isSent: false },
      timestamp: Date.now(),
    };
    const reply = {
      type: "email",
      role: "assistant",
      content: ask.content,
      emailData: { recipient, subject: subject || "Drafted Email", isSent: false },
      answered: ask.answered,
      questionId: ask.questionId ?? undefined,
      timestamp: Date.now(),
    };
    await appendTurn(chat, userMessage, reply);

    res.json({ success: true, reply, userMessage, chatName: chat.name, source: "python_backend", ...replyMeta(ask) });
  } catch (error) {
    console.error("Error in emailMessageController:", error.message);
    res.status(500).json({ success: false, message: "Error generating email" });
  }
};

// Shared by voice + transcribe: decode, validate, run Whisper.
async function transcribeRequestAudio(audioUrl) {
  const decoded = decodeAudioDataUrl(audioUrl);
  if (decoded.error) return { status: 400, message: decoded.error };

  const transcription = await transcribeWithPython(decoded.buffer, decoded.extension);
  if (!transcription.success) {
    console.error("Transcription failed:", transcription.error);
    return {
      status: 502,
      message: "Could not transcribe voice message. Please speak more clearly or try text input.",
    };
  }
  // Same length rule as a typed message — a long recording can't smuggle a
  // bigger prompt to the LLM than the text box allows.
  const text = transcription.text.trim().slice(0, MAX_PROMPT_CHARS).trim();
  if (!text) return { status: 502, message: "Could not transcribe voice message. Please try text input." };
  return { text, extension: decoded.extension };
}

export const voiceMessageController = async (req, res) => {
  try {
    const userId = req.user._id;
    const { chatId, audioUrl, duration, fileSize } = req.body ?? {};

    const chat = await findUserChat(userId, chatId);
    if (!chat) {
      return res.status(404).json({ success: false, message: "Chat not found" });
    }

    const result = await transcribeRequestAudio(audioUrl);
    if (!result.text) {
      return res.status(result.status).json({ success: false, message: result.message });
    }

    const history = buildHistoryPayload(chat.messages);
    const suggestComplaint = complaintHint(req.user, result.text);
    const ask = await askAndCapture(result.text, {
      user: req.user,
      chatId: chat._id,
      history,
      fallback:
        "I received your voice message, but I'm having trouble accessing the knowledge base. Please try again or use text input.",
      logLabel: "Python backend Error",
      complaint: suggestComplaint,
    });

    const userMessage = {
      type: "voice",
      role: "user",
      content: result.text,
      voiceNote: {
        duration: Number(duration) || 0,
        fileSize: Number(fileSize) || 0,
      },
      timestamp: Date.now(),
    };
    const reply = {
      type: "text",
      role: "assistant",
      content: ask.content,
      answered: ask.answered,
      questionId: ask.questionId ?? undefined,
      suggestComplaint,
      timestamp: Date.now(),
    };
    await appendTurn(chat, userMessage, reply);

    res.json({
      success: true,
      reply,
      suggestComplaint,
      transcription: result.text,
      transcriptionDetails: { service: "whisper", isFallback: false, audioFormat: result.extension },
      chatName: chat.name,
      source: "python_backend",
      message: "Voice message processed successfully",
      ...replyMeta(ask),
    });
  } catch (error) {
    console.error("Voice message processing error:", error.message);
    res.status(500).json({ success: false, message: "Error processing voice message" });
  }
};

// Transcribe-only — converts audio to text WITHOUT saving a chat message or
// calling the LLM. The frontend drops the result into the text input so the
// user can edit it before actually sending.
export const transcribeMessageController = async (req, res) => {
  try {
    const result = await transcribeRequestAudio(req.body?.audioUrl);
    if (!result.text) {
      return res.status(result.status).json({ success: false, message: result.message });
    }
    res.json({
      success: true,
      transcription: result.text,
      transcriptionDetails: { service: "whisper", isFallback: false, audioFormat: result.extension },
    });
  } catch (error) {
    console.error("Voice transcription error:", error.message);
    res.status(500).json({ success: false, message: "Error transcribing voice message" });
  }
};

export const transcriptionHealth = async (req, res) => {
  const healthy = await pythonIsHealthy();
  res.json({
    success: true,
    health: {
      pythonBackend: healthy,
      whisper: healthy, // local transcription is part of the Python service
      timestamp: new Date().toISOString(),
      audioFormats: ["webm", "wav", "mp3", "ogg", "m4a"],
    },
    message: healthy ? "All systems operational" : "Python backend connection issue",
  });
};
