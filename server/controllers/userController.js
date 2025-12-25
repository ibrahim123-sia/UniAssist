import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import nodemailer from "nodemailer";
import User from "../models/User.js";
import rateLimit from "express-rate-limit";

// Gmail Transporter with App Password - REMOVE SPACES FROM PASSWORD!
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false, // true for 465, false for 587
  auth: {
    user: process.env.EMAIL_USER, // syedibrahimali1111@gmail.com
    pass: process.env.EMAIL_PASS // 16-char App Password NO SPACES
  },
  tls: {
    rejectUnauthorized: false,
    ciphers: 'SSLv3'
  }
});

// Test connection on startup
transporter.verify(function(error, success) {
  if (error) {
    console.log("❌ Gmail SMTP Error:", error.message);
    console.log("Fix: 1) Remove spaces from App Password 2) Enable 2FA on Google");
  } else {
    console.log("✅ Gmail SMTP Connected");
  }
});

// Helper function to hash password
const hashPassword = async (password) => {
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

// OTP rate limiter
export const otpLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  message: "Too many OTP requests from this IP, please try again later",
  skipSuccessfulRequests: true,
});

function generateOtp() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

const generateToken = (id) => {
  const userId = id.toString ? id.toString() : id;
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

// Email sending function
const sendOtpEmail = async (toEmail, name, otp, subject = 'OTP Verification') => {
  try {
    const mailOptions = {
      from: `"UniAssist" <${process.env.EMAIL_USER}>`,
      to: toEmail,
      subject: subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <div style="background: #4a6fa5; color: white; padding: 15px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="margin: 0;">UniAssist Verification</h1>
          </div>
          <div style="padding: 25px;">
            <h2>Hello ${name},</h2>
            <p>Your verification code is:</p>
            <div style="background: #f8f9fa; padding: 25px; text-align: center; margin: 25px 0; border-radius: 8px; border-left: 4px solid #4a6fa5;">
              <div style="font-size: 36px; font-weight: bold; letter-spacing: 10px; color: #2c3e50;">${otp}</div>
            </div>
            <p><strong>This code expires in 5 minutes.</strong></p>
            <div style="background: #fff3cd; padding: 12px; border-radius: 5px; margin: 20px 0; border: 1px solid #ffeaa7;">
              <p style="margin: 0; color: #856404;">
                ⚠️ <strong>For University Emails:</strong> Check your <strong>SPAM or JUNK</strong> folder.
              </p>
            </div>
            <p style="color: #666; font-size: 12px;">
              Sent via Gmail SMTP | UniAssist System
            </p>
          </div>
        </div>
      `,
      text: `UniAssist OTP: ${otp}. Expires in 5 minutes. Check spam folder.`,
      headers: {
        'X-Priority': '1',
        'X-MSMail-Priority': 'High',
        'Importance': 'high'
      }
    };

    const info = await transporter.sendMail(mailOptions);
    console.log(`✅ Email sent to: ${toEmail}`);
    return true;
  } catch (error) {
    console.error('❌ Email error:', error.message);
    return false;
  }
};

export const registerUser = async (req, res) => {
  const { name, email, password } = req.body;

  try {
    const userExists = await User.findOne({ email });

    if (userExists?.isVerified) {
      return res.status(409).json({
        success: false,
        message: "User already exists. Please login",
      });
    }

    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    const hashedPassword = await hashPassword(password);

    if (userExists) {
      userExists.name = name;
      userExists.password = hashedPassword;
      userExists.otp = otp;
      userExists.otpExpires = otpExpires;
      await userExists.save();
    } else {
      await User.create({
        name,
        email,
        password: hashedPassword,
        otp,
        otpExpires,
      });
    }

    // Send OTP via Gmail
    const emailSent = await sendOtpEmail(email, name, otp, 'Your OTP Verification Code');

    if (!emailSent) {
      if (!userExists) {
        await User.deleteOne({ email });
      }
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP. Check App Password (16 chars, no spaces).",
      });
    }

    res.status(200).json({
      success: true,
      message: "OTP sent! Check inbox AND spam folder.",
    });
  } catch (error) {
    console.error("Registration error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

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
      message: "Account verified successfully!",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        isVerified: user.isVerified,
      }
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const resentOtp = async (req, res) => {
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

    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    user.otp = otp;
    user.otpExpires = otpExpires;
    await user.save();

    // Resend via Gmail
    const emailSent = await sendOtpEmail(email, user.name, otp, 'Your New OTP Verification Code');

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to resend OTP. Please try again.",
      });
    }

    res.status(200).json({
      success: true,
      message: "New OTP sent! Check inbox AND spam folder.",
    });
  } catch (err) {
    console.error("Resend OTP error:", err);
    res.status(500).json({
      success: false,
      message: "Server error while resending OTP",
    });
  }
};

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

    // Send password reset via Gmail
    const emailSent = await sendOtpEmail(
      email, 
      user.name, 
      otp, 
      'Password Reset OTP'
    );

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to send reset email. Please try again.",
      });
    }

    res.json({
      success: true,
      message: "Reset OTP sent! Check inbox AND spam folder.",
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

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
      return res.status(404).json({
        success: false,
        message: "User not found",
      });
    }

    if (user.resetPasswordOtp !== otp) {
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
      });
    }

    if (user.resetPasswordExpires < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP expired",
      });
    }

    const hashedPassword = await hashPassword(newPassword);

    user.password = hashedPassword;
    user.resetPasswordOtp = undefined;
    user.resetPasswordExpires = undefined;
    await user.save();

    res.json({
      success: true,
      message: "Password reset successfully",
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error",
    });
  }
};

export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email }).select("+password");
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
      });
    }

    // Check if user is verified
    if (!user.isVerified) {
      return res.status(403).json({
        success: false,
        message: "Account not verified. Please verify your email first.",
        needsVerification: true,
        email: user.email
      });
    }

    const token = generateToken(user._id);

    return res.json({
      success: true,
      token: token,
      message: "Login successful",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        credits: user.credits,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

export const getUser = async (req, res) => {
  try {
    const user = req.user;
    return res.json({
      success: true,
      user,
    });
  } catch (error) {
    console.error("Get user error:", error);
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// TEST ENDPOINT
export const testGmail = async (req, res) => {
  try {
    console.log('Testing Gmail SMTP...');
    console.log('Email:', process.env.EMAIL_USER);
    console.log('Pass length:', process.env.EMAIL_PASS?.length);
    
    // Test connection
    await transporter.verify();
    console.log('✅ SMTP connection verified');
    
    // Send test email
    const testEmail = 'sp23bscs0178@maju.edu.pk';
    const mailOptions = {
      from: `"UniAssist" <${process.env.EMAIL_USER}>`,
      to: testEmail,
      subject: 'Gmail SMTP Test',
      text: 'Test from Gmail SMTP. If received, OTP will work.',
      html: '<h1>Gmail Test</h1><p>Check spam folder too!</p>'
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    console.log('✅ Test sent! ID:', info.messageId);
    
    res.json({
      success: true,
      message: 'Test email sent. Check university email AND spam folder.',
      messageId: info.messageId
    });
    
  } catch (error) {
    console.error('❌ Test error:', error);
    
    let errorMsg = error.message;
    if (errorMsg.includes('Invalid login')) {
      errorMsg = 'Invalid App Password. Regenerate 16-char password (NO SPACES)';
    }
    
    res.status(500).json({
      success: false,
      error: errorMsg,
      fix: '1) Enable 2FA on Google 2) Generate new App Password 3) Copy 16 chars without spaces'
    });
  }
};

// Check if email was sent successfully
export const checkEmailStatus = async (req, res) => {
  try {
    const testEmail = 'sp23bscs0178@maju.edu.pk';
    const mailOptions = {
      from: `"UniAssist Check" <${process.env.EMAIL_USER}>`,
      to: testEmail,
      subject: 'Status Check - ' + new Date().toLocaleTimeString(),
      text: 'Testing email delivery status'
    };
    
    const info = await transporter.sendMail(mailOptions);
    
    res.json({
      success: true,
      status: 'Email queued for delivery',
      messageId: info.messageId,
      time: new Date().toLocaleString(),
      note: 'University emails may take 2-5 minutes. Check spam folder.'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      status: 'Failed to send'
    });
  }
};