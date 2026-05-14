import AuditLog from "../models/AuditLog.js";

// Trim noisy fields out of the recorded payload
const REDACT_KEYS = ["password", "newPassword", "otp", "token"];

const redactPayload = (obj) => {
  if (!obj || typeof obj !== "object") return obj;
  const copy = { ...obj };
  for (const k of Object.keys(copy)) {
    if (REDACT_KEYS.includes(k)) copy[k] = "***";
  }
  return copy;
};

// Wraps res.json so we can capture the status code and the target id from the
// response without changing each controller. Only logs on 2xx.
export const auditAdminWrites = (req, res, next) => {
  if (!req.user || req.user.role !== "admin") return next();
  if (req.method === "GET" || req.method === "HEAD") return next();

  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const targetIdFromBody =
        body?.user?._id ||
        body?.department?._id ||
        body?.issue?._id ||
        "";
      const targetId = req.params?.id || targetIdFromBody || "";
      const action = `${req.method} ${req.baseUrl}${req.route?.path || ""}`.trim();

      AuditLog.create({
        actor: req.user._id,
        actorEmail: req.user.email,
        action,
        method: req.method,
        path: req.originalUrl,
        targetType: req.baseUrl.split("/").pop() || "",
        targetId: String(targetId || ""),
        payload: redactPayload(req.body),
        statusCode: res.statusCode,
        ip: req.ip || req.headers["x-forwarded-for"] || "",
      }).catch((err) => console.error("auditAdminWrites: failed to log", err.message));
    }
    return originalJson(body);
  };
  next();
};
