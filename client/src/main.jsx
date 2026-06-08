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
  Smartphone,
  UserPlus,
  Users,
  XCircle
} from "lucide-react";
import constructionLoadingAnimation from "./assets/construction-loading.json";
import logoAsset from "./assets/logo-display.jpg";
import "./styles.css";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";
const MEMBER_TEAM_OPTIONS = [
  "Mason Team",
  "Centering Team",
  "Tiles Team",
  "Painting Team",
  "Electrical Team",
  "Plumbing Team",
  "Other"
];
const MEMBER_TEAM_OPTIONS_REQUIRING_DETAIL = new Set(["Mason Team", "Other"]);
const ADMIN_ATTENDANCE_OPTIONS = ["Present", "Absent", "0.5 days leave"];

function isIosDevice() {
  if (typeof window === "undefined") return false;

  const userAgent = window.navigator.userAgent.toLowerCase();
  const isTouchMac = window.navigator.platform === "MacIntel" && window.navigator.maxTouchPoints > 1;
  return /iphone|ipad|ipod/.test(userAgent) || isTouchMac;
}

function isStandaloneApp() {
  if (typeof window === "undefined") return false;

  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;

  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch((error) => {
      console.warn("Service worker registration failed", error);
    });
  });
}

function money(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(value || 0);
}

function calculateDailySalary(monthlySalary, referenceDate = new Date()) {
  const monthly = Number(monthlySalary || 0);
  if (!Number.isFinite(monthly) || monthly <= 0) return 0;

  const daysInMonth = new Date(referenceDate.getFullYear(), referenceDate.getMonth() + 1, 0).getDate();
  return daysInMonth > 0 ? monthly / daysInMonth : 0;
}

function adminAttendanceClass(leaveType) {
  if (leaveType === "Present") return "present";
  if (leaveType === "Absent") return "absent";
  if (leaveType === "0.5 days leave") return "half";
  return "";
}

function adminAttendanceUnit(entry) {
  if (new Date(`${entry.date}T00:00:00`).getDay() === 0) return 1;
  if (entry.leaveType === "0.5 days leave") return 0.5;
  if (entry.leaveType === "Absent") return 0;
  return 1;
}

function overtimeTotal(member) {
  return (member.overtimeEntries || []).reduce((total, entry) => total + Number(entry.hours || 0) * Number(entry.hourlyRate || 0), 0);
}

function attendanceUnit(status) {
  if (status === "present") return 1;
  if (status === "half") return 0.5;
  return 0;
}

function attendanceEntrySalary(member, entry) {
  const dailySalary = Number(entry?.dailySalary);
  return Number.isFinite(dailySalary) && dailySalary > 0 ? dailySalary : Number(member.fixedSalary || 0);
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
  return dates.reduce((total, date) => total + attendanceUnit(member.attendanceEntries?.find((entry) => normalizeDateKey(entry.date) === date)?.status), 0);
}

function attendanceSalaryForDates(member, dates) {
  return dates.reduce((total, date) => {
    const entry = member.attendanceEntries?.find((item) => normalizeDateKey(item.date) === date);
    return total + attendanceUnit(entry?.status) * attendanceEntrySalary(member, entry || {});
  }, 0);
}

function overtimeTotalForDates(member, dates) {
  return (member.overtimeEntries || [])
    .filter((entry) => dates.includes(normalizeDateKey(entry.date)))
    .reduce((total, entry) => total + Number(entry.hours || 0) * Number(entry.hourlyRate || 0), 0);
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
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function normalizeDateKey(value) {
  if (!value) return "";
  if (value instanceof Date) return dateKey(value);
  return String(value).slice(0, 10);
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

function xmlValue(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function excelSheetName(name, usedNames) {
  const baseName = String(name || "Sheet")
    .replace(/[\[\]:*?/\\]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 31) || "Sheet";
  let sheetName = baseName;
  let index = 2;

  while (usedNames.has(sheetName)) {
    const suffix = ` ${index}`;
    sheetName = `${baseName.slice(0, 31 - suffix.length)}${suffix}`;
    index += 1;
  }

  usedNames.add(sheetName);
  return sheetName;
}

function excelCell(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return `<Cell><Data ss:Type="Number">${value}</Data></Cell>`;
  }

  return `<Cell><Data ss:Type="String">${xmlValue(value)}</Data></Cell>`;
}

function downloadExcelWorkbook(filename, sheets) {
  const usedNames = new Set();
  const worksheets = sheets.map((sheet) => {
    const rows = sheet.rows.map((row) => `<Row>${row.map(excelCell).join("")}</Row>`).join("");
    return `<Worksheet ss:Name="${xmlValue(excelSheetName(sheet.name, usedNames))}"><Table>${rows}</Table></Worksheet>`;
  }).join("");
  const workbook = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:o="urn:schemas-microsoft-com:office:office"
  xmlns:x="urn:schemas-microsoft-com:office:excel"
  xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
  xmlns:html="http://www.w3.org/TR/REC-html40">
  ${worksheets}
</Workbook>`;
  const blob = new Blob([workbook], { type: "application/vnd.ms-excel;charset=utf-8" });
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

function InstallAppPrompt({ compact = false, edge = false, alwaysVisible = false }) {
  const [installPrompt, setInstallPrompt] = useState(null);
  const [isInstalled, setIsInstalled] = useState(isStandaloneApp);
  const [showIosHelp, setShowIosHelp] = useState(false);

  useEffect(() => {
    function handleBeforeInstallPrompt(event) {
      event.preventDefault();
      setInstallPrompt(event);
    }

    function handleInstalled() {
      setInstallPrompt(null);
      setShowIosHelp(false);
      setIsInstalled(true);
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleInstalled);

    if (isIosDevice() && !isStandaloneApp()) {
      setShowIosHelp(true);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
      window.removeEventListener("appinstalled", handleInstalled);
    };
  }, []);

  async function installApp() {
    if (!installPrompt) return;

    installPrompt.prompt();
    const choice = await installPrompt.userChoice;
    if (choice.outcome === "accepted") {
      setInstallPrompt(null);
    }
  }

  if (isInstalled && !alwaysVisible) return null;
  if (!installPrompt && !showIosHelp && !alwaysVisible) return null;

  const statusText = isInstalled
    ? "App installed"
    : installPrompt
      ? "PWA Install Support"
      : "Install on this device";

  return (
    <div className={`install-app ${compact ? "compact" : ""} ${edge ? "edge" : ""}`}>
      <button
        className="install-button"
        type="button"
        onClick={installPrompt ? installApp : undefined}
        disabled={!installPrompt}
        aria-label={statusText}
        title={statusText}
      >
        <Smartphone size={18} />
        <span>{statusText}</span>
      </button>
      {isInstalled && <p>This app is already installed on this device.</p>}
      {!isInstalled && showIosHelp && <p>On iPhone or iPad, tap Share in Safari, then choose Add to Home Screen.</p>}
      {!isInstalled && !installPrompt && !showIosHelp && alwaysVisible && (
        <p></p>
      )}
    </div>
  );
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

function MonthlyCalendar() {
  const today = new Date();
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const monthEnd = new Date(today.getFullYear(), today.getMonth() + 1, 0);
  const leadingBlanks = monthStart.getDay();
  const days = [
    ...Array.from({ length: leadingBlanks }, (_, index) => ({ key: `blank-${index}`, label: "" })),
    ...Array.from({ length: monthEnd.getDate() }, (_, index) => {
      const day = index + 1;
      return {
        key: `day-${day}`,
        label: day,
        isToday: day === today.getDate()
      };
    })
  ];

  return (
    <section className="sidebar-calendar" aria-label="Monthly calendar">
      <div>
        <strong>{today.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</strong>
        <span>{today.toLocaleDateString("en-IN", { weekday: "long", day: "2-digit", month: "short" })}</span>
      </div>
      <div className="calendar-weekdays" aria-hidden="true">
        {["S", "M", "T", "W", "T", "F", "S"].map((day, index) => (
          <span key={`${day}-${index}`}>{day}</span>
        ))}
      </div>
      <div className="calendar-days">
        {days.map((day) => (
          <span className={day.isToday ? "today" : ""} key={day.key}>
            {day.label}
          </span>
        ))}
      </div>
    </section>
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
          <img src={logoAsset} alt="" className="brand-logo" />
          <span>Valar Constraction Workforce</span>
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
          <InstallAppPrompt alwaysVisible />
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
  const [selectedAdminControlId, setSelectedAdminControlId] = useState("");
  const [expandedTeamNames, setExpandedTeamNames] = useState({});
  const [showAdminDataControl, setShowAdminDataControl] = useState(false);
  const [isInitialLoading, setIsInitialLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const canManageUsers = user.role === "super_admin" || user.permissions?.includes("manage_users");
  const canViewApprovals = user.role === "super_admin" || user.permissions?.includes("view_approvals");
  const assignedTeamId = user.assignedTeam?._id || user.assignedTeam || "";
  const isAdmin = user.role === "admin";

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
  const assignedSidebarTeam = teams.find((team) => team._id === assignedTeamId);
  const teamGroups = useMemo(() => buildTeamGroups(teams), [teams]);

  useEffect(() => {
    if (isAdmin && assignedTeamId && !selectedSiteId) {
      setSelectedSiteId(assignedTeamId);
    }
  }, [assignedTeamId, isAdmin, selectedSiteId]);

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
  const adminUsers = useMemo(() => users.filter((item) => item.role === "admin"), [users]);

  useEffect(() => {
    if (!showAdminDataControl) return;

    setSelectedAdminControlId((current) => {
      if (adminUsers.some((admin) => admin._id === current)) return current;
      return adminUsers[0]?._id || "";
    });
  }, [adminUsers, showAdminDataControl]);

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
            <img src={logoAsset} alt="" className="brand-logo" />
            <span>Valar Constraction</span>
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
          {showAdminDataControl && user.role === "super_admin" ? (
            <>
              <strong>Admins</strong>
              {adminUsers.map((admin) => (
                <button
                  className={`sidebar-site ${selectedAdminControlId === admin._id ? "active" : ""}`}
                  key={admin._id}
                  type="button"
                  onClick={() => setSelectedAdminControlId(admin._id)}
                >
                  <Users className="sidebar-site-icon" size={24} />
                  <span>
                    <strong>{admin.name}</strong>
                    <small>{admin.assignedTeam?.name || "No site assigned"}</small>
                  </span>
                  <ChevronRight className="sidebar-site-arrow" size={20} />
                </button>
              ))}
              {!adminUsers.length && <small>No admins created yet.</small>}
            </>
          ) : (
            <>
              <strong>Sites</strong>
              {!isAdmin && (
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
              )}
              {isAdmin && assignedSidebarTeam && (
                <button
                  className={`sidebar-site ${selectedSiteId === assignedSidebarTeam._id ? "active" : ""}`}
                  type="button"
                  onClick={() => setSelectedSiteId(assignedSidebarTeam._id)}
                >
                  <Building2 className="sidebar-site-icon" size={24} />
                  <span>
                    <strong>{assignedSidebarTeam.name}</strong>
                    <small>{assignedSidebarTeam.siteLocation}</small>
                  </span>
                  <ChevronRight className="sidebar-site-arrow" size={20} />
                </button>
              )}
              {!isAdmin && teamGroups.map((group) => {
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
            </>
          )}
        </div>
        {user.role === "super_admin" && !showAdminDataControl && <MonthlyCalendar />}
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
          <InstallAppPrompt compact />
        </header>

        {!showAdminDataControl && (
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
        )}

        {user.role === "super_admin" && !isInitialLoading && !showAdminDataControl && (
          <div className="dashboard-nav-row">
            <button
              className={`dashboard-nav-button ${showAdminDataControl ? "active" : ""}`}
              type="button"
              onClick={() => setShowAdminDataControl(true)}
            >
              <Users size={18} />
              Admin Data Control
            </button>
          </div>
        )}

        {message && <p className="notice">{message}</p>}

        {user.role === "super_admin" && showAdminDataControl ? (
          <AdminDataControlPage
            users={users}
            teams={teams}
            selectedAdminId={selectedAdminControlId}
            reload={refreshData}
            setMessage={setMessage}
            onBack={() => setShowAdminDataControl(false)}
          />
        ) : (
          <>
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
          </>
        )}
      </section>
    </main>
  );
}

function AdminDataControlPage({ users, teams, selectedAdminId, reload, setMessage, onBack }) {
  const admins = useMemo(() => users.filter((item) => item.role === "admin"), [users]);
  const todayKey = dateKey(new Date());
  const currentMonthKey = todayKey.slice(0, 7);
  const [adminAttendanceEntries, setAdminAttendanceEntries] = useState([]);
  const adminMonthlySalaryTotal = useMemo(
    () => admins.reduce((total, admin) => total + Number(admin.monthlySalary || 0), 0),
    [admins]
  );
  const selectedAdmin = admins.find((admin) => admin._id === selectedAdminId) || admins[0] || null;
  const selectedAdminEntries = useMemo(
    () => adminAttendanceEntries.filter((entry) => entry.admin?._id === selectedAdmin?._id || entry.admin === selectedAdmin?._id),
    [adminAttendanceEntries, selectedAdmin?._id]
  );
  function adminStats(admin, entries) {
    const dailySalary = Number(admin?.dailySalary || 0);
    return entries.reduce((stats, entry) => {
      const unit = adminAttendanceUnit(entry);
      return {
        totalEarnings: stats.totalEarnings + unit * dailySalary,
        presentDays: stats.presentDays + (unit === 1 ? 1 : 0),
        halfDays: stats.halfDays + (entry.leaveType === "0.5 days leave" && unit !== 1 ? 1 : 0),
        absentDays: stats.absentDays + (entry.leaveType === "Absent" && unit !== 1 ? 1 : 0)
      };
    }, { totalEarnings: 0, presentDays: 0, halfDays: 0, absentDays: 0 });
  }

  const selectedAdminStats = useMemo(() => {
    return adminStats(selectedAdmin, selectedAdminEntries);
  }, [selectedAdmin, selectedAdminEntries]);

  async function refreshAdminAttendanceEntries() {
    const data = await apiRequest(`/admin-attendance/all?month=${currentMonthKey}`);
    setAdminAttendanceEntries(data.entries || []);
  }

  useEffect(() => {
    refreshAdminAttendanceEntries().catch((error) => setMessage(error.message));
  }, [currentMonthKey, setMessage]);

  function downloadSelectedAdminData() {
    if (!selectedAdmin) return;

    const rows = [
      ["Admin", "Month", "Monthly salary", "Daily salary", "Total earnings", "Present days", "0.5 days leave", "Absent days"],
      [
        selectedAdmin.name,
        currentMonthKey,
        selectedAdmin.monthlySalary || 0,
        selectedAdmin.dailySalary || 0,
        selectedAdminStats.totalEarnings,
        selectedAdminStats.presentDays,
        selectedAdminStats.halfDays,
        selectedAdminStats.absentDays
      ],
      [],
      ["Date", "Status", "Remark"],
      ...selectedAdminEntries.map((entry) => [
        entry.date,
        entry.leaveType,
        entry.remark || ""
      ])
    ];

    downloadCsv(`admin-${selectedAdmin.name}-${currentMonthKey}-attendance.csv`, rows);
  }

  function downloadAllAdminExcel() {
    if (!admins.length) return;

    const adminSheets = admins.map((admin) => {
      const entries = adminAttendanceEntries.filter((entry) => entry.admin?._id === admin._id || entry.admin === admin._id);
      const stats = adminStats(admin, entries);

      return {
        admin,
        entries,
        stats,
        rows: [
          ["Admin details"],
          ["Name", admin.name],
          ["Email", admin.email],
          ["Project", admin.assignedTeam?.name || "No site assigned"],
          ["Site location", admin.assignedTeam?.siteLocation || ""],
          ["Month", currentMonthKey],
          ["Monthly salary", Number(admin.monthlySalary || 0)],
          ["Daily salary", Number(admin.dailySalary || 0)],
          ["Total monthly earnings", stats.totalEarnings],
          ["Total day present", stats.presentDays],
          ["Total 0.5 days leave", stats.halfDays],
          ["Total day absent", stats.absentDays],
          [],
          ["Attendance details"],
          ["Date", "Day", "Status", "Daily salary", "Day earning", "Remark"],
          ...entries.map((entry) => {
            const unit = adminAttendanceUnit(entry);
            return [
              entry.date,
              shortDateLabel(entry.date),
              entry.leaveType,
              Number(admin.dailySalary || 0),
              unit * Number(admin.dailySalary || 0),
              entry.remark || ""
            ];
          })
        ]
      };
    });

    const summaryRows = [
      ["All admin details"],
      ["Month", currentMonthKey],
      [],
      ["Name", "Email", "Project", "Site location", "Monthly salary", "Daily salary", "Total earnings", "Present days", "0.5 days leave", "Absent days"],
      ...adminSheets.map(({ admin, stats }) => [
        admin.name,
        admin.email,
        admin.assignedTeam?.name || "No site assigned",
        admin.assignedTeam?.siteLocation || "",
        Number(admin.monthlySalary || 0),
        Number(admin.dailySalary || 0),
        stats.totalEarnings,
        stats.presentDays,
        stats.halfDays,
        stats.absentDays
      ])
    ];

    downloadExcelWorkbook(`all-admin-details-${currentMonthKey}.xls`, [
      { name: "All Admins", rows: summaryRows },
      ...adminSheets.map(({ admin, rows }) => ({ name: admin.name, rows }))
    ]);
  }

  return (
    <section className="admin-data-page">
      <div className="admin-data-summary-grid">
        <article className="admin-data-summary-card">
          <span className="stat-icon">
            <Users size={26} />
          </span>
          <div>
            <span>Total admins</span>
            <strong>{admins.length}</strong>
          </div>
        </article>
        <article className="admin-data-summary-card">
          <span className="stat-icon">
            <IndianRupee size={26} />
          </span>
          <div>
            <span>All admin monthly salary</span>
            <strong>{money(adminMonthlySalaryTotal)}</strong>
          </div>
        </article>
      </div>
      <section className="panel selected-admin-summary-panel">
        <div className="selected-admin-summary-header">
          <div>
            <span>Selected admin</span>
            <h2>{selectedAdmin?.name || "No admin selected"}</h2>
            <p>{selectedAdmin?.assignedTeam?.name || "No site assigned"}</p>
          </div>
          <div className="selected-admin-actions">
            <button type="button" onClick={downloadSelectedAdminData} disabled={!selectedAdmin}>
              <Download size={16} />
              Download
            </button>
            <button type="button" onClick={downloadAllAdminExcel} disabled={!admins.length}>
              <Download size={16} />
              Download all admins
            </button>
          </div>
        </div>
        <div className="selected-admin-metrics">
          <div>
            <span>Total monthly earnings</span>
            <strong>{money(selectedAdminStats.totalEarnings)}</strong>
          </div>
          <div>
            <span>Total day present</span>
            <strong>{selectedAdminStats.presentDays}</strong>
          </div>
          <div>
            <span>Total 0.5 days leave</span>
            <strong>{selectedAdminStats.halfDays}</strong>
          </div>
          <div>
            <span>Total day absent</span>
            <strong>{selectedAdminStats.absentDays}</strong>
          </div>
          <div>
            <span>Monthly salary</span>
            <strong>{money(selectedAdmin?.monthlySalary || 0)}</strong>
          </div>
        </div>
      </section>
      <div className="admin-data-page-header">
        <div>
          <div className="admin-data-page-title">
            <span className="panel-heading-icon">
              <Users size={18} />
            </span>
            <h2>Admin Data Control</h2>
          </div>
          <p className="muted">Move a site to another admin and the team stays with the new owner automatically.</p>
        </div>
        <button className="ghost-button admin-data-back-button" type="button" onClick={onBack}>
          <ChevronLeft size={18} />
          Back to dashboard
        </button>
      </div>
      <AdminAttendanceControl
        admins={admins}
        entries={adminAttendanceEntries}
        refreshEntries={refreshAdminAttendanceEntries}
        setMessage={setMessage}
      />
      <AdminDataControl users={users} teams={teams} reload={reload} setMessage={setMessage} showHeading={false} />
    </section>
  );
}

function AdminAttendanceControl({ admins, entries, refreshEntries, setMessage }) {
  const todayKey = dateKey(new Date());
  const [form, setForm] = useState({
    from: todayKey,
    to: todayKey,
    leaveType: "Present",
    remark: ""
  });
  const [selectedAdminIds, setSelectedAdminIds] = useState([]);
  const [editingEntry, setEditingEntry] = useState(null);

  function toggleAdmin(adminId) {
    setSelectedAdminIds((current) =>
      current.includes(adminId)
        ? current.filter((item) => item !== adminId)
        : [...current, adminId]
    );
  }

  async function submitAttendance() {
    if (!selectedAdminIds.length) {
      setMessage("Select at least one admin");
      return;
    }

    await apiRequest("/admin-attendance/bulk", {
      method: "POST",
      body: JSON.stringify({
        adminIds: selectedAdminIds,
        from: form.from,
        to: form.to,
        leaveType: form.leaveType,
        remark: form.remark
      })
    });

    setMessage("Admin attendance updated");
    setEditingEntry(null);
    await refreshEntries();
  }

  async function updateAttendance() {
    if (!editingEntry) return;

    await apiRequest(`/admin-attendance/${editingEntry.admin._id}/${editingEntry.date}`, {
      method: "PATCH",
      body: JSON.stringify({
        leaveType: form.leaveType,
        remark: form.remark
      })
    });

    setMessage("Admin attendance updated");
    setEditingEntry(null);
    await refreshEntries();
  }

  async function deleteAttendance(entry) {
    if (!window.confirm("Delete this attendance entry?")) return;

    await apiRequest(`/admin-attendance/${entry.admin._id}/${entry.date}`, { method: "DELETE" });
    setMessage("Admin attendance deleted");
    if (editingEntry && editingEntry._id === entry._id) {
      setEditingEntry(null);
    }
    await refreshEntries();
  }

  function editEntry(entry) {
    setEditingEntry(entry);
    setForm({
      from: entry.date,
      to: entry.date,
      leaveType: entry.leaveType,
      remark: entry.remark || ""
    });
    setSelectedAdminIds([entry.admin._id]);
  }

  return (
    <section className="panel admin-attendance-control-panel">
      <PanelHeading icon={CalendarDays} title="Admin Attendance Control" />
      <div className="admin-attendance-control-grid">
        <label>
          From
          <input type="date" value={form.from} onChange={(event) => setForm({ ...form, from: event.target.value })} />
        </label>
        <label>
          To
          <input type="date" value={form.to} onChange={(event) => setForm({ ...form, to: event.target.value })} />
        </label>
        <label>
          Leave type
          <select value={form.leaveType} onChange={(event) => setForm({ ...form, leaveType: event.target.value })}>
            <option value="Present">Present</option>
            <option value="Absent">Absent</option>
            <option value="0.5 days leave">0.5 days leave</option>
          </select>
        </label>
        <label>
          Remark
          <input value={form.remark} onChange={(event) => setForm({ ...form, remark: event.target.value })} placeholder="Optional remark" />
        </label>
      </div>

      <details className="admin-select-dropdown">
        <summary>Select admins</summary>
        <div className="admin-select-list">
          {admins.map((admin) => (
            <label key={admin._id} className="admin-select-item">
              <input
                type="checkbox"
                checked={selectedAdminIds.includes(admin._id)}
                onChange={() => toggleAdmin(admin._id)}
              />
              <span>{admin.name}</span>
              <small>{admin.assignedTeam?.name || "No site assigned"}</small>
            </label>
          ))}
        </div>
      </details>

      <div className="action-row compact admin-attendance-actions">
        <button type="button" onClick={submitAttendance}>Submit</button>
        <button type="button" onClick={updateAttendance} disabled={!editingEntry}>Update</button>
        <button type="button" onClick={() => setEditingEntry(null)}>Edit</button>
      </div>

      <div className="mini-table-head admin-attendance-head">
        <span>Admin</span>
        <span>Date</span>
        <span>Status</span>
        <span>Remark</span>
        <span>Actions</span>
      </div>
      <div className="admin-attendance-list">
        {entries.map((entry) => (
          <div className="admin-attendance-row" key={entry._id}>
            <strong>{entry.admin?.name || "-"}</strong>
            <span>{shortDateLabel(entry.date)}</span>
            <span className={`status ${adminAttendanceClass(entry.leaveType)}`}>{entry.leaveType}</span>
            <span>{entry.remark || "No remarks"}</span>
            <div className="action-row compact">
              <button type="button" onClick={() => editEntry(entry)}>Edit</button>
              <button type="button" onClick={() => deleteAttendance(entry)}>Delete</button>
            </div>
          </div>
        ))}
        {!entries.length && <p className="muted">No admin attendance records for this month.</p>}
      </div>
    </section>
  );
}

function AdminDataControl({ users, teams = [], reload, setMessage, showHeading = true }) {
  const admins = useMemo(() => users.filter((item) => item.role !== "super_admin"), [users]);
  const [transferForms, setTransferForms] = useState({});
  const [savingAdminId, setSavingAdminId] = useState("");
  const [memberTeamMoveForm, setMemberTeamMoveForm] = useState({
    sourceTeamId: "",
    trade: "",
    targetTeamId: ""
  });
  const [movingMemberTeam, setMovingMemberTeam] = useState(false);
  const sourceMoveTeam = teams.find((team) => team._id === memberTeamMoveForm.sourceTeamId);
  const sourceMemberTeamNames = useMemo(() => {
    if (!sourceMoveTeam) return [];
    return [...new Set(sourceMoveTeam.members.map((member) => member.trade).filter(Boolean))].sort();
  }, [sourceMoveTeam]);

  useEffect(() => {
    setTransferForms(
      Object.fromEntries(
        admins.map((admin) => [admin._id, admin.assignedTeam?._id || admin.assignedTeam || ""])
      )
    );
  }, [admins]);

  async function moveSite(adminId) {
    const assignedTeam = transferForms[adminId] || "";

    setSavingAdminId(adminId);
    try {
      await apiRequest(`/users/${adminId}`, {
        method: "PATCH",
        body: JSON.stringify({ assignedTeam: assignedTeam || null })
      });
      setMessage("Site moved successfully");
      await reload();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setSavingAdminId("");
    }
  }

  async function moveMemberTeam() {
    const { sourceTeamId, trade, targetTeamId } = memberTeamMoveForm;
    if (!sourceTeamId || !trade || !targetTeamId) {
      setMessage("Select from site, team name, and target site");
      return;
    }

    setMovingMemberTeam(true);
    try {
      const result = await apiRequest("/teams/member-team/move", {
        method: "PATCH",
        body: JSON.stringify({ sourceTeamId, trade, targetTeamId })
      });
      setMessage(`${result.movedMembers || 0} member${result.movedMembers === 1 ? "" : "s"} moved successfully`);
      setMemberTeamMoveForm({ sourceTeamId: "", trade: "", targetTeamId: "" });
      await reload();
    } catch (error) {
      setMessage(error.message);
    } finally {
      setMovingMemberTeam(false);
    }
  }

  return (
    <section className="panel admin-data-panel admin-data-table-shell">
      {showHeading && <PanelHeading icon={Users} title="Admin Data Control" />}
      <div className="member-team-transfer-card">
        <div>
          <strong>Move Team Members</strong>
          <span>Move one selected team name, like Painting Team, from one site to another.</span>
        </div>
        <div className="member-team-transfer-grid">
          <select
            value={memberTeamMoveForm.sourceTeamId}
            onChange={(event) => setMemberTeamMoveForm({
              sourceTeamId: event.target.value,
              trade: "",
              targetTeamId: memberTeamMoveForm.targetTeamId
            })}
          >
            <option value="">From site</option>
            {teams.map((team) => (
              <option key={team._id} value={team._id}>
                {team.name} - {team.siteLocation}
              </option>
            ))}
          </select>
          <select
            value={memberTeamMoveForm.trade}
            onChange={(event) => setMemberTeamMoveForm((current) => ({
              ...current,
              trade: event.target.value
            }))}
            disabled={!memberTeamMoveForm.sourceTeamId}
          >
            <option value="">{memberTeamMoveForm.sourceTeamId ? "Select team name" : "Select from site first"}</option>
            {sourceMemberTeamNames.map((teamName) => (
              <option key={teamName} value={teamName}>{teamName}</option>
            ))}
          </select>
          <select
            value={memberTeamMoveForm.targetTeamId}
            onChange={(event) => setMemberTeamMoveForm((current) => ({
              ...current,
              targetTeamId: event.target.value
            }))}
          >
            <option value="">To site</option>
            {teams
              .filter((team) => team._id !== memberTeamMoveForm.sourceTeamId)
              .map((team) => (
                <option key={team._id} value={team._id}>
                  {team.name} - {team.siteLocation}
                </option>
              ))}
          </select>
          <button
            type="button"
            onClick={moveMemberTeam}
            disabled={movingMemberTeam || !memberTeamMoveForm.sourceTeamId || !memberTeamMoveForm.trade || !memberTeamMoveForm.targetTeamId}
          >
            {movingMemberTeam ? "Moving..." : "Move Team"}
          </button>
        </div>
      </div>
      <div className="admin-data-grid admin-data-grid--move">
        <span>Name</span>
        <span>Email</span>
        <span>Project</span>
        <span>Monthly Salary</span>
        <span>Daily Salary</span>
        <span>Status</span>
        <span>Move Site</span>
      </div>
      <div className="admin-data-list">
        {admins.map((admin) => {
          const currentTeamId = admin.assignedTeam?._id || admin.assignedTeam || "";
          const selectedTeamId = transferForms[admin._id] || "";

          return (
            <div className="admin-data-row" key={admin._id}>
              <strong>{admin.name}</strong>
              <span>{admin.email}</span>
              <span>{admin.assignedTeam?.name || "No project assigned"}</span>
              <span>{money(admin.monthlySalary || 0)}</span>
              <span>{money(admin.dailySalary || 0)}</span>
              <span className={`status ${admin.status}`}>{admin.status}</span>
              <div className="admin-data-transfer">
                <select
                  value={selectedTeamId}
                  onChange={(event) => setTransferForms((current) => ({
                    ...current,
                    [admin._id]: event.target.value
                  }))}
                >
                  <option value="">No project assigned</option>
                  {teams.map((team) => (
                    <option key={team._id} value={team._id}>
                      {team.name} - {team.siteLocation}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => moveSite(admin._id)}
                  disabled={savingAdminId === admin._id || selectedTeamId === currentTeamId}
                >
                  {savingAdminId === admin._id ? "Moving..." : "Move"}
                </button>
              </div>
            </div>
          );
        })}
        {!admins.length && (
          <EmptyState
            icon={Users}
            title="No admin details available."
            detail="Create an admin login to see data here."
          />
        )}
      </div>
    </section>
  );
}

function SuperAdminPanel({ users, teams, approvals, reload, setMessage }) {
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    assignedTeam: "",
    monthlySalary: ""
  });
  const [newProject, setNewProject] = useState({ name: "", address: "" });
  const [passwordForms, setPasswordForms] = useState({});
  const [editingAdminId, setEditingAdminId] = useState(null);
  const [adminEditForm, setAdminEditForm] = useState({ name: "", email: "", assignedTeam: "", monthlySalary: "" });
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [teamEditForm, setTeamEditForm] = useState({ name: "", siteLocation: "" });
  const [teamTransferForms, setTeamTransferForms] = useState({});
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [hiddenApprovalIds, setHiddenApprovalIds] = useState([]);
  const newAdminDailySalary = useMemo(() => calculateDailySalary(newUser.monthlySalary), [newUser.monthlySalary]);
  const editAdminDailySalary = useMemo(() => calculateDailySalary(adminEditForm.monthlySalary), [adminEditForm.monthlySalary]);

  async function review(id, decision) {
    setHiddenApprovalIds((ids) => [...ids, id]);

    try {
      await apiRequest(`/approvals/${id}/review`, {
        method: "POST",
        body: JSON.stringify({ decision })
      });
      setMessage(`Request ${decision}`);
      await reload();
    } catch (error) {
      setHiddenApprovalIds((ids) => ids.filter((approvalId) => approvalId !== id));
      throw error;
    }
  }

  async function createLogin(event) {
    event.preventDefault();
    const payload = {
      name: newUser.name,
      email: newUser.email,
      password: newUser.password,
      role: "admin",
      permissions: [],
      assignedTeam: newUser.assignedTeam,
      monthlySalary: Number(newUser.monthlySalary || 0)
    };

    await apiRequest("/users", {
      method: "POST",
      body: JSON.stringify(payload)
    });

    setNewUser({ name: "", email: "", password: "", assignedTeam: "", monthlySalary: "" });
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

  async function createProject(event) {
    event.preventDefault();

    const createdProject = await apiRequest("/teams", {
      method: "POST",
      body: JSON.stringify({
        name: newProject.name.trim(),
        siteLocation: newProject.address.trim()
      })
    });

    setNewProject({ name: "", address: "" });
    setSelectedTeamId(createdProject._id);
    setMessage("Project created successfully");
    reload();
  }

  function startEditAdmin(item) {
    setEditingAdminId(item._id);
    setAdminEditForm({
      name: item.name,
      email: item.email,
      assignedTeam: item.assignedTeam?._id || item.assignedTeam || "",
      monthlySalary: item.monthlySalary || ""
    });
  }

  async function updateAdmin(userId) {
    await apiRequest(`/users/${userId}`, {
      method: "PATCH",
      body: JSON.stringify({
        ...adminEditForm,
        monthlySalary: Number(adminEditForm.monthlySalary || 0)
      })
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
    setMessage("Project updated successfully");
    reload();
  }

  async function moveTeamSite(teamId) {
    const targetTeamId = teamTransferForms[teamId];
    if (!targetTeamId) return;

    const targetTeam = teams.find((team) => team._id === targetTeamId);
    if (!targetTeam) return;

    await apiRequest(`/teams/${teamId}`, {
      method: "PATCH",
      body: JSON.stringify({ siteLocation: targetTeam.siteLocation })
    });

    setMessage("Team moved to the new site successfully");
    reload();
  }

  async function deleteTeam(teamId) {
    if (!window.confirm("Delete this project and its members, attendance, OT, and approvals?")) return;

    await apiRequest(`/teams/${teamId}`, { method: "DELETE" });
    setSelectedTeamId("");
    setEditingTeamId(null);
    setMessage("Project deleted successfully");
    reload();
  }

  function requestDetails(request) {
    const detailSource = request.type === "delete_member" ? request.currentMember : request.payload;
    const rows = [
      ["Name", detailSource?.name],
      ["Team", detailSource?.trade],
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
        {rows.map(([label, value], index) => (
          <div key={`${label}-${index}`}>
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>
    );
  }

  const selectedTeam = teams.find((team) => team._id === selectedTeamId);
  const visibleApprovals = approvals.filter((request) => !hiddenApprovalIds.includes(request._id));

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
              <option value="">Assign project</option>
              {teams.map((team) => (
                <option key={team._id} value={team._id}>{team.name} - {team.siteLocation}</option>
              ))}
            </select>
          </IconField>
          <div className="admin-salary-row">
            <IconField icon={IndianRupee}>
              <input
                placeholder="Monthly salary"
                type="number"
                min="0"
                value={newUser.monthlySalary}
                onChange={(event) => setNewUser({ ...newUser, monthlySalary: event.target.value })}
              />
            </IconField>
            <IconField icon={IndianRupee}>
              <input
                placeholder="Daily salary"
                value={newAdminDailySalary ? newAdminDailySalary.toFixed(2).replace(/\.00$/, "") : "0"}
                readOnly
              />
            </IconField>
          </div>
          <button className="primary-button" type="submit">
            <Plus size={18} />
            Create Admin
          </button>
        </form>
      </article>

      <article className="panel user-form-panel">
        <PanelHeading icon={Building2} title="Our Projects" />
        <form className="user-create-form" onSubmit={createProject}>
          <IconField icon={Building2}>
            <input
              placeholder="Project name"
              value={newProject.name}
              onChange={(event) => setNewProject({ ...newProject, name: event.target.value })}
              required
            />
          </IconField>
          <IconField icon={MapPin}>
            <input
              placeholder="Address"
              value={newProject.address}
              onChange={(event) => setNewProject({ ...newProject, address: event.target.value })}
              required
            />
          </IconField>
          <button className="primary-button" type="submit">
            <Plus size={18} />
            Create Project
          </button>
        </form>

        <div className="created-team-list">
          <div className="section-subheading">
            <h3>Projects</h3>
            <button type="button" onClick={reload} aria-label="Refresh projects">
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
              <option value="">Select project</option>
              {teams.map((team) => (
                <option key={team._id} value={team._id}>{team.name} - {team.siteLocation}</option>
              ))}
            </select>
          </IconField>

          {selectedTeam && (
            <div className="selected-team-card">
              {editingTeamId === selectedTeam._id ? (
                <>
                  <input aria-label="Project name" value={teamEditForm.name} onChange={(event) => setTeamEditForm({ ...teamEditForm, name: event.target.value })} />
                  <input aria-label="Address" value={teamEditForm.siteLocation} onChange={(event) => setTeamEditForm({ ...teamEditForm, siteLocation: event.target.value })} />
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
                  <div className="team-transfer-row">
                    <select
                      value={teamTransferForms[selectedTeam._id] || ""}
                      onChange={(event) => setTeamTransferForms((current) => ({
                        ...current,
                        [selectedTeam._id]: event.target.value
                      }))}
                    >
                      <option value="">Move to site</option>
                      {teams.map((team) => (
                        <option key={team._id} value={team._id}>
                          {team.name} - {team.siteLocation}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => moveTeamSite(selectedTeam._id)}
                      disabled={!teamTransferForms[selectedTeam._id]}
                    >
                      Move
                    </button>
                  </div>
                  <div className="action-row compact">
                    <button type="button" onClick={() => startEditTeam(selectedTeam)}>Edit</button>
                    <button type="button" onClick={() => deleteTeam(selectedTeam._id)}>Delete</button>
                  </div>
                </>
              )}
            </div>
          )}

          {!teams.length && <p className="muted">No projects created yet.</p>}
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
          <span>Project</span>
          <span>Created On</span>
        </div>
        <div className="user-password-list">
          {users.filter((item) => item.role !== "super_admin").map((item) => (
            <div className={`password-row ${editingAdminId === item._id ? "admin-edit-row" : ""}`} key={item._id}>
              {editingAdminId === item._id ? (
                <>
                  <input value={adminEditForm.name} onChange={(event) => setAdminEditForm({ ...adminEditForm, name: event.target.value })} />
                  <input type="email" value={adminEditForm.email} onChange={(event) => setAdminEditForm({ ...adminEditForm, email: event.target.value })} />
                  <select value={adminEditForm.assignedTeam} onChange={(event) => setAdminEditForm({ ...adminEditForm, assignedTeam: event.target.value })}>
                    <option value="">Assign project</option>
                    {teams.map((team) => (
                      <option key={team._id} value={team._id}>{team.name} - {team.siteLocation}</option>
                    ))}
                  </select>
                  <input
                    aria-label="Monthly salary"
                    placeholder="Monthly salary"
                    type="number"
                    min="0"
                    value={adminEditForm.monthlySalary}
                    onChange={(event) => setAdminEditForm({ ...adminEditForm, monthlySalary: event.target.value })}
                  />
                  <input
                    aria-label="Daily salary"
                    placeholder="Daily salary"
                    value={editAdminDailySalary ? editAdminDailySalary.toFixed(2).replace(/\.00$/, "") : "0"}
                    readOnly
                  />
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
                    <span>Monthly: {money(item.monthlySalary || 0)} - Daily: {money(item.dailySalary || 0)}</span>
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
          {visibleApprovals.map((request) => (
            <div className="request-card" key={request._id}>
              <div className="request-summary">
                <div>
                  <span>Request</span>
                  <strong>{request.type.replace("_", " ")}</strong>
                </div>
                <div>
                  <span>Requested By</span>
                  <strong>{request.requestedBy?.name || "-"}</strong>
                </div>
                <div>
                  <span>Team</span>
                  <strong>{request.team?.name || "-"}</strong>
                </div>
                <div>
                  <span>Date</span>
                  <strong>{new Date(request.createdAt).toLocaleString()}</strong>
                </div>
                <div>
                  <span>Status</span>
                  <strong className={`status ${request.status}`}>{request.status}</strong>
                </div>
              </div>
              {requestDetails(request)}
              {request.status === "pending" && (
                <div className="action-row">
                  <button className="approve-button" onClick={() => review(request._id, "approved")}><CheckCircle2 /> Approve</button>
                  <button className="reject-button" onClick={() => review(request._id, "rejected")}><XCircle /> Reject</button>
                </div>
              )}
            </div>
          ))}
          {!visibleApprovals.length && (
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
  const [selectedReportTeamName, setSelectedReportTeamName] = useState("");
  const [selectedReportMemberId, setSelectedReportMemberId] = useState("");
  const [reportError, setReportError] = useState("");
  const reportMembers = selectedReportTeamName
    ? teams.flatMap((team) => team.members.filter((member) => member.trade === selectedReportTeamName || member.trade?.startsWith(`${selectedReportTeamName} -`)))
    : [];
  const selectedReportMember = reportMembers.find((member) => member._id === selectedReportMemberId);

  function overtimeHoursForDates(member, dates) {
    return (member.overtimeEntries || [])
      .filter((entry) => dates.includes(normalizeDateKey(entry.date)))
      .reduce((total, entry) => total + Number(entry.hours || 0), 0);
  }

  function overtimeRemarksForDates(member, dates) {
    return (member.overtimeEntries || [])
      .filter((entry) => dates.includes(normalizeDateKey(entry.date)) && entry.note)
      .map((entry) => `${normalizeDateKey(entry.date)}: ${entry.note}`)
      .join("; ");
  }

  function attendanceBreakdown(member, dates) {
    return dates.map((date) => {
      const status = member.attendanceEntries?.find((entry) => normalizeDateKey(entry.date) === date)?.status || "absent";
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
        "Team",
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

    let exportedRows = 0;

    teams.forEach((team) => {
      const members = team.members.filter((member) => {
        const matchesTeam = selectedReportTeamName
          ? member.trade === selectedReportTeamName || member.trade?.startsWith(`${selectedReportTeamName} -`)
          : true;
        const matchesMember = selectedReportMemberId ? member._id === selectedReportMemberId : true;

        return matchesTeam && matchesMember;
      });

      members.forEach((member) => {
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
        exportedRows += 1;
      });
    });

    if (!exportedRows) {
      setReportError("No members found for the selected report filters");
      return;
    }

    const teamLabel = selectedReportTeamName ? selectedReportTeamName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "") : "all-teams";
    const memberLabel = selectedReportMember ? `-${selectedReportMember.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "")}` : "";
    downloadCsv(`construction-${teamLabel}${memberLabel}-${dateRange.from}-to-${dateRange.to}-report-${dateKey(new Date())}.csv`, rows);
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
          Team
          <IconField icon={Building2}>
            <select
              value={selectedReportTeamName}
              onChange={(event) => {
                setSelectedReportTeamName(event.target.value);
                setSelectedReportMemberId("");
              }}
            >
              <option value="">All teams</option>
              {MEMBER_TEAM_OPTIONS.map((teamName) => (
                <option value={teamName} key={teamName}>
                  {teamName}
                </option>
              ))}
            </select>
          </IconField>
        </label>
        <label>
          Member
          <IconField icon={Users}>
            <select
              value={selectedReportMemberId}
              onChange={(event) => setSelectedReportMemberId(event.target.value)}
              disabled={!selectedReportTeamName}
            >
              <option value="">{selectedReportTeamName ? "All members" : "Select team first"}</option>
              {reportMembers.map((member) => (
                <option value={member._id} key={member._id}>
                  {member.name}
                </option>
              ))}
            </select>
          </IconField>
        </label>
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
  const [memberForm, setMemberForm] = useState({ name: "", trade: "", teamDetail: "", phone: "", site: "" });
  const [selectedMemberTeamId, setSelectedMemberTeamId] = useState("");
  const [salaryForms, setSalaryForms] = useState({});
  const [dailyOvertimeForms, setDailyOvertimeForms] = useState({});
  const [adminAttendance, setAdminAttendance] = useState({ monthlySalary: user.monthlySalary || 0, totalEarnings: 0, entries: [] });
  const [adminAttendanceForms, setAdminAttendanceForms] = useState({});
  const currentWeek = useMemo(() => weekDates(), []);
  const todayKey = dateKey(new Date());
  const currentMonthKey = todayKey.slice(0, 7);
  const assignedTeamId = user.assignedTeam?._id || user.assignedTeam;
  const assignedTeam = user.role === "admin"
    ? teams.find((team) => team._id === assignedTeamId) || teams[0]
    : teams[0];
  const canAssignedAdminRequest = Boolean(user.role === "admin" && assignedTeam);
  const selectedMemberTeam = teams.find((team) => team._id === selectedMemberTeamId) || assignedTeam;
  const selectedMemberSiteLocation = selectedMemberTeam?.siteLocation || "";

  useEffect(() => {
    if (canAssignedAdminRequest && !selectedMemberTeamId && assignedTeam?._id) {
      setSelectedMemberTeamId(assignedTeam._id);
    }
  }, [assignedTeam?._id, canAssignedAdminRequest, selectedMemberTeamId]);

  useEffect(() => {
    if (user.role !== "admin") return;

    apiRequest(`/admin-attendance/me?month=${currentMonthKey}`)
      .then((data) => {
        setAdminAttendance(data);
        setAdminAttendanceForms(
          Object.fromEntries((data.entries || []).map((entry) => [
            normalizeDateKey(entry.date),
            { leaveType: entry.leaveType, remark: entry.remark || "" }
          ]))
        );
      })
      .catch((error) => setMessage(error.message));
  }, [currentMonthKey, setMessage, todayKey, user.role]);

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
    return member.attendanceEntries?.find((entry) => normalizeDateKey(entry.date) === date)?.status || "absent";
  }

  function attendanceEntryForDate(member, date) {
    return member.attendanceEntries?.find((entry) => normalizeDateKey(entry.date) === date);
  }

  function attendanceSalaryForDate(member, date) {
    const entry = attendanceEntryForDate(member, date);
    return attendanceEntrySalary(member, entry || {});
  }

  function overtimeForDate(member, date) {
    return (member.overtimeEntries || [])
      .filter((entry) => normalizeDateKey(entry.date) === date)
      .reduce((total, entry) => total + Number(entry.hours || 0), 0);
  }

  function overtimeAmountForDate(member, date) {
    return (member.overtimeEntries || [])
      .filter((entry) => normalizeDateKey(entry.date) === date)
      .reduce((total, entry) => total + Number(entry.hours || 0) * Number(entry.hourlyRate || 0), 0);
  }

  function overtimeRemarksForDate(member, date) {
    return (member.overtimeEntries || [])
      .filter((entry) => normalizeDateKey(entry.date) === date && entry.note)
      .map((entry) => entry.note)
      .join(", ");
  }

  function isSunday(date) {
    return new Date(`${date}T00:00:00`).getDay() === 0;
  }

  function adminAttendanceEntryForDate(date) {
    return adminAttendance.entries?.find((entry) => normalizeDateKey(entry.date) === date);
  }

  function adminAttendanceFormForDate(date) {
    if (isSunday(date)) {
      return { leaveType: "Present", remark: adminAttendanceEntryForDate(date)?.remark || "" };
    }

    const entry = adminAttendanceEntryForDate(date);
    return adminAttendanceForms[date] || {
      leaveType: entry?.leaveType || "Present",
      remark: entry?.remark || ""
    };
  }

  async function submitMember(event) {
    event.preventDefault();
    if (!canAssignedAdminRequest || !selectedMemberTeam) return;

    const selectedTeam = memberForm.trade.trim();
    const teamDetail = memberForm.teamDetail.trim();

    if (MEMBER_TEAM_OPTIONS_REQUIRING_DETAIL.has(selectedTeam) && !teamDetail) {
      setMessage("Enter the required team detail");
      return;
    }

    const trade = MEMBER_TEAM_OPTIONS_REQUIRING_DETAIL.has(selectedTeam)
      ? `${selectedTeam} - ${teamDetail}`
      : selectedTeam;
    const { teamDetail: _teamDetail, ...memberPayload } = memberForm;

    await apiRequest(`/teams/${selectedMemberTeam._id}/members/request`, {
      method: "POST",
      body: JSON.stringify({
        type: "add_member",
        payload: { ...memberPayload, trade, site: selectedMemberSiteLocation }
      })
    });

    setMemberForm({ name: "", trade: "", teamDetail: "", phone: "", site: "" });
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

  async function saveAdminAttendance(date, leaveType) {
    if (isSunday(date)) return;

    await apiRequest("/admin-attendance/me", {
      method: "PUT",
      body: JSON.stringify({ date, leaveType, remark: "" })
    });

    const data = await apiRequest(`/admin-attendance/me?month=${currentMonthKey}`);
    setAdminAttendance(data);
    setMessage("Admin daily attendance saved");
  }

  const visibleTeams = user.role === "super_admin"
    ? teams.filter((team) => team.members.length > 0)
    : teams;

  return (
    <section className="team-section">
      {canAssignedAdminRequest && (
        <div className="team-workspace">
          <aside className="team-workspace-left">
            <form className="panel member-form" onSubmit={submitMember}>
              <h2>Add Team Member</h2>
              <div className="selected-team-card">
                <div>
                  <strong>{selectedMemberTeam?.name}</strong>
                  <span>{selectedMemberSiteLocation}</span>
                </div>
              </div>
              <input placeholder="Name" value={memberForm.name} onChange={(e) => setMemberForm({ ...memberForm, name: e.target.value })} required />
              <select
                value={memberForm.trade}
                onChange={(e) => setMemberForm({
                  ...memberForm,
                  trade: e.target.value,
                  teamDetail: MEMBER_TEAM_OPTIONS_REQUIRING_DETAIL.has(e.target.value) ? memberForm.teamDetail : ""
                })}
                required
              >
                <option value="">Select team</option>
                {MEMBER_TEAM_OPTIONS.map((teamName) => (
                  <option key={teamName} value={teamName}>{teamName}</option>
                ))}
              </select>
              {MEMBER_TEAM_OPTIONS_REQUIRING_DETAIL.has(memberForm.trade) && (
                <input
                  placeholder={memberForm.trade === "Other" ? "Other team name" : "Mason team detail"}
                  value={memberForm.teamDetail}
                  onChange={(e) => setMemberForm({ ...memberForm, teamDetail: e.target.value })}
                  required
                />
              )}
              <input placeholder="Phone" value={memberForm.phone} onChange={(e) => setMemberForm({ ...memberForm, phone: e.target.value })} />
              <input placeholder="Project address" value={selectedMemberSiteLocation} readOnly />
              <button className="primary-button" type="submit"><Plus size={18} /> Send for approval</button>
            </form>
          </aside>

          <aside className="panel attendance-setup-panel">
            <h2>Admin Daily Attendance</h2>
            <div className="attendance-setup-grid">
              <div>
                <span>Monthly salary</span>
                <strong>{money(adminAttendance.monthlySalary || user.monthlySalary || 0)}</strong>
              </div>
              <div>
                <span>Total earnings this month</span>
                <strong>{money(adminAttendance.totalEarnings || 0)}</strong>
              </div>
            </div>
            <div className="admin-weekly-attendance">
              <strong>Weekly Attendance</strong>
              <div className="admin-week-grid">
                {currentWeek.map((date) => {
                  const entry = adminAttendanceEntryForDate(date);
                  const form = adminAttendanceFormForDate(date);
                  const sunday = isSunday(date);
                  const isToday = date === todayKey;

                  return (
                    <div className="admin-week-day" key={date}>
                      <span>{shortDateLabel(date)}</span>
                      {sunday ? (
                        <>
                          <strong className="admin-leave-pill today-pill">Present</strong>
                          <small>Sunday is always present</small>
                        </>
                      ) : isToday ? (
                        <>
                          <select
                            className={`admin-attendance-select ${adminAttendanceClass(form.leaveType)}`}
                            value={form.leaveType}
                            onChange={(event) => {
                              const nextLeaveType = event.target.value;
                              const nextForm = { ...form, leaveType: nextLeaveType };
                              setAdminAttendanceForms((prev) => ({
                                ...prev,
                                [date]: nextForm
                              }));
                              saveAdminAttendance(date, nextLeaveType);
                            }}
                          >
                            {ADMIN_ATTENDANCE_OPTIONS.map((option) => (
                              <option key={option} value={option}>{option}</option>
                            ))}
                          </select>
                          <small>Changes save automatically</small>
                        </>
                      ) : (
                        <>
                          <strong className={entry ? "admin-leave-pill" : "admin-leave-pill muted-pill"}>
                            {entry?.leaveType || "Not marked"}
                          </strong>
                          <small>Remarks: {entry?.remark || "No remarks"}</small>
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </aside>
        </div>
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
            <span>{team.members.length} member{team.members.length === 1 ? "" : "s"}</span>
          </div>
          <div className="member-table">
            {team.members.map((member) => (
              <div className="member-row salary-row" key={member._id}>
                <div className="member-profile">
                  <span className="member-avatar">{member.name?.charAt(0)?.toUpperCase() || "M"}</span>
                  <strong>{member.name}</strong>
                  <span className="member-team-label">Team name</span>
                  <strong className="member-team-name">{member.trade}</strong>
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
                          <small>Daily salary: {money(attendanceSalaryForDate(member, date))}</small>
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

registerServiceWorker();

createRoot(document.getElementById("root")).render(<App />);
