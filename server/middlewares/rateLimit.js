import rateLimit, { ipKeyGenerator } from "express-rate-limit";

const tooMany = (message) => ({ success: false, message });

// Most students hit the API from the campus network, i.e. one shared NAT IP.
// Tight limits are therefore keyed per IP+email (one account), and the pure
// per-IP caps are loose enough for a whole campus.
const byIpAndEmail = (req) =>
  `${ipKeyGenerator(req.ip)}:${String(req.body?.email || "").trim().toLowerCase()}`;

// Login: 10 attempts per 15 min per account+IP, plus a per-IP ceiling so one
// IP can't spray many accounts.
export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: byIpAndEmail,
  message: tooMany("Too many login attempts. Please try again in 15 minutes."),
});

export const loginIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 200,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: tooMany("Too many login attempts from this network. Please try again later."),
});

// Routes that SEND an email (register / resend-otp / forgot-password). Every
// request counts, successful ones included — successful sends are exactly the
// abuse (email bombing, burning the Gmail sending quota).
export const otpSendLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: byIpAndEmail,
  message: tooMany("Too many OTP requests. Please try again in 15 minutes."),
});

export const otpSendIpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: tooMany("Too many OTP requests from this network. Please try again later."),
});

// Routes that CHECK an OTP (verify-otp / reset-password). Per-account attempt
// counters in the controller are the main defence; this caps per-IP volume.
export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 15,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: byIpAndEmail,
  message: tooMany("Too many attempts. Please try again in 15 minutes."),
});

// Anonymous guest chat hits the LLM on every message. Keyed per guest session
// + IP so visitors behind the campus NAT don't share one budget, with a
// per-IP ceiling against session-id rotation.
export const guestChatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${String(req.body?.sessionId || "")}`,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: tooMany("You're sending messages too quickly. Please wait a minute."),
});

export const guestIpLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 60,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  message: tooMany("Too many requests from this network. Please wait a minute."),
});

const byUser = (req) => (req.user?._id ? `u:${req.user._id}` : ipKeyGenerator(req.ip));

// Admin "scrape a job/scholarship from a link" — each call costs a page fetch
// plus an LLM extraction.
export const listingScrapeLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 20,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: byUser,
  message: tooMany("Too many scrape requests. Please wait a minute."),
});

// Admin "Send test email" — each one is a real SMTP login + send.
export const emailTestLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: byUser,
  message: tooMany("Too many test emails. Please try again in a few minutes."),
});

// Student "Ask an admin" — each one notifies every admin.
export const questionAskLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: byUser,
  message: tooMany("You've sent too many questions to the admin. Please try again later."),
});

// Student "Register a complaint" from a chat — each one notifies (and emails)
// the whole department.
export const complaintFromChatLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  limit: 5,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: byUser,
  message: tooMany("You've registered too many complaints. Please try again in a few minutes."),
});

// Logged-in chat / voice: generous, just stops runaway scripts.
export const userChatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 30,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  keyGenerator: (req) => (req.user?._id ? `u:${req.user._id}` : ipKeyGenerator(req.ip)),
  message: tooMany("You're sending messages too quickly. Please wait a minute."),
});
