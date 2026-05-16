import mongoose from "mongoose";

const userSchema = new mongoose.Schema({
  name: {
    type: String,
    trim: true,
    required: [true, 'Name is required']
  },
  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^[\w-\.]+@([\w-]+\.)+[\w-]{2,4}$/, 'Please enter a valid email']
  },
  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [6, 'Password must be at least 6 characters'],
    select: false
  },
  otp: {
    type: String,
    select: false
  },
  otpExpires: {
    type: Date,
    select: false
  },
  isVerified: {
    type: Boolean,
    default: false
  },
  resetPasswordOtp: {
    type: String,
    select: false
  },
  resetPasswordExpires: {
    type: Date,
    select: false
  },
  role: {
    type: String,
    enum: ["student", "staff", "admin"],
    default: "student",
    index: true,
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Department",
    default: null,
    index: true,
  },
  staffTitle: {
    type: String,
    default: null,
  },
  profilePicture: {
    // Relative URL under /uploads/avatars/ — client prepends VITE_SERVER_URL.
    // Empty string = fall back to initial-letter avatar.
    type: String,
    default: "",
  },
  isBlocked: {
    type: Boolean,
    default: false,
  },
  lastLoginAt: {
    type: Date,
    default: null,
  },
  flags: {
    type: [
      new mongoose.Schema(
        {
          type: { type: String, default: "inappropriate_language" },
          message: { type: String, default: "" },
          matches: { type: [String], default: [] },
          chatId: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", default: null },
          timestamp: { type: Date, default: Date.now },
        },
        { _id: true }
      ),
    ],
    default: [],
  },
}, {
  timestamps: true
});

const User = mongoose.model("User", userSchema);

export default User;
