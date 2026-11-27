import { useMemo } from "react";
import {
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Compass,
  CreditCard,
  GraduationCap,
  Megaphone,
  PlayCircle,
  TrendingUp,
  Video,
  Wallet,
} from "lucide-react";
import { displayName, useAuth } from "@/lib/auth";
import { formatETB } from "@/lib/access";
import { computeAttendanceStats, computeGradeOutcome } from "@/lib/owner/logic";
import type { StudentSubmenuId } from "@/lib/student/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Panel, StatCard, STATUS_BADGE } from "@/components/dashboard/ui";
import type { StudentDataHandle } from "./useStudentData";

export function StudentOverview({
  data,
  onNavigate,
}: {
  data: StudentDataHandle;
  onNavigate: (menu: StudentSubmenuId) => void;
}) {
  const { user, profile } = useAuth();
  const { db, workspace, maps } = data;

  const summary = useMemo(() => {
    const myCourses = maps.myCourses;
    const totalLessonsInMyCourses = myCourses.reduce(
      (sum, c) => sum + (maps.lessonsByCourse.get(c.id)?.length ?? 0),
      0,
    );
    const completedLessonCount = db.progress.filter((p) =>
      maps.enrolledCourseIdSet.has(p.course_id),
    ).length;

    let completedCourses = 0;
    let inProgressCourses = 0;
    for (const c of myCourses) {
      const courseLessons = maps.lessonsByCourse.get(c.id) ?? [];
      const done = db.progress.filter((p) => p.course_id === c.id).length;
      const officialDone = workspace?.courseCompletions.some(
        (cc) => cc.courseId === c.id && (cc.status === "completed" || cc.status === "confirmed"),
      );
      if (officialDone || (courseLessons.length > 0 && done >= courseLessons.length)) {
        completedCourses += 1;
      } else {
        inProgressCourses += 1;
      }
    }

    const att = computeAttendanceStats(workspace?.attendance ?? []);

    const scale = workspace?.gradingScales.find((s) => s.isDefault) ?? workspace?.gradingScales[0];
    const grades = workspace?.grades ?? [];
    const avgGrade =
      grades.length && scale
        ? Math.round(
            grades.reduce(
              (sum, g) => sum + computeGradeOutcome(g.score, g.maxScore, scale).percent,
              0,
            ) / grades.length,
          )
        : null;

    const feePlans = workspace?.feePlans ?? [];
    const outstandingBalance = feePlans.reduce((sum, fp) => {
      const net = Math.max(0, fp.amount - fp.discount - fp.paidAmount);
      return sum + net;
    }, 0);
    const pendingPaymentsCount = db.payments.filter((p) => p.status === "pending").length;

    const subByAssignment = new Map(
      (workspace?.assignmentSubmissions ?? []).map((s) => [s.assignmentId, s]),
    );
    const pendingAssignments = (workspace?.assignments ?? [])
      .filter((a) => {
        if (a.status !== "published") return false;
        const sub = subByAssignment.get(a.id);
        return !sub || sub.status === "pending" || sub.status === "returned";
      })
      .slice(0, 4);

    const upcomingLive = (workspace?.liveClasses ?? [])
      .filter((lc) => lc.status === "scheduled" || lc.status === "live")
      .slice(0, 3);

    const upcomingExams = (workspace?.exams ?? [])
      .filter((ex) => ex.status === "scheduled" || ex.status === "active")
      .slice(0, 3);

    const unreadNotifications = (workspace?.notifications ?? []).filter(
      (n) => !user || !n.readBy.includes(user.id),
    );

    const overallProgressPct = totalLessonsInMyCourses
      ? Math.min(100, Math.round((completedLessonCount / totalLessonsInMyCourses) * 100))
      : 0;

    return {
      myCoursesCount: myCourses.length,
      completedCourses,
      inProgressCourses,
      totalLessonsInMyCourses,
      completedLessonCount,
      overallProgressPct,
      att,
      avgGrade,
      gradesCount: grades.length,
      outstandingBalance,
      pendingPaymentsCount,
      pendingAssignments,
      upcomingLive,
      upcomingExams,
      unreadNotifications,
      recentGrades: grades.slice(0, 4),
    };
  }, [db.payments, db.progress, maps, user, workspace]);

  const firstName = profile ? displayName(profile).split(" ")[0] : "Student";
  const myClass = workspace?.myStudentMeta?.classSectionId
    ? maps.classesById.get(workspace.myStudentMeta.classSectionId)
    : workspace?.classes[0];

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description={[
          workspace?.myStudentMeta.studentCode || "Student Portal",
          myClass ? `${myClass.name} (${myClass.sectionCode})` : "Self-Paced & Live Cohorts",
          `${summary.overallProgressPct}% overall lesson progress`,
        ].join(" · ")}
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="emerald"
              size="sm"
              onClick={() => onNavigate("continue-learning")}
            >
              <PlayCircle className="h-4 w-4" /> Continue Learning
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onNavigate("explore-courses")}
            >
              <Compass className="h-4 w-4" /> Explore Courses
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Enrolled Courses"
          value={<span className="tabular-nums">{summary.myCoursesCount}</span>}
          icon={BookOpen}
          hint={`${summary.inProgressCourses} in progress · ${summary.completedCourses} completed`}
          index={0}
        />
        <StatCard
          label="Lessons Completed"
          value={
            <span className="tabular-nums">
              {summary.completedLessonCount}/{summary.totalLessonsInMyCourses}
            </span>
          }
          icon={CheckCircle2}
          hint={`${summary.overallProgressPct}% curriculum completion`}
          tone="gold"
          index={1}
        />
        <StatCard
          label="Attendance & Performance"
          value={
            <span className="tabular-nums">
              {summary.avgGrade !== null
                ? `${summary.avgGrade}%`
                : summary.att.total > 0
                  ? `${summary.att.attendanceRate}%`
                  : "On Track"}
            </span>
          }
          icon={GraduationCap}
          hint={
            summary.att.total > 0
              ? `Attendance ${summary.att.attendanceRate}% · ${summary.gradesCount} grades`
              : `${summary.gradesCount} recorded grade entries`
          }
          tone="deep"
          index={2}
        />
        <StatCard
          label="Outstanding Fees"
          value={<span className="tabular-nums">{formatETB(summary.outstandingBalance)}</span>}
          icon={Wallet}
          hint={
            summary.pendingPaymentsCount > 0
              ? `${summary.pendingPaymentsCount} receipt(s) pending verification`
              : summary.outstandingBalance > 0
                ? "Payment due — upload receipt in Fees"
                : "Account balance settled"
          }
          tone="plain"
          index={3}
        />
      </div>

      {/* Quick Actions Strip */}
      <Panel title="Quick Learning Actions">
        <div className="grid gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {(
            [
              { id: "continue-learning", label: "Resume Lesson", icon: PlayCircle },
              { id: "my-assignments", label: "Assignments", icon: ClipboardList },
              { id: "quizzes-exams", label: "Quizzes & Exams", icon: ClipboardCheck },
              { id: "my-timetable", label: "My Timetable", icon: CalendarClock },
              { id: "make-payment", label: "Make Payment", icon: CreditCard },
              { id: "my-certificates", label: "Certificates", icon: Award },
            ] as const
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => onNavigate(id)}
              className="flex items-center justify-between gap-2 rounded-xl border border-border bg-secondary/35 px-3 py-2.5 text-left text-xs font-semibold transition-colors hover:border-primary/40 hover:bg-secondary"
            >
              <span className="flex min-w-0 items-center gap-2">
                <Icon className="h-4 w-4 shrink-0 text-primary" />
                <span className="truncate">{label}</span>
              </span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            </button>
          ))}
        </div>
      </Panel>

      <div className="grid gap-6 xl:grid-cols-[1.25fr_1fr]">
        <Panel
          title="Upcoming Classes, Assignments & Assessments"
          actions={
            <button
              type="button"
              className="text-xs font-semibold text-primary hover:underline"
              onClick={() => onNavigate("learning-schedule")}
            >
              Full learning schedule
            </button>
          }
        >
          {summary.upcomingLive.length > 0 ||
          summary.pendingAssignments.length > 0 ||
          summary.upcomingExams.length > 0 ? (
            <div className="space-y-2.5">
              {summary.upcomingLive.map((lc) => (
                <div
                  key={lc.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary/30 p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Video className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{lc.title}</p>
                      <p className="truncate text-xs text-muted-foreground tabular-nums">
                        {maps.coursesById.get(lc.courseId)?.title ?? "Course"} · {lc.scheduledDate}{" "}
                        · {lc.startTime}–{lc.endTime}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant={lc.status === "live" ? "success" : "secondary"}>
                      {lc.status}
                    </Badge>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => onNavigate("live-classes")}
                    >
                      Join
                    </Button>
                  </div>
                </div>
              ))}

              {summary.pendingAssignments.map((a) => (
                <div
                  key={a.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold/20 text-foreground">
                      <ClipboardList className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{a.title}</p>
                      <p className="truncate text-xs text-muted-foreground tabular-nums">
                        {maps.coursesById.get(a.courseId)?.title ?? "Course"} · Due {a.dueDate} ·{" "}
                        {a.maxScore} pts
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigate("my-assignments")}
                  >
                    Submit
                  </Button>
                </div>
              ))}

              {summary.upcomingExams.map((ex) => (
                <div
                  key={ex.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <ClipboardCheck className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{ex.title}</p>
                      <p className="truncate text-xs text-muted-foreground tabular-nums">
                        {maps.coursesById.get(ex.courseId)?.title ?? "Course"} ·{" "}
                        {ex.scheduledDate} at {ex.startTime} · {ex.durationMinutes} min
                      </p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={ex.status === "active" ? "emerald" : "outline"}
                    onClick={() => onNavigate("quizzes-exams")}
                  >
                    {ex.status === "active" ? "Start" : "Details"}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No pending deadlines or upcoming live sessions"
              text="You are caught up on live sessions, assignments, and exams. Jump back into a course lesson anytime."
              icon={CalendarClock}
              action={
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => onNavigate("continue-learning")}
                >
                  Open Lessons
                </Button>
              }
            />
          )}
        </Panel>

        <Panel
          title="Recent Grades & Academic Summary"
          actions={
            <button
              type="button"
              className="text-xs font-semibold text-primary hover:underline"
              onClick={() => onNavigate("grades-report-cards")}
            >
              Report cards
            </button>
          }
        >
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-secondary/35 p-3.5">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>Personal Attendance Summary</span>
                <span className="font-semibold text-foreground tabular-nums">
                  {summary.att.total > 0 ? `${summary.att.attendanceRate}%` : "No records yet"}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, summary.att.attendanceRate)}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground tabular-nums">
                {summary.att.present} present · {summary.att.late} late · {summary.att.absent}{" "}
                absent · {summary.att.excused} excused
              </p>
            </div>

            {summary.recentGrades.length > 0 ? (
              <div className="space-y-2">
                {summary.recentGrades.map((g) => {
                  const pct = g.maxScore ? Math.round((g.score / g.maxScore) * 100) : 0;
                  return (
                    <div
                      key={g.id}
                      className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2.5"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">{g.assessmentTitle}</p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          {maps.coursesById.get(g.courseId)?.title ?? "Course"} ·{" "}
                          {g.assessmentType}
                        </p>
                      </div>
                      <span className="shrink-0 font-mono text-xs font-bold text-primary tabular-nums">
                        {g.score}/{g.maxScore} ({pct}%)
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                <TrendingUp className="mx-auto mb-1.5 h-5 w-5 text-primary/70" />
                Released quiz, assignment, and exam grades will appear here automatically.
              </div>
            )}
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          title="Recent Announcements"
          actions={
            <button
              type="button"
              className="text-xs font-semibold text-primary hover:underline"
              onClick={() => onNavigate("announcements")}
            >
              View all
            </button>
          }
        >
          {db.announcements.length > 0 ? (
            <div className="divide-y divide-border">
              {db.announcements.slice(0, 4).map((a) => (
                <div key={a.id} className="py-3 first:pt-0 last:pb-0">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate text-sm font-semibold">{a.title}</p>
                    <span className="shrink-0 text-[11px] text-muted-foreground tabular-nums">
                      {new Date(a.publish_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{a.body}</p>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No recent announcements"
              text="Course and academy notices will appear here."
              icon={Megaphone}
            />
          )}
        </Panel>

        <Panel
          title="Unread Notifications & Fee Status"
          actions={
            <button
              type="button"
              className="text-xs font-semibold text-primary hover:underline"
              onClick={() => onNavigate("notifications")}
            >
              Open inbox
            </button>
          }
        >
          {summary.unreadNotifications.length > 0 || db.payments.length > 0 ? (
            <div className="space-y-2.5">
              {summary.unreadNotifications.slice(0, 3).map((n) => (
                <div
                  key={n.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-border bg-secondary/35 p-3"
                >
                  <div className="flex min-w-0 items-start gap-2.5">
                    <Bell className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold">{n.title}</p>
                      <p className="line-clamp-2 text-[11px] text-muted-foreground">{n.message}</p>
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => onNavigate("notifications")}
                  >
                    View
                  </Button>
                </div>
              ))}
              {db.payments.slice(0, 2).map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold">
                      {maps.coursesById.get(p.course_id)?.title ?? "Course Tuition"} · {p.method}
                    </p>
                    <p className="text-[11px] text-muted-foreground tabular-nums">
                      Ref: {p.reference} · {formatETB(Number(p.amount))}
                    </p>
                  </div>
                  <Badge variant={STATUS_BADGE[p.status] ?? "muted"} className="capitalize">
                    {p.status}
                  </Badge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="All notifications caught up"
              text="Alerts for grades, payments, classes, and enrollment requests appear here."
              icon={Bell}
            />
          )}
        </Panel>
      </div>
    </div>
  );
}
