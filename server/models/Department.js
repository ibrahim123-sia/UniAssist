import mongoose from "mongoose";

export const SLA_HOURS_MIN = 1;
export const SLA_HOURS_MAX = 720;

const departmentSchema = new mongoose.Schema(
  {
    code: {
      type: String,
      required: [true, "Department code is required"],
      unique: true,
      uppercase: true,
      trim: true,
    },
    name: {
      type: String,
      required: [true, "Department name is required"],
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      default: "",
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    // Hours a Pending issue may wait for its first staff response before it is
    // escalated. null → ISSUE_SLA_HOURS (default 48).
    slaHours: {
      type: Number,
      default: null,
      min: [SLA_HOURS_MIN, `slaHours must be between ${SLA_HOURS_MIN} and ${SLA_HOURS_MAX}`],
      max: [SLA_HOURS_MAX, `slaHours must be between ${SLA_HOURS_MIN} and ${SLA_HOURS_MAX}`],
    },
    // Staff member of this department who receives SLA escalations (falls back
    // to every staff member of the department when unset).
    head: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
  },
  { timestamps: true }
);

const Department = mongoose.model("Department", departmentSchema);

export default Department;
