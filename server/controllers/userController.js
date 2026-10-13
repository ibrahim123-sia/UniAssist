import fs from "fs";
import path from "path";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import User, { EMAIL_REGEX } from "../models/User.js";
import LoginEvent from "../models/LoginEvent.js";
import {
  transporter,
  escapeHtml,
  isEmailConfigured,
  isEmailNotConfigured,
  EMAIL_NOT_CONFIGURED_MESSAGE,
} from "../services/mailer.js";

const recordLogin = (req, email, userId, success, reason = "") =>
  LoginEvent.create({
    userId: userId || null,
    email: (email || "").toLowerCase(),
    success,
    reason,
    ip: req.ip || req.headers["x-forwarded-for"] || "",
    userAgent: req.headers["user-agent"] || "",
  }).catch((err) => console.error("recordLogin failed:", err.message));

const OTP_TTL_MS = 5 * 60 * 1000;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;
const MAX_OTP_ATTEMPTS = 5;
const MAX_LOGIN_ATTEMPTS = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

// Format: sp/fa + 2-digit year + program + 4-digit roll @maju.edu.pk
// Examples: sp23bscs0178@maju.edu.pk, fa24bsai1234@maju.edu.pk
const MAJU_EMAIL_REGEX = /^(sp|fa)(\d{2})(bscs|bsai|bsse|bsbc)([0-9]{4})@maju\.edu\.pk$/i;
const FIRST_INTAKE_YEAR = 20;

const PROGRAM_CODES = {
  'bscs': 'BS Computer Science',
  'bsai': 'BS Artificial Intelligence',
  'bsse': 'BS Software Engineering',
  'bsbc': 'BS Business Computing'
};

const validateMajuEmail = (email) => {
  if (typeof email !== "string") return { isValid: false, error: "Invalid email format" };
  const trimmedEmail = email.trim().toLowerCase();
  const match = trimmedEmail.match(MAJU_EMAIL_REGEX);
  if (!match) return { isValid: false, error: "Invalid email format" };

  const sessionType = match[1].toLowerCase();
  const yearNum = parseInt(match[2], 10);
  const programCode = match[3].toLowerCase();
  const rollNumber = match[4];

  // Intake year runs from 2020 up to next year (students can register before
  // their first semester starts) — computed so the regex never goes stale.
  const maxYear = (new Date().getFullYear() % 100) + 1;
  if (yearNum < FIRST_INTAKE_YEAR || yearNum > maxYear) {
    return {
      isValid: false,
      error: `Invalid year. Must be between ${FIRST_INTAKE_YEAR} and ${maxYear}`,
    };
  }

  return {
    isValid: true,
    email: trimmedEmail,
    sessionType,
    year: yearNum,
    programCode,
    rollNumber,
    programName: PROGRAM_CODES[programCode],
  };
};

const hashPassword = async (password) => {
  if (!password || password.length < 6) {
    throw new Error("Password must be at least 6 characters long");
  }
  const salt = await bcrypt.genSalt(10);
  return await bcrypt.hash(password, salt);
};

// OTPs come from a CSPRNG and only their sha256 is stored, so a DB read
// doesn't hand out live codes.
const generateOtp = () => crypto.randomInt(100000, 1000000).toString();
const hashOtp = (otp) => crypto.createHash("sha256").update(String(otp)).digest("hex");
const otpMatches = (stored, candidate) => {
  if (!stored) return false;
  const a = Buffer.from(stored, "hex");
  const b = Buffer.from(hashOtp(candidate), "hex");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};
const cleanOtpInput = (otp) => String(otp ?? "").replace(/\s/g, "");

// Compared against when the email doesn't exist so response time doesn't
// reveal which accounts are registered.
const DUMMY_HASH = bcrypt.hashSync("uniassist-timing-equaliser", 10);

const generateToken = (id) => {
  const userId = id.toString ? id.toString() : id;
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: "30d",
  });
};

const cooldownRemaining = (sentAt) => {
  if (!sentAt) return 0;
  const elapsed = Date.now() - new Date(sentAt).getTime();
  return elapsed < OTP_RESEND_COOLDOWN_MS ? Math.ceil((OTP_RESEND_COOLDOWN_MS - elapsed) / 1000) : 0;
};

// Flows that can't work without email answer 503 with this before touching
// any account state (so nothing half-done blocks a retry later).
const emailNotConfigured = (res) =>
  res.status(503).json({ success: false, message: EMAIL_NOT_CONFIGURED_MESSAGE });

// Login / password reset work for every account (students, staff with
// @maju.<dept>.edu addresses, admins) — only REGISTRATION needs a MAJU
// student email.
const normalizeAnyEmail = (email) => {
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  return normalized.length <= 254 && EMAIL_REGEX.test(normalized) ? normalized : null;
};

// → "sent" | "not_configured" | "failed"
const sendOtpEmail = async (toEmail, name, otp, subject = 'OTP Verification') => {
  try {
    await transporter.sendMail({
      to: toEmail,
      subject,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 10px;">
          <div style="background: #4a6fa5; color: white; padding: 15px; border-radius: 10px 10px 0 0; text-align: center;">
            <h1 style="margin: 0;">UniAssist Verification</h1>
          </div>
          <div style="padding: 25px;">
            <h2>Hello ${escapeHtml(name)},</h2>
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
              If you didn't request this code, you can ignore this email.
            </p>
          </div>
        </div>
      `,
      text: `UniAssist OTP: ${otp}. Expires in 5 minutes. Check spam folder.`,
    });
    console.log(`✅ Email sent to: ${toEmail}`);
    return "sent";
  } catch (error) {
    if (isEmailNotConfigured(error)) return "not_configured";
    console.error('❌ Email error:', error.message);
    return "failed";
  }
};

const studentFields = (v) => ({
  program: v.programName,
  rollNumber: v.rollNumber,
  session: v.sessionType,
  admissionYear: 2000 + v.year,
});

export const registerUser = async (req, res) => {
  const { name, email, password } = req.body ?? {};

  if (typeof name !== "string" || typeof email !== "string" || typeof password !== "string"
      || !name || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "All fields (name, email, password) are required"
    });
  }

  const trimmedName = name.trim();
  if (trimmedName.length < 2 || trimmedName.length > 80) {
    return res.status(400).json({
      success: false,
      message: "Name must be between 2 and 80 characters long"
    });
  }

  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: "Password must be at least 6 characters long"
    });
  }

  const emailValidation = validateMajuEmail(email);
  if (!emailValidation.isValid) {
    return res.status(400).json({
      success: false,
      message: emailValidation.error
    });
  }

  try {
    if (!(await isEmailConfigured())) return emailNotConfigured(res);

    const userExists = await User.findOne({ email: emailValidation.email })
      .select("+otpExpires +otpSentAt");

    if (userExists?.isVerified) {
      return res.status(409).json({
        success: false,
        message: "User already exists and is verified. Please login",
        email: userExists.email
      });
    }

    // While a pending registration's OTP is still live, refuse to overwrite it.
    // Otherwise anyone could re-register the same email with their own
    // password, and the real student would verify the attacker's password by
    // entering the newest OTP from their inbox.
    if (userExists && userExists.otpExpires && userExists.otpExpires > Date.now()) {
      const waitSeconds = Math.ceil((userExists.otpExpires - Date.now()) / 1000);
      return res.status(429).json({
        success: false,
        message: "A verification code was already sent to this email. Enter it, use 'Resend OTP', or try again once it expires.",
        retryAfter: waitSeconds,
      });
    }

    const otp = generateOtp();
    const now = new Date();
    const otpFields = {
      otp: hashOtp(otp),
      otpExpires: new Date(now.getTime() + OTP_TTL_MS),
      otpSentAt: now,
      otpAttempts: 0,
    };
    const hashedPassword = await hashPassword(password);

    if (userExists) {
      Object.assign(userExists, {
        name: trimmedName,
        password: hashedPassword,
        ...otpFields,
        ...studentFields(emailValidation),
      });
      await userExists.save();
    } else {
      await User.create({
        name: trimmedName,
        email: emailValidation.email,
        password: hashedPassword,
        ...otpFields,
        ...studentFields(emailValidation),
      });
    }

    const emailResult = await sendOtpEmail(emailValidation.email, trimmedName, otp, 'Your OTP Verification Code');

    if (emailResult !== "sent") {
      // Undo the pending registration so the student can simply try again
      // (a live-looking OTP would otherwise block re-register for 5 minutes).
      if (!userExists) {
        await User.deleteOne({ email: emailValidation.email, isVerified: false });
      } else {
        await User.updateOne(
          { _id: userExists._id, isVerified: false },
          { $unset: { otp: 1, otpExpires: 1, otpSentAt: 1 }, $set: { otpAttempts: 0 } }
        );
      }
      if (emailResult === "not_configured") return emailNotConfigured(res);
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
    } else if (error.message?.includes("password")) {
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
  const { email, otp } = req.body ?? {};

  if (!email || !otp) {
    return res.status(400).json({
      success: false,
      message: "Email and OTP are required"
    });
  }

  const emailValidation = validateMajuEmail(email);
  if (!emailValidation.isValid) {
    return res.status(400).json({
      success: false,
      message: emailValidation.error
    });
  }

  const cleanOtp = cleanOtpInput(otp);
  if (!/^\d{6}$/.test(cleanOtp)) {
    return res.status(400).json({
      success: false,
      message: "OTP must be a 6-digit number"
    });
  }

  try {
    const user = await User.findOne({ email: emailValidation.email })
      .select("+otp +otpExpires +otpAttempts");

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

    // Attempt cap is checked BEFORE comparing, and the OTP is burned once it's
    // hit, so a 6-digit code can't be brute-forced.
    if (!user.otp || (user.otpAttempts || 0) >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        message: "Too many failed OTP attempts. Please request a new OTP.",
        requiresNewOtp: true
      });
    }

    if (!user.otpExpires || user.otpExpires < Date.now()) {
      return res.status(400).json({
        success: false,
        message: "OTP has expired. Please request a new one.",
        requiresNewOtp: true
      });
    }

    if (!otpMatches(user.otp, cleanOtp)) {
      const updated = await User.findOneAndUpdate(
        { _id: user._id },
        { $inc: { otpAttempts: 1 } },
        { returnDocument: "after", projection: "+otpAttempts" }
      );
      const attempts = updated?.otpAttempts ?? MAX_OTP_ATTEMPTS;
      if (attempts >= MAX_OTP_ATTEMPTS) {
        await User.updateOne({ _id: user._id }, { $unset: { otp: 1, otpExpires: 1 } });
        return res.status(429).json({
          success: false,
          message: "Too many failed OTP attempts. Please request a new OTP.",
          requiresNewOtp: true
        });
      }
      return res.status(400).json({
        success: false,
        message: "Invalid OTP code",
        attemptsRemaining: MAX_OTP_ATTEMPTS - attempts
      });
    }

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
      user: serializeUser(user),
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
  const { email } = req.body ?? {};

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required"
    });
  }

  const emailValidation = validateMajuEmail(email);
  if (!emailValidation.isValid) {
    return res.status(400).json({
      success: false,
      message: emailValidation.error
    });
  }

  try {
    if (!(await isEmailConfigured())) return emailNotConfigured(res);

    const user = await User.findOne({ email: emailValidation.email }).select("+otpSentAt");
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

    const waitTime = cooldownRemaining(user.otpSentAt);
    if (waitTime > 0) {
      return res.status(429).json({
        success: false,
        message: `Please wait ${waitTime} seconds before requesting a new OTP`,
        retryAfter: waitTime
      });
    }

    const otp = generateOtp();
    const now = new Date();
    user.otp = hashOtp(otp);
    user.otpExpires = new Date(now.getTime() + OTP_TTL_MS);
    user.otpSentAt = now;
    user.otpAttempts = 0;
    await user.save();

    const emailResult = await sendOtpEmail(emailValidation.email, user.name, otp, 'Your New OTP Verification Code');

    if (emailResult !== "sent") {
      // No cooldown for a code that never went out.
      await User.updateOne(
        { _id: user._id, isVerified: false },
        { $unset: { otp: 1, otpExpires: 1, otpSentAt: 1 }, $set: { otpAttempts: 0 } }
      );
      if (emailResult === "not_configured") return emailNotConfigured(res);
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
  const { email } = req.body ?? {};

  if (!email) {
    return res.status(400).json({
      success: false,
      message: "Email is required"
    });
  }

  const normalizedEmail = normalizeAnyEmail(email);
  if (!normalizedEmail) {
    return res.status(400).json({
      success: false,
      message: "Invalid email format"
    });
  }

  const genericOk = {
    success: true,
    message: "If an account exists with this email, a reset OTP has been sent."
  };

  try {
    if (!(await isEmailConfigured())) return emailNotConfigured(res);

    const user = await User.findOne({ email: normalizedEmail }).select("+resetPasswordSentAt");

    // Don't reveal whether the account exists.
    if (!user) return res.json(genericOk);

    const waitTime = cooldownRemaining(user.resetPasswordSentAt);
    if (waitTime > 0) {
      return res.status(429).json({
        success: false,
        message: `Reset OTP was recently sent. Please wait ${waitTime} seconds before requesting a new one.`,
        retryAfter: waitTime
      });
    }

    const otp = generateOtp();
    const now = new Date();
    user.resetPasswordOtp = hashOtp(otp);
    user.resetPasswordExpires = new Date(now.getTime() + OTP_TTL_MS);
    user.resetPasswordSentAt = now;
    user.resetPasswordAttempts = 0;
    await user.save();

    const emailResult = await sendOtpEmail(normalizedEmail, user.name, otp, 'Password Reset OTP');

    if (emailResult !== "sent") {
      await User.updateOne(
        { _id: user._id },
        { $unset: { resetPasswordOtp: 1, resetPasswordExpires: 1, resetPasswordSentAt: 1 } }
      );
      if (emailResult === "not_configured") return emailNotConfigured(res);
      return res.status(500).json({
        success: false,
        message: "Failed to send reset email. Please try again."
      });
    }

    res.json(genericOk);
  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({
      success: false,
      message: "Server error processing password reset"
    });
  }
};

export const resetPassword = async (req, res) => {
  const { email, otp, newPassword } = req.body ?? {};

  if (!email || !otp || typeof newPassword !== "string" || !newPassword) {
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

  const normalizedEmail = normalizeAnyEmail(email);
  if (!normalizedEmail) {
    return res.status(400).json({
      success: false,
      message: "Invalid email format"
    });
  }

  const cleanOtp = cleanOtpInput(otp);
  const invalid = { success: false, message: "Invalid or expired OTP" };

  try {
    const user = await User.findOne({ email: normalizedEmail }).select(
      "+resetPasswordOtp +resetPasswordExpires +resetPasswordAttempts"
    );

    // Same response as a wrong OTP, so this can't be used to probe accounts.
    if (!user || !user.resetPasswordOtp) return res.status(400).json(invalid);

    if ((user.resetPasswordAttempts || 0) >= MAX_OTP_ATTEMPTS) {
      return res.status(429).json({
        success: false,
        message: "Too many failed attempts. Please request a new reset OTP."
      });
    }

    if (!user.resetPasswordExpires || user.resetPasswordExpires < new Date()) {
      return res.status(400).json({
        success: false,
        message: "OTP expired. Please request a new one."
      });
    }

    if (!otpMatches(user.resetPasswordOtp, cleanOtp)) {
      const updated = await User.findOneAndUpdate(
        { _id: user._id },
        { $inc: { resetPasswordAttempts: 1 } },
        { returnDocument: "after", projection: "+resetPasswordAttempts" }
      );
      const attempts = updated?.resetPasswordAttempts ?? MAX_OTP_ATTEMPTS;
      if (attempts >= MAX_OTP_ATTEMPTS) {
        await User.updateOne(
          { _id: user._id },
          { $unset: { resetPasswordOtp: 1, resetPasswordExpires: 1 } }
        );
        return res.status(429).json({
          success: false,
          message: "Too many failed attempts. Please request a new reset OTP."
        });
      }
      return res.status(400).json({
        success: false,
        message: "Invalid OTP",
        attemptsRemaining: MAX_OTP_ATTEMPTS - attempts
      });
    }

    user.password = await hashPassword(newPassword);
    user.passwordChangedAt = new Date();
    user.resetPasswordOtp = undefined;
    user.resetPasswordExpires = undefined;
    user.resetPasswordAttempts = 0;
    user.loginAttempts = 0;
    user.accountLockedUntil = null;
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
  const { email, password } = req.body ?? {};

  if (typeof email !== "string" || typeof password !== "string" || !email || !password) {
    return res.status(400).json({
      success: false,
      message: "Email and password are required"
    });
  }

  const normalizedEmail = email.trim().toLowerCase();
  if (!EMAIL_REGEX.test(normalizedEmail)) {
    return res.status(400).json({
      success: false,
      message: "Invalid email format"
    });
  }

  try {
    const user = await User.findOne({ email: normalizedEmail })
      .select("+password +loginAttempts +accountLockedUntil");

    if (!user) {
      await bcrypt.compare(password, DUMMY_HASH);
      recordLogin(req, normalizedEmail, null, false, "user_not_found");
      return res.status(401).json({
        success: false,
        message: "Invalid email or password"
      });
    }

    // Lock check comes BEFORE the password compare — otherwise the "locked"
    // message only appears for the right password and confirms it to an attacker.
    if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
      const minutesLeft = Math.ceil((user.accountLockedUntil - new Date()) / (60 * 1000));
      recordLogin(req, normalizedEmail, user._id, false, "locked");
      return res.status(429).json({
        success: false,
        message: `Account is locked. Try again in ${minutesLeft} minute(s).`
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      recordLogin(req, normalizedEmail, user._id, false, "bad_password");
      // Atomic increment so parallel guesses can't all read the same count.
      const updated = await User.findOneAndUpdate(
        { _id: user._id },
        { $inc: { loginAttempts: 1 } },
        { returnDocument: "after", projection: "+loginAttempts" }
      );
      const attempts = updated?.loginAttempts ?? MAX_LOGIN_ATTEMPTS;

      if (attempts >= MAX_LOGIN_ATTEMPTS) {
        await User.updateOne(
          { _id: user._id },
          { $set: { accountLockedUntil: new Date(Date.now() + LOCK_DURATION_MS), loginAttempts: 0 } }
        );
        return res.status(429).json({
          success: false,
          message: "Account temporarily locked due to too many failed attempts. Try again in 15 minutes."
        });
      }

      return res.status(401).json({
        success: false,
        message: "Invalid email or password",
        attemptsRemaining: MAX_LOGIN_ATTEMPTS - attempts
      });
    }

    if (!user.isVerified) {
      recordLogin(req, normalizedEmail, user._id, false, "not_verified");
      return res.status(403).json({
        success: false,
        message: "Account not verified. Please verify your email first.",
        needsVerification: true,
        email: user.email
      });
    }

    if (user.isBlocked) {
      recordLogin(req, normalizedEmail, user._id, false, "blocked");
      return res.status(403).json({
        success: false,
        message: "Your account has been blocked. Please contact the administrator.",
        blocked: true,
      });
    }

    await User.updateOne(
      { _id: user._id },
      { $set: { loginAttempts: 0, accountLockedUntil: null, lastLoginAt: new Date() } }
    );
    recordLogin(req, normalizedEmail, user._id, true);

    return res.json({
      success: true,
      token: generateToken(user._id),
      message: "Login successful",
      user: serializeUser(user),
    });
  } catch (error) {
    console.error("Login error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error during login"
    });
  }
};

function serializeUser(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    program: user.program,
    rollNumber: user.rollNumber,
    session: user.session,
    admissionYear: user.admissionYear,
    isVerified: user.isVerified,
    role: user.role,
    department: user.department,
    staffTitle: user.staffTitle,
    isBlocked: user.isBlocked,
    profilePicture: user.profilePicture || "",
  };
}

export const getUser = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate("department", "code name");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    return res.json({ success: true, user: serializeUser(user) });
  } catch (error) {
    console.error("Get user error:", error);
    return res.status(500).json({
      success: false,
      message: "Server error fetching user data",
    });
  }
};

const removeUploadedFile = (file) => {
  if (file?.path) fs.unlink(file.path, () => {});
};

// ---------------------------------------------------------------------------
// PATCH /api/user/profile
//   Multipart form: optional `avatar` file, optional `name` field.
//   Used by everyone (student / staff / admin) to manage their own profile.
//   Email + role are NOT editable here — admins handle role changes via the
//   admin panel; email changes need re-verification and aren't supported yet.
// ---------------------------------------------------------------------------

export const updateProfile = async (req, res) => {
  try {
    const user = await User.findById(req.user._id);
    if (!user) {
      removeUploadedFile(req.file);
      return res.status(404).json({ success: false, message: "User not found" });
    }

    const { name } = req.body || {};
    if (name !== undefined) {
      const trimmed = String(name).trim();
      if (trimmed.length < 2 || trimmed.length > 80) {
        removeUploadedFile(req.file);
        return res.status(400).json({ success: false, message: "Name must be between 2 and 80 characters" });
      }
      user.name = trimmed;
    }

    if (req.file) {
      // Delete the old avatar file if it was stored locally. Resolve against
      // process.cwd() so this works regardless of how the server was started.
      if (user.profilePicture && user.profilePicture.startsWith("/uploads/avatars/")) {
        const oldPath = path.join(process.cwd(), user.profilePicture.replace(/^\//, ""));
        fs.unlink(oldPath, () => {}); // best-effort; ignore ENOENT
      }
      user.profilePicture = `/uploads/avatars/${req.file.filename}`;
    }

    await user.save();
    const populated = await User.findById(user._id).populate("department", "code name");
    return res.json({ success: true, user: serializeUser(populated) });
  } catch (error) {
    removeUploadedFile(req.file);
    console.error("updateProfile error:", error);
    return res.status(500).json({ success: false, message: "Failed to update profile" });
  }
};

// ---------------------------------------------------------------------------
// POST /api/user/change-password
//   Body: { currentPassword, newPassword }
//   Verifies current password against the hash, then sets a new bcrypt hash.
//   Older tokens are invalidated; a fresh token is returned for this session.
// ---------------------------------------------------------------------------

export const changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (typeof currentPassword !== "string" || typeof newPassword !== "string"
      || !currentPassword || !newPassword) {
    return res.status(400).json({
      success: false,
      message: "Current password and new password are both required",
    });
  }
  if (newPassword.length < 6) {
    return res.status(400).json({
      success: false,
      message: "New password must be at least 6 characters",
    });
  }
  if (currentPassword === newPassword) {
    return res.status(400).json({
      success: false,
      message: "New password must be different from the current one",
    });
  }
  try {
    // `password` is `select: false` on the schema, so we have to ask for it explicitly.
    const user = await User.findById(req.user._id).select("+password");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const matches = await bcrypt.compare(currentPassword, user.password);
    if (!matches) {
      return res.status(401).json({ success: false, message: "Current password is incorrect" });
    }

    user.password = await hashPassword(newPassword);
    user.passwordChangedAt = new Date();
    await user.save();

    return res.json({
      success: true,
      message: "Password changed successfully",
      token: generateToken(user._id),
    });
  } catch (error) {
    console.error("changePassword error:", error);
    return res.status(500).json({ success: false, message: "Failed to change password" });
  }
};
