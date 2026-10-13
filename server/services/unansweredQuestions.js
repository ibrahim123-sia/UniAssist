import UnansweredQuestion, {
  normalizeQuestion,
  MAX_QUESTION_CHARS,
  MAX_ANSWER_CHARS,
} from "../models/UnansweredQuestion.js";

const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;

// Small talk ("hi", "thanks", "ok", "salam") has no real answer to give, and
// with an empty knowledge base every message comes back unanswered — so these
// would flood the admin tab. Only real questions are captured.
const SMALL_TALK = new Set([
  "hi", "hii", "hello", "hey", "salam", "salaam", "aoa", "assalamualaikum", "assalam o alaikum",
  "asalam o alaikum", "assalamu alaikum", "thanks", "thank you", "thankyou", "thx", "shukriya",
  "ok", "okay", "k", "bye", "good", "nice", "great", "yes", "no", "hmm", "acha", "theek hai",
  "good morning", "good evening", "good night", "how are you", "kaise ho", "kya haal hai",
]);
const isSmallTalk = (normalized) =>
  SMALL_TALK.has(normalized) || normalized.replace(/\s/g, "").length < 3;

// Record a question the bot couldn't answer (source "auto"). Logged-in users
// carry their identity + chat; guests are stored anonymously. The same asker
// (or any guest) asking the same normalised question again within 24h while
// it is still open reuses the existing entry. Admins are NOT notified for
// auto-captured questions — they just appear in the admin tab.
//
// Never throws: a capture failure must not break the chat reply.
// Returns { escalated, questionId }.
export async function captureUnansweredQuestion({ question, botAnswer, user, chatId }) {
  try {
    const text = String(question ?? "").trim().slice(0, MAX_QUESTION_CHARS);
    const normalized = normalizeQuestion(text);
    if (!normalized || isSmallTalk(normalized)) return { escalated: false, questionId: null };

    const isGuest = !user;
    const existing = await UnansweredQuestion.findOne({
      askedBy: user ? user._id : null,
      isGuest,
      normalizedQuestion: normalized,
      status: "open",
      createdAt: { $gte: new Date(Date.now() - DEDUPE_WINDOW_MS) },
    }).select("_id");
    if (existing) return { escalated: true, questionId: existing._id };

    const created = await UnansweredQuestion.create({
      question: text,
      normalizedQuestion: normalized,
      botAnswer: String(botAnswer ?? "").slice(0, MAX_ANSWER_CHARS),
      source: "auto",
      askedBy: user ? user._id : null,
      askerName: user ? user.name || "" : "",
      askerEmail: user ? user.email || "" : "",
      isGuest,
      chatId: user && chatId ? chatId : null,
    });
    return { escalated: true, questionId: created._id };
  } catch (error) {
    console.error("captureUnansweredQuestion failed:", error.message);
    return { escalated: false, questionId: null };
  }
}

// Shared by the chat controllers: turn a Python /ask result into the reply
// metadata, auto-capturing unanswered (but not moderation-flagged) questions.
// `capture: false` → same metadata, but nothing is recorded (guest IP cap).
export async function handleAskResult(result, { question, user, chatId, capture = true }) {
  const answered = result.answered !== false;
  if (answered || result.flagged || !capture) {
    return { answered, escalated: false, questionId: null };
  }
  const { escalated, questionId } = await captureUnansweredQuestion({
    question,
    botAnswer: result.answer,
    user,
    chatId,
  });
  return { answered, escalated, questionId };
}
