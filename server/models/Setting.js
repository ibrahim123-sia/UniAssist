import mongoose from "mongoose";

// Small key/value store for settings the admin changes at runtime (e.g. the
// university's outgoing email account under key "email"). Secrets inside a
// value are stored encrypted by the code that owns them (services/mailer.js).
const settingSchema = new mongoose.Schema(
  {
    key: { type: String, required: true, unique: true, trim: true },
    value: { type: mongoose.Schema.Types.Mixed, default: {} },
    updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
  },
  { timestamps: true, minimize: false }
);

const Setting = mongoose.model("Setting", settingSchema);

export default Setting;
