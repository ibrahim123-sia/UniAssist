import mongoose from "mongoose";

const auditLogSchema = new mongoose.Schema(
  {
    actor: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    actorEmail: { type: String, required: true },
    action: { type: String, required: true, index: true },
    method: { type: String, required: true },
    path: { type: String, required: true },
    targetType: { type: String, default: "" },
    targetId: { type: String, default: "" },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    statusCode: { type: Number, default: 200 },
    ip: { type: String, default: "" },
  },
  { timestamps: true }
);

auditLogSchema.index({ createdAt: -1 });

const AuditLog = mongoose.model("AuditLog", auditLogSchema);

export default AuditLog;
