// models/User.js
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
  // For email verification
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
  // For password reset
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

// userSchema.pre("save", async function (next) {
//   if (!this.isModified("password")) {
//     return next();
//   }

//   const salt = await bcrypt.genSalt(10);
//   this.password = await bcrypt.hash(this.password, salt);
//   next();
// });


// // Method to compare password
// userSchema.methods.comparePassword = async function (candidatePassword) {
//   return await bcrypt.compare(candidatePassword, this.password);
// };

// // Indexes for faster queries
// userSchema.index({ email: 1 }, { unique: true });

const User = mongoose.model("User", userSchema);
export default User;