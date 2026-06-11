import express from "express";
import User from "../models/User.js";
import { requireAuth, requirePermission, requireRole } from "../middleware/auth.js";
import { httpError } from "../utils/httpError.js";

const router = express.Router();

function calculateDailySalary(monthlySalary, referenceDate = new Date()) {
  const monthly = Number(monthlySalary || 0);
  if (!Number.isFinite(monthly) || monthly <= 0) return 0;

  const daysInMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0).getDate();
  return daysInMonth > 0 ? monthly / daysInMonth : 0;
}

router.get("/", requireAuth, requirePermission("manage_users"), async (_req, res) => {
  const users = await User.find().select("-password").populate("assignedTeam", "name siteLocation");
  res.json(users);
});

router.get("/admins", requireAuth, requireRole("admin", "super_admin"), async (_req, res) => {
  const users = await User.find({ role: "admin", status: "active" })
    .select("name email position role assignedTeam monthlySalary dailySalary status")
    .populate("assignedTeam", "name siteLocation");
  res.json(users);
});

router.post("/", requireAuth, requireRole("super_admin"), async (req, res, next) => {
  try {
    const user = await User.create({
      ...req.body,
      dailySalary: calculateDailySalary(req.body.monthlySalary)
    });
    res.status(201).json(user.toSafeJSON());
  } catch (error) {
    next(error);
  }
});

router.patch("/:id/password", requireAuth, requireRole("super_admin"), async (req, res, next) => {
  try {
    const { password } = req.body;

    if (!password || password.length < 6) {
      throw httpError(400, "Password must be at least 6 characters");
    }

    const user = await User.findById(req.params.id);
    if (!user) throw httpError(404, "User not found");

    user.password = password;
    await user.save();

    res.json({ message: "Password updated" });
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", requireAuth, requireRole("super_admin"), async (req, res, next) => {
  try {
    const allowed = ["name", "email", "position", "role", "permissions", "assignedTeam", "monthlySalary", "status"];
    const updates = Object.fromEntries(Object.entries(req.body).filter(([key]) => allowed.includes(key)));

    const user = await User.findById(req.params.id);
    if (!user) throw httpError(404, "User not found");

    if (Object.prototype.hasOwnProperty.call(updates, "assignedTeam")) {
      const nextAssignedTeam = updates.assignedTeam || null;

      if (nextAssignedTeam) {
        await User.updateMany(
          { assignedTeam: nextAssignedTeam, _id: { $ne: req.params.id } },
          { $set: { assignedTeam: null } }
        );
      }

      updates.assignedTeam = nextAssignedTeam;
    }

    if (Object.prototype.hasOwnProperty.call(updates, "monthlySalary")) {
      updates.dailySalary = calculateDailySalary(updates.monthlySalary);
    }

    Object.assign(user, updates);
    await user.save();
    await user.populate("assignedTeam", "name siteLocation");

    res.json(user);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAuth, requireRole("super_admin"), async (req, res, next) => {
  try {
    if (req.params.id === String(req.user._id)) {
      throw httpError(400, "Super Admin cannot delete own account");
    }

    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) throw httpError(404, "User not found");

    res.json({ message: "User deleted" });
  } catch (error) {
    next(error);
  }
});

export default router;
