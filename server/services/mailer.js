import crypto from "crypto";
import mongoose from "mongoose";
import nodemailer from "nodemailer";
import Setting from "../models/Setting.js";

// The university's ONE outgoing email account (OTPs + notifications).
// Resolution order:
//   1. Admin → Settings (stored in MongoDB, app password encrypted at rest)
//   2. EMAIL_USER / EMAIL_PASS from server/.env (first-boot fallback, Gmail)
//   3. none — sendMail()/verify() reject with code EMAIL_NOT_CONFIGURED
// The active config + its nodemailer transport are cached until the admin
// changes the settings (invalidateEmailCache). Port 587 upgrades to TLS via
// STARTTLS; certificate checks stay ON so the password and OTPs can't be
// captured by a man-in-the-middle. Nothing here ever logs or returns the
// password.

export const EMAIL_SETTING_KEY = "email";
export const DEFAULT_SENDER_NAME = "UniAssist — MAJU";
export const DEFAULT_SMTP_HOST = "smtp.gmail.com";
export const DEFAULT_SMTP_PORT = 587;
export const EMAIL_NOT_CONFIGURED = "EMAIL_NOT_CONFIGURED";
export const EMAIL_NOT_CONFIGURED_MESSAGE =
  "Email service is not configured yet. Please contact the university administrator.";

const SMTP_CONNECTION_TIMEOUT_MS = 15 * 1000;

// ---------------------------------------------------------------- secrets

// AES-256-GCM, key = sha256(SETTINGS_SECRET || JWT_SECRET).
// Stored as "v1:<iv b64>:<tag b64>:<ciphertext b64>".
const encryptionKey = () =>
  crypto
    .createHash("sha256")
    .update(String(process.env.SETTINGS_SECRET || process.env.JWT_SECRET || ""))
    .digest();

export function encryptSecret(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString("base64")}:${tag.toString("base64")}:${ciphertext.toString("base64")}`;
}

// Throws when the value is malformed or was encrypted with another secret.
export function decryptSecret(stored) {
  const parts = String(stored ?? "").split(":");
  if (parts.length !== 4 || parts[0] !== "v1") throw new Error("Unsupported secret format");
  const [, iv, tag, ciphertext] = parts.map((p, i) => (i === 0 ? p : Buffer.from(p, "base64")));
  const decipher = crypto.createDecipheriv("aes-256-gcm", encryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

// ---------------------------------------------------------------- helpers

// Error raised by sendMail()/verify() when no account is configured.
export const emailNotConfiguredError = () => {
  const error = new Error("Email is not configured — set it in Admin → Settings");
  error.code = EMAIL_NOT_CONFIGURED;
  return error;
};

export const isEmailNotConfigured = (error) => error?.code === EMAIL_NOT_CONFIGURED;

// Strip anything URI-, address- or credential-shaped from an SMTP / driver
// error so it can be logged or shown to an admin.
export const safeErrorMessage = (error, fallback = "Unknown error") => {
  const text = String(error?.message || "")
    .replace(/\b[a-z][a-z0-9+.-]*:\/\/\S+/gi, "[uri]")
    .replace(/\S+@\S+/g, "[address]")
    .replace(/\s+/g, " ")
    .slice(0, 200)
    .trim();
  return text || fallback;
};

// `"Name" <address>` with the display name made header-safe.
export const formatFrom = (name, address) =>
  `"${String(name || DEFAULT_SENDER_NAME).replace(/["\\\r\n]/g, "").trim() || DEFAULT_SENDER_NAME}" <${address}>`;

// A fresh SMTP transport (used for the active config and for the admin's
// "Save & verify" check before anything is stored).
export const createSmtpTransport = ({ smtpHost, smtpPort, secure, user, pass }) =>
  nodemailer.createTransport({
    host: smtpHost || DEFAULT_SMTP_HOST,
    port: smtpPort || DEFAULT_SMTP_PORT,
    secure: Boolean(secure),
    auth: { user, pass },
    connectionTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    greetingTimeout: SMTP_CONNECTION_TIMEOUT_MS,
    socketTimeout: 2 * SMTP_CONNECTION_TIMEOUT_MS,
  });

// The stored "email" setting value (password still encrypted), or null.
export async function getStoredEmailSettings() {
  const doc = await Setting.findOne({ key: EMAIL_SETTING_KEY }).lean();
  return doc?.value && typeof doc.value === "object" ? doc.value : null;
}

// Decrypted app password of the stored settings, or null (none stored, or it
// can't be decrypted because SETTINGS_SECRET / JWT_SECRET changed).
let warnedDecrypt = false;
export function storedAppPassword(settings) {
  if (!settings?.appPasswordEnc) return null;
  try {
    return decryptSecret(settings.appPasswordEnc);
  } catch {
    if (!warnedDecrypt) {
      warnedDecrypt = true;
      console.warn(
        "⚠️ The saved email app password could not be decrypted (SETTINGS_SECRET or JWT_SECRET changed?). " +
          "Email from Admin → Settings is treated as not configured — re-enter the app password there."
      );
    }
    return null;
  }
}

// ---------------------------------------------------------------- active config

let active;          // undefined = not resolved yet; null = none; else the config
let generation = 0;  // bumped by invalidateEmailCache so a stale lookup isn't cached
let resolving = null;

async function lookupActive() {
  const dbReady = mongoose.connection.readyState === 1;
  if (dbReady) {
    const settings = await getStoredEmailSettings();
    const pass = settings?.senderEmail ? storedAppPassword(settings) : null;
    if (pass) {
      return {
        dbReady,
        config: {
          source: "database",
          senderEmail: settings.senderEmail,
          from: formatFrom(settings.senderName, settings.senderEmail),
          smtp: {
            smtpHost: settings.smtpHost || DEFAULT_SMTP_HOST,
            smtpPort: settings.smtpPort || DEFAULT_SMTP_PORT,
            secure: Boolean(settings.secure),
            user: settings.senderEmail,
            pass,
          },
        },
      };
    }
  }
  if (process.env.EMAIL_USER && process.env.EMAIL_PASS) {
    return {
      dbReady,
      config: {
        source: "env",
        senderEmail: process.env.EMAIL_USER,
        from: formatFrom(DEFAULT_SENDER_NAME, process.env.EMAIL_USER),
        smtp: {
          smtpHost: DEFAULT_SMTP_HOST,
          smtpPort: DEFAULT_SMTP_PORT,
          secure: false,
          user: process.env.EMAIL_USER,
          pass: process.env.EMAIL_PASS,
        },
      },
    };
  }
  return { dbReady, config: null };
}

async function resolveActive() {
  if (active !== undefined) return active;
  if (!resolving) {
    const gen = generation;
    resolving = lookupActive()
      .then(({ dbReady, config }) => {
        // Before the DB is connected the answer may change — don't cache it.
        if (dbReady && gen === generation) active = config;
        return config;
      })
      .finally(() => {
        if (gen === generation) resolving = null;
      });
  }
  return resolving;
}

const transportOf = (config) => {
  config.transport ??= createSmtpTransport(config.smtp);
  return config.transport;
};

// Forget the cached config/transport (call after the settings change).
export function invalidateEmailCache() {
  generation++;
  resolving = null;
  if (active?.transport) {
    try {
      active.transport.close();
    } catch {
      // already closed
    }
  }
  active = undefined;
}

// → { configured, source: "database" | "env" | "none", senderEmail }
export async function getEmailStatus() {
  const config = await resolveActive();
  return {
    configured: Boolean(config),
    source: config ? config.source : "none",
    senderEmail: config ? config.senderEmail : null,
  };
}

export const isEmailConfigured = async () => (await getEmailStatus()).configured;

// Same API every caller (and the tests) already use. `from` defaults to the
// configured sender.
export const transporter = {
  async sendMail(options = {}) {
    const config = await resolveActive();
    if (!config) throw emailNotConfiguredError();
    return transportOf(config).sendMail({ ...options, from: options.from || config.from });
  },
  async verify() {
    const config = await resolveActive();
    if (!config) throw emailNotConfiguredError();
    return transportOf(config).verify();
  },
};

// Startup log (server.js, after the DB connects). Never throws, never prints
// the password.
export async function logEmailStatus() {
  try {
    const config = await resolveActive();
    if (!config) {
      console.log("✉️  Email not configured — set it in Admin → Settings");
      return;
    }
    const label = config.source === "database" ? "Admin settings" : ".env fallback";
    try {
      await transportOf(config).verify();
      console.log(`✅ Email (SMTP) connected (${label})`);
    } catch (error) {
      console.log(`❌ Email (SMTP) check failed (${label}): ${safeErrorMessage(error, "verify failed")}`);
    }
  } catch (error) {
    console.log(`❌ Email status check failed: ${safeErrorMessage(error, "unknown error")}`);
  }
}

// Escape user-supplied text before interpolating it into email HTML, so an
// issue title / name / reply can't inject links or markup into mail sent from
// the official UniAssist account.
export const escapeHtml = (value) =>
  String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  })[c]);
