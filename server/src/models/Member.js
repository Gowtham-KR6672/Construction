import mongoose from "mongoose";

const memberSchema = new mongoose.Schema(
  {
    team: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true, index: true },
    name: { type: String, required: true, trim: true },
    position: { type: String, trim: true, default: "" },
    trade: { type: String, required: true, trim: true },
    phone: { type: String, trim: true },
    site: { type: String, trim: true },
    fixedSalary: { type: Number, min: 0, default: 0 },
    overtimeHourlyRate: { type: Number, min: 0, default: 0 },
    labourCount: { type: Number, min: 0, default: 0 },
    labourSalary: { type: Number, min: 0, default: 0 },
    labourEntries: [{
      date: { type: Date, required: true },
      labourCount: { type: Number, min: 0, default: 0 },
      labourSalary: { type: Number, min: 0, default: 0 }
    }],
    status: { type: String, enum: ["active", "inactive"], default: "active" }
  },
  { timestamps: true }
);

export default mongoose.model("Member", memberSchema);
