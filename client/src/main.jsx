import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  CheckCircle2,
  ClipboardCheck,
  Clock,
  HardHat,
  IndianRupee,
  LogOut,
  Download,
  Plus,
  ShieldCheck,
  Users,
  XCircle
} from "lucide-react";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value || 0);
}

function overtimeTotal(member) {
  return (member.overtimeEntries || []).reduce((total, entry) => total + entry.hours * entry.hourlyRate, 0);
}

function attendanceUnit(status) {
  if (status === "present") return 1;
  if (status === "half") return 0.5;
  return 0;
}

function attendanceEntrySalary(member, entry) {
  return Number.isFinite(entry?.dailySalary) && entry.dailySalary > 0 ? entry.dailySalary : member.fixedSalary || 0;
}

function attendanceDays(member) {
  return (member.attendanceEntries || []).reduce((total, entry) => total + attendanceUnit(entry.status), 0);
}

function attendanceSalary(member) {
  return (member.attendanceEntries || []).reduce(
    (total, entry) => total + attendanceUnit(entry.status) * attendanceEntrySalary(member, entry),
    0
  );
}

function attendanceDaysForDates(member, dates) {
  return dates.reduce((total, date) => total + attendanceUnit(member.attendanceEntries?.find((entry) => entry.date === date)?.status), 0);
}

function attendanceSalaryForDates(member, dates) {
  return dates.reduce((total, date) => {
    const entry = member.attendanceEntries?.find((item) => item.date === date);
    return total + attendanceUnit(entry?.status) * attendanceEntrySalary(member, entry || {});
  }, 0);
}

function overtimeTotalForDates(member, dates) {
  return (member.overtimeEntries || [])
    .filter((entry) => dates.includes(entry.date))
    .reduce((total, entry) => total + entry.hours * entry.hourlyRate, 0);
}

function memberTotalForDates(member, dates) {
  return attendanceSalaryForDates(member, dates) + overtimeTotalForDates(member, dates);
}

function memberTotal(member) {
  return attendanceSalary(member) + overtimeTotal(member);
}

function teamPayrollTotal(team) {
  return team.members.reduce((total, member) => total + memberTotal(member), 0);
}

function dateKey(date) {
  return date.toISOString().slice(0, 10);
}

function weekDates() {
  const today = new Date();
  const monday = new Date(today);
  const day = today.getDay() || 7;
  monday.setDate(today.getDate() - day + 1);
  return Array.from({ length: 7 }, (_, index) => {
    const date = new Date(monday);
    date.setDate(monday.getDate() + index);
    return dateKey(date);
  });
}

function datesBetween(start, end) {
  const dates = [];
  const cursor = new Date(start);

  while (cursor <= end) {
    dates.push(dateKey(cursor));
    cursor.setDate(cursor.getDate() + 1);
  }

  return dates;
}

function currentPeriodDates(period) {
  const today = new Date();

  if (period === "weekly") return weekDates();

  if (period === "monthly") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0);
    return datesBetween(start, end);
  }

  const start = new Date(today.getFullYear(), 0, 1);
  const end = new Date(today.getFullYear(), 11, 31);
  return datesBetween(start, end);
}

function csvValue(value) {
  return `"${String(value ?? "").replace(/"/g, '""')}"`;
}

function downloadCsv(filename, rows) {
  const csv = rows.map((row) => row.map(csvValue).join(",")).join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function shortDateLabel(value) {
  return new Date(`${value}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    weekday: "short"
  });
}

function apiRequest(path, options = {}) {
  const token = localStorage.getItem("token");
  return fetch(`${API_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  }).then(async (response) => {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message || "Request failed");
    return data;
  });
}

function App() {
  const [user, setUser] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) return;

    apiRequest("/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => localStorage.removeItem("token"));
  }, []);

  function logout() {
    localStorage.removeItem("token");
    setUser(null);
  }

  if (!user) return <Login setUser={setUser} error={error} setError={setError} />;

  return <Dashboard user={user} logout={logout} />;
}

function Login({ setUser, error, setError }) {
  const [form, setForm] = useState({ email: "", password: "" });

  async function submit(event) {
    event.preventDefault();
    setError("");

    try {
      const data = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify(form)
      });
      localStorage.setItem("token", data.token);
      setUser(data.user);
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <main className="login-page">
      <section className="login-hero">
        <div className="brand-mark">
          <HardHat size={34} />
          <span>BuildCo Workforce</span>
        </div>
        <h1>Construction admin login and site approvals</h1>
        <p>Manage site admins, assigned locations, crews, attendance, salary, and approvals.</p>
      </section>

      <section className="login-panel">
        <form onSubmit={submit}>
          <h2>Sign in</h2>
          <label>
            Email
            <input
              value={form.email}
              onChange={(event) => setForm({ ...form, email: event.target.value })}
              placeholder="Enter your email"
              type="email"
              required
            />
          </label>
          <label>
            Password
            <input
              value={form.password}
              onChange={(event) => setForm({ ...form, password: event.target.value })}
              placeholder="Enter your password"
              type="password"
              required
            />
          </label>
          {error && <p className="error">{error}</p>}
          <button className="primary-button" type="submit">Login</button>
        </form>
        <div className="demo-list">
          <button type="button" onClick={() => setForm({ email: "super@valarconstruction.com", password: "Valar@123" })}>
            Super Admin
          </button>
        </div>
      </section>
    </main>
  );
}

function Dashboard({ user, logout }) {
  const [teams, setTeams] = useState([]);
  const [users, setUsers] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [message, setMessage] = useState("");
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const canManageUsers = user.role === "super_admin" || user.permissions?.includes("manage_users");
  const canViewApprovals = user.role === "super_admin" || user.permissions?.includes("view_approvals");

  async function loadData() {
    const [teamData, approvalData, userData] = await Promise.all([
      apiRequest("/teams"),
      canViewApprovals ? apiRequest("/approvals") : Promise.resolve([]),
      canManageUsers ? apiRequest("/users") : Promise.resolve([])
    ]);
    setTeams(teamData);
    setApprovals(approvalData);
    setUsers(userData);
  }

  useEffect(() => {
    loadData().catch((err) => setMessage(err.message));
  }, []);

  const visibleTeams = selectedSiteId ? teams.filter((team) => team._id === selectedSiteId) : teams;
  const visibleUsers = selectedSiteId
    ? users.filter((item) => (item.assignedTeam?._id || item.assignedTeam) === selectedSiteId)
    : users;
  const visibleApprovals = selectedSiteId
    ? approvals.filter((item) => (item.team?._id || item.team) === selectedSiteId)
    : approvals;
  const selectedSite = teams.find((team) => team._id === selectedSiteId);

  const stats = useMemo(() => {
    const memberCount = visibleTeams.reduce((total, team) => total + team.members.length, 0);
    const payrollTotal = visibleTeams.reduce((total, team) => total + teamPayrollTotal(team), 0);
    return [
      { label: "Teams", value: visibleTeams.length, icon: Users },
      { label: "Members", value: memberCount, icon: HardHat },
      { label: "Payroll total", value: money(payrollTotal), icon: IndianRupee },
      { label: "Pending approvals", value: visibleApprovals.filter((item) => item.status === "pending").length, icon: ClipboardCheck }
    ];
  }, [visibleTeams, visibleApprovals]);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="brand-mark small">
          <HardHat />
          <span>BuildCo</span>
        </div>
        <div className="role-card">
          <ShieldCheck />
          <strong>{user.name}</strong>
          <span>{user.role.replace("_", " ")}</span>
        </div>
        <div className="sidebar-sites">
          <strong>Sites</strong>
          <button
            className={`sidebar-site ${!selectedSiteId ? "active" : ""}`}
            type="button"
            onClick={() => setSelectedSiteId("")}
          >
            <span>All Sites</span>
            <small>Show all dashboard data</small>
          </button>
          {teams.map((team) => (
            <button
              className={`sidebar-site ${selectedSiteId === team._id ? "active" : ""}`}
              key={team._id}
              type="button"
              onClick={() => setSelectedSiteId(team._id)}
            >
              <span>{team.name}</span>
              <small>{team.siteLocation}</small>
            </button>
          ))}
          {!teams.length && <small>No sites created yet.</small>}
        </div>
        <button className="ghost-button" onClick={logout}>
          <LogOut size={18} />
          Logout
        </button>
      </aside>

      <section className="content">
        <header className="topbar">
          <div>
            <h1>{user.role === "super_admin" ? "Super Admin Control" : "Assigned Site"}</h1>
            <p>{selectedSite ? `${selectedSite.name}: ${selectedSite.siteLocation}` : roleDescription(user)}</p>
          </div>
        </header>

        <div className="stat-grid">
          {stats.map((stat) => (
            <article className="stat-card" key={stat.label}>
              <stat.icon />
              <span>{stat.label}</span>
              <strong>{stat.value}</strong>
            </article>
          ))}
        </div>

        {message && <p className="notice">{message}</p>}

        {user.role === "super_admin" && (
          <SuperAdminPanel users={visibleUsers} teams={visibleTeams} approvals={visibleApprovals} reload={loadData} setMessage={setMessage} />
        )}

        {user.role === "super_admin" && <ReportsPanel teams={visibleTeams} />}

        <TeamPanel user={user} teams={visibleTeams} reload={loadData} setMessage={setMessage} />
      </section>
    </main>
  );
}

function SuperAdminPanel({ users, teams, approvals, reload, setMessage }) {
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    assignedTeam: ""
  });
  const [newTeam, setNewTeam] = useState({ name: "", siteLocation: "" });
  const [passwordForms, setPasswordForms] = useState({});
  const [editingAdminId, setEditingAdminId] = useState(null);
  const [adminEditForm, setAdminEditForm] = useState({ name: "", email: "", assignedTeam: "" });
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [teamEditForm, setTeamEditForm] = useState({ name: "", siteLocation: "" });
  const [selectedTeamId, setSelectedTeamId] = useState("");

  async function review(id, decision) {
    await apiRequest(`/approvals/${id}/review`, {
      method: "POST",
      body: JSON.stringify({ decision })
    });
    setMessage(`Request ${decision}`);
    await reload();
  }

  async function createLogin(event) {
    event.preventDefault();
    const payload = {
      name: newUser.name,
      email: newUser.email,
      password: newUser.password,
      role: "admin",
      permissions: [],
      assignedTeam: newUser.assignedTeam
    };

    await apiRequest("/users", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    setNewUser({ name: "", email: "", password: "", assignedTeam: "" });
    setMessage("Admin login created successfully");
    reload();
  }

  async function updatePassword(userId) {
    const password = passwordForms[userId] || "";

    await apiRequest(`/users/${userId}/password`, {
      method: "PATCH",
      body: JSON.stringify({ password })
    });

    setPasswordForms({ ...passwordForms, [userId]: "" });
    setMessage("Password updated successfully");
  }

  async function createTeam(event) {
    event.preventDefault();

    const createdTeam = await apiRequest("/teams", {
      method: "POST",
      body: JSON.stringify(newTeam)
    });

    setNewTeam({ name: "", siteLocation: "" });
    setSelectedTeamId(createdTeam._id);
    setMessage("Team created successfully");
    reload();
  }

  function startEditAdmin(item) {
    setEditingAdminId(item._id);
    setAdminEditForm({
      name: item.name,
      email: item.email,
      assignedTeam: item.assignedTeam?._id || item.assignedTeam || ""
    });
  }

  async function updateAdmin(userId) {
    await apiRequest(`/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify(adminEditForm)
    });

    setEditingAdminId(null);
    setMessage("Admin updated successfully");
    reload();
  }

  async function deleteAdmin(userId) {
    if (!window.confirm("Delete this admin login?")) return;

    await apiRequest(`/users/${userId}`, { method: "DELETE" });
    setMessage("Admin deleted successfully");
    reload();
  }

  function startEditTeam(team) {
    setEditingTeamId(team._id);
    setTeamEditForm({ name: team.name, siteLocation: team.siteLocation });
  }

  async function updateTeam(teamId) {
    await apiRequest(`/teams/${teamId}`, {
      method: "PATCH",
      body: JSON.stringify(teamEditForm)
    });

    setEditingTeamId(null);
    setMessage("Site updated successfully");
    reload();
  }

  async function deleteTeam(teamId) {
    if (!window.confirm("Delete this site and its members, attendance, OT, and approvals?")) return;

    await apiRequest(`/teams/${teamId}`, { method: "DELETE" });
    setSelectedTeamId("");
    setEditingTeamId(null);
    setMessage("Site deleted successfully");
    reload();
  }

  function requestDetails(request) {
    const detailSource = request.type === "delete_member" ? request.currentMember : request.payload;
    const rows = [
      ["Name", detailSource?.name],
      ["Trade", detailSource?.trade],
      ["Phone", detailSource?.phone],
      ["Site", detailSource?.site],
      ["Team", request.team?.name],
      ["Location", request.team?.siteLocation],
      ["Status", detailSource?.status]
    ].filter(([, value]) => value);

    if (request.type === "delete_member" && !detailSource) {
      return <p className="muted">Member was already removed or no longer exists.</p>;
    }

    return (
      <div className="request-details">
        {rows.map(([label, value]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    );
  }

  const selectedTeam = teams.find((team) => team._id === selectedTeamId);

  return (
    <section className="panel-grid">
      <article className="panel user-form-panel">
        <h2>Create Admin Login</h2>
        <form className="user-create-form" onSubmit={createLogin}>
          <input
            placeholder="Full name"
            value={newUser.name}
            onChange={(event) => setNewUser({ ...newUser, name: event.target.value })}
            required
          />
          <input
            placeholder="Email"
            type="email"
            value={newUser.email}
            onChange={(event) => setNewUser({ ...newUser, email: event.target.value })}
            required
          />
          <input
            placeholder="Password"
            type="password"
            minLength="6"
            value={newUser.password}
            onChange={(event) => setNewUser({ ...newUser, password: event.target.value })}
            required
          />
          <select
            value={newUser.assignedTeam}
            onChange={(event) => setNewUser({ ...newUser, assignedTeam: event.target.value })}
            required
          >
            <option value="">Assign site</option>
            {teams.map((team) => (
              <option key={team._id} value={team._id}>{team.name} - {team.siteLocation}</option>
            ))}
          </select>
          <button className="primary-button" type="submit">
            <Plus size={18} />
            Create admin
          </button>
        </form>
      </article>

      <article className="panel user-form-panel">
        <h2>Create Team</h2>
        <form className="user-create-form" onSubmit={createTeam}>
          <input
            placeholder="Team name"
            value={newTeam.name}
            onChange={(event) => setNewTeam({ ...newTeam, name: event.target.value })}
            required
          />
          <input
            placeholder="Site location"
            value={newTeam.siteLocation}
            onChange={(event) => setNewTeam({ ...newTeam, siteLocation: event.target.value })}
            required
          />
          <button className="primary-button" type="submit">
            <Plus size={18} />
            Create team
          </button>
        </form>

        <div className="created-team-list">
          <h3>Created Teams</h3>
          <select
            value={selectedTeamId}
            onChange={(event) => {
              setSelectedTeamId(event.target.value);
              setEditingTeamId(null);
            }}
          >
            <option value="">Select team</option>
            {teams.map((team) => (
              <option key={team._id} value={team._id}>{team.name} - {team.siteLocation}</option>
            ))}
          </select>

          {selectedTeam && (
            <div className="selected-team-card">
              {editingTeamId === selectedTeam._id ? (
                <>
                  <input value={teamEditForm.name} onChange={(event) => setTeamEditForm({ ...teamEditForm, name: event.target.value })} />
                  <input value={teamEditForm.siteLocation} onChange={(event) => setTeamEditForm({ ...teamEditForm, siteLocation: event.target.value })} />
                  <div className="action-row compact">
                    <button type="button" onClick={() => updateTeam(selectedTeam._id)}>Save</button>
                    <button type="button" onClick={() => setEditingTeamId(null)}>Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <strong>{selectedTeam.name}</strong>
                    <span>{selectedTeam.siteLocation}</span>
                  </div>
                  <div className="action-row compact">
                    <button type="button" onClick={() => startEditTeam(selectedTeam)}>Edit</button>
                    <button type="button" onClick={() => deleteTeam(selectedTeam._id)}>Delete</button>
                  </div>
                </>
              )}
            </div>
          )}

          {!teams.length && <p className="muted">No teams created yet.</p>}
        </div>
      </article>

      <article className="panel">
        <h2>Admin Users</h2>
        <div className="user-password-list">
          {users.filter((item) => item.role !== "super_admin").map((item) => (
            <div className="password-row" key={item._id}>
              {editingAdminId === item._id ? (
                <>
                  <input value={adminEditForm.name} onChange={(event) => setAdminEditForm({ ...adminEditForm, name: event.target.value })} />
                  <input type="email" value={adminEditForm.email} onChange={(event) => setAdminEditForm({ ...adminEditForm, email: event.target.value })} />
                  <select value={adminEditForm.assignedTeam} onChange={(event) => setAdminEditForm({ ...adminEditForm, assignedTeam: event.target.value })}>
                    <option value="">Assign site</option>
                    {teams.map((team) => (
                      <option key={team._id} value={team._id}>{team.name} - {team.siteLocation}</option>
                    ))}
                  </select>
                  <div className="action-row compact">
                    <button type="button" onClick={() => updateAdmin(item._id)}>Save</button>
                    <button type="button" onClick={() => setEditingAdminId(null)}>Cancel</button>
                  </div>
                </>
              ) : (
                <>
                  <div>
                    <strong>{item.name}</strong>
                    <span>{item.email} - {item.assignedTeam?.name || "No site assigned"}</span>
                  </div>
                  <input
                    placeholder="New password"
                    type="password"
                    minLength="6"
                    value={passwordForms[item._id] || ""}
                    onChange={(event) => setPasswordForms({ ...passwordForms, [item._id]: event.target.value })}
                  />
                  <div className="action-row compact">
                    <button type="button" onClick={() => updatePassword(item._id)}>Password</button>
                    <button type="button" onClick={() => startEditAdmin(item)}>Edit</button>
                    <button type="button" onClick={() => deleteAdmin(item._id)}>Delete</button>
                  </div>
                </>
              )}
            </div>
          ))}
          {!users.filter((item) => item.role !== "super_admin").length && <p className="muted">No Admin logins created yet.</p>}
        </div>
      </article>

      <article className="panel">
        <h2>Approval Requests</h2>
        <div className="request-list">
          {approvals.map((request) => (
            <div className="request-card" key={request._id}>
              <div>
                <strong>{request.type.replace("_", " ")}</strong>
                <span>{request.team?.name} by {request.requestedBy?.name}</span>
                <span>{new Date(request.createdAt).toLocaleString()}</span>
              </div>
              <span className={`status ${request.status}`}>{request.status}</span>
              {requestDetails(request)}
              {request.status === "pending" && (
                <div className="action-row">
                  <button onClick={() => review(request._id, "approved")}><CheckCircle2 /> Approve</button>
                  <button onClick={() => review(request._id, "rejected")}><XCircle /> Reject</button>
                </div>
              )}
            </div>
          ))}
          {!approvals.length && <p className="muted">No pending approval requests.</p>}
        </div>
      </article>
    </section>
  );
}

function ReportsPanel({ teams }) {
  function overtimeHoursForDates(member, dates) {
    return (member.overtimeEntries || [])
      .filter((entry) => dates.includes(entry.date))
      .reduce((total, entry) => total + entry.hours, 0);
  }

  function overtimeRemarksForDates(member, dates) {
    return (member.overtimeEntries || [])
      .filter((entry) => dates.includes(entry.date) && entry.note)
      .map((entry) => `${entry.date}: ${entry.note}`)
      .join("; ");
  }

  function attendanceBreakdown(member, dates) {
    return dates.map((date) => {
      const status = member.attendanceEntries?.find((entry) => entry.date === date)?.status || "absent";
      return `${date}: ${status}`;
    }).join("; ");
  }

  function downloadReport(period) {
    const dates = currentPeriodDates(period);
    const rows = [
      [
        "Period",
        "Team",
        "Site",
        "Member",
        "Trade",
        "Phone",
        "Attendance days",
        "Day salary",
        "OT hours",
        "OT amount",
        "Total salary",
        "Attendance detail",
        "OT remarks"
      ]
    ];

    teams.forEach((team) => {
      team.members.forEach((member) => {
        rows.push([
          period,
          team.name,
          team.siteLocation,
          member.name,
          member.trade,
          member.phone || "",
          attendanceDaysForDates(member, dates),
          attendanceSalaryForDates(member, dates),
          overtimeHoursForDates(member, dates),
          overtimeTotalForDates(member, dates),
          memberTotalForDates(member, dates),
          attendanceBreakdown(member, dates),
          overtimeRemarksForDates(member, dates)
        ]);
      });
    });

    downloadCsv(`construction-${period}-report-${dateKey(new Date())}.csv`, rows);
  }

  return (
    <section className="panel report-panel">
      <div>
        <h2>Download Reports</h2>
        <p className="muted">Export attendance, salary, overtime, remarks, and totals.</p>
      </div>
      <div className="report-actions">
        <button type="button" onClick={() => downloadReport("weekly")}>
          <Download size={18} />
          Weekly
        </button>
        <button type="button" onClick={() => downloadReport("monthly")}>
          <Download size={18} />
          Monthly
        </button>
        <button type="button" onClick={() => downloadReport("yearly")}>
          <Download size={18} />
          Yearly
        </button>
      </div>
    </section>
  );
}

function TeamPanel({ user, teams, reload, setMessage }) {
  const [memberForm, setMemberForm] = useState({ name: "", trade: "", phone: "", site: "" });
  const [salaryForms, setSalaryForms] = useState({});
  const [dailyOvertimeForms, setDailyOvertimeForms] = useState({});
  const currentWeek = useMemo(() => weekDates(), []);
  const todayKey = dateKey(new Date());
  const assignedTeam = teams[0];
  const canAssignedAdminRequest = user.role === "admin" && assignedTeam;
  const assignedSiteLocation = assignedTeam?.siteLocation || "";

  function salaryFormFor(member) {
    return salaryForms[member._id] || {
      fixedSalary: member.fixedSalary || 0,
      overtimeHourlyRate: member.overtimeHourlyRate || 0
    };
  }

  function dailyOvertimeFormFor(member, date) {
    return dailyOvertimeForms[`${member._id}-${date}`] || { hours: "", note: "" };
  }

  function attendanceFor(member, date) {
    return member.attendanceEntries?.find((entry) => entry.date === date)?.status || "absent";
  }

  function overtimeForDate(member, date) {
    return (member.overtimeEntries || [])
      .filter((entry) => entry.date === date)
      .reduce((total, entry) => total + entry.hours, 0);
  }

  function overtimeAmountForDate(member, date) {
    return (member.overtimeEntries || [])
      .filter((entry) => entry.date === date)
      .reduce((total, entry) => total + entry.hours * entry.hourlyRate, 0);
  }

  function overtimeRemarksForDate(member, date) {
    return (member.overtimeEntries || [])
      .filter((entry) => entry.date === date && entry.note)
      .map((entry) => entry.note)
      .join(", ");
  }

  async function submitMember(event) {
    event.preventDefault();
    if (!canAssignedAdminRequest) return;

    await apiRequest(`/teams/${assignedTeam._id}/members/request`, {
      method: "POST",
      body: JSON.stringify({
        type: "add_member",
        payload: { ...memberForm, site: assignedSiteLocation }
      })
    });

    setMemberForm({ name: "", trade: "", phone: "", site: "" });
    setMessage("Team member change sent to Super Admin for approval");
    reload();
  }

  async function requestMemberUpdate(team, member, type) {
    const payload = type === "delete_member"
      ? {}
      : { ...member, status: member.status === "active" ? "inactive" : "active" };

    await apiRequest(`/teams/${team._id}/members/request`, {
      method: "POST",
      body: JSON.stringify({ type, memberId: member._id, payload })
    });
    setMessage("Update request forwarded to Super Admin approval");
    reload();
  }

  async function saveSalary(team, member) {
    const form = salaryFormFor(member);
    await apiRequest(`/teams/${team._id}/members/${member._id}/salary`, {
      method: "PATCH",
      body: JSON.stringify(form)
    });
    setMessage("Salary and overtime hourly rate updated");
    reload();
  }

  async function updateAttendance(team, member, date, status) {
    await apiRequest(`/teams/${team._id}/members/${member._id}/attendance`, {
      method: "PUT",
      body: JSON.stringify({ date, status })
    });
    setMessage("Attendance updated");
    reload();
  }

  async function addDailyOvertime(event, team, member, date) {
    event.preventDefault();
    if (!member.overtimeHourlyRate || member.overtimeHourlyRate <= 0) {
      setMessage("Super Admin must set OT hourly salary before adding overtime");
      return;
    }
    const form = dailyOvertimeFormFor(member, date);

    await apiRequest(`/teams/${team._id}/members/${member._id}/overtime`, {
      method: "POST",
      body: JSON.stringify({ ...form, date })
    });

    setDailyOvertimeForms({
      ...dailyOvertimeForms,
      [`${member._id}-${date}`]: { hours: "", note: "" }
    });
    setMessage("Date-wise overtime added");
    reload();
  }

  const visibleTeams = user.role === "super_admin"
    ? teams.filter((team) => team.members.length > 0)
    : teams;

  return (
    <section className="team-section">
      {canAssignedAdminRequest && (
        <form className="panel member-form" onSubmit={submitMember}>
          <h2>Add Team Member</h2>
          <input placeholder="Name" value={memberForm.name} onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })} required />
          <input placeholder="Trade" value={memberForm.trade} onChange={(e) => setMemberForm({ ...memberForm, trade: e.target.value })} required />
          <input placeholder="Phone" value={memberForm.phone} onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })} />
          <input placeholder="Assigned site" value={assignedSiteLocation} readOnly />
          <button className="primary-button" type="submit"><Plus size={18} /> Send for approval</button>
        </form>
      )}

      {user.role === "super_admin" && !visibleTeams.length && (
        <section className="panel">
          <p className="muted">No approved team members yet. Admin-created members will appear here after approval.</p>
        </section>
      )}

      {visibleTeams.map((team) => (
        <article className="panel team-card" key={team._id}>
          <div className="team-header">
            <div>
              <h2>{team.name}</h2>
              <p>{team.siteLocation}</p>
            </div>
            <span>{team.members.length} members</span>
          </div>
          <div className="member-table">
            {team.members.map((member) => (
              <div className="member-row salary-row" key={member._id}>
                <div>
                  <strong>{member.name}</strong>
                  <span>{member.trade}</span>
                  <span>{member.phone || "No phone"}</span>
                  <span>{team.siteLocation}</span>
                </div>

                <div className="salary-summary">
                  <div>
                    <span>Current daily</span>
                    <strong>{money(member.fixedSalary)}</strong>
                  </div>
                  <div>
                    <span>Present days</span>
                    <strong>{attendanceDays(member)}</strong>
                  </div>
                  <div>
                    <span>Day salary</span>
                    <strong>{money(attendanceSalary(member))}</strong>
                  </div>
                  <div>
                    <span>OT</span>
                    <strong>{money(overtimeTotal(member))}</strong>
                  </div>
                  <div>
                    <span>Total</span>
                    <strong>{money(memberTotal(member))}</strong>
                  </div>
                  <small>{member.overtimeEntries?.length || 0} overtime entries at {money(member.overtimeHourlyRate)}/hr</small>
                </div>

                {user.role === "admin" && (
                  <form className="today-ot-form" onSubmit={(event) => addDailyOvertime(event, team, member, todayKey)}>
                    <input
                      aria-label="Today overtime hours"
                      placeholder="Today OT"
                      type="number"
                      min="0"
                      step="0.5"
                      value={dailyOvertimeFormFor(member, todayKey).hours}
                      onChange={(event) => setDailyOvertimeForms({
                        ...dailyOvertimeForms,
                        [`${member._id}-${todayKey}`]: {
                          ...dailyOvertimeFormFor(member, todayKey),
                          hours: event.target.value
                        }
                      })}
                      disabled={!member.overtimeHourlyRate || member.overtimeHourlyRate <= 0}
                      required
                    />
                    <input
                      aria-label="Today overtime remarks"
                      placeholder="Remarks"
                      value={dailyOvertimeFormFor(member, todayKey).note}
                      onChange={(event) => setDailyOvertimeForms({
                        ...dailyOvertimeForms,
                        [`${member._id}-${todayKey}`]: {
                          ...dailyOvertimeFormFor(member, todayKey),
                          note: event.target.value
                        }
                      })}
                      disabled={!member.overtimeHourlyRate || member.overtimeHourlyRate <= 0}
                      required
                    />
                    <button type="submit" disabled={!member.overtimeHourlyRate || member.overtimeHourlyRate <= 0}>
                      <Clock size={14} />
                      Save OT
                    </button>
                  </form>
                )}

                <div className="member-toolbar">
                  {user.role === "admin" && (
                    <div className="action-row compact member-actions">
                      <button onClick={() => requestMemberUpdate(team, member, "delete_member")}>Delete</button>
                    </div>
                  )}
                </div>

                {user.role === "super_admin" && (
                  <div className="salary-controls">
                    <label>
                      Current daily salary
                      <input
                        aria-label="Current daily salary"
                        type="number"
                        min="0"
                        value={salaryFormFor(member).fixedSalary}
                        onChange={(event) => setSalaryForms({
                          ...salaryForms,
                          [member._id]: { ...salaryFormFor(member), fixedSalary: event.target.value }
                        })}
                      />
                    </label>
                    <label>
                      OT hour salary
                      <input
                        aria-label="OT hour salary"
                        type="number"
                        min="0"
                        value={salaryFormFor(member).overtimeHourlyRate}
                        onChange={(event) => setSalaryForms({
                          ...salaryForms,
                          [member._id]: { ...salaryFormFor(member), overtimeHourlyRate: event.target.value }
                        })}
                      />
                    </label>
                    <button onClick={() => saveSalary(team, member)}>
                      <IndianRupee size={16} />
                      Save salary
                    </button>
                  </div>
                )}

                {(user.role === "admin" || user.role === "super_admin") && (
                  <div className="attendance-member inline-attendance">
                    <div className="attendance-name">
                      <strong>Weekly Attendance</strong>
                    </div>
                    <div className="attendance-grid">
                      {currentWeek.map((date) => (
                        <div className="attendance-day" key={`${member._id}-${date}`}>
                          <span>{shortDateLabel(date)}</span>
                          {user.role === "admin" && date === todayKey ? (
                            <select
                              className={`attendance-select ${attendanceFor(member, date)}`}
                              value={attendanceFor(member, date)}
                              onChange={(event) => updateAttendance(team, member, date, event.target.value)}
                            >
                              <option value="present">Present</option>
                              <option value="absent">Absent</option>
                              <option value="half">0.5 day</option>
                            </select>
                          ) : (
                            <span className={`attendance-pill ${attendanceFor(member, date)}`}>
                              {attendanceFor(member, date) === "half" ? "0.5 day" : attendanceFor(member, date)}
                            </span>
                          )}
                          <small>OT: {overtimeForDate(member, date)} hr - {money(overtimeAmountForDate(member, date))}</small>
                          <small>Remarks: {overtimeRemarksForDate(member, date) || "No remarks"}</small>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            ))}
          </div>
        </article>
      ))}
    </section>
  );
}

function roleDescription(user) {
  if (user.role === "super_admin") return "Full system control for sites, admins, salary, reports, and approvals.";
  return "You can work only with your assigned site. Changes are sent for Super Admin approval.";
}

createRoot(document.getElementById("root")).render(<App />);
