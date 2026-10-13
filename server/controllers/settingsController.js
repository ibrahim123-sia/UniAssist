import Setting from "../models/Setting.js";
import { EMAIL_REGEX } from "../models/User.js";
import {
  EMAIL_SETTING_KEY,
  DEFAULT_SENDER_NAME,
  DEFAULT_SMTP_HOST,
  DEFAULT_SMTP_PORT,
  createSmtpTransport,
  encryptSecret,
  getEmailStatus,
  getStoredEmailSettings,
  invalidateEmailCache,
  isEmailNotConfigured,
  safeErrorMessage,
  storedAppPassword,
  transporter,
  escapeHtml,
} from "../services/mailer.js";
import { resetEmailHealthCache } from "./adminHealthController.js";

// Admin → Settings → "University email": the one account that sends OTPs and
// notifications. The app password is verified against the mail server BEFORE
// it is saved, stored encrypted, and never returned or logged.

const VERIFY_TIMEOUT_MS = 15 * 1000;
const MAX_SENDER_NAME = 100;
const MAX_PASSWORD = 200;
const HOST_REGEX = /^(?=.{1,253}$)[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/i;

const withTimeout = (promise, ms, message) =>
  Promise.race([
    promise,
    new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms).unref()),
  ]);

const signInError = (reason) =>
  `Could not sign in to the mail server: ${reason}. For Gmail use an App Password (Google Account → Security → App passwords).`;

// Short, credential-free reason from an SMTP error.
const shortReason = (error) =>
  safeErrorMessage(error, "unknown error").replace(/[.\s]+$/, "").slice(0, 160);

// The public view of the settings — never the password.
async function publicEmailSettings() {
  const [stored, status] = await Promise.all([getStoredEmailSettings(), getEmailStatus()]);
  const envSender = status.source === "env" ? status.senderEmail : "";
  const smtpPort = stored?.smtpPort || DEFAULT_SMTP_PORT;
  return {
    senderEmail: stored?.senderEmail || envSender || "",
    senderName: stored?.senderName || DEFAULT_SENDER_NAME,
    smtpHost: stored?.smtpHost || DEFAULT_SMTP_HOST,
    smtpPort,
    secure: stored ? Boolean(stored.secure) : smtpPort === 465,
    hasPassword: Boolean(stored?.senderEmail && storedAppPassword(stored)),
    source: status.source,
    lastTestAt: stored?.lastTestAt || null,
    lastTestOk: typeof stored?.lastTestOk === "boolean" ? stored.lastTestOk : null,
    lastTestError: stored?.lastTestError || null,
  };
}

// Record the outcome of a verify / test send on the stored settings.
const recordTest = (ok, error, adminId) =>
  Setting.updateOne(
    { key: EMAIL_SETTING_KEY },
    {
      $set: {
        "value.lastTestAt": new Date(),
        "value.lastTestOk": ok,
        "value.lastTestError": ok ? null : error,
        updatedBy: adminId,
      },
    },
    { upsert: true }
  );

// Validate a PUT body → { fields } or { error }.
function parseEmailSettings(body) {
  const { senderEmail, senderName, smtpHost, smtpPort, appPassword, secure } = body ?? {};
  if (typeof senderEmail !== "string" || !EMAIL_REGEX.test(senderEmail.trim().toLowerCase()) || senderEmail.trim().length > 254) {
    return { error: "A valid sender email is required" };
  }
  if (senderName !== undefined && senderName !== null && typeof senderName !== "string") {
    return { error: "senderName must be a string" };
  }
  const name = typeof senderName === "string" ? senderName.replace(/["\\\r\n]/g, "").trim() : "";
  if (name.length > MAX_SENDER_NAME) {
    return { error: `Sender name must be at most ${MAX_SENDER_NAME} characters` };
  }
  if (smtpHost !== undefined && smtpHost !== null && smtpHost !== "" && (typeof smtpHost !== "string" || !HOST_REGEX.test(smtpHost.trim()))) {
    return { error: "SMTP host must be a host name like smtp.gmail.com" };
  }
  let port = DEFAULT_SMTP_PORT;
  if (smtpPort !== undefined && smtpPort !== null && smtpPort !== "") {
    port = typeof smtpPort === "string" && /^\d+$/.test(smtpPort.trim()) ? Number(smtpPort.trim()) : smtpPort;
    if (!Number.isInteger(port) || port < 1 || port > 65535) {
      return { error: "SMTP port must be a whole number from 1 to 65535" };
    }
  }
  if (secure !== undefined && secure !== null && typeof secure !== "boolean") {
    return { error: "secure must be true or false" };
  }
  if (appPassword !== undefined && appPassword !== null && typeof appPassword !== "string") {
    return { error: "appPassword must be a string" };
  }
  if (typeof appPassword === "string" && appPassword.length > MAX_PASSWORD) {
    return { error: "App password is too long" };
  }
  const host = typeof smtpHost === "string" && smtpHost.trim() ? smtpHost.trim().toLowerCase() : DEFAULT_SMTP_HOST;
  // Gmail shows app passwords in groups ("abcd efgh ijkl mnop"); the spaces
  // aren't part of it.
  let password = typeof appPassword === "string" ? appPassword.trim() : "";
  if (host === DEFAULT_SMTP_HOST) password = password.replace(/\s+/g, "");
  return {
    fields: {
      senderEmail: senderEmail.trim().toLowerCase(),
      senderName: name || DEFAULT_SENDER_NAME,
      smtpHost: host,
      smtpPort: port,
      secure: typeof secure === "boolean" ? secure : port === 465,
      appPassword: password,
    },
  };
}

// GET /api/admin/settings/email
export const getEmailSettings = async (req, res) => {
  try {
    res.json({ success: true, settings: await publicEmailSettings() });
  } catch (error) {
    console.error("getEmailSettings error:", error.message);
    res.status(500).json({ success: false, message: "Failed to load email settings" });
  }
};

// PUT /api/admin/settings/email
//   { senderEmail, senderName?, smtpHost?, smtpPort?, secure?, appPassword? }
//   An empty/omitted appPassword keeps the stored one. Signs in to the mail
//   server first — nothing is saved unless that works.
export const updateEmailSettings = async (req, res) => {
  const { fields, error } = parseEmailSettings(req.body);
  if (error) return res.status(400).json({ success: false, message: error });
  try {
    const stored = await getStoredEmailSettings();
    const password = fields.appPassword || storedAppPassword(stored);
    if (!password) {
      return res.status(400).json({ success: false, message: "The app password is required" });
    }

    const transport = createSmtpTransport({
      smtpHost: fields.smtpHost,
      smtpPort: fields.smtpPort,
      secure: fields.secure,
      user: fields.senderEmail,
      pass: password,
    });
    try {
      await withTimeout(transport.verify(), VERIFY_TIMEOUT_MS, "the mail server did not respond in time");
    } catch (verifyError) {
      // Some servers echo the credentials back — never pass the password on.
      const reason = shortReason(verifyError).split(password).join("[hidden]");
      return res.status(400).json({ success: false, message: signInError(reason) });
    } finally {
      try {
        transport.close();
      } catch {
        // nothing open
      }
    }

    await Setting.findOneAndUpdate(
      { key: EMAIL_SETTING_KEY },
      {
        $set: {
          value: {
            senderEmail: fields.senderEmail,
            senderName: fields.senderName,
            smtpHost: fields.smtpHost,
            smtpPort: fields.smtpPort,
            secure: fields.secure,
            appPasswordEnc: encryptSecret(password),
            lastTestAt: new Date(),
            lastTestOk: true,
            lastTestError: null,
          },
          updatedBy: req.user._id,
        },
      },
      { upsert: true }
    );
    invalidateEmailCache();
    resetEmailHealthCache();

    res.json({ success: true, settings: await publicEmailSettings() });
  } catch (err) {
    console.error("updateEmailSettings error:", safeErrorMessage(err));
    res.status(500).json({ success: false, message: "Failed to save email settings" });
  }
};

// POST /api/admin/settings/email/test { to? } — a short test email through the
// active configuration (default recipient: the requesting admin).
export const sendTestEmail = async (req, res) => {
  const { to } = req.body ?? {};
  if (to !== undefined && to !== null && to !== "" && (typeof to !== "string" || !EMAIL_REGEX.test(to.trim().toLowerCase()))) {
    return res.status(400).json({ success: false, message: "Invalid recipient email" });
  }
  const recipient = typeof to === "string" && to.trim() ? to.trim().toLowerCase() : req.user.email;
  try {
    const status = await getEmailStatus();
    const when = new Date().toUTCString();
    try {
      await withTimeout(
        transporter.sendMail({
          to: recipient,
          subject: "UniAssist test email",
          text: `This is a test email from UniAssist (sent ${when}). Email delivery is working.`,
          html: `<p>This is a test email from <strong>UniAssist</strong> (sent ${escapeHtml(when)}).</p><p>Email delivery is working.</p>`,
        }),
        2 * VERIFY_TIMEOUT_MS,
        "the mail server did not respond in time"
      );
    } catch (sendError) {
      if (isEmailNotConfigured(sendError)) {
        return res.status(400).json({
          success: false,
          message: "Email is not configured yet. Save the university email settings first.",
        });
      }
      const reason = shortReason(sendError);
      await recordTest(false, reason, req.user._id).catch(() => {});
      return res.status(502).json({ success: false, message: `The test email could not be sent: ${reason}` });
    }
    await recordTest(true, null, req.user._id).catch(() => {});
    const via = status.source === "env" ? " (using the .env fallback account)" : "";
    res.json({ success: true, message: `Test email sent to ${recipient}${via}` });
  } catch (err) {
    console.error("sendTestEmail error:", safeErrorMessage(err));
    res.status(500).json({ success: false, message: "Failed to send the test email" });
  }
};
