import dotenv from "dotenv";
import mongoose from "mongoose";
import Member from "./models/Member.js";
import Attendance from "./models/Attendance.js";
import Overtime from "./models/Overtime.js";

dotenv.config();

await mongoose.connect(process.env.MONGO_URI);

const teams = await mongoose.connection.db
  .collection("teams")
  .find({ members: { $exists: true, $ne: [] } })
  .toArray();

let movedMembers = 0;
let movedRows = 0;

for (const team of teams) {
  for (const oldMember of team.members || []) {
    const existing = await Member.findOne({
      team: team._id,
      name: oldMember.name,
      phone: oldMember.phone || ""
    });

    const member = existing || await Member.create({
      team: team._id,
      name: oldMember.name,
      trade: oldMember.trade,
      phone: oldMember.phone || "",
      site: oldMember.site || team.siteLocation || "",
      fixedSalary: oldMember.fixedSalary || 0,
      overtimeHourlyRate: oldMember.overtimeHourlyRate || 0,
      status: oldMember.status || "active"
    });

    if (!existing) movedMembers++;

    for (const oldAttendance of oldMember.attendanceEntries || []) {
      await Attendance.findOneAndUpdate(
        { team: team._id, member: member._id, date: oldAttendance.date },
        {
          $set: {
            status: oldAttendance.status || "absent",
            dailySalary: oldAttendance.dailySalary || oldMember.fixedSalary || 0,
            addedBy: oldAttendance.addedBy || null
          }
        },
        { upsert: true }
      );
      movedRows++;
    }

    for (const oldOt of oldMember.overtimeEntries || []) {
      const date = oldOt.date || new Date().toISOString().slice(0, 10);

      await Attendance.findOneAndUpdate(
        { team: team._id, member: member._id, date },
        {
          $setOnInsert: {
            status: "absent",
            dailySalary: oldMember.fixedSalary || 0
          },
          $push: {
            overtimeEntries: {
              hours: oldOt.hours || 0,
              hourlyRate: oldOt.hourlyRate || oldMember.overtimeHourlyRate || 0,
              note: oldOt.note || "Migrated overtime",
              addedBy: oldOt.addedBy || null,
              createdAt: oldOt.createdAt || new Date()
            }
          }
        },
        { upsert: true }
      );
      movedRows++;
    }
  }

  await mongoose.connection.db
    .collection("teams")
    .updateOne({ _id: team._id }, { $unset: { members: "" } });
}

console.log(`Migrated members: ${movedMembers}`);
console.log(`Migrated attendance/OT rows: ${movedRows}`);

const attendancesWithOvertime = await mongoose.connection.db
  .collection("attendances")
  .find({ overtimeEntries: { $exists: true, $ne: [] } })
  .toArray();

let movedOvertimes = 0;

for (const attendance of attendancesWithOvertime) {
  for (const overtime of attendance.overtimeEntries || []) {
    await Overtime.create({
      team: attendance.team,
      member: attendance.member,
      date: attendance.date,
      hours: overtime.hours || 0,
      hourlyRate: overtime.hourlyRate || 0,
      note: overtime.note || "Migrated overtime",
      addedBy: overtime.addedBy || null,
      createdAt: overtime.createdAt || new Date(),
      updatedAt: overtime.updatedAt || overtime.createdAt || new Date()
    });
    movedOvertimes++;
  }

  await mongoose.connection.db
    .collection("attendances")
    .updateOne({ _id: attendance._id }, { $unset: { overtimeEntries: "" } });
}

console.log(`Migrated separate overtime rows: ${movedOvertimes}`);

await mongoose.disconnect();
