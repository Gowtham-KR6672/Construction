import mongoose from "mongoose";

const approvalRequestSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ["add_member", "update_member", "delete_member", "update_overtime"], required: true },
    team: { type: mongoose.Schema.Types.ObjectId, ref: "Team", required: true },
    memberId: { type: mongoose.Schema.Types.ObjectId, default: null },
    payload: { type: mongoose.Schema.Types.Mixed, default: {} },
    requestedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null },
    status: { type: String, enum: ["pending", "approved", "rejected"], default: "pending" },
    note: { type: String, trim: true, default: "" }
  },
  { timestamps: true }
);

export default mongoose.model("ApprovalRequest", approvalRequestSchema);
