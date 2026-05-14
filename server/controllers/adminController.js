import bcrypt from "bcryptjs";
import crypto from "crypto";
import User from "../models/User.js";
import Department from "../models/Department.js";
import Issue from "../models/Issue.js";
import Chat from "../models/Chat.js";
import { notify } from "../services/notify.js";

const sanitizeNamePart = (s) =>
  (s || "")
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[^a-z0-9]/g, "");

const buildStaffEmail = async (name, deptCode) => {
  const parts = (name || "").trim().split(/\s+/).filter(Boolean);
  let local;
  if (parts.length === 0) local = "staff";
  else if (parts.length === 1) local = sanitizeNamePart(parts[0]);
  else local = sanitizeNamePart(parts[0]) + sanitizeNamePart(parts[parts.length - 1]);
  if (!local) local = "staff";
  const domain = `maju.${(deptCode || "general").toLowerCase()}.edu`;
  let candidate = `${local}@${domain}`;
  let suffix = 1;
  while (await User.findOne({ email: candidate })) {
    candidate = `${local}${suffix}@${domain}`;
    suffix += 1;
  }
  return candidate;
};

const generatePassword = () => {
  const upper = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  const lower = "abcdefghjkmnpqrstuvwxyz";
  const digits = "23456789";
  const all = upper + lower + digits;
  const rand = (set) => set[crypto.randomInt(0, set.length)];
  const chars = [rand(upper), rand(upper), rand(lower), rand(lower), rand(digits), rand(digits)];
  for (let i = chars.length; i < 12; i++) chars.push(rand(all));
  // Shuffle
  for (let i = chars.length - 1; i > 0; i--) {
    const j = crypto.randomInt(0, i + 1);
    [chars[i], chars[j]] = [chars[j], chars[i]];
  }
  return chars.join("");
};

export const listUsers = async (req, res) => {
  try {
    const { role, departmentId, isBlocked, search, flaggedOnly } = req.query;
    const limit = Math.min(parseInt(req.query.limit) || 25, 100);
    const offset = Math.max(parseInt(req.query.offset) || 0, 0);
    const filter = {};
    if (role) filter.role = role;
    if (departmentId) filter.department = departmentId;
    if (isBlocked !== undefined) filter.isBlocked = isBlocked === "true";
    if (flaggedOnly === "true") filter["flags.0"] = { $exists: true };
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    const [users, total] = await Promise.all([
      User.find(filter)
        .populate("department", "code name")
        .sort({ createdAt: -1 })
        .skip(offset)
        .limit(limit),
      User.countDocuments(filter),
    ]);
    res.json({ success: true, users, total });
  } catch (error) {
    console.error("listUsers error:", error);
    res.status(500).json({ success: false, message: "Failed to list users" });
  }
};

export const getUserActivity = async (req, res) => {
  try {
    const user = await User.findById(req.params.id).populate("department", "code name");
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    const [issues, chats] = await Promise.all([
      Issue.find({ studentId: user._id })
        .populate("department", "code name")
        .sort({ createdAt: -1 })
        .limit(20)
        .select("title status category department createdAt updatedAt"),
      Chat.find({ userId: user._id })
        .sort({ updatedAt: -1 })
        .limit(20)
        .select("name messages updatedAt createdAt"),
    ]);

    const chatSummaries = chats.map((c) => ({
      _id: c._id,
      name: c.name,
      messageCount: c.messages?.length || 0,
      lastMessage: c.messages?.[c.messages.length - 1]?.content?.slice(0, 80) || "",
      updatedAt: c.updatedAt,
      createdAt: c.createdAt,
    }));

    res.json({
      success: true,
      user,
      activity: {
        issues,
        chats: chatSummaries,
        flags: (user.flags || []).slice(-50).reverse(),
        lastLoginAt: user.lastLoginAt,
      },
    });
  } catch (error) {
    console.error("getUserActivity error:", error);
    res.status(500).json({ success: false, message: "Failed to load activity" });
  }
};

export const updateUser = async (req, res) => {
  const { role, departmentId, staffTitle } = req.body;
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });

    if (role !== undefined) {
      if (!["student", "staff", "admin"].includes(role)) {
        return res.status(400).json({ success: false, message: "Invalid role" });
      }
      user.role = role;
    }

    if (departmentId !== undefined) {
      if (departmentId === null || departmentId === "") {
        user.department = null;
      } else {
        const dept = await Department.findById(departmentId);
        if (!dept) return res.status(400).json({ success: false, message: "Invalid department" });
        user.department = dept._id;
      }
    }

    if (staffTitle !== undefined) user.staffTitle = staffTitle;

    if (user.role === "staff" && !user.department) {
      return res.status(400).json({
        success: false,
        message: "Staff users must have a department",
      });
    }

    await user.save();
    res.json({ success: true, user });
  } catch (error) {
    console.error("updateUser error:", error);
    res.status(500).json({ success: false, message: "Failed to update user" });
  }
};

export const blockUser = async (req, res) => {
  const { isBlocked } = req.body;
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ success: false, message: "User not found" });
    if (user._id.toString() === req.user._id.toString()) {
      return res.status(400).json({ success: false, message: "Cannot block yourself" });
    }
    user.isBlocked = !!isBlocked;
    await user.save();
    res.json({ success: true, user });
  } catch (error) {
    console.error("blockUser error:", error);
    res.status(500).json({ success: false, message: "Failed to update block status" });
  }
};

export const createStaffUser = async (req, res) => {
  const { name, departmentId, staffTitle } = req.body;
  if (!name || !departmentId) {
    return res.status(400).json({
      success: false,
      message: "name and departmentId are required",
    });
  }
  try {
    const dept = await Department.findById(departmentId);
    if (!dept) return res.status(400).json({ success: false, message: "Invalid department" });

    const email = await buildStaffEmail(name, dept.code);
    const password = generatePassword();
    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);

    const user = await User.create({
      name,
      email,
      password: hashed,
      role: "staff",
      department: dept._id,
      staffTitle: staffTitle || dept.code,
      isVerified: true,
    });

    // Email the staff member their credentials (don't fail the request if SMTP misfires)
    notify(user, {
      type: "issue_created",
      message: "Your UniAssist staff account is ready",
      emailSubject: "Welcome to UniAssist — Your Staff Credentials",
      emailHeading: `Welcome, ${name}`,
      emailBody: `An administrator created a staff account for you on UniAssist (${dept.name}).<br/><br/><strong>Email:</strong> ${email}<br/><strong>Password:</strong> ${password}<br/><br/>Please log in and change your password as soon as possible.`,
      link: "/login",
    }).catch((err) => console.error("staff welcome email failed", err.message));

    res.status(201).json({
      success: true,
      user,
      credentials: { email, password },
    });
  } catch (error) {
    console.error("createStaffUser error:", error);
    res.status(500).json({ success: false, message: "Failed to create staff user" });
  }
};

export const updateStaffUser = async (req, res) => {
  const { name, departmentId, staffTitle } = req.body;
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role !== "staff") {
      return res.status(404).json({ success: false, message: "Staff not found" });
    }
    if (name !== undefined) user.name = name;
    if (staffTitle !== undefined) user.staffTitle = staffTitle;
    if (departmentId !== undefined) {
      const dept = await Department.findById(departmentId);
      if (!dept) return res.status(400).json({ success: false, message: "Invalid department" });
      user.department = dept._id;
    }
    await user.save();
    const populated = await User.findById(user._id).populate("department", "code name");
    res.json({ success: true, user: populated });
  } catch (error) {
    console.error("updateStaffUser error:", error);
    res.status(500).json({ success: false, message: "Failed to update staff" });
  }
};

export const deleteStaffUser = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user || user.role !== "staff") {
      return res.status(404).json({ success: false, message: "Staff not found" });
    }
    // Soft-delete: block, preserve role for history
    user.isBlocked = true;
    await user.save();
    res.json({ success: true, message: "Staff account deactivated" });
  } catch (error) {
    console.error("deleteStaffUser error:", error);
    res.status(500).json({ success: false, message: "Failed to deactivate staff" });
  }
};
