import express from "express";
import Team from "../models/Team.js";
import Member from "../models/Member.js";
import Attendance from "../models/Attendance.js";
import Overtime from "../models/Overtime.js";
import ApprovalRequest from "../models/ApprovalRequest.js";
import User from "../models/User.js";
import { requireAuth, requirePermission, requireRole } from "../middleware/auth.js";
import { httpError } from "../utils/httpError.js";

const router = express.Router();

const MASON_TEAM_NAME = "Mason team";

function splitTeamName(name = "") {
  const [mainTeam, ...subTeamParts] = name.split(" - ");
  return {
    mainTeam: mainTeam.trim(),
    subTeam: subTeamParts.join(" - ").trim()
  };
}

function escapeRegex(value = "") {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

async function userCanManageTeam(user, teamId) {
  if (!user.assignedTeam) return false;
  if (String(user.assignedTeam) === String(teamId)) return true;

  const [assignedTeam, requestedTeam] = await Promise.all([
    Team.findById(user.assignedTeam).select("name"),
    Team.findById(teamId).select("name")
  ]);

  if (!assignedTeam || !requestedTeam) return false;

  return splitTeamName(assignedTeam.name).mainTeam === splitTeamName(requestedTeam.name).mainTeam;
}

function cleanMemberPayload(payload = {}) {
  const allowed = ["name", "trade", "phone", "site", "status"];
  return Object.fromEntries(Object.entries(payload).filter(([key]) => allowed.includes(key)));
}

async function attachMembers(teams) {
  const teamIds = teams.map((team) => team._id);
  const [members, attendances, overtimes] = await Promise.all([
    Member.find({ team: { $in: teamIds } }).lean(),
    Attendance.find({ team: { $in: teamIds } }).lean(),
    Overtime.find({ team: { $in: teamIds } }).lean()
  ]);

  return teams.map((teamDoc) => {
    const team = teamDoc.toObject ? teamDoc.toObject() : teamDoc;
    const teamMembers = members
      .filter((member) => String(member.team) === String(team._id))
      .map((member) => {
        const memberAttendances = attendances.filter((entry) => String(entry.member) === String(member._id));
        return {
          ...member,
          attendanceEntries: memberAttendances.map((entry) => ({
            _id: entry._id,
            date: entry.date,
            status: entry.status,
            dailySalary: entry.dailySalary,
            addedBy: entry.addedBy
          })),
          overtimeEntries: overtimes
            .filter((entry) => String(entry.member) === String(member._id))
            .map((entry) => ({
              _id: entry._id,
              hours: entry.hours,
              hourlyRate: entry.hourlyRate,
              note: entry.note,
              addedBy: entry.addedBy,
              createdAt: entry.createdAt,
              date: entry.date
            }))
        };
      });

    return { ...team, members: teamMembers };
  });
}

router.get("/", requireAuth, async (req, res) => {
  let query = {};

  if (req.user.role === "admin") {
    if (!req.user.assignedTeam) {
      return res.json([]);
    }

    const assignedTeam = await Team.findById(req.user.assignedTeam);
    if (!assignedTeam) {
      return res.json([]);
    }

    const { mainTeam } = splitTeamName(assignedTeam.name);
    query = { name: new RegExp(`^${escapeRegex(mainTeam)}(?: - |$)`) };
  }

  const teams = await Team.find(query).populate("supervisor", "name email role");
  res.json(await attachMembers(teams));
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    if (req.user.role === "admin" && !req.user.permissions.includes("manage_teams")) {
      if (!req.user.assignedTeam) {
        throw httpError(403, "Admins need an assigned main team to create sub teams");
      }

      const assignedTeam = await Team.findById(req.user.assignedTeam);
      if (!assignedTeam) {
        throw httpError(404, "Assigned team not found");
      }

      const assignedMainTeam = splitTeamName(assignedTeam.name).mainTeam;
      const requestedTeam = splitTeamName(req.body.name);

      if (assignedMainTeam !== MASON_TEAM_NAME) {
        throw httpError(403, "Admins can create sub teams only for Mason team");
      }

      if (!requestedTeam.subTeam) {
        throw httpError(400, "Admins can create sub teams only");
      }

      if (requestedTeam.mainTeam !== assignedMainTeam) {
        throw httpError(403, "Admins can create sub teams only under their assigned team");
      }

      const team = await Team.create({
        name: `${assignedMainTeam} - ${requestedTeam.subTeam}`,
        siteLocation: req.body.siteLocation || assignedTeam.siteLocation,
        supervisor: req.user._id
      });
      return res.status(201).json(team);
    }

    if (req.user.role !== "super_admin" && !req.user.permissions.includes("manage_teams")) {
      throw httpError(403, "Missing permission: manage_teams");
    }

    const team = await Team.create(req.body);
    res.status(201).json(team);
  } catch (error) {
    next(error);
  }
});

router.patch("/:id", requireAuth, requirePermission("manage_teams"), async (req, res, next) => {
  try {
    const team = await Team.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!team) throw httpError(404, "Team not found");
    res.json(team);
  } catch (error) {
    next(error);
  }
});

router.delete("/:id", requireAuth, requirePermission("manage_teams"), async (req, res, next) => {
  try {
    const team = await Team.findByIdAndDelete(req.params.id);
    if (!team) throw httpError(404, "Team not found");
    const members = await Member.find({ team: req.params.id }).select("_id");
    await Promise.all([
      Attendance.deleteMany({ team: req.params.id }),
      Overtime.deleteMany({ team: req.params.id }),
      Member.deleteMany({ _id: { $in: members.map((member) => member._id) } }),
      User.updateMany({ assignedTeam: req.params.id }, { $set: { assignedTeam: null } }),
      ApprovalRequest.deleteMany({ team: req.params.id })
    ]);
    res.json({ message: "Team deleted" });
  } catch (error) {
    next(error);
  }
});

router.post("/:teamId/members/request", requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      throw httpError(403, "Only assigned admins submit approval requests from this route");
    }

    if (!(await userCanManageTeam(req.user, req.params.teamId))) {
      throw httpError(403, "Admins can only manage assigned site");
    }

    const { type, memberId, payload } = req.body;
    const request = await ApprovalRequest.create({
      type,
      team: req.params.teamId,
      memberId: memberId || null,
      payload,
      requestedBy: req.user._id
    });

    res.status(201).json(request);
  } catch (error) {
    next(error);
  }
});

router.post("/:teamId/members", requireAuth, requirePermission("manage_members"), async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) throw httpError(404, "Team not found");

    await Member.create({ ...cleanMemberPayload(req.body), team: team._id });
    res.status(201).json((await attachMembers([team]))[0]);
  } catch (error) {
    next(error);
  }
});

router.patch("/:teamId/members/:memberId/salary", requireAuth, requireRole("super_admin"), async (req, res, next) => {
  try {
    const team = await Team.findById(req.params.teamId);
    if (!team) throw httpError(404, "Team not found");

    const member = await Member.findOne({ _id: req.params.memberId, team: req.params.teamId });
    if (!member) throw httpError(404, "Team member not found");

    const fixedSalary = Number(req.body.fixedSalary);
    const overtimeHourlyRate = Number(req.body.overtimeHourlyRate);

    if (Number.isNaN(fixedSalary) || Number.isNaN(overtimeHourlyRate)) {
      throw httpError(400, "Salary and overtime rate must be valid numbers");
    }

    member.fixedSalary = Math.max(0, fixedSalary);
    member.overtimeHourlyRate = Math.max(0, overtimeHourlyRate);
    await member.save();

    res.json((await attachMembers([team]))[0]);
  } catch (error) {
    next(error);
  }
});

router.post("/:teamId/members/:memberId/overtime", requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      throw httpError(403, "Only assigned admins can add overtime");
    }

    if (!(await userCanManageTeam(req.user, req.params.teamId))) {
      throw httpError(403, "Admins can only add overtime for assigned site");
    }

    const team = await Team.findById(req.params.teamId);
    if (!team) throw httpError(404, "Team not found");

    const member = await Member.findOne({ _id: req.params.memberId, team: req.params.teamId });
    if (!member) throw httpError(404, "Team member not found");

    if (!member.overtimeHourlyRate || member.overtimeHourlyRate <= 0) {
      throw httpError(400, "Super Admin must set OT hourly salary before overtime can be added");
    }

    const hours = Number(req.body.hours);
    if (!hours || Number.isNaN(hours) || hours <= 0) {
      throw httpError(400, "Overtime hours must be greater than 0");
    }

    const note = String(req.body.note || "").trim();
    if (!note) {
      throw httpError(400, "Overtime remarks are required");
    }

    const date = req.body.date || new Date().toISOString().slice(0, 10);
    await Attendance.findOneAndUpdate(
      { team: team._id, member: member._id, date },
      {
        $setOnInsert: {
          status: "absent",
          dailySalary: member.fixedSalary,
          addedBy: req.user._id
        }
      },
      { new: true, upsert: true }
    );

    const overtime = await Overtime.create({
      team: team._id,
      member: member._id,
      date,
      hours,
      hourlyRate: member.overtimeHourlyRate,
      note,
      addedBy: req.user._id
    });

    res.status(201).json({ overtime, team: (await attachMembers([team]))[0] });
  } catch (error) {
    next(error);
  }
});

router.put("/:teamId/members/:memberId/attendance", requireAuth, async (req, res, next) => {
  try {
    if (req.user.role !== "admin") {
      throw httpError(403, "Only assigned admins can update attendance");
    }

    if (!(await userCanManageTeam(req.user, req.params.teamId))) {
      throw httpError(403, "Admins can only update attendance for assigned site");
    }

    const { date, status } = req.body;
    if (!date || !["present", "absent", "half"].includes(status)) {
      throw httpError(400, "Date and valid attendance status are required");
    }

    const team = await Team.findById(req.params.teamId);
    if (!team) throw httpError(404, "Team not found");

    const member = await Member.findOne({ _id: req.params.memberId, team: req.params.teamId });
    if (!member) throw httpError(404, "Team member not found");

    await Attendance.findOneAndUpdate(
      { team: team._id, member: member._id, date },
      {
        $set: { status, addedBy: req.user._id },
        $setOnInsert: { dailySalary: member.fixedSalary }
      },
      { new: true, upsert: true }
    );

    res.json((await attachMembers([team]))[0]);
  } catch (error) {
    next(error);
  }
});

export default router;
