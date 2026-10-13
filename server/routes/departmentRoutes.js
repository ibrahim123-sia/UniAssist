import express from "express";
import { protect } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/requireRole.js";
import { auditAdminWrites } from "../middlewares/audit.js";
import {
  listDepartments,
  createDepartment,
  updateDepartment,
  deleteDepartment,
} from "../controllers/departmentController.js";

const router = express.Router();

router.get("/", protect, listDepartments);
router.post("/", protect, requireRole("admin"), auditAdminWrites, createDepartment);
router.patch("/:id", protect, requireRole("admin"), auditAdminWrites, updateDepartment);
router.delete("/:id", protect, requireRole("admin"), auditAdminWrites, deleteDepartment);

export default router;
