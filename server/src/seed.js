import dotenv from "dotenv";
import mongoose from "mongoose";
import User from "./models/User.js";
import Team from "./models/Team.js";
import ApprovalRequest from "./models/ApprovalRequest.js";
import Member from "./models/Member.js";
import Attendance from "./models/Attendance.js";
import Overtime from "./models/Overtime.js";
import { connectDatabase } from "./utils/db.js";

dotenv.config();

await connectDatabase();

await Promise.all([
  User.deleteMany({}),
  Team.deleteMany({}),
  ApprovalRequest.deleteMany({}),
  Member.deleteMany({}),
  Attendance.deleteMany({}),
  Overtime.deleteMany({})
]);

const superAdmin = await User.create({
  name: "Super Admin",
  email: "super@valarconstruction.com",
  password: "Valar@123",
  role: "super_admin",
  permissions: []
});

console.log("Seed complete");
console.table([
  { role: superAdmin.role, email: superAdmin.email, password: "Valar@123" }
]);

await mongoose.disconnect();
