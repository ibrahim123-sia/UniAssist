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

// NO PRE-SAVE HOOKS AT ALL - completely remove them
const User = mongoose.model("User", userSchema);

export default User;