import mongoose from "mongoose";
import Department, { SLA_HOURS_MIN, SLA_HOURS_MAX } from "../models/Department.js";
import User from "../models/User.js";

// Codes become part of generated staff emails (name@maju.<code>.edu), so keep
// them to letters/digits.
const DEPT_CODE_REGEX = /^[A-Z0-9]{2,10}$/;

const findDept = (id) => (mongoose.isValidObjectId(id) ? Department.findById(id) : null);

const MAX_DEPT_NAME = 100;
const MAX_DEPT_DESCRIPTION = 500;

const SLA_ERROR = `slaHours must be a number from ${SLA_HOURS_MIN} to ${SLA_HOURS_MAX}, or empty for the default`;

// null/"" → null (use ISSUE_SLA_HOURS); a number (or numeric string) in range
// → that number; anything else → undefined (invalid).
const parseSlaHours = (value) => {
  if (value === null || value === "") return null;
  const n = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof n !== "number" || !Number.isFinite(n) || n < SLA_HOURS_MIN || n > SLA_HOURS_MAX) return undefined;
  return n;
};

export const listDepartments = async (req, res) => {
  try {
    const filter = req.user?.role === "admin" ? {} : { isActive: true };
    const departments = await Department.find(filter).sort({ code: 1 });
    res.json({ success: true, departments });
  } catch (error) {
    console.error("listDepartments error:", error);
    res.status(500).json({ success: false, message: "Failed to list departments" });
  }
};

export const createDepartment = async (req, res) => {
  const { code, name, description, slaHours } = req.body ?? {};
  if (typeof code !== "string" || typeof name !== "string" || !code.trim() || !name.trim()) {
    return res.status(400).json({ success: false, message: "code and name are required" });
  }
  const normalizedCode = code.trim().toUpperCase();
  if (!DEPT_CODE_REGEX.test(normalizedCode)) {
    return res.status(400).json({
      success: false,
      message: "Department code must be 2-10 letters or digits (e.g. SFC, IT, HOD)",
    });
  }
  if (name.trim().length > MAX_DEPT_NAME) {
    return res.status(400).json({ success: false, message: `Name must be at most ${MAX_DEPT_NAME} characters` });
  }
  if (description !== undefined && description !== null && typeof description !== "string") {
    return res.status(400).json({ success: false, message: "Description must be text" });
  }
  if (typeof description === "string" && description.trim().length > MAX_DEPT_DESCRIPTION) {
    return res.status(400).json({ success: false, message: `Description must be at most ${MAX_DEPT_DESCRIPTION} characters` });
  }
  const sla = slaHours === undefined ? null : parseSlaHours(slaHours);
  if (sla === undefined) return res.status(400).json({ success: false, message: SLA_ERROR });
  try {
    const exists = await Department.findOne({ code: normalizedCode });
    if (exists) {
      return res.status(409).json({ success: false, message: "Department code already exists" });
    }
    const dept = await Department.create({
      code: normalizedCode,
      name: name.trim(),
      description: typeof description === "string" ? description.trim() : "",
      slaHours: sla,
    });
    res.status(201).json({ success: true, department: dept });
  } catch (error) {
    console.error("createDepartment error:", error);
    res.status(500).json({ success: false, message: "Failed to create department" });
  }
};

export const updateDepartment = async (req, res) => {
  const { id } = req.params;
  const { name, description, isActive, slaHours, head } = req.body ?? {};
  try {
    const dept = await findDept(id);
    if (!dept) return res.status(404).json({ success: false, message: "Department not found" });
    if (name !== undefined) {
      if (typeof name !== "string" || !name.trim()) {
        return res.status(400).json({ success: false, message: "Name cannot be empty" });
      }
      if (name.trim().length > MAX_DEPT_NAME) {
        return res.status(400).json({ success: false, message: `Name must be at most ${MAX_DEPT_NAME} characters` });
      }
      dept.name = name.trim();
    }
    if (description !== undefined) {
      if (description !== null && typeof description !== "string") {
        return res.status(400).json({ success: false, message: "Description must be text" });
      }
      const text = (description ?? "").trim();
      if (text.length > MAX_DEPT_DESCRIPTION) {
        return res.status(400).json({ success: false, message: `Description must be at most ${MAX_DEPT_DESCRIPTION} characters` });
      }
      dept.description = text;
    }
    if (isActive !== undefined) {
      // A real boolean only — the string "false" must not activate it.
      if (typeof isActive !== "boolean") {
        return res.status(400).json({ success: false, message: "isActive must be true or false" });
      }
      dept.isActive = isActive;
    }
    if (slaHours !== undefined) {
      const sla = parseSlaHours(slaHours);
      if (sla === undefined) return res.status(400).json({ success: false, message: SLA_ERROR });
      dept.slaHours = sla;
    }
    if (head !== undefined) {
      if (head === null || head === "") {
        dept.head = null;
      } else {
        // The head receives SLA escalations, so it must be an active staff
        // member of this very department.
        const headUser = mongoose.isValidObjectId(head) && await User.findById(head).select("role department isBlocked");
        if (
          !headUser ||
          headUser.role !== "staff" ||
          headUser.isBlocked ||
          String(headUser.department) !== String(dept._id)
        ) {
          return res.status(400).json({
            success: false,
            message: "Department head must be an active staff member of this department",
          });
        }
        dept.head = headUser._id;
      }
    }
    await dept.save();
    res.json({ success: true, department: dept });
  } catch (error) {
    console.error("updateDepartment error:", error);
    res.status(500).json({ success: false, message: "Failed to update department" });
  }
};

export const deleteDepartment = async (req, res) => {
  const { id } = req.params;
  try {
    const dept = await findDept(id);
    if (!dept) return res.status(404).json({ success: false, message: "Department not found" });
    dept.isActive = false;
    await dept.save();
    res.json({ success: true, message: "Department deactivated" });
  } catch (error) {
    console.error("deleteDepartment error:", error);
    res.status(500).json({ success: false, message: "Failed to delete department" });
  }
};
