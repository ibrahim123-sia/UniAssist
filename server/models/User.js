import mongoose from "mongoose";

// Shared by the schema, login and admin staff-email validation so they can't
// disagree (a TLD that passes one but fails the other used to 500 on save).
export const EMAIL_REGEX = /^[\w.-]+@([\w-]+\.)+[\w-]{2,24}$/;

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
    match: [EMAIL_REGEX, 'Please enter a valid email']
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
  // OTPs above are stored as sha256 hashes. *SentAt drives the 60s resend
  // cooldown; *Attempts caps wrong guesses per issued OTP.
  otpSentAt: { type: Date, select: false },
  otpAttempts: { type: Number, default: 0, select: false },
  resetPasswordSentAt: { type: Date, select: false },
  resetPasswordAttempts: { type: Number, default: 0, select: false },
  // Login lockout: 5 wrong passwords → locked for 15 minutes.
  loginAttempts: { type: Number, default: 0, select: false },
  accountLockedUntil: { type: Date, default: null, select: false },
  // Tokens issued before this moment are rejected by `protect`.
  passwordChangedAt: { type: Date, default: null },
  // Student details parsed from the MAJU email at registration.
  program: { type: String, default: null },
  rollNumber: { type: String, default: null },
  session: { type: String, default: null },
  admissionYear: { type: Number, default: null },
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
