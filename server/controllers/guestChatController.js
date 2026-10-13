import crypto from "crypto";
import { askPython, buildHistoryPayload, MAX_PROMPT_CHARS } from "../services/pythonClient.js";
import { handleAskResult } from "../services/unansweredQuestions.js";

// Guest sessions live in memory (no account, no DB). Both the number of
// sessions and the messages kept per session are capped so anonymous traffic
// can't grow the Node heap without bound.
const guestSessions = new Map();
const GUEST_SESSION_EXPIRY = 60 * 60 * 1000; // 1 hour idle
const MAX_GUEST_SESSIONS = 5000;
const MAX_MESSAGES_PER_SESSION = 40;
const MAX_GUEST_MESSAGE_CHARS = Math.min(MAX_PROMPT_CHARS, 2000);

// Anonymous visitors can't flood the admin "Unanswered questions" tab: at
// most GUEST_CAPTURE_LIMIT captured questions per IP per 24 h. Over the cap
// the reply is exactly the same — the question just isn't recorded.
const GUEST_CAPTURE_LIMIT = 20;
const GUEST_CAPTURE_WINDOW_MS = 24 * 60 * 60 * 1000;
const MAX_CAPTURE_IPS = 10000;
const guestCaptures = new Map(); // ip → { count, windowStart }

const captureBudget = (ip) => {
  const now = Date.now();
  let entry = guestCaptures.get(ip);
  if (!entry || now - entry.windowStart > GUEST_CAPTURE_WINDOW_MS) {
    guestCaptures.delete(ip);
    if (guestCaptures.size >= MAX_CAPTURE_IPS) guestCaptures.delete(guestCaptures.keys().next().value);
    entry = { count: 0, windowStart: now };
    guestCaptures.set(ip, entry);
  }
  return entry;
};

const cleanupOldSessions = () => {
  const now = Date.now();
  for (const [sessionId, session] of guestSessions) {
    if (now - session.lastActivity > GUEST_SESSION_EXPIRY) guestSessions.delete(sessionId);
  }
  for (const [ip, entry] of guestCaptures) {
    if (now - entry.windowStart > GUEST_CAPTURE_WINDOW_MS) guestCaptures.delete(ip);
  }
};
setInterval(cleanupOldSessions, 5 * 60 * 1000).unref();

// Session ids are always issued by the server (random UUIDs). An unknown or
// expired id from the client simply starts a new session with a fresh id.
const getOrCreateGuestSession = (sessionId) => {
  let session = typeof sessionId === "string" ? guestSessions.get(sessionId) : undefined;
  if (!session) {
    if (guestSessions.size >= MAX_GUEST_SESSIONS) {
      // Map iterates in insertion order — drop the oldest session.
      guestSessions.delete(guestSessions.keys().next().value);
    }
    session = { id: crypto.randomUUID(), messages: [], createdAt: Date.now(), lastActivity: Date.now() };
    guestSessions.set(session.id, session);
  }
  session.lastActivity = Date.now();
  return session;
};

export const guestTextChatController = async (req, res) => {
  try {
    const { message, sessionId } = req.body ?? {};

    if (typeof message !== "string" || !message.trim()) {
      return res.status(400).json({
        success: false,
        message: "Message is required and must be a non-empty string.",
      });
    }
    if (message.length > MAX_GUEST_MESSAGE_CHARS) {
      return res.status(400).json({
        success: false,
        message: `Message is too long (max ${MAX_GUEST_MESSAGE_CHARS} characters).`,
      });
    }

    const session = getOrCreateGuestSession(sessionId);
    const question = message.trim();

    // History is snapshotted BEFORE the new question is added.
    const history = buildHistoryPayload(session.messages);

    let botReply;
    let answered;
    try {
      // No user_id for guests: their session id is client-supplied, and
      // passing it on would let a guest get a real account flagged.
      const result = await askPython(question, { chatId: `guest:${session.id}`, history });
      botReply = result.answer;
      // Unanswered guest questions are captured anonymously (isGuest) for the
      // admin tab (capped per IP), but guests get no escalation / question id back.
      const budget = captureBudget(String(req.ip || ""));
      const capture = budget.count < GUEST_CAPTURE_LIMIT;
      let escalated;
      ({ answered, escalated } = await handleAskResult(result, { question, user: null, capture }));
      if (escalated) budget.count++;
    } catch (error) {
      console.error("Failed to get response from Python backend:", error.message);
      botReply = "Sorry, I'm unable to connect to the university knowledge base at the moment. Please try again later.";
      answered = false;
    }

    const reply = { type: "text", role: "assistant", content: botReply, answered, timestamp: Date.now() };
    session.messages.push({ type: "text", role: "user", content: question, timestamp: Date.now() }, reply);
    if (session.messages.length > MAX_MESSAGES_PER_SESSION) {
      session.messages.splice(0, session.messages.length - MAX_MESSAGES_PER_SESSION);
    }

    res.json({
      success: true,
      reply,
      sessionId: session.id,
      totalMessages: session.messages.length / 2,
      source: "python_backend",
      answered,
    });
  } catch (error) {
    console.error("Guest chat error:", error.message);
    res.status(500).json({
      success: false,
      message: "Sorry, there was an error processing your request. Please try again.",
    });
  }
};

export const getGuestChatHistory = async (req, res) => {
  const { sessionId } = req.query;
  if (typeof sessionId !== "string" || !sessionId) {
    return res.status(400).json({ success: false, message: "Session ID is required." });
  }

  const session = guestSessions.get(sessionId);
  if (!session) {
    return res.status(404).json({ success: false, message: "Session not found or expired." });
  }

  res.json({
    success: true,
    sessionId,
    messages: session.messages,
    createdAt: session.createdAt,
    lastActivity: session.lastActivity,
    messageCount: session.messages.length,
    willExpireIn: GUEST_SESSION_EXPIRY - (Date.now() - session.lastActivity),
  });
};

export const clearGuestSession = async (req, res) => {
  const { sessionId } = req.body ?? {};
  if (typeof sessionId !== "string" || !sessionId) {
    return res.status(400).json({ success: false, message: "Session ID is required." });
  }
  guestSessions.delete(sessionId);
  res.json({ success: true, message: "Session cleared successfully." });
};
