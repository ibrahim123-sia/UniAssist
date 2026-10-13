import mongoose from "mongoose";

// Chatbot questions the bot couldn't answer (source "auto") or that a student
// explicitly sent to the admin (source "student"). The admin answers them from
// the "Unanswered Questions" tab, optionally adding the Q&A to the chatbot KB.

export const QUESTION_STATUSES = ["open", "answered", "dismissed"];
export const QUESTION_SOURCES = ["auto", "student"];
export const MAX_QUESTION_CHARS = 2000;
export const MAX_ANSWER_CHARS = 4000;

// Lower-cased, punctuation/whitespace-collapsed form used for de-duplication.
export const normalizeQuestion = (text) =>
  String(text ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .slice(0, MAX_QUESTION_CHARS);

const unansweredQuestionSchema = new mongoose.Schema(
  {
    question: { type: String, required: true, trim: true, maxlength: MAX_QUESTION_CHARS },
    // Internal de-dupe key; never sent to clients.
    normalizedQuestion: { type: String, default: "", select: false },
    botAnswer: { type: String, default: "", maxlength: MAX_ANSWER_CHARS },
    source: { type: String, enum: QUESTION_SOURCES, required: true },
    askedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    askerName: { type: String, default: "" },
    askerEmail: { type: String, default: "" },
    isGuest: { type: Boolean, default: false },
    chatId: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", default: null },
    status: { type: String, enum: QUESTION_STATUSES, default: "open", index: true },
    adminAnswer: { type: String, default: "", maxlength: MAX_ANSWER_CHARS },
    answeredBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    answeredAt: { type: Date, default: null },
    addedToKB: { type: Boolean, default: false },
    kbChunkId: { type: String, default: "" },
  },
  {
    timestamps: true,
    // select:false only covers queries — also strip the key from freshly
    // created docs when they're serialised.
    toJSON: {
      transform: (doc, ret) => {
        delete ret.normalizedQuestion;
        return ret;
      },
    },
  }
);

unansweredQuestionSchema.index({ askedBy: 1, createdAt: -1 });
unansweredQuestionSchema.index({ askedBy: 1, isGuest: 1, status: 1, normalizedQuestion: 1 });
unansweredQuestionSchema.index({ status: 1, createdAt: -1 });

const UnansweredQuestion = mongoose.model("UnansweredQuestion", unansweredQuestionSchema);

export default UnansweredQuestion;
