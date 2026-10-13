import mongoose from "mongoose";
import { pythonHealthReport } from "../services/pythonClient.js";
import { transporter, getEmailStatus } from "../services/mailer.js";

// Admin "System health" page: one call that checks every moving part. Error
// strings are short descriptions only — never connection strings, hosts with
// credentials, or keys.

const MONGO_TIMEOUT_MS = 5 * 1000;
const EMAIL_TIMEOUT_MS = 10 * 1000;
const EMAIL_CACHE_MS = 10 * 60 * 1000; // SMTP verify is a real login — don't hammer Gmail

const withTimeout = (promise, ms, message) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms).unref()),
  ]);

// Strip anything URI- or credential-shaped from a driver/SMTP error message.
const safeMessage = (error, fallback) => {
  const text = String(error?.message || "")
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, "[uri]")
    .replace(/\S+@\S+/g, "[address]")
    .slice(0, 200)
    .trim();
  return text || fallback;
};

async function checkMongo() {
  const started = Date.now();
  try {
    const db = mongoose.connection.db;
    if (mongoose.connection.readyState !== 1 || !db) {
      return { ok: false, latencyMs: null, error: "Not connected to the database" };
    }
    await withTimeout(db.admin().ping(), MONGO_TIMEOUT_MS, "Database ping timed out");
    return { ok: true, latencyMs: Date.now() - started, error: null };
  } catch (error) {
    return { ok: false, latencyMs: null, error: safeMessage(error, "Database ping failed") };
  }
}

let emailCache = null; // { at, result }

// → { ok, error, source: "database"|"env"|"none", senderEmail }
async function checkEmail() {
  if (emailCache && Date.now() - emailCache.at < EMAIL_CACHE_MS) return emailCache.result;
  let result;
  try {
    const status = await getEmailStatus();
    if (!status.configured) {
      // Not cached: it changes the moment the admin saves the settings.
      return { ok: false, error: "Email is not configured — set it in Admin → Settings", source: "none", senderEmail: null };
    }
    const where = { source: status.source, senderEmail: status.senderEmail };
    try {
      await withTimeout(transporter.verify(), EMAIL_TIMEOUT_MS, "SMTP check timed out");
      result = { ok: true, error: null, ...where };
    } catch (error) {
      result = { ok: false, error: safeMessage(error, "SMTP check failed"), ...where };
    }
  } catch (error) {
    return { ok: false, error: safeMessage(error, "Email status unavailable"), source: "none", senderEmail: null };
  }
  emailCache = { at: Date.now(), result };
  return result;
}

// Forget the cached SMTP result (tests, and after the email settings change).
export const resetEmailHealthCache = () => {
  emailCache = null;
};

// GET /api/admin/health
export const getSystemHealth = async (req, res) => {
  try {
    const [mongo, python, email] = await Promise.all([checkMongo(), pythonHealthReport(), checkEmail()]);
    res.json({
      success: true,
      checkedAt: new Date().toISOString(),
      node: { ok: true, uptimeSec: Math.round(process.uptime()), version: process.version },
      mongo,
      python,
      email,
    });
  } catch (error) {
    console.error("getSystemHealth error:", error);
    res.status(500).json({ success: false, message: "Failed to check system health" });
  }
};
