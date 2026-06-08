import mongoose from "mongoose";

export const ADMIN_LEAVE_TYPES = ["Present", "Absent", "0.5 days leave"];

const adminAttendanceSchema = new mongoose.Schema(
  {
    admin: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    date: { type: String, required: true, index: true },
    leaveType: { type: String, enum: ADMIN_LEAVE_TYPES, required: true },
    remark: { type: String, trim: true, default: "" }
  },
  { timestamps: true }
);

adminAttendanceSchema.index({ admin: 1, date: 1 }, { unique: true });

export default mongoose.model("AdminAttendance", adminAttendanceSchema);
