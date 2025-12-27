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

// CORRECTED Regex patterns for email validation
// Format: sp/fa + (20-26) + (bscs|bsai|bsse|bsbc) + (0000-9999) + @maju.edu.pk
// Examples: sp23bscs0178@maju.edu.pk, fa24bsai1234@maju.edu.pk
const MAJU_EMAIL_REGEX = /^(sp|fa)(2[0-6])(bscs|bsai|bsse|bsbc)([0-9]{4})@maju\.edu\.pk$/i;

// Program codes mapping - Updated to only include specified programs
const PROGRAM_CODES = {
  'bscs': 'BS Computer Science',
  'bsai': 'BS Artificial Intelligence',
  'bsse': 'BS Software Engineering',
  'bsbc': 'BS Business Computing'
};

// Helper function to validate MAJU email
const validateMajuEmail = (email) => {
  const trimmedEmail = email.trim().toLowerCase();
  const match = trimmedEmail.match(MAJU_EMAIL_REGEX);
  
  if (!match) {
    return {
      isValid: false,
      error: "Invalid email format"
    };
  }
  
  // Extract parts from regex groups
  const sessionType = match[1]?.toLowerCase(); // sp or fa
  const year = match[2]; // 20-26
  const programCode = match[3]?.toLowerCase(); // bscs, bsai, bsse, bsbc
  const rollNumber = match[4]; // 0178, 1234, etc. (0000-9999)
  
  // Validate session (sp or fa) - regex already ensures this
  if (!['sp', 'fa'].includes(sessionType)) {
    return {
      isValid: false,
      error: "Invalid session. Must be 'sp' (Spring) or 'fa' (Fall)"
    };
  }
  
  // Validate year (20-26) - regex already ensures this but double-check
  const yearNum = parseInt(year);
  if (yearNum < 20 || yearNum > 26) {
    return {
      isValid: false,
      error: "Invalid year. Must be between 20 and 26 (2020-2026)"
    };
  }
  
  // Validate program code - regex already ensures this but double-check
  if (!PROGRAM_CODES[programCode]) {
    const validPrograms = Object.keys(PROGRAM_CODES).join(', ');
    return {
      isValid: false,
      error: `Invalid program code. Valid codes: ${validPrograms}`
    };
  }
  
  // Validate roll number (0000-9999) - regex already ensures 4 digits
  const rollNum = parseInt(rollNumber);
  if (rollNum < 0 || rollNum > 9999) {
    return {
      isValid: false,
      error: "Invalid roll number. Must be between 0000 and 9999"
    };
  }
  
  return {
    isValid: true,
    email: trimmedEmail,
    sessionType,
    year: yearNum,
    programCode,
    rollNumber: rollNumber, // Keep as string with leading zeros
    programName: PROGRAM_CODES[programCode],
    fullFormat: `${sessionType}${year}${programCode}${rollNumber}@maju.edu.pk`
  };
};

// Helper function to hash password
const hashPassword = async (password) => {
  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters long");
  }
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

  // Input validation
  if (!name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "All fields (name, email, password) are required"
    });
  }

  if (name.length < 2) {
    return res.status(400).json({
      success: false,
      message: "Name must be at least 2 characters long"
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 6 characters long"
    });
  }

  // Validate MAJU email format
  const emailValidation = validateMajuEmail(email);
  if (!emailValidation.isValid) {
    return res.status(400).json({
      success: false,
      message: emailValidation.error
    });
  }

  try {
    const userExists = await User.findOne({ email: emailValidation.email });

    // Check if user is already verified
    if (userExists?.isVerified) {
      return res.status(409).json({
        success: false,
        message: "User already exists and is verified. Please login",
        email: userExists.email
      });
    }

    // Check if user exists but not verified
    if (userExists && !userExists.isVerified) {
      // Check if OTP was recently sent (cooldown period)
      if (userExists.otpExpires && userExists.otpExpires > Date.now() - 60000) {
        return res.status(429).json({
          success: false,
          message: "OTP was recently sent. Please wait 1 minute before requesting a new one",
          retryAfter: Math.ceil((userExists.otpExpires - Date.now() + 60000) / 1000)
        });
      }
    }

    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    const hashedPassword = await hashPassword(password);

    if (userExists) {
      // Update existing unverified user
      userExists.name = name;
      userExists.password = hashedPassword;
      userExists.otp = otp;
      userExists.otpExpires = otpExpires;
      userExists.program = emailValidation.programName;
      userExists.rollNumber = emailValidation.rollNumber;
      userExists.session = emailValidation.sessionType;
      userExists.year = emailValidation.year;
      await userExists.save();
    } else {
      // Create new user
      await User.create({
        name,
        email: emailValidation.email,
        password: hashedPassword,
        otp,
        otpExpires,
        program: emailValidation.programName,
        rollNumber: emailValidation.rollNumber,
        session: emailValidation.sessionType,
        year: emailValidation.year,
        admissionYear: 2000 + emailValidation.year, // Convert 23 to 2023
        isMajuStudent: true
      });
    }

    // Send OTP via Gmail
    const emailSent = await sendOtpEmail(emailValidation.email, name, otp, 'Your OTP Verification Code');

    if (!emailSent) {
      // Cleanup if email failed and user was newly created
      if (!userExists) {
        await User.deleteOne({ email: emailValidation.email });
      }
      return res.status(500).json({
        success: false,
        message: "Failed to send OTP. Please try again later.",
      });
    }

    res.status(200).json({
      success: true,
      message: "OTP sent! Check your inbox AND spam folder.",
      email: emailValidation.email,
      program: emailValidation.programName,
      session: emailValidation.sessionType.toUpperCase(),
      year: `20${emailValidation.year}`,
      rollNumber: emailValidation.rollNumber
    });
  } catch (error) {
    console.error("Registration error:", error);
    
    let errorMessage = "Registration failed. Please try again.";
    let statusCode = 500;

    if (error.code === 11000) {
      errorMessage = "Email already exists";
      statusCode = 409;
    } else if (error.message.includes("password")) {
      errorMessage = error.message;
      statusCode = 400;
    }

    return res.status(statusCode).json({
      success: false,
      message: errorMessage,
    });
  }
};

export const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;

  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      message: "Email and OTP are required"
    });
  }

  // Validate MAJU email format
  const emailValidation = validateMajuEmail(email);
  if (!emailValidation.isValid) {
    return res.status(400).json({
      success: false,
      message: emailValidation.error
    });
  }

  const cleanOtp = otp.toString().replace(/\s/g, "");

  if (cleanOtp.length !== 6 || !/^\d{6}$/.test(cleanOtp)) {
    return res.status(400).json({
      success: false,
      message: "OTP must be a 6-digit number"
    });
  }

  try {
    const user = await User.findOne({ email: emailValidation.email }).select("+otp +otpExpires");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found. Please register first."
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Account already verified. Please login.",
        email: user.email
      });
    }

    if (!user.otp || user.otp !== cleanOtp) {
      // Increment failed attempts
      user.otpAttempts = (user.otpAttempts || 0) + 1;
      await user.save();

      if (user.otpAttempts >= 5) {
        return res.status(429).json({
          success: false,
          message: "Too many failed OTP attempts. Please request a new OTP.",
          requiresNewOtp: true
        });
      }

      return res.status(400).json({
        success: false,
        message: "Invalid OTP code",
        attemptsRemaining: 5 - user.otpAttempts
      });
    }

    if (user.otpExpires < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
        requiresNewOtp: true
      });
    }

    // Clear OTP attempts on successful verification
    user.isVerified = true;
    user.otp = undefined;
    user.otpExpires = undefined;
    user.otpAttempts = 0;
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
        program: user.program,
        rollNumber: user.rollNumber,
        session: user.session,
        admissionYear: user.admissionYear,
        isVerified: user.isVerified,
        isMajuStudent: user.isMajuStudent
      }
    });
  } catch (error) {
    console.error("OTP verification error:", error);
    res.status(500).json({
      success: false,
      message: "Server error during OTP verification"
    });
  }
};

export const resentOtp = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required"
    });
  }

  // Validate MAJU email format
  const emailValidation = validateMajuEmail(email);
  if (!emailValidation.isValid) {
    return res.status(400).json({
      success: false,
      message: emailValidation.error
    });
  }

  try {
    const user = await User.findOne({ email: emailValidation.email });
    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found. Please register first."
      });
    }

    if (user.isVerified) {
      return res.status(400).json({
        success: false,
        message: "Account already verified. Please login."
      });
    }

    // Check cooldown period (1 minute)
    if (user.otpExpires && user.otpExpires > Date.now() - 60000) {
      const waitTime = Math.ceil((user.otpExpires - Date.now() + 60000) / 1000);
      return res.status(429).json({
        success: false,
        message: `Please wait ${waitTime} seconds before requesting a new OTP`,
        retryAfter: waitTime
      });
    }

    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    user.otp = otp;
    user.otpExpires = otpExpires;
    user.otpAttempts = 0; // Reset attempts
    await user.save();

    // Resend via Gmail
    const emailSent = await sendOtpEmail(emailValidation.email, user.name, otp, 'Your New OTP Verification Code');

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to resend OTP. Please try again."
      });
    }

    res.status(200).json({
      success: true,
      message: "New OTP sent! Check inbox AND spam folder.",
      email: emailValidation.email
    });
  } catch (err) {
    console.error("Resend OTP error:", err);
    res.status(500).json({
      success: false,
      message: "Server error while resending OTP"
    });
  }
};

export const forgetPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required"
    });
  }

  // Validate MAJU email format
  const emailValidation = validateMajuEmail(email);
  if (!emailValidation.isValid) {
    return res.status(400).json({
      success: false,
      message: emailValidation.error
    });
  }

  try {
    const user = await User.findOne({ email: emailValidation.email });
    
    // Always return success for security (don't reveal if user exists)
    if (!user) {
      return res.json({
        success: true,
        message: "If an account exists with this email, a reset OTP has been sent."
      });
    }

    // Check if password reset was recently requested
    if (user.resetPasswordExpires && user.resetPasswordExpires > Date.now() - 60000) {
      return res.status(429).json({
        success: false,
        message: "Reset OTP was recently sent. Please wait 1 minute before requesting a new one."
      });
    }

    const otp = generateOtp();
    const otpExpires = new Date(Date.now() + 5 * 60 * 1000);

    user.resetPasswordOtp = otp;
    user.resetPasswordExpires = otpExpires;
    await user.save();

    // Send password reset via Gmail
    const emailSent = await sendOtpEmail(
      emailValidation.email, 
      user.name, 
      otp, 
      'Password Reset OTP'
    );

    if (!emailSent) {
      return res.status(500).json({
        success: false,
        message: "Failed to send reset email. Please try again."
      });
    }

    res.json({
      success: true,
      message: "Reset OTP sent! Check inbox AND spam folder."
    });
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error processing password reset"
    });
  }
};

export const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body;

  if (!email || !otp || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "All fields (email, OTP, new password) are required"
    });
  }

  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 6 characters long"
    });
  }

  // Validate MAJU email format
  const emailValidation = validateMajuEmail(email);
  if (!emailValidation.isValid) {
    return res.status(400).json({
      success: false,
      message: emailValidation.error
    });
  }

  const cleanOtp = otp.toString().replace(/\s/g, "");

  try {
    const user = await User.findOne({ email: emailValidation.email }).select(
      "+resetPasswordOtp +resetPasswordExpires"
    );

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found"
      });
    }

    if (user.resetPasswordOtp !== cleanOtp) {
      // Increment failed attempts
      user.resetPasswordAttempts = (user.resetPasswordAttempts || 0) + 1;
      await user.save();

      if (user.resetPasswordAttempts >= 5) {
        return res.status(429).json({
          success: false,
          message: "Too many failed attempts. Please request a new reset OTP."
        });
      }

      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
        attemptsRemaining: 5 - user.resetPasswordAttempts
      });
    }

    if (user.resetPasswordExpires < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP expired. Please request a new one."
      });
    }

    const hashedPassword = await hashPassword(newPassword);

    user.password = hashedPassword;
    user.resetPasswordOtp = undefined;
    user.resetPasswordExpires = undefined;
    user.resetPasswordAttempts = 0;
    await user.save();

    res.json({
      success: true,
      message: "Password reset successfully. You can now login with your new password."
    });
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error resetting password"
    });
  }
};

export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required"
    });
  }

  // Validate MAJU email format
  const emailValidation = validateMajuEmail(email);
  if (!emailValidation.isValid) {
    return res.status(400).json({
      success: false,
      message: emailValidation.error
    });
  }

  try {
    const user = await User.findOne({ email: emailValidation.email }).select("+password");
    
    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      // Increment failed login attempts
      user.loginAttempts = (user.loginAttempts || 0) + 1;
      user.lastLoginAttempt = new Date();
      await user.save();

      if (user.loginAttempts >= 5) {
        // Lock account for 15 minutes
        user.accountLockedUntil = new Date(Date.now() + 15 * 60 * 1000);
        await user.save();

        return res.status(429).json({
          success: false,
          message: "Account temporarily locked due to too many failed attempts. Try again in 15 minutes."
        });
      }

      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
        attemptsRemaining: 5 - user.loginAttempts
      });
    }

    // Check if account is locked
    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.accountLockedUntil - new Date()) / (60 * 1000));
      return res.status(429).json({
        success: false,
        message: `Account is locked. Try again in ${minutesLeft} minute(s).`
      });
    }

    // Reset login attempts on successful login
    user.loginAttempts = 0;
    user.accountLockedUntil = undefined;
    await user.save();

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
        program: user.program,
        rollNumber: user.rollNumber,
        session: user.session,
        admissionYear: user.admissionYear,
        credits: user.credits,
        isVerified: user.isVerified,
        isMajuStudent: user.isMajuStudent
      },
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during login"
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
      message: "Server error fetching user data"
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
    
    // Send test email with a valid format
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
      messageId: info.messageId,
      testEmail: testEmail,
      emailFormat: 'Valid format: sp23bscs0178@maju.edu.pk'
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
      note: 'University emails may take 2-5 minutes. Check spam folder.',
      validFormat: 'sp23bscs0178@maju.edu.pk',
      regexPattern: '^(sp|fa)(2[0-6])(bscs|bsai|bsse|bsbc)([0-9]{4})@maju\\.edu\\.pk$'
    });
    
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
      status: 'Failed to send'
    });
  }
};

// Export email validator for use in other files
export const validateEmailFormat = (email) => {
  return validateMajuEmail(email);
};

// Test email validation function
export const testEmailValidation = async (req, res) => {
  const { email } = req.query;
  
  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Please provide an email parameter",
      example: "/api/auth/test-email?email=sp23bscs0178@maju.edu.pk"
    });
  }
  
  const validation = validateMajuEmail(email);
  
  // Test with sample valid emails
  const sampleEmails = [
    'sp23bscs0178@maju.edu.pk',
    'fa24bsai1234@maju.edu.pk',
    'sp20bsse5678@maju.edu.pk',
    'fa26bsbc9999@maju.edu.pk'
  ];
  
  const sampleResults = sampleEmails.map(sample => ({
    email: sample,
    isValid: validateMajuEmail(sample).isValid
  }));
  
  return res.json({
    success: true,
    validationResult: validation,
    sampleTests: sampleResults,
    regexPattern: MAJU_EMAIL_REGEX.toString(),
    validFormat: "[sp/fa][20-26][bscs|bsai|bsse|bsbc][0000-9999]@maju.edu.pk",
    validPrograms: Object.keys(PROGRAM_CODES),
    yearsRange: "20-26 (represents 2020-2026)"
  });
};