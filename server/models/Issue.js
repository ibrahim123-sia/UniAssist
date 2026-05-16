import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
  {
    filename: { type: String, required: true },
    originalName: { type: String, required: true },
    mimeType: { type: String, required: true },
    size: { type: Number, required: true },
    url: { type: String, required: true },
  },
  { _id: false }
);

const replySchema = new mongoose.Schema(
  {
    authorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    authorName: { type: String, required: true },
    authorRole: {
      type: String,
      enum: ["student", "staff"],
      required: true,
    },
    message: { type: String, required: true, trim: true },
    createdAt: { type: Date, default: Date.now },
  },
  { _id: true }
);

const issueSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    studentName: { type: String, required: true },
    studentEmail: { type: String, required: true },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: [true, "Title is required"],
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: [true, "Description is required"],
      trim: true,
    },
    category: {
      type: String,
      trim: true,
      default: "other",
    },
    status: {
      type: String,
      enum: ["Pending", "In Progress", "Resolved", "Closed", "Rejected"],
      default: "Pending",
      index: true,
    },
    // Mandatory when status=Rejected, optional otherwise. Shown to the student.
    rejectionReason: { type: String, trim: true, default: "" },
    attachments: { type: [attachmentSchema], default: [] },
    replies: { type: [replySchema], default: [] },
    assignedTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    // Last write metadata — used by the staff UI to show "Sara just resolved this"
    // banners and for concurrency-conflict messages.
    lastEvent: {
      type: { type: String, enum: ["created", "reply", "status", "assign"], default: "created" },
      byUserId: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
      byName: { type: String, default: "" },
      byRole: { type: String, default: "" },
      at: { type: Date, default: Date.now },
      note: { type: String, default: "" }, // e.g. previous->new status
    },
  },
  { timestamps: true }
);

const Issue = mongoose.model("Issue", issueSchema);

export default Issue;
