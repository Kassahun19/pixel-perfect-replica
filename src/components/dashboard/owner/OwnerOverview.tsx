import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowRight,
  Award,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  CircleDollarSign,
  ClipboardCheck,
  GraduationCap,
  Mail,
  ShieldCheck,
  Users,
  Wallet,
} from "lucide-react";
import { displayName, useAuth, type AppRole } from "@/lib/auth";
import { formatETB } from "@/lib/access";
import { computeAttendanceStats, computeGradeOutcome, summarizeFees } from "@/lib/owner/logic";
import type { OwnerSubmenuId } from "@/lib/owner/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Panel, StatCard } from "@/components/dashboard/ui";
import type { OwnerDataHandle } from "./useOwnerData";

const CHART_COLORS = ["#0f5132", "#d97706", "#0284c7", "#16a34a", "#dc2626"];

export function OwnerOverview({
  data,
  role,
  onNavigate,
}: {
  data: OwnerDataHandle;
  role: AppRole;
  onNavigate: (id: OwnerSubmenuId) => void;
}) {
  const { profile } = useAuth();
  const { db, workspace, maps } = data;

  const stats = useMemo(() => {
    const counts = { owner: 0, admin: 0, instructor: 0, student: 0, parent: 0 };
    for (const r of db.roles) {
      counts[r.role] = (counts[r.role] ?? 0) + 1;
    }

    const approvedRevenue = db.payments
      .filter((p) => p.status === "approved")
      .reduce((sum, p) => sum + Number(p.amount || 0), 0);
    const pendingPayments = db.payments.filter((p) => p.status === "pending");
    const pendingPayAmount = pendingPayments.reduce((s, p) => s + Number(p.amount || 0), 0);

    const feeSummary = summarizeFees(workspace?.feePlans ?? []);
    const totalRevenue = approvedRevenue + feeSummary.collected;
    const totalOutstanding = pendingPayAmount + feeSummary.outstanding;

    const attendanceSummary = computeAttendanceStats(workspace?.attendance ?? []);
    const defaultScale =
      workspace?.gradingScales.find((s) => s.isDefault) ?? workspace?.gradingScales[0];
    const grades = workspace?.grades ?? [];
    const avgGradePercent =
      grades.length && defaultScale
        ? Math.round(
            (grades.reduce(
              (sum, g) => sum + computeGradeOutcome(g.score, g.maxScore, defaultScale).percent,
              0,
            ) /
              grades.length) *
              10,
          ) / 10
        : null;

    const openTickets = db.messages.filter((m) => {
      const meta = workspace?.supportMeta[m.id];
      const status = meta?.workflowStatus ?? (m.status === "resolved" ? "resolved" : "open");
      return status !== "resolved";
    }).length;

    const liveCourses = db.courses.filter((c) => c.status === "published").length;

    return {
      counts,
      totalRevenue,
      totalOutstanding,
      pendingCount: pendingPayments.length,
      attendanceSummary,
      avgGradePercent,
      gradeCount: grades.length,
      openTickets,
      liveCourses,
      totalCourses: db.courses.length,
      enrollmentsCount: db.enrollments.length,
    };
  }, [db, workspace]);

  const monthlySeries = useMemo(() => {
    const byMonth = new Map<
      string,
      { month: string; revenue: number; enrollments: number; pending: number }
    >();
    const ensureMonth = (iso: string) => {
      const d = new Date(iso);
      const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("en-US", { month: "short", year: "2-digit" });
      if (!byMonth.has(key)) {
        byMonth.set(key, { month: label, revenue: 0, enrollments: 0, pending: 0 });
      }
      return byMonth.get(key)!;
    };

    for (const p of db.payments) {
      const entry = ensureMonth(p.created_at);
      if (p.status === "approved") entry.revenue += Number(p.amount || 0);
      if (p.status === "pending") entry.pending += Number(p.amount || 0);
    }
    for (const e of db.enrollments) {
      ensureMonth(e.created_at).enrollments += 1;
    }

    return [...byMonth.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([, v]) => v);
  }, [db.payments, db.enrollments]);

  const roleBreakdown = useMemo(
    () =>
      [
        { name: "Students", value: stats.counts.student },
        { name: "Instructors", value: stats.counts.instructor },
        { name: "Parents", value: stats.counts.parent },
        { name: "Admins", value: stats.counts.admin },
        { name: "Owners", value: stats.counts.owner },
      ].filter((x) => x.value > 0),
    [stats.counts],
  );

  const courseEnrollmentBars = useMemo(
    () =>
      db.courses.slice(0, 6).map((c) => ({
        name: c.title.length > 22 ? `${c.title.slice(0, 20)}…` : c.title,
        enrollments: db.enrollments.filter((e) => e.course_id === c.id).length,
        lessons: (maps.lessonsByCourse.get(c.id) ?? []).length,
      })),
    [db.courses, db.enrollments, maps.lessonsByCourse],
  );

  const firstName = profile ? displayName(profile).split(" ")[0] : "Owner";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Good ${new Date().getHours() < 12 ? "morning" : "afternoon"}, ${firstName}`}
        description="Complete executive overview across users, academics, attendance, grades, finance, and operations."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="gold" className="gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5" />
              {role === "owner" ? "Owner Command" : "Admin Workspace"}
            </Badge>
            <Button size="sm" variant="outline" onClick={() => onNavigate("reports")}>
              Open Reports
            </Button>
            <Button size="sm" variant="emerald" onClick={() => onNavigate("users")}>
              Manage Users
            </Button>
          </div>
        }
      />

      {/* Row 1: Primary KPIs */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Revenue Collected"
          value={<span className="tabular-nums">{formatETB(stats.totalRevenue)}</span>}
          icon={CircleDollarSign}
          tone="emerald"
          hint={`${formatETB(stats.totalOutstanding)} outstanding · ${stats.pendingCount} pending`}
          index={0}
        />
        <StatCard
          label="Students & Parents"
          value={<span className="tabular-nums">{stats.counts.student}</span>}
          icon={GraduationCap}
          tone="gold"
          hint={`${stats.counts.parent} parents · ${stats.counts.instructor} instructors · ${stats.counts.admin} admins`}
          index={1}
        />
        <StatCard
          label="Courses & Enrollments"
          value={<span className="tabular-nums">{stats.enrollmentsCount}</span>}
          icon={BookOpen}
          tone="deep"
          hint={`${stats.liveCourses} published of ${stats.totalCourses} courses`}
          index={2}
        />
        <StatCard
          label="Attendance & Academics"
          value={
            <span className="tabular-nums">
              {stats.attendanceSummary.total > 0
                ? `${stats.attendanceSummary.attendanceRate}%`
                : stats.avgGradePercent !== null
                  ? `${stats.avgGradePercent}%`
                  : "Ready"}
            </span>
          }
          icon={ClipboardCheck}
          tone="plain"
          hint={
            stats.avgGradePercent !== null
              ? `Avg grade ${stats.avgGradePercent}% (${stats.gradeCount} scores)`
              : `${stats.attendanceSummary.total} attendance logs recorded`
          }
          index={3}
        />
      </div>

      {/* Row 2: Role Counts & Academic Quick Summary */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {(
          [
            ["Students", stats.counts.student, Users, "students"],
            ["Instructors", stats.counts.instructor, Users, "instructors"],
            ["Parents", stats.counts.parent, Users, "parents"],
            ["Admins & Owners", stats.counts.admin + stats.counts.owner, ShieldCheck, "users"],
            ["Open Support", stats.openTickets, Mail, "support"],
          ] as const
        ).map(([label, count, Icon, target]) => (
          <button
            key={label}
            type="button"
            onClick={() => onNavigate(target)}
            className="flex items-center justify-between rounded-xl border border-border bg-card p-4 text-left transition-colors hover:border-primary/40 hover:bg-secondary/40"
          >
            <div>
              <p className="text-xs font-medium text-muted-foreground">{label}</p>
              <p className="mt-1 font-display text-2xl font-semibold tabular-nums">{count}</p>
            </div>
            <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-secondary text-primary">
              <Icon className="h-4 w-4" />
            </span>
          </button>
        ))}
      </div>

      {/* Row 3: Charts */}
      <div className="grid gap-6 xl:grid-cols-[1.5fr_1fr]">
        <Panel
          title="Revenue & Enrollment Trends"
          actions={
            <button
              type="button"
              onClick={() => onNavigate("financial-reports")}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Financial reports →
            </button>
          }
        >
          {monthlySeries.length > 0 ? (
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={monthlySeries} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="revFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0f5132" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#0f5132" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Area
                    type="monotone"
                    dataKey="revenue"
                    name="Approved Revenue (ETB)"
                    stroke="#0f5132"
                    fillOpacity={1}
                    fill="url(#revFill)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="pending"
                    name="Pending Payments (ETB)"
                    stroke="#d97706"
                    fillOpacity={0.08}
                    fill="#d97706"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              title="No payment timeline yet"
              text="Revenue trends will chart automatically as payments and fee plans are recorded."
              icon={CircleDollarSign}
            />
          )}
        </Panel>

        <Panel
          title="Community Composition"
          actions={
            <button
              type="button"
              onClick={() => onNavigate("users")}
              className="text-xs font-semibold text-primary hover:underline"
            >
              User directory →
            </button>
          }
        >
          {roleBreakdown.length > 0 ? (
            <div className="grid items-center gap-4 sm:grid-cols-[1fr_140px]">
              <div className="h-56 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={roleBreakdown}
                      dataKey="value"
                      nameKey="name"
                      innerRadius={45}
                      outerRadius={78}
                      paddingAngle={3}
                    >
                      {roleBreakdown.map((entry, idx) => (
                        <Cell key={entry.name} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2 text-xs">
                {roleBreakdown.map((item, idx) => (
                  <div key={item.name} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 font-medium">
                      <span
                        className="h-2.5 w-2.5 rounded-full"
                        style={{ backgroundColor: CHART_COLORS[idx % CHART_COLORS.length] }}
                      />
                      {item.name}
                    </span>
                    <span className="font-semibold tabular-nums">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <EmptyState
              title="No role assignments yet"
              text="Assigned student, parent, instructor, and admin roles will visualize here."
              icon={Users}
            />
          )}
        </Panel>
      </div>

      {/* Row 4: Course Activity Bar Chart + Action Queue + Audit Activity */}
      <div className="grid gap-6 xl:grid-cols-3">
        <Panel
          title="Course Capacity & Lessons"
          actions={
            <button
              type="button"
              onClick={() => onNavigate("courses")}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Courses →
            </button>
          }
        >
          {courseEnrollmentBars.length > 0 ? (
            <div className="h-56 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={courseEnrollmentBars}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  <Bar
                    dataKey="enrollments"
                    name="Enrollments"
                    fill="#0f5132"
                    radius={[4, 4, 0, 0]}
                  />
                  <Bar dataKey="lessons" name="Lessons" fill="#d97706" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <EmptyState
              title="No courses yet"
              text="Create your first course to track metrics."
              icon={BookOpen}
            />
          )}
        </Panel>

        <Panel
          title="Operations Queue & Alerts"
          actions={<span className="text-xs text-muted-foreground">Live priorities</span>}
        >
          <div className="space-y-2.5">
            <button
              type="button"
              onClick={() => onNavigate("fees-payments")}
              className="flex w-full items-center justify-between rounded-xl border border-border p-3 text-left transition-colors hover:bg-secondary/50"
            >
              <div className="flex items-center gap-3">
                <Wallet className="h-4 w-4 text-amber-600" />
                <div>
                  <p className="text-sm font-semibold">Pending Payment Reviews</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {stats.pendingCount} requests · {formatETB(stats.totalOutstanding)} outstanding
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate("support")}
              className="flex w-full items-center justify-between rounded-xl border border-border p-3 text-left transition-colors hover:bg-secondary/50"
            >
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-primary" />
                <div>
                  <p className="text-sm font-semibold">Support & Feedback Tickets</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {stats.openTickets} open inquiries awaiting resolution
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate("timetables")}
              className="flex w-full items-center justify-between rounded-xl border border-border p-3 text-left transition-colors hover:bg-secondary/50"
            >
              <div className="flex items-center gap-3">
                <CalendarClock className="h-4 w-4 text-emerald-700" />
                <div>
                  <p className="text-sm font-semibold">Scheduled Timetable Sessions</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {(workspace?.timetables ?? []).length} active weekly slots
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>

            <button
              type="button"
              onClick={() => onNavigate("grades")}
              className="flex w-full items-center justify-between rounded-xl border border-border p-3 text-left transition-colors hover:bg-secondary/50"
            >
              <div className="flex items-center gap-3">
                <Award className="h-4 w-4 text-amber-600" />
                <div>
                  <p className="text-sm font-semibold">Academic Assessments</p>
                  <p className="text-xs text-muted-foreground tabular-nums">
                    {stats.gradeCount} recorded grades ·{" "}
                    {stats.avgGradePercent !== null
                      ? `${stats.avgGradePercent}% avg`
                      : "Scale ready"}
                  </p>
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>
        </Panel>

        <Panel
          title="Recent Activities & Updates"
          actions={
            <button
              type="button"
              onClick={() => onNavigate("audit-logs")}
              className="text-xs font-semibold text-primary hover:underline"
            >
              Audit logs →
            </button>
          }
        >
          {db.audit.length > 0 ? (
            <div className="space-y-3">
              {db.audit.slice(0, 5).map((item) => {
                const actor = item.actor_id ? maps.profilesById.get(item.actor_id) : undefined;
                return (
                  <div
                    key={item.id}
                    className="flex items-start gap-3 border-b border-border pb-2.5 last:border-0 last:pb-0"
                  >
                    <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-primary">
                      <Activity className="h-3.5 w-3.5" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium capitalize">
                        {item.action.replaceAll("_", " ")}
                      </p>
                      <p className="truncate text-xs text-muted-foreground">
                        {actor ? displayName(actor) : "System"} · {item.entity}
                      </p>
                    </div>
                    <time className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                      {new Date(item.created_at).toLocaleDateString()}
                    </time>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2.5">
              {db.announcements.slice(0, 3).map((a) => (
                <div key={a.id} className="flex items-start gap-2.5 rounded-lg bg-secondary/40 p-3">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{a.title}</p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">{a.body}</p>
                  </div>
                </div>
              ))}
              {db.announcements.length === 0 && (
                <EmptyState
                  title="No recent logs"
                  text="Administrative actions appear here."
                  icon={Activity}
                />
              )}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
