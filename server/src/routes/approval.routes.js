import express from "express";
import ApprovalRequest from "../models/ApprovalRequest.js";
import Team from "../models/Team.js";
import Member from "../models/Member.js";
import Attendance from "../models/Attendance.js";
import Overtime from "../models/Overtime.js";
import { requireAuth, requirePermission, requireRole } from "../middleware/auth.js";
import { httpError } from "../utils/httpError.js";

const router = express.Router();

function cleanMemberPayload(payload = {}) {
  const allowed = ["name", "position", "trade", "phone", "site", "fixedSalary", "overtimeHourlyRate", "labourCount", "labourSalary", "labourEntries", "status"];
  return Object.fromEntries(Object.entries(payload).filter(([key]) => allowed.includes(key)));
}

router.get("/", requireAuth, requirePermission("view_approvals"), async (_req, res) => {
  const requests = await ApprovalRequest.find({ status: "pending" })
    .sort({ createdAt: -1 })
    .populate("team", "name siteLocation")
    .populate("requestedBy", "name email role")
    .populate("reviewedBy", "name email role");

  const memberIds = requests.map((request) => request.memberId).filter(Boolean);
  const members = await Member.find({ _id: { $in: memberIds } }).lean();

  const enrichedRequests = requests.map((request) => {
    const data = request.toObject();
    const member = members.find((item) => String(item._id) === String(data.memberId));
    return {
      ...data,
      currentMember: member || null
    };
  });

  res.json(enrichedRequests);
});

router.get("/mine", requireAuth, requireRole("admin"), async (req, res) => {
  const requests = await ApprovalRequest.find({ requestedBy: req.user._id })
    .sort({ createdAt: -1 })
    .limit(100)
    .populate("team", "name siteLocation")
    .populate("requestedBy", "name email role")
    .populate("reviewedBy", "name email role");

  res.json(requests);
});

router.post("/:id/review", requireAuth, requireRole("super_admin"), async (req, res, next) => {
  try {
    const { decision, note } = req.body;
    const request = await ApprovalRequest.findById(req.params.id);

    if (!request) throw httpError(404, "Approval request not found");
    if (request.status !== "pending") throw httpError(400, "Request already reviewed");
    if (!["approved", "rejected"].includes(decision)) throw httpError(400, "Invalid decision");

    if (decision === "approved") {
      const team = await Team.findById(request.team);
      if (!team) throw httpError(404, "Team not found");

      if (request.type === "add_member") {
        const member = await Member.create({ ...cleanMemberPayload(request.payload), team: team._id });
        request.memberId = member._id;
      }

      if (request.type === "update_member") {
        const member = await Member.findOne({ _id: request.memberId, team: team._id });
        if (!member) throw httpError(404, "Team member not found");
        member.set(cleanMemberPayload(request.payload));
        await member.save();
      }

      if (request.type === "delete_member") {
        const member = await Member.findOne({ _id: request.memberId, team: team._id });
        if (!member) throw httpError(404, "Team member not found");
        await Promise.all([
          Attendance.deleteMany({ member: member._id }),
          Overtime.deleteMany({ member: member._id }),
          member.deleteOne()
        ]);
      }

      if (request.type === "update_overtime") {
        const member = await Member.findOne({ _id: request.memberId, team: team._id });
        if (!member) throw httpError(404, "Team member not found");
        if (!member.overtimeHourlyRate || member.overtimeHourlyRate <= 0) {
          throw httpError(400, "OT hourly salary is required before overtime can be approved");
        }

        const date = request.payload?.date || new Date().toISOString().slice(0, 10);
        const hours = Number(request.payload?.hours || 0);
        const note = String(request.payload?.note || "").trim();

        if (Number.isNaN(hours) || hours < 0) throw httpError(400, "Overtime hours must be valid");
        if (hours > 0 && !note) throw httpError(400, "Overtime remarks are required");

        await Attendance.findOneAndUpdate(
          { team: team._id, member: member._id, date },
          {
            $setOnInsert: {
              status: "absent",
              dailySalary: member.fixedSalary,
              addedBy: request.requestedBy
            }
          },
          { new: true, upsert: true }
        );

        await Overtime.deleteMany({ team: team._id, member: member._id, date });
        if (hours > 0) {
          await Overtime.create({
            team: team._id,
            member: member._id,
            date,
            hours,
            hourlyRate: member.overtimeHourlyRate,
            note,
            addedBy: request.requestedBy
          });
        }
      }
    }

    request.status = decision;
    request.note = note || "";
    request.reviewedBy = req.user._id;
    await request.save();

    res.json(request);
  } catch (error) {
    next(error);
  }
});

export default router;
