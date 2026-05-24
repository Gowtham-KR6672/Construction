import mongoose from "mongoose";

const teamSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    siteLocation: { type: String, required: true, trim: true },
    supervisor: { type: mongoose.Schema.Types.ObjectId, ref: "User", default: null }
  },
  { timestamps: true }
);

export default mongoose.model("Team", teamSchema);
