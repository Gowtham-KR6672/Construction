import mongoose from "mongoose";
import bcrypt from "bcryptjs";

export const ROLES = ["super_admin", "admin"];
export const ADMIN_PERMISSIONS = [
  "manage_users",
  "manage_teams",
  "manage_members",
  "view_approvals",
  "approve_requests"
];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    password: { type: String, required: true, minlength: 6 },
    role: { type: String, enum: ROLES, required: true, default: "admin" },
    permissions: [{ type: String, enum: ADMIN_PERMISSIONS }],
    assignedTeam: { type: mongoose.Schema.Types.ObjectId, ref: "Team", default: null },
    monthlySalary: { type: Number, min: 0, default: 0 },
    dailySalary: { type: Number, min: 0, default: 0 },
    status: { type: String, enum: ["active", "inactive"], default: "active" }
  },
  { timestamps: true }
);

userSchema.pre("save", async function hashPassword(next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function comparePassword(candidate) {
  return bcrypt.compare(candidate, this.password);
};

userSchema.methods.toSafeJSON = function toSafeJSON() {
  return {
    id: this._id,
    name: this.name,
    email: this.email,
    role: this.role,
    permissions: this.permissions,
    assignedTeam: this.assignedTeam,
    monthlySalary: this.monthlySalary,
    dailySalary: this.dailySalary,
    status: this.status
  };
};

export default mongoose.model("User", userSchema);
