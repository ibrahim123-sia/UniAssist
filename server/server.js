import express from "express";
import "dotenv/config";
import cors from "cors";
import connectDB from "./config/db.js";
import { UPLOAD_ROOT } from "./middlewares/upload.js";
import userRouter from "./routes/userRoutes.js";
import chatRouter from "./routes/chatRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import guestChatRoutes from "./routes/guestChatRoutes.js";
import issueRouter from "./routes/issueRoutes.js";
import departmentRouter from "./routes/departmentRoutes.js";
import notificationRouter from "./routes/notificationRoutes.js";
import adminRouter from "./routes/adminRoutes.js";
import listingRouter from "./routes/listingRoutes.js";
import questionRouter from "./routes/questionRoutes.js";
import { startSchedulers } from "./services/scheduler.js";
import { logEmailStatus } from "./services/mailer.js";

// Fail fast on missing config instead of failing on the first request.
// Email is NOT required here: the admin sets the university's account in
// Admin → Settings (EMAIL_USER / EMAIL_PASS stay as an optional fallback).
const REQUIRED_ENV = ["MONGODB_URI", "JWT_SECRET", "INTERNAL_SECRET"];
const missingEnv = REQUIRED_ENV.filter((k) => !process.env[k]);
if (missingEnv.length) {
  console.error(`Missing required environment variables: ${missingEnv.join(", ")}`);
  process.exit(1);
}

const app = express();
await connectDB();
// Logs whether email works (and from where) — never blocks or crashes startup.
logEmailStatus();
// SLA escalation timer (skipped when NODE_ENV=test / DISABLE_SCHEDULERS=true).
startSchedulers();

// Behind a reverse proxy (TRUST_PROXY=1) req.ip must come from
// X-Forwarded-For, or every visitor shares the proxy's IP in rate limits.
if (process.env.TRUST_PROXY) app.set("trust proxy", Number(process.env.TRUST_PROXY) || process.env.TRUST_PROXY);

// Only the web client may call the API from a browser. CLIENT_URL may hold a
// comma-separated list (e.g. local dev + production).
const allowedOrigins = (process.env.CLIENT_URL || "http://localhost:5173")
  .split(",")
  .map((o) => o.trim())
  .filter(Boolean);
app.use(cors({ origin: allowedOrigins }));

app.use((req, res, next) => {
  res.set("X-Content-Type-Options", "nosniff");
  next();
});

// Small default body limit. The voice routes (base64 audio) skip it here and
// apply their own larger parser in messageRoutes.js.
const AUDIO_ROUTES = new Set(["/api/message/voice", "/api/message/transcribe"]);
const defaultJson = express.json({ limit: "100kb" });
app.use((req, res, next) => (AUDIO_ROUTES.has(req.path) ? next() : defaultJson(req, res, next)));
app.use(express.urlencoded({ limit: "100kb", extended: true }));

// Uploaded files: random UUID names with an extension derived from an
// allow-listed MIME type (PDF / images only), served with nosniff.
app.use(`/${UPLOAD_ROOT}`, express.static(UPLOAD_ROOT));

// Routes
app.get("/", (req, res) => res.send("UniAssist Server is Live"));
app.use("/api/user", userRouter);
app.use("/api/chat", chatRouter);
app.use("/api/message", messageRouter);
app.use("/api/guest", guestChatRoutes);
app.use("/api/issue", issueRouter);
app.use("/api/department", departmentRouter);
app.use("/api/notification", notificationRouter);
app.use("/api/admin", adminRouter);
app.use("/api/listings", listingRouter);
app.use("/api/question", questionRouter);

app.use((req, res) => {
  res.status(404).json({ success: false, message: "Not found" });
});

// Last-resort handler: malformed JSON, oversized bodies and anything a
// controller didn't catch get a JSON error instead of an HTML stack trace.
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = err.status || err.statusCode || 500;
  if (status >= 500) console.error("Unhandled error:", err);
  const message =
    err.type === "entity.too.large" ? "Request body too large"
    : status === 400 ? "Bad request"
    : status < 500 ? err.message
    : "Server error";
  res.status(status).json({ success: false, message });
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`UniAssist Server is running on port ${PORT}`);
});
