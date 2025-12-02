import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const userSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String, require: true, unique: true },
  password: { type: String, require: true },
  credits: { type: Number, default: 100 },
  otp: { type: String, select: false },
  otpExpires: { type: Date, select: false },
  isVerified: { type: Boolean, default: false },
  resetPasswordOtp: { type: String, select: false },
  resetPasswordExpires: { type: Date, select: false },
});

userSchema.pre("save", async function (next) {
  if (!this.isModified("password")) {
    return next();
  }

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

const User = mongoose.model("User", userSchema);

export default User;

