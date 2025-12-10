import mongoose from "mongoose";
import bcrypt from "bcryptjs";

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
  credits: { 
    type: Number, 
    default: 100,
    min: [0, 'Credits cannot be negative']
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
  }
}, {
  timestamps: true
});

// CORRECTED Password hash middleware
userSchema.pre("save", async function (next) {
  // Only hash the password if it's modified (or new)
  if (!this.isModified("password")) return next();
  
  try {
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Method to compare password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

const User = mongoose.model("User", userSchema);
export default User;