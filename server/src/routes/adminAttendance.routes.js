import express from "express";
import AdminAttendance, { ADMIN_LEAVE_TYPES } from "../models/AdminAttendance.js";
import User from "../models/User.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { httpError } from "../utils/httpError.js";

const router = express.Router();

function monthBounds(month) {
  if (!/^\d{4}-\d{2}$/.test(month || "")) {
    throw httpError(400, "Month is required in YYYY-MM format");
  }

  return {
    from: `${month}-01`,
    to: `${month}-31`
  };
}

function attendanceUnit(leaveType) {
  if (leaveType === "Absent") return 0;
  if (leaveType === "0.5 days leave") return 0.5;
  return 1;
}

function isSunday(date) {
  return new Date(`${date}T00:00:00`).getDay() === 0;
}

function datesBetween(from, to) {
  const dates = [];
  const cursor = new Date(`${from}T00:00:00`);
  const end = new Date(`${to}T00:00:00`);

  if (Number.isNaN(cursor.getTime()) || Number.isNaN(end.getTime()) || cursor > end) {
    throw httpError(400, "Invalid date range");
  }

  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function monthlySummary(user, entries) {
  const dailySalary = Number(user.dailySalary || 0);
  const totalEarnings = entries.reduce((total, entry) => {
    // Sunday is always a full paid day, regardless of the stored leave type.
    const unit = isSunday(entry.date) ? 1 : attendanceUnit(entry.leaveType);
    return total + unit * dailySalary;
  }, 0);

  return {
    monthlySalary: Number(user.monthlySalary || 0),
    totalEarnings,
    entries
  };
}

router.get("/me", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { from, to } = monthBounds(req.query.month);
    const entries = await AdminAttendance.find({
      admin: req.user._id,
      date: { $gte: from, $lte: to }
    }).sort({ date: 1 }).lean();

    res.json(monthlySummary(req.user, entries));
  } catch (error) {
    next(error);
  }
});

router.get("/all", requireAuth, requireRole("super_admin"), async (req, res, next) => {
  try {
    const { from, to } = monthBounds(req.query.month);
    const [admins, entries] = await Promise.all([
      User.find({ role: "admin" }).select("name email assignedTeam monthlySalary dailySalary status").populate("assignedTeam", "name siteLocation"),
      AdminAttendance.find({
        date: { $gte: from, $lte: to }
      })
        .populate("admin", "name email assignedTeam")
        .sort({ date: 1 })
        .lean()
    ]);

    res.json({ admins, entries });
  } catch (error) {
    next(error);
  }
});

router.put("/me", requireAuth, requireRole("admin"), async (req, res, next) => {
  try {
    const { date, leaveType, remark = "" } = req.body;

    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw httpError(400, "Date is required in YYYY-MM-DD format");
    }

    if (!ADMIN_LEAVE_TYPES.includes(leaveType)) {
      throw httpError(400, "Valid leave type is required");
    }

    const entry = await AdminAttendance.findOneAndUpdate(
      { admin: req.user._id, date },
      { $set: { leaveType, remark } },
      { new: true, upsert: true }
    ).lean();

    res.json(entry);
  } catch (error) {
    next(error);
  }
});

router.post("/bulk", requireAuth, requireRole("super_admin"), async (req, res, next) => {
  try {
    const { adminIds, from, to, leaveType, remark = "" } = req.body;

    if (!Array.isArray(adminIds) || !adminIds.length) {
      throw httpError(400, "Select at least one admin");
    }

    if (!ADMIN_LEAVE_TYPES.includes(leaveType)) {
      throw httpError(400, "Valid leave type is required");
    }

    const dates = datesBetween(from, to);
    const operations = [];

    for (const adminId of adminIds) {
      for (const date of dates) {
        operations.push({
          updateOne: {
            filter: { admin: adminId, date },
            update: { $set: { admin: adminId, date, leaveType, remark } },
            upsert: true
          }
        });
      }
    }

    if (operations.length) {
      await AdminAttendance.bulkWrite(operations);
    }

    res.json({ message: "Attendance updated", updatedDates: dates.length, updatedAdmins: adminIds.length });
  } catch (error) {
    next(error);
  }
});

router.patch("/:adminId/:date", requireAuth, requireRole("super_admin"), async (req, res, next) => {
  try {
    const { adminId, date } = req.params;
    const { leaveType, remark = "" } = req.body;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw httpError(400, "Date is required in YYYY-MM-DD format");
    }

    if (!ADMIN_LEAVE_TYPES.includes(leaveType)) {
      throw httpError(400, "Valid leave type is required");
    }

    const entry = await AdminAttendance.findOneAndUpdate(
      { admin: adminId, date },
      { $set: { leaveType, remark } },
      { new: true, upsert: true }
    ).populate("admin", "name email assignedTeam").lean();

    res.json(entry);
  } catch (error) {
    next(error);
  }
});

router.delete("/:adminId/:date", requireAuth, requireRole("super_admin"), async (req, res, next) => {
  try {
    const { adminId, date } = req.params;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw httpError(400, "Date is required in YYYY-MM-DD format");
    }

    await AdminAttendance.deleteOne({ admin: adminId, date });
    res.json({ message: "Attendance deleted" });
  } catch (error) {
    next(error);
  }
});

export default router;
