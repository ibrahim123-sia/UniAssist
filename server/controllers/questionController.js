import mongoose from "mongoose";
import UnansweredQuestion, {
  QUESTION_STATUSES,
  QUESTION_SOURCES,
  MAX_QUESTION_CHARS,
  MAX_ANSWER_CHARS,
  normalizeQuestion,
} from "../models/UnansweredQuestion.js";
import User from "../models/User.js";
import Chat from "../models/Chat.js";
import { notify } from "../services/notify.js";
import { addQaToKnowledgeBase, deleteQaFromKnowledgeBase, clusterQuestions } from "../services/pythonClient.js";
import { escapeRegex } from "../utils/regex.js";

const KB_SOURCE_LABEL = "Admin answer";

const notFound = (res) => res.status(404).json({ success: false, message: "Question not found" });

const MAX_GROUP_SOURCE = 1000; // questions sent to the similarity service
const MAX_GROUP_IDS = 200;     // questions answered/dismissed in one request

const preview = (text, max = 120) => {
  const t = String(text ?? "").replace(/\s+/g, " ").trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
};

// In-app only (no email) — every admin, except blocked accounts.
async function notifyAdminsOfQuestion(question, askerName) {
  const admins = await User.find({ role: "admin", isBlocked: { $ne: true } }).select("_id");
  const message = `New question from ${askerName || "a student"}: ${preview(question.question)}`;
  await Promise.all(
    admins.map((admin) =>
      notify(admin, { type: "question_new", message, link: "/admin/questions", sendEmail: false })
    )
  );
}

// The bot's reply to `questionText` in the student's chat, if we can find it.
async function findBotAnswer(chat, questionText) {
  const target = normalizeQuestion(questionText);
  const msgs = chat.messages || [];
  for (let i = msgs.length - 1; i >= 0; i--) {
    if (msgs[i].role === "user" && normalizeQuestion(msgs[i].content) === target) {
      const next = msgs[i + 1];
      return next && next.role === "assistant" ? String(next.content).slice(0, MAX_ANSWER_CHARS) : "";
    }
  }
  return "";
}

// ---------------------------------------------------------------- student

export const askAdmin = async (req, res) => {
  try {
    const { question, chatId } = req.body ?? {};
    if (typeof question !== "string" || !question.trim()) {
      return res.status(400).json({ success: false, message: "Question is required" });
    }
    const text = question.trim();
    if (text.length > MAX_QUESTION_CHARS) {
      return res.status(400).json({
        success: false,
        message: `Question is too long (max ${MAX_QUESTION_CHARS} characters)`,
      });
    }
    const normalized = normalizeQuestion(text);
    if (!normalized) {
      return res.status(400).json({ success: false, message: "Question is required" });
    }

    // Only link a chat the student actually owns; a stale/foreign id is ignored.
    const chat = mongoose.isValidObjectId(chatId)
      ? await Chat.findOne({ _id: chatId, userId: req.user._id })
      : null;

    const existing = await UnansweredQuestion.findOne({
      askedBy: req.user._id,
      normalizedQuestion: normalized,
      status: "open",
    });
    if (existing) {
      // The bot already auto-captured it — the student now explicitly wants an
      // admin, so promote it and let the admins know (once).
      if (existing.source === "auto") {
        existing.source = "student";
        if (!existing.chatId && chat) existing.chatId = chat._id;
        await existing.save();
        notifyAdminsOfQuestion(existing, req.user.name).catch((e) =>
          console.error("askAdmin: notify admins failed:", e.message)
        );
      }
      return res.status(200).json({ success: true, question: existing });
    }

    const created = await UnansweredQuestion.create({
      question: text,
      normalizedQuestion: normalized,
      botAnswer: chat ? await findBotAnswer(chat, text) : "",
      source: "student",
      askedBy: req.user._id,
      askerName: req.user.name || "",
      askerEmail: req.user.email || "",
      isGuest: false,
      chatId: chat ? chat._id : null,
    });

    notifyAdminsOfQuestion(created, req.user.name).catch((e) =>
      console.error("askAdmin: notify admins failed:", e.message)
    );

    res.status(201).json({ success: true, question: created });
  } catch (error) {
    console.error("askAdmin error:", error);
    res.status(500).json({ success: false, message: "Failed to send your question" });
  }
};

export const getMyQuestions = async (req, res) => {
  try {
    const questions = await UnansweredQuestion.find({ askedBy: req.user._id })
      .select("-answeredBy -askerEmail")
      .sort({ createdAt: -1, _id: -1 })
      .limit(200);
    res.json({ success: true, questions });
  } catch (error) {
    console.error("getMyQuestions error:", error);
    res.status(500).json({ success: false, message: "Failed to load your questions" });
  }
};

// ---------------------------------------------------------------- admin

export const listQuestions = async (req, res) => {
  try {
    const { status, source, search } = req.query;
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 25, 1), 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);

    // `counts` honour source + search but not status, so the status tabs show
    // how many each tab would list.
    const base = {};
    if (source) {
      if (!QUESTION_SOURCES.includes(source)) {
        return res.status(400).json({ success: false, message: "source must be auto or student" });
      }
      base.source = source;
    }
    if (typeof search === "string" && search.trim()) {
      const pattern = escapeRegex(search.trim());
      base.$or = [
        { question: { $regex: pattern, $options: "i" } },
        { askerName: { $regex: pattern, $options: "i" } },
        { askerEmail: { $regex: pattern, $options: "i" } },
      ];
    }
    const filter = { ...base };
    if (status) {
      if (!QUESTION_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status" });
      }
      filter.status = status;
    }

    const [questions, total, grouped] = await Promise.all([
      UnansweredQuestion.find(filter)
        .populate("askedBy", "name email role")
        .populate("answeredBy", "name email")
        .sort({ createdAt: -1, _id: -1 })
        .skip(offset)
        .limit(limit),
      UnansweredQuestion.countDocuments(filter),
      UnansweredQuestion.aggregate([{ $match: base }, { $group: { _id: "$status", count: { $sum: 1 } } }]),
    ]);
    const counts = { open: 0, answered: 0, dismissed: 0 };
    for (const g of grouped) if (g._id in counts) counts[g._id] = g.count;

    res.json({ success: true, questions, total, counts });
  } catch (error) {
    console.error("listQuestions error:", error);
    res.status(500).json({ success: false, message: "Failed to load questions" });
  }
};

// Validate the admin's answer body → { text, addToKB } or { error }.
function parseAnswerBody(body) {
  const { answer, addToKB } = body ?? {};
  if (typeof answer !== "string" || !answer.trim()) return { error: "Answer is required" };
  const text = answer.trim();
  if (text.length > MAX_ANSWER_CHARS) {
    return { error: `Answer is too long (max ${MAX_ANSWER_CHARS} characters)` };
  }
  if (addToKB !== undefined && typeof addToKB !== "boolean") {
    return { error: "addToKB must be a boolean" };
  }
  return { text, addToKB: addToKB === true };
}

const ANSWER_POPULATE = [
  { path: "askedBy", select: "name email role" },
  { path: "answeredBy", select: "name email" },
];

// Notify + email each logged-in asker of these questions. Students get the
// "My Questions" link; staff/admin askers (no such page) just the in-app note.
async function notifyAskers(questions, text, { edited = false } = {}) {
  const askerIds = [...new Set(questions.filter((q) => q.askedBy).map((q) => String(q.askedBy?._id ?? q.askedBy)))];
  if (askerIds.length === 0) return;
  const askers = new Map(
    (await User.find({ _id: { $in: askerIds } }).select("name email role")).map((u) => [String(u._id), u])
  );
  const message = edited ? "The answer to your question was updated" : "Your question was answered";
  for (const question of questions) {
    const asker = question.askedBy && askers.get(String(question.askedBy?._id ?? question.askedBy));
    if (!asker) continue;
    notify(asker, {
      type: "question_answered",
      message,
      link: asker.role === "student" ? "/questions" : "",
      emailSubject: message,
      emailHeading: message,
      emailBody: `You asked:\n${preview(question.question, 500)}\n\nAnswer from the university:\n${text}`,
    }).catch((e) => console.error("answerQuestion: notify failed:", e.message));
  }
}

// One Q&A chunk in the KB → { chunkId } or { kbError } (never throws).
async function addAnswerToKB(questionText, text) {
  try {
    const { id } = await addQaToKnowledgeBase({ question: questionText, answer: text, sourceLabel: KB_SOURCE_LABEL });
    return { chunkId: id };
  } catch (error) {
    console.error("answerQuestion: adding to knowledge base failed:", error.message);
    return { kbError: `Answer saved, but it could not be added to the knowledge base: ${error.message}` };
  }
}

// Edited answer → swap the question's KB chunk for a new one (delete the old
// `qa_` chunk first so the KB keeps exactly one). Questions of a group that
// shared the old chunk follow the new id. → { kbError? }
async function replaceKbChunk(question, text) {
  const oldId = question.kbChunkId && question.kbChunkId.startsWith("qa_") ? question.kbChunkId : "";
  const sharing = oldId ? { $or: [{ _id: question._id }, { kbChunkId: oldId }] } : { _id: question._id };
  if (oldId) {
    try {
      await deleteQaFromKnowledgeBase(oldId);
    } catch (error) {
      console.error("answerQuestion: removing the old KB answer failed:", error.message);
      return {
        kbError: `Answer saved, but the knowledge base still has the previous answer (it could not be replaced): ${error.message}`,
      };
    }
  }
  const { chunkId, kbError } = await addAnswerToKB(question.question, text);
  await UnansweredQuestion.updateMany(
    sharing,
    chunkId ? { $set: { addedToKB: true, kbChunkId: chunkId } } : { $set: { addedToKB: false, kbChunkId: "" } }
  );
  return { kbError };
}

// Atomically move one question from `fromStatus` to answered. → the updated
// doc, or null when another admin changed it first.
const claimForAnswer = (id, fromStatus, { text, adminId, answeredAt }) =>
  UnansweredQuestion.findOneAndUpdate(
    { _id: id, status: fromStatus },
    { $set: { status: "answered", adminAnswer: text, answeredBy: adminId, answeredAt } },
    { returnDocument: "after" }
  );

// PATCH /api/admin/questions/:id/answer { answer, addToKB }
//   Open (or dismissed) → answered, notifying the asker once. Already answered
//   → an edit: the text is replaced, the asker is notified again only if it
//   actually changed, and with addToKB the KB chunk is replaced (one chunk).
export const answerQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return notFound(res);
    const { text, addToKB, error } = parseAnswerBody(req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    const current = await UnansweredQuestion.findById(id).select("status");
    if (!current) return notFound(res);

    const adminId = req.user._id;
    let kbError;
    const claimed =
      current.status !== "answered" ? await claimForAnswer(id, current.status, { text, adminId, answeredAt: new Date() }) : null;

    if (claimed) {
      if (addToKB) {
        const kb = await addAnswerToKB(claimed.question, text);
        if (kb.chunkId) {
          await UnansweredQuestion.updateOne({ _id: id }, { $set: { addedToKB: true, kbChunkId: kb.chunkId } });
        }
        kbError = kb.kbError;
      }
      notifyAskers([claimed], text).catch((e) => console.error("answerQuestion: notify failed:", e.message));
    } else {
      // Edit of an answered question (or one another admin answered a moment ago).
      const before = await UnansweredQuestion.findOneAndUpdate(
        { _id: id, status: "answered" },
        { $set: { adminAnswer: text } },
        { returnDocument: "before" }
      );
      if (!before) {
        if (!(await UnansweredQuestion.exists({ _id: id }))) return notFound(res);
        return res.status(409).json({ success: false, message: "This question was just changed by another admin. Reload and try again." });
      }
      const changed = before.adminAnswer !== text;
      if (changed) {
        await UnansweredQuestion.updateOne({ _id: id }, { $set: { answeredBy: adminId, answeredAt: new Date() } });
      }
      if (addToKB && (changed || !before.addedToKB || !before.kbChunkId)) {
        ({ kbError } = await replaceKbChunk(before, text));
      }
      if (changed) {
        notifyAskers([before], text, { edited: Boolean(before.adminAnswer) }).catch((e) =>
          console.error("answerQuestion: notify failed:", e.message)
        );
      }
    }

    const question = await UnansweredQuestion.findById(id).populate(ANSWER_POPULATE);
    if (!question) return notFound(res);
    const body = { success: true, question };
    if (kbError) body.kbError = kbError;
    res.json(body);
  } catch (error) {
    console.error("answerQuestion error:", error);
    res.status(500).json({ success: false, message: "Failed to save the answer" });
  }
};

// PATCH /api/admin/questions/:id/dismiss — open → dismissed (atomic).
export const dismissQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return notFound(res);
    const question = await UnansweredQuestion.findOneAndUpdate(
      { _id: id, status: "open" },
      { $set: { status: "dismissed" } },
      { returnDocument: "after" }
    ).populate("askedBy", "name email role");
    if (question) return res.json({ success: true, question });

    const current = await UnansweredQuestion.findById(id).populate("askedBy", "name email role");
    if (!current) return notFound(res);
    if (current.status === "dismissed") return res.json({ success: true, question: current });
    res.status(409).json({ success: false, message: "This question was already answered", question: current });
  } catch (error) {
    console.error("dismissQuestion error:", error);
    res.status(500).json({ success: false, message: "Failed to dismiss question" });
  }
};

export const deleteQuestion = async (req, res) => {
  try {
    const { id } = req.params;
    if (!mongoose.isValidObjectId(id)) return notFound(res);
    const deleted = await UnansweredQuestion.findByIdAndDelete(id);
    if (!deleted) return notFound(res);
    res.json({ success: true });
  } catch (error) {
    console.error("deleteQuestion error:", error);
    res.status(500).json({ success: false, message: "Failed to delete question" });
  }
};

// ---------------------------------------------------------------- admin: groups

// `ids` from a group request body → array of ObjectId strings, or { error }.
function parseIds(ids) {
  if (!Array.isArray(ids) || ids.length === 0) return { error: "ids must be a non-empty array" };
  if (ids.length > MAX_GROUP_IDS) return { error: `At most ${MAX_GROUP_IDS} questions at a time` };
  if (!ids.every((id) => typeof id === "string" && mongoose.isValidObjectId(id))) {
    return { error: "ids must be question ids" };
  }
  return { ids: [...new Set(ids)] };
}

// Fallback grouping when the similarity service is unavailable: identical
// normalised wording only. Oldest question represents the group.
function exactClusters(docs) {
  const byKey = new Map();
  for (const doc of docs) {
    const key = doc.normalizedQuestion || normalizeQuestion(doc.question) || String(doc._id);
    if (!byKey.has(key)) byKey.set(key, []);
    byKey.get(key).push(String(doc._id));
  }
  return [...byKey.values()].map((ids) => ({ ids, representativeId: ids[ids.length - 1] }));
}

// GET /api/admin/questions/groups?status=&source=
//   Up to 1000 matching questions (newest first), grouped by meaning via the
//   Python similarity service, or by exact wording if that fails.
export const listQuestionGroups = async (req, res) => {
  try {
    const { status, source } = req.query;
    const filter = {};
    if (status) {
      if (!QUESTION_STATUSES.includes(status)) {
        return res.status(400).json({ success: false, message: "Invalid status" });
      }
      filter.status = status;
    }
    if (source) {
      if (!QUESTION_SOURCES.includes(source)) {
        return res.status(400).json({ success: false, message: "source must be auto or student" });
      }
      filter.source = source;
    }

    const docs = await UnansweredQuestion.find(filter)
      .select("+normalizedQuestion question source askedBy askerName isGuest status createdAt")
      .sort({ createdAt: -1, _id: -1 })
      .limit(MAX_GROUP_SOURCE)
      .lean();

    let clusters;
    let grouping = "semantic";
    if (docs.length > 0) {
      try {
        clusters = await clusterQuestions(
          docs.map((d) => ({ id: String(d._id), text: d.question.slice(0, MAX_QUESTION_CHARS) }))
        );
      } catch (error) {
        console.error("listQuestionGroups: similarity service failed, grouping by exact text:", error.message);
        clusters = exactClusters(docs);
        grouping = "exact";
      }
    } else {
      clusters = [];
    }

    // Every question lands in exactly one group, even if the service skipped
    // or repeated an id.
    const byId = new Map(docs.map((d) => [String(d._id), d]));
    const seen = new Set();
    const groups = [];
    const addGroup = (ids, representativeId) => {
      const members = ids.filter((id) => byId.has(id) && !seen.has(id)).map((id) => byId.get(id));
      if (members.length === 0) return;
      for (const m of members) seen.add(String(m._id));
      members.sort((a, b) => b.createdAt - a.createdAt);
      const rep = members.find((m) => String(m._id) === representativeId) || members[members.length - 1];
      const askers = new Set(members.filter((m) => m.askedBy).map((m) => String(m.askedBy)));
      const guests = members.filter((m) => !m.askedBy).length;
      groups.push({
        representative: { _id: rep._id, question: rep.question },
        count: members.length,
        askers: askers.size + guests,
        latestAt: members[0].createdAt,
        firstAt: members[members.length - 1].createdAt,
        sources: {
          auto: members.filter((m) => m.source === "auto").length,
          student: members.filter((m) => m.source === "student").length,
        },
        ids: members.map((m) => m._id),
        questions: members.map((m) => ({
          _id: m._id,
          question: m.question,
          askerName: m.askerName,
          isGuest: m.isGuest,
          createdAt: m.createdAt,
          status: m.status,
        })),
      });
    };
    for (const c of clusters) addGroup(c.ids, c.representativeId);
    for (const d of docs) if (!seen.has(String(d._id))) addGroup([String(d._id)], String(d._id));

    groups.sort((a, b) => b.count - a.count || b.latestAt - a.latestAt);
    res.json({ success: true, groups, total: docs.length, grouping });
  } catch (error) {
    console.error("listQuestionGroups error:", error);
    res.status(500).json({ success: false, message: "Failed to group questions" });
  }
};

// PATCH /api/admin/questions/answer-group { ids, answer, addToKB }
//   Answers every still-open question in `ids` with one answer. Each question
//   flips open → answered atomically, so two admins answering overlapping
//   groups can't notify an asker twice. The KB gets a single chunk worded
//   like the first (representative) question this request actually answered.
export const answerQuestionGroup = async (req, res) => {
  try {
    const { ids, error: idsError } = parseIds(req.body?.ids);
    if (idsError) return res.status(400).json({ success: false, message: idsError });
    const { text, addToKB, error } = parseAnswerBody(req.body);
    if (error) return res.status(400).json({ success: false, message: error });

    const stamp = { text, adminId: req.user._id, answeredAt: new Date() };
    const answered = [];
    // Caller's order, so ids[0] (the representative) words the KB chunk.
    for (const id of ids) {
      const question = await claimForAnswer(id, "open", stamp);
      if (question) answered.push(question);
    }

    let kbError;
    if (addToKB && answered.length > 0) {
      const kb = await addAnswerToKB(answered[0].question, text);
      if (kb.chunkId) {
        await UnansweredQuestion.updateMany(
          { _id: { $in: answered.map((q) => q._id) } },
          { $set: { addedToKB: true, kbChunkId: kb.chunkId } }
        );
      }
      kbError = kb.kbError;
    }
    notifyAskers(answered, text).catch((e) => console.error("answerQuestionGroup: notify failed:", e.message));

    const body = { success: true, answered: answered.length };
    if (kbError) body.kbError = kbError;
    res.json(body);
  } catch (error) {
    console.error("answerQuestionGroup error:", error);
    res.status(500).json({ success: false, message: "Failed to save the answers" });
  }
};

// PATCH /api/admin/questions/dismiss-group { ids } — dismisses the open ones.
export const dismissQuestionGroup = async (req, res) => {
  try {
    const { ids, error } = parseIds(req.body?.ids);
    if (error) return res.status(400).json({ success: false, message: error });
    const result = await UnansweredQuestion.updateMany(
      { _id: { $in: ids }, status: "open" },
      { $set: { status: "dismissed" } }
    );
    res.json({ success: true, dismissed: result.modifiedCount });
  } catch (error) {
    console.error("dismissQuestionGroup error:", error);
    res.status(500).json({ success: false, message: "Failed to dismiss questions" });
  }
};
