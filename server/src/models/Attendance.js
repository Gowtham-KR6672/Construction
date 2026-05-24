import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema(
  {
    team: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true, index: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true, index: true },
    date: { type: String, required: true, index: true },
    status: { type: String, enum: ["present", "absent", "half"], required: true, default: "absent" },
    dailySalary: { type: Number, min: 0, default: 0 },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true }
);

attendanceSchema.index({ member: 1, date: 1 }, { unique: true });

export default mongoose.model("Attendance", attendanceSchema);
