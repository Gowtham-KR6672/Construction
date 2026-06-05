import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import Lottie from "lottie-react";
import {
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Building2,
  CalendarDays,
  EyeOff,
  FileSpreadsheet,
  HardHat,
  IndianRupee,
  Lock,
  LogOut,
  Mail,
  MapPin,
  LayoutGrid,
  Download,
  Plus,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  Users,
  XCircle
} from "lucide-react";
import constructionLoadingAnimation from "./assets/construction-loading.json";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const DEFAULT_TEAM_NAMES = [
  "Mason team",
  "Centering team",
  "Tiles team",
  "Painting team",
  "Electrical team",
  "Plumbing team"
];

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

function splitTeamName(name = "") {
  const [mainTeam, ...subTeamParts] = name.split(" - ");
  return {
    mainTeam: mainTeam.trim(),
    subTeam: subTeamParts.join(" - ").trim()
  };
}

function mainTeamSelectionId(mainTeam) {
  return `main:${mainTeam}`;
}

function isMainTeamSelection(value) {
  return value.startsWith("main:");
}

function selectedMainTeam(value) {
  return value.replace(/^main:/, "");
}

function buildTeamGroups(teams) {
  const groups = new Map();

  teams.forEach((team) => {
    const { mainTeam, subTeam } = splitTeamName(team.name);
    if (!groups.has(mainTeam)) {
      groups.set(mainTeam, { mainTeam, parent: null, subTeams: [] });
    }

    const group = groups.get(mainTeam);
    if (subTeam) {
      group.subTeams.push({ ...team, subTeam });
    } else {
      group.parent = team;
    }
  });

  return Array.from(groups.values()).sort((a, b) => a.mainTeam.localeCompare(b.mainTeam));
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
  const [isCheckingSession, setIsCheckingSession] = useState(Boolean(localStorage.getItem("token")));

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setIsCheckingSession(false);
      return;
    }

    apiRequest("/auth/me")
      .then((data) => setUser(data.user))
      .catch(() => localStorage.removeItem("token"))
      .finally(() => setIsCheckingSession(false));
  }, []);

  function logout() {
    localStorage.removeItem("token");
    setUser(null);
  }

  if (isCheckingSession) {
    return <LoadingScreen title="Restoring secure session" detail="Connecting to the deployed API and database" />;
  }

  if (!user) return <Login setUser={setUser} error={error} setError={setError} />;

  return <Dashboard user={user} logout={logout} />;
}

function LoadingScreen({ title, detail }) {
  return (
    <main className="loading-page">
      <div className="loading-panel">
        <Lottie
          animationData={constructionLoadingAnimation}
          aria-hidden="true"
          className="loading-lottie"
          loop
        />
        <div>
          <h1>{title}</h1>
          <p>{detail}</p>
        </div>
        <div className="loading-bar" aria-hidden="true">
          <span />
        </div>
      </div>
    </main>
  );
}

function DataLoading({ title = "Fetching database records", detail = "Loading teams, approvals, users, attendance, and payroll data." }) {
  return (
    <section className="panel data-loading" aria-live="polite">
      <div className="loading-mark compact" aria-hidden="true">
        <HardHat size={24} />
      </div>
      <div>
        <h2>{title}</h2>
        <p className="muted">{detail}</p>
      </div>
      <div className="loading-card-grid" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    </section>
  );
}

function PanelHeading({ icon: Icon, title, action }) {
  return (
    <div className="panel-heading">
      <div>
        <span className="panel-heading-icon">
          <Icon size={18} />
        </span>
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function IconField({ icon: Icon, children }) {
  return (
    <div className="icon-field">
      <Icon size={16} />
      {children}
    </div>
  );
}

function EmptyState({ icon: Icon, title, detail }) {
  return (
    <div className="empty-state">
      <span>
        <Icon size={28} />
      </span>
      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

function Login({ setUser, error, setError }) {
  const [form, setForm] = useState({ email: "", password: "" });
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const data = await apiRequest("/auth/login", {
        method: "POST",
        body: JSON.stringify(form)
      });
      localStorage.setItem("token", data.token);
      setUser(data.user);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
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
          <button className="primary-button" type="submit" disabled={isSubmitting}>
            {isSubmitting ? "Fetching data..." : "Login"}
          </button>
        </form>
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
  const [expandedTeamNames, setExpandedTeamNames] = useState({});
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const canManageUsers = user.role === "super_admin" || user.permissions?.includes("manage_users");
  const canViewApprovals = user.role === "super_admin" || user.permissions?.includes("view_approvals");

  async function loadData({ background = false } = {}) {
    if (background) {
      setIsRefreshing(true);
    } else {
      setIsInitialLoading(true);
    }

    try {
      const [teamData, approvalData, userData] = await Promise.all([
        apiRequest("/teams"),
        canViewApprovals ? apiRequest("/approvals") : Promise.resolve([]),
        canManageUsers ? apiRequest("/users") : Promise.resolve([])
      ]);
      setTeams(teamData);
      setApprovals(approvalData);
      setUsers(userData);
    } finally {
      if (background) {
        setIsRefreshing(false);
      } else {
        setIsInitialLoading(false);
      }
    }
  }

  useEffect(() => {
    loadData().catch((err) => setMessage(err.message));
  }, []);

  const refreshData = () => loadData({ background: true });
  const teamGroups = useMemo(() => buildTeamGroups(teams), [teams]);
  const selectedTeamIds = useMemo(() => {
    if (!selectedSiteId) return teams.map((team) => team._id);
    if (!isMainTeamSelection(selectedSiteId)) return [selectedSiteId];

    const mainTeam = selectedMainTeam(selectedSiteId);
    return teams
      .filter((team) => splitTeamName(team.name).mainTeam === mainTeam)
      .map((team) => team._id);
  }, [selectedSiteId, teams]);
  const visibleTeams = selectedSiteId ? teams.filter((team) => selectedTeamIds.includes(team._id)) : teams;
  const visibleUsers = selectedSiteId
    ? users.filter((item) => selectedTeamIds.includes(item.assignedTeam?._id || item.assignedTeam))
    : users;
  const visibleApprovals = selectedSiteId
    ? approvals.filter((item) => selectedTeamIds.includes(item.team?._id || item.team))
    : approvals;
  const selectedSite = isMainTeamSelection(selectedSiteId)
    ? { name: selectedMainTeam(selectedSiteId), siteLocation: `${visibleTeams.length} team${visibleTeams.length === 1 ? "" : "s"}` }
    : teams.find((team) => team._id === selectedSiteId);

  function toggleTeamGroup(mainTeam) {
    setExpandedTeamNames((current) => ({
      ...current,
      [mainTeam]: !current[mainTeam]
    }));
  }

  const stats = useMemo(() => {
    const memberCount = visibleTeams.reduce((total, team) => total + team.members.length, 0);
    const payrollTotal = visibleTeams.reduce((total, team) => total + teamPayrollTotal(team), 0);
    return [
      { label: "Teams", value: buildTeamGroups(visibleTeams).length, icon: Users },
      { label: "Members", value: memberCount, icon: HardHat },
      { label: "Payroll total", value: money(payrollTotal), icon: IndianRupee },
      { label: "Pending approvals", value: visibleApprovals.filter((item) => item.status === "pending").length, icon: ClipboardCheck }
    ];
  }, [visibleTeams, visibleApprovals]);

  return (
    <main className="app-shell">
      <aside className="sidebar">
        <div className="sidebar-brand">
          <div className="brand-mark small">
            <HardHat size={28} />
            <span>BuildCo</span>
          </div>
          <button className="sidebar-collapse" type="button" aria-label="Collapse navigation">
            <ChevronLeft size={22} />
          </button>
        </div>
        <div className="role-card">
          <span className="role-icon">
            <ShieldCheck size={24} />
          </span>
          <div>
            <strong>{user.name}</strong>
            <span>{user.role.replace("_", " ")}</span>
          </div>
          <ChevronDown size={18} />
        </div>
        <div className="sidebar-sites">
          <strong>Sites</strong>
          <button
            className={`sidebar-site ${!selectedSiteId ? "active" : ""}`}
            type="button"
            onClick={() => setSelectedSiteId("")}
          >
            <LayoutGrid className="sidebar-site-icon" size={24} />
            <span>
              <strong>All Sites</strong>
              <small>Show all dashboard data</small>
            </span>
            <ChevronRight className="sidebar-site-arrow" size={20} />
          </button>
          {teamGroups.map((group) => {
            const groupSelectionId = mainTeamSelectionId(group.mainTeam);
            const groupLocation = group.parent?.siteLocation || group.subTeams[0]?.siteLocation || "";
            const hasSubTeams = group.subTeams.length > 0;
            const isExpanded = Boolean(expandedTeamNames[group.mainTeam]);
            return (
              <div className="sidebar-team-group" key={group.mainTeam}>
                <button
                  className={`sidebar-site ${selectedSiteId === groupSelectionId ? "active" : ""}`}
                  type="button"
                  onClick={() => {
                    setSelectedSiteId(groupSelectionId);
                    if (hasSubTeams) toggleTeamGroup(group.mainTeam);
                  }}
                >
                  <Building2 className="sidebar-site-icon" size={24} />
                  <span>
                    <strong>{group.mainTeam}</strong>
                    <small>{groupLocation}</small>
                  </span>
                  {hasSubTeams ? (
                    <ChevronRight className={`sidebar-site-arrow ${isExpanded ? "expanded" : ""}`} size={20} />
                  ) : (
                    <ChevronRight className="sidebar-site-arrow" size={20} />
                  )}
                </button>
                {hasSubTeams && isExpanded && (
                  <div className="sidebar-subteams">
                    {group.subTeams.map((team) => (
                      <button
                        className={`sidebar-subteam ${selectedSiteId === team._id ? "active" : ""}`}
                        key={team._id}
                        type="button"
                        onClick={() => setSelectedSiteId(team._id)}
                      >
                        <span>
                          <strong>{team.subTeam}</strong>
                          <small>{team.siteLocation}</small>
                        </span>
                        {selectedSiteId === team._id && <ChevronRight size={16} />}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {isInitialLoading && <small>Loading sites...</small>}
          {!isInitialLoading && !teams.length && <small>No sites created yet.</small>}
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
          {isInitialLoading
            ? ["Teams", "Members", "Payroll total", "Pending approvals"].map((label) => (
              <article className="stat-card stat-card-loading" key={label}>
                <span>{label}</span>
                <strong />
              </article>
            ))
            : stats.map((stat) => (
              <article className="stat-card" key={stat.label}>
                <span className="stat-icon">
                  <stat.icon size={28} />
                </span>
                <div>
                  <span>{stat.label}</span>
                  <strong>{stat.value}</strong>
                </div>
              </article>
            ))}
        </div>

        {message && <p className="notice">{message}</p>}

        {isRefreshing && <p className="sync-note">Refreshing database data...</p>}

        {isInitialLoading ? (
          <DataLoading />
        ) : (
          <>
            {user.role === "super_admin" && (
              <SuperAdminPanel users={visibleUsers} teams={visibleTeams} approvals={visibleApprovals} reload={refreshData} setMessage={setMessage} />
            )}

            {user.role === "super_admin" && <ReportsPanel teams={visibleTeams} />}

            <TeamPanel user={user} teams={visibleTeams} reload={refreshData} setMessage={setMessage} />
          </>
        )}
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
  const [newTeam, setNewTeam] = useState({ name: "", subTeam: "", siteLocation: "" });
  const [teamNameMode, setTeamNameMode] = useState("");
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
    const teamName = teamNameMode === "custom"
      ? newTeam.name.trim()
      : [teamNameMode, newTeam.subTeam.trim()].filter(Boolean).join(" - ");

    const createdTeam = await apiRequest("/teams", {
      method: "POST",
      body: JSON.stringify({
        name: teamName,
        siteLocation: newTeam.siteLocation
      })
    });

    setNewTeam({ name: "", subTeam: "", siteLocation: "" });
    setTeamNameMode("");
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
        <PanelHeading icon={UserPlus} title="Create Admin Login" />
        <form className="user-create-form" onSubmit={createLogin}>
          <IconField icon={UserPlus}>
            <input
              placeholder="Full name"
              value={newUser.name}
              onChange={(event) => setNewUser({ ...newUser, name: event.target.value })}
              required
            />
          </IconField>
          <IconField icon={Mail}>
            <input
              placeholder="Email"
              type="email"
              value={newUser.email}
              onChange={(event) => setNewUser({ ...newUser, email: event.target.value })}
              required
            />
          </IconField>
          <IconField icon={Lock}>
            <input
              placeholder="Password"
              type="password"
              minLength="6"
              value={newUser.password}
              onChange={(event) => setNewUser({ ...newUser, password: event.target.value })}
              required
            />
            <EyeOff size={16} />
          </IconField>
          <IconField icon={Building2}>
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
          </IconField>
          <button className="primary-button" type="submit">
            <Plus size={18} />
            Create Admin
          </button>
        </form>
      </article>

      <article className="panel user-form-panel">
        <PanelHeading icon={Users} title="Create Team" />
        <form className="user-create-form" onSubmit={createTeam}>
          <IconField icon={Users}>
            <select
              value={teamNameMode}
              onChange={(event) => {
                setTeamNameMode(event.target.value);
                setNewTeam({
                  ...newTeam,
                  name: "",
                  subTeam: ""
                });
              }}
              required
            >
              <option value="">Select team type</option>
              {DEFAULT_TEAM_NAMES.map((teamName) => (
                <option key={teamName} value={teamName}>{teamName}</option>
              ))}
              <option value="custom">Custom team</option>
            </select>
          </IconField>
          {teamNameMode === "custom" && (
            <IconField icon={Building2}>
              <input
                placeholder="Custom team name"
                value={newTeam.name}
                onChange={(event) => setNewTeam({ ...newTeam, name: event.target.value })}
                required
              />
            </IconField>
          )}
          {teamNameMode && teamNameMode !== "custom" && (
            <IconField icon={Building2}>
              <input
                placeholder="Sub-team name"
                value={newTeam.subTeam}
                onChange={(event) => setNewTeam({ ...newTeam, subTeam: event.target.value })}
              />
            </IconField>
          )}
          <IconField icon={MapPin}>
            <input
              placeholder="Site location"
              value={newTeam.siteLocation}
              onChange={(event) => setNewTeam({ ...newTeam, siteLocation: event.target.value })}
              required
            />
          </IconField>
          <button className="primary-button" type="submit">
            <Plus size={18} />
            Create Team
          </button>
        </form>

        <div className="created-team-list">
          <div className="section-subheading">
            <h3>Created Teams</h3>
            <button type="button" onClick={reload} aria-label="Refresh teams">
              <RefreshCw size={16} />
            </button>
          </div>
          <IconField icon={Building2}>
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
          </IconField>

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

      <article className="panel table-panel">
        <PanelHeading
          icon={UserPlus}
          title="Admin Users"
          action={<button className="panel-link" type="button">View all</button>}
        />
        <div className="mini-table-head admin-table-head">
          <span>Name</span>
          <span>Email</span>
          <span>Site</span>
          <span>Created On</span>
        </div>
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
          {!users.filter((item) => item.role !== "super_admin").length && (
            <EmptyState
              icon={Users}
              title="No admin logins created yet."
              detail="Create your first admin login using the form above."
            />
          )}
        </div>
      </article>

      <article className="panel table-panel">
        <PanelHeading
          icon={ClipboardCheck}
          title="Approval Requests"
          action={<button className="panel-link" type="button">View all</button>}
        />
        <div className="mini-table-head approval-table-head">
          <span>Request</span>
          <span>Requested By</span>
          <span>Team</span>
          <span>Date</span>
        </div>
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
          {!approvals.length && (
            <EmptyState
              icon={ClipboardCheck}
              title="No pending approval requests."
              detail="You're all caught up!"
            />
          )}
        </div>
      </article>
    </section>
  );
}

function ReportsPanel({ teams }) {
  const today = dateKey(new Date());
  const [dateRange, setDateRange] = useState({ from: today, to: today });
  const [reportError, setReportError] = useState("");

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

  function downloadReport(event) {
    event.preventDefault();
    setReportError("");

    if (!dateRange.from || !dateRange.to) {
      setReportError("Select both From and To dates");
      return;
    }

    const start = new Date(`${dateRange.from}T00:00:00`);
    const end = new Date(`${dateRange.to}T00:00:00`);

    if (start > end) {
      setReportError("From date must be before To date");
      return;
    }

    const dates = datesBetween(start, end);
    const periodLabel = `${dateRange.from} to ${dateRange.to}`;
    const rows = [
      [
        "Date range",
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
          periodLabel,
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

    downloadCsv(`construction-${dateRange.from}-to-${dateRange.to}-report-${dateKey(new Date())}.csv`, rows);
  }

  return (
    <section className="panel report-panel">
      <div className="report-heading">
        <PanelHeading icon={FileSpreadsheet} title="Download Reports" />
        <p className="muted">Export attendance, salary, overtime, remarks, and totals by date range.</p>
      </div>
      <div className="report-illustration" aria-hidden="true">
        <FileSpreadsheet size={54} />
        <Download size={18} />
      </div>
      <form className="report-actions" onSubmit={downloadReport}>
        <label>
          From
          <IconField icon={CalendarDays}>
            <input
              type="date"
              value={dateRange.from}
              onChange={(event) => setDateRange({ ...dateRange, from: event.target.value })}
              required
            />
          </IconField>
        </label>
        <label>
          To
          <IconField icon={CalendarDays}>
            <input
              type="date"
              value={dateRange.to}
              onChange={(event) => setDateRange({ ...dateRange, to: event.target.value })}
              required
            />
          </IconField>
        </label>
        <button className="primary-button" type="submit">
          <Download size={18} />
          Download Report
        </button>
        {reportError && <p className="error">{reportError}</p>}
      </form>
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
