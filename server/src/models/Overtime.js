import mongoose from "mongoose";

const overtimeSchema = new mongoose.Schema(
  {
    team: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true, index: true },
    member: { type: mongoose.Schema.Types.ObjectId, ref: "Member", required: true, index: true },
    date: { type: String, required: true, index: true },
    hours: { type: Number, min: 0, required: true },
    hourlyRate: { type: Number, min: 0, required: true },
    note: { type: String, trim: true, required: true },
    addedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true }
);

export default mongoose.model("Overtime", overtimeSchema);
