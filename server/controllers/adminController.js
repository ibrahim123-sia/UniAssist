import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Department from "../models/Department.js";

export const listUsers = async (req, res) => {
  try {
    const { role, departmentId, isBlocked, search } = req.query;
    const filter = {};
    if (role) filter.role = role;
    if (departmentId) filter.department = departmentId;
    if (isBlocked !== undefined) filter.isBlocked = isBlocked === "true";
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } },
      ];
    }
    const users = await User.find(filter)
      .populate("department", "code name")
      .sort({ createdAt: -1 })
      .limit(200);
    res.json({ success: true, users });
  } catch (error) {
    console.error("listUsers error:", error);
    res.status(500).json({ success: false, message: "Failed to list users" });
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
  const { name, email, password, departmentId, staffTitle } = req.body;
  if (!name || !email || !password || !departmentId) {
    return res.status(400).json({
      success: false,
      message: "name, email, password, and departmentId are required",
    });
  }
  if (password.length < 6) {
    return res.status(400).json({ success: false, message: "Password must be at least 6 characters" });
  }
  try {
    const dept = await Department.findById(departmentId);
    if (!dept) return res.status(400).json({ success: false, message: "Invalid department" });
    const exists = await User.findOne({ email: email.toLowerCase().trim() });
    if (exists) return res.status(409).json({ success: false, message: "Email already in use" });

    const salt = await bcrypt.genSalt(10);
    const hashed = await bcrypt.hash(password, salt);
    const user = await User.create({
      name,
      email: email.toLowerCase().trim(),
      password: hashed,
      role: "staff",
      department: dept._id,
      staffTitle: staffTitle || dept.code,
      isVerified: true,
    });
    res.status(201).json({ success: true, user });
  } catch (error) {
    console.error("createStaffUser error:", error);
    res.status(500).json({ success: false, message: "Failed to create staff user" });
  }
};
