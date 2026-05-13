import express from "express";
import "dotenv/config";
import cors from "cors";
import fs from "fs";
import path from "path";
import connectDB from "./config/db.js";
import userRouter from "./routes/userRoutes.js";
import chatRouter from "./routes/chatRoutes.js";
import messageRouter from "./routes/messageRoutes.js";
import guestChatRoutes from "./routes/guestChatRoutes.js";
import issueRouter from "./routes/issueRoutes.js";
import departmentRouter from "./routes/departmentRoutes.js";
import notificationRouter from "./routes/notificationRoutes.js";
import adminRouter from "./routes/adminRoutes.js";

const app = express();
await connectDB();

const UPLOAD_ROOT = "uploads";
const UPLOAD_ISSUES = path.join(UPLOAD_ROOT, "issues");
if (!fs.existsSync(UPLOAD_ISSUES)) fs.mkdirSync(UPLOAD_ISSUES, { recursive: true });

// Middleware
app.use(cors());
// Increase payload limit for voice messages
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ limit: '10mb', extended: true }));

app.use("/uploads", express.static(UPLOAD_ROOT));

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

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`UniAssist Server is running on port ${PORT}`);
});