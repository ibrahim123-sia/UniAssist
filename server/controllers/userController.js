import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import User from "../models/User.js";
import rateLimit from "express-rate-limit";

// OTP rate limiting
const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, 
  message: "Too many OTP requests from this IP, please try again later",
  skipSuccessfulRequests: true,
});

const transporter = nodemailer.createTransport({
  service: "gmail",
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: {
    rejectUnauthorized: false,
  },
});

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Generate JWT
const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: "30d" });
};

// User Registration
export const registerUser = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const userExists = await User.findOne({ email });

    if (userExists?.isVerified) {
      return res.status(409).json({
        success: false,
        message: "User already exists. Please login.",
      });
    }

    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);
    
    if (userExists) {
      userExists.name = name;
      userExists.password = password;
      userExists.otp = otp;
      userExists.otpExpires = otpExpires;
      await userExists.save();
    } else {
      const user = await User.create({
        name,
        email,
        password,
        otp,
        otpExpires,
      });
      await user.save();
    }

    try {
      await transporter.sendMail({
        from: `"UniAssist" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Your OTP Verification Code - UniAssist",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #2c3e50;">Welcome to UniAssist!</h2>
            <p>Hello ${name},</p>
            <p>Your OTP verification code is:</p>
            <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
              <h1 style="margin: 0; color: #2c3e50; letter-spacing: 5px; font-size: 28px;">${otp}</h1>
            </div>
            <p>This code will expire in 5 minutes.</p>
            <p style="font-size: 12px; color: #7f8c8d;">
              If you didn't request this code, please ignore this email.
            </p>
          </div>
        `,
      });

      res.status(200).json({
        success: true,
        message: "OTP sent to your email. Please check your inbox.",
      });
    } catch (emailError) {
      if (!userExists) {
        await User.deleteOne({ email });
      }
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP email. Please try again.",
      });
    }
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  }
};

// Verify OTP
export const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  const cleanOtp = otp?.toString().replace(/\s/g, "");

  if (!email || !cleanOtp) {
    return res.status(400).json({
      success: false,
      message: "Email and OTP are required",
    });
  }

  try {
    const user = await User.findOne({ email }).select("+otp +otpExpires");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Account already verified. Please login.",
      });
    }

    if (!user.otp || user.otp !== cleanOtp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP code",
      });
    }

    if (user.otpExpires < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
      });
    }

    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    await user.save();
    const token = generateToken(user._id);

    res.json({
      success: true,
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        credits: user.credits,
      },
      message: "Account verified successfully!",
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Resend OTP
export const resentOtp = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ message: "Email is required" });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.isVerified) {
      return res.status(400).json({
        message: "Account already verified. Please login.",
      });
    }

    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    try {
      await transporter.sendMail({
        from: `"UniAssist" <${process.env.EMAIL_USER}>`,
        to: email,
        subject: "Your New OTP Verification Code",
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #333;">New OTP Requested</h2>
            <p>Hello ${user.name},</p>
            <p>Your new OTP verification code is:</p>
            <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
              <h1 style="margin: 0; color: #2c3e50; letter-spacing: 5px; font-size: 28px;">${otp}</h1>
            </div>
            <p>This code will expire in 5 minutes.</p>
            <p style="font-size: 12px; color: #7f8c8d;">
              If you didn't request this code, please ignore this email.
            </p>
          </div>
        `,
      });

      res.status(200).json({
        success: true,
        message: "New OTP sent to your email. Please check your inbox.",
      });
    } catch (emailError) {
      console.error("Email sending failed:", emailError);
      return res.status(500).json({
        message: "Failed to send OTP email. Please try again.",
      });
    }
  } catch (err) {
    console.error("Resend OTP error:", err);
    res.status(500).json({
      message: "Server error while resending OTP",
    });
  }
};

// Forgot Password
export const forgetPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required",
    });
  }

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.json({
        success: true,
        message: "If an account exists, an OTP has been sent to your email",
      });
    }

    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    user.resetPasswordOtp = otp;
    user.resetPasswordExpires = otpExpires;
    await user.save();

    await transporter.sendMail({
      from: `"UniAssist" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Password Reset OTP",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #333;">Password Reset Request</h2>
          <p>Hello ${user.name},</p>
          <p>Your OTP for password reset is:</p>
          <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0; border-radius: 5px;">
            <h1 style="margin: 0; color: #2c3e50; letter-spacing: 5px; font-size: 28px;">${otp}</h1>
          </div>
          <p>This code will expire in 5 minutes.</p>
          <p style="font-size: 12px; color: #7f8c8d;">
            If you didn't request this, please ignore this email.
          </p>
        </div>
      `,
    });

    res.json({
      success: true,
      message: "OTP has been sent to your email",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

// Reset Password
export const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "All fields are required",
    });
  }

  try {
    const user = await User.findOne({ email }).select(
      "+resetPasswordOtp +resetPasswordExpires"
    );

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.resetPasswordOtp !== otp) {
      return res.status(400).json({ message: "Invalid OTP" });
    }

    if (user.resetPasswordExpires < new Date()) {
      return res.status(400).json({ message: "OTP expired" });
    }

    user.password = newPassword;
    user.resetPasswordOtp = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ message: "Server error" });
  }
};

// Login User
export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (user) {
      const isMatch = await bcrypt.compare(password, user.password);

      if (isMatch && user.isVerified) {
        const token = generateToken(user._id);
        return res.json({ 
          success: true, 
          token,
          user: {
            id: user._id,
            name: user.name,
            email: user.email,
            credits: user.credits,
          }
        });
      }
    }

    return res.json({ success: false, message: "Invalid email or password" });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};

// Get User Profile
export const getUser = async (req, res) => {
  try {
    const user = req.user;
    return res.json({ 
      success: true, 
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        credits: user.credits,
        createdAt: user.createdAt,
      }
    });
  } catch (error) {
    return res.json({ success: false, message: error.message });
  }
};