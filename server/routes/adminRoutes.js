import express from "express";
import { protect } from "../middlewares/auth.js";
import { requireRole } from "../middlewares/requireRole.js";
import {
  listUsers,
  updateUser,
  blockUser,
  createStaffUser,
} from "../controllers/adminController.js";

const router = express.Router();

router.use(protect, requireRole("admin"));

router.get("/users", listUsers);
router.patch("/users/:id", updateUser);
router.patch("/users/:id/block", blockUser);
router.post("/staff", createStaffUser);

export default router;
