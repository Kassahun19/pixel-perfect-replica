import { useMemo } from "react";
import {
  Activity,
  ArrowRight,
  Award,
  Bell,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FolderTree,
  Mail,
  PlusCircle,
  TrendingUp,
  Users,
  Video,
} from "lucide-react";
import { displayName, useAuth } from "@/lib/auth";
import type { InstructorSubmenuId } from "@/lib/instructor/types";
import { computeAttendanceStats, computeGradeOutcome } from "@/lib/owner/logic";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState, PageHeader, Panel, StatCard } from "@/components/dashboard/ui";
import type { InstructorDataHandle } from "./useInstructorData";

export function InstructorOverview({
  data,
  onNavigate,
}: {
  data: InstructorDataHandle;
  onNavigate: (menu: InstructorSubmenuId) => void;
}) {
  const { user, profile } = useAuth();
  const { db, workspace, maps, can } = data;

  const stats = useMemo(() => {
    const coursesCount = db.courses.length;
    const classesCount = (workspace?.classes ?? []).length;
    const studentsCount = maps.students.length;

    const pendingAssignmentsCount = (workspace?.assignmentSubmissions ?? []).filter(
      (s) => s.status === "submitted" || s.status === "late",
    ).length;
    const pendingExamCount = (workspace?.examSubmissions ?? []).filter(
      (s) => s.status === "submitted",
    ).length;
    const totalPendingGrading = pendingAssignmentsCount + pendingExamCount;

    const attendanceSummary = computeAttendanceStats(
      (workspace?.attendance ?? []).filter((a) => a.personType === "student"),
    );

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
        : 0;

    const unreadMessages = (workspace?.internalMessages ?? []).filter(
      (m) => m.recipientId === user?.id && !m.read,
    ).length;

    const unreadNotifications = (workspace?.notifications ?? []).filter(
      (n) => !user || !n.readBy.includes(user.id),
    ).length;

    const upcomingLive = (workspace?.liveClasses ?? [])
      .filter((lc) => lc.status === "scheduled" || lc.status === "live")
      .slice(0, 4);

    const upcomingExams = (workspace?.exams ?? [])
      .filter((ex) => ex.status === "scheduled" || ex.status === "active")
      .slice(0, 4);

    return {
      coursesCount,
      classesCount,
      studentsCount,
      totalPendingGrading,
      attendanceSummary,
      avgGrade,
      unreadMessages,
      unreadNotifications,
      upcomingLive,
      upcomingExams,
    };
  }, [db.courses.length, maps.students.length, user, workspace]);

  const firstName = profile ? displayName(profile).split(" ")[0] : "Instructor";

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back, ${firstName}`}
        description="Overview of your assigned courses, classes, upcoming sessions, student progress, and pending evaluations."
        actions={
          <div className="flex flex-wrap gap-2">
            {can("courses", "create") && (
              <Button type="button" variant="emerald" size="sm" onClick={() => onNavigate("create-course")}>
                <PlusCircle className="h-4 w-4" />
                Create Course
              </Button>
            )}
            {can("attendance", "create") && (
              <Button type="button" variant="outline" size="sm" onClick={() => onNavigate("attendance")}>
                <ClipboardCheck className="h-4 w-4" />
                Mark Attendance
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Assigned Courses"
          value={stats.coursesCount}
          icon={BookOpen}
          hint={`${db.courses.filter((c) => c.status === "published").length} published · ${db.lessons.length} lessons`}
          index={0}
        />
        <StatCard
          label="Assigned Classes"
          value={stats.classesCount}
          icon={FolderTree}
          hint={`${(workspace?.timetables ?? []).length} scheduled weekly slots`}
          tone="gold"
          index={1}
        />
        <StatCard
          label="Enrolled Students"
          value={stats.studentsCount}
          icon={Users}
          hint={`${db.enrollments.length} course enrollments`}
          tone="deep"
          index={2}
        />
        <StatCard
          label="Pending Evaluations"
          value={stats.totalPendingGrading}
          icon={ClipboardList}
          hint={`${(workspace?.assignments ?? []).length} assignments · ${(workspace?.exams ?? []).length} exams`}
          tone="plain"
          index={3}
        />
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.3fr_1fr]">
        <Panel
          title="Upcoming Lessons, Live Classes & Examinations"
          actions={
            <button
              type="button"
              className="text-xs font-semibold text-primary hover:underline"
              onClick={() => onNavigate("timetables")}
            >
              View full timetable
            </button>
          }
        >
          {stats.upcomingLive.length > 0 ||
          stats.upcomingExams.length > 0 ||
          (workspace?.timetables ?? []).length > 0 ? (
            <div className="space-y-3">
              {stats.upcomingLive.map((lc) => (
                <div
                  key={lc.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary/35 p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <Video className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{lc.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {maps.coursesById.get(lc.courseId)?.title ?? "Course"} · {lc.scheduledDate}{" "}
                        ({lc.startTime}–{lc.endTime})
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
                      Open
                    </Button>
                  </div>
                </div>
              ))}

              {stats.upcomingExams.map((ex) => (
                <div
                  key={ex.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-secondary/35 p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gold/20 text-foreground">
                      <ClipboardList className="h-4 w-4" />
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{ex.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {maps.coursesById.get(ex.courseId)?.title ?? "Course"} · {ex.scheduledDate}{" "}
                        at {ex.startTime} ({ex.durationMinutes} min)
                      </p>
                    </div>
                  </div>
                  <Badge variant="gold">{ex.examType}</Badge>
                </div>
              ))}

              {(workspace?.timetables ?? []).slice(0, 3).map((slot) => (
                <div
                  key={slot.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <CalendarClock className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{slot.title}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {slot.dayOfWeek} · {slot.startTime}–{slot.endTime} · {slot.room || "Online"}
                      </p>
                    </div>
                  </div>
                  <Badge variant="outline">{slot.sessionType.replace("_", " ")}</Badge>
                </div>
              ))}
            </div>
          ) : (
            <EmptyState
              title="No upcoming sessions scheduled"
              text="Schedule a live class, timetable slot, or quiz for your assigned courses."
              icon={CalendarClock}
              action={
                <Button type="button" variant="outline" size="sm" onClick={() => onNavigate("live-classes")}>
                  Schedule Live Class
                </Button>
              }
            />
          )}
        </Panel>

        <Panel title="Teaching Health & Performance Summary">
          <div className="space-y-4">
            <div className="rounded-xl border border-border bg-secondary/35 p-3.5">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>Class Attendance Rate</span>
                <span className="font-semibold text-foreground">
                  {stats.attendanceSummary.total > 0
                    ? `${stats.attendanceSummary.attendanceRate}%`
                    : "No records yet"}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-primary transition-all"
                  style={{ width: `${Math.min(100, stats.attendanceSummary.attendanceRate)}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {stats.attendanceSummary.present} present · {stats.attendanceSummary.late} late ·{" "}
                {stats.attendanceSummary.absent} absent
              </p>
            </div>

            <div className="rounded-xl border border-border bg-secondary/35 p-3.5">
              <div className="flex items-center justify-between text-xs font-medium text-muted-foreground">
                <span>Average Student Grade</span>
                <span className="font-semibold text-foreground">
                  {(workspace?.grades ?? []).length > 0 ? `${stats.avgGrade}%` : "No grades yet"}
                </span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-gold transition-all"
                  style={{ width: `${Math.min(100, stats.avgGrade)}%` }}
                />
              </div>
              <p className="mt-1.5 text-[11px] text-muted-foreground">
                {(workspace?.grades ?? []).length} graded assessment entries across assigned courses
              </p>
            </div>

            <div className="grid gap-2.5 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => onNavigate("student-messages")}
                className="flex items-center justify-between rounded-xl border border-border p-3 text-left transition-colors hover:bg-secondary/60"
              >
                <div className="flex items-center gap-2.5">
                  <Mail className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs font-semibold">Student Inbox</p>
                    <p className="text-[11px] text-muted-foreground">
                      {stats.unreadMessages} unread
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>

              <button
                type="button"
                onClick={() => onNavigate("notifications")}
                className="flex items-center justify-between rounded-xl border border-border p-3 text-left transition-colors hover:bg-secondary/60"
              >
                <div className="flex items-center gap-2.5">
                  <Bell className="h-4 w-4 text-primary" />
                  <div>
                    <p className="text-xs font-semibold">Notifications</p>
                    <p className="text-[11px] text-muted-foreground">
                      {stats.unreadNotifications} unread
                    </p>
                  </div>
                </div>
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </button>
            </div>
          </div>
        </Panel>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel
          title="Recent Learner Progress & Activity"
          actions={
            <button
              type="button"
              className="text-xs font-semibold text-primary hover:underline"
              onClick={() => onNavigate("student-progress")}
            >
              Inspect student progress
            </button>
          }
        >
          {db.progress.length > 0 ? (
            <div className="space-y-2.5">
              {db.progress.slice(0, 6).map((item) => {
                const student = maps.profilesById.get(item.user_id);
                const course = maps.coursesById.get(item.course_id);
                return (
                  <div
                    key={item.id}
                    className="flex items-center justify-between gap-3 rounded-xl bg-secondary/45 px-3 py-2.5"
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-primary" />
                      <div className="min-w-0">
                        <p className="truncate text-xs font-semibold">
                          {student ? displayName(student) : "Enrolled Learner"}
                        </p>
                        <p className="truncate text-[11px] text-muted-foreground">
                          Completed a lesson in {course?.title ?? "Course"}
                        </p>
                      </div>
                    </div>
                    <span className="shrink-0 text-[11px] text-muted-foreground">
                      {new Date(item.completed_at).toLocaleDateString()}
                    </span>
                  </div>
                );
              })}
            </div>
          ) : (
            <EmptyState
              title="No lesson completions yet"
              text="Student lesson completions in your assigned courses will appear here automatically."
              icon={TrendingUp}
            />
          )}
        </Panel>

        <Panel
          title="Recent Teaching Activity & Quick Actions"
          actions={
            <button
              type="button"
              className="text-xs font-semibold text-primary hover:underline"
              onClick={() => onNavigate("grading-evaluation")}
            >
              Open grading queue
            </button>
          }
        >
          {db.audit.length > 0 ? (
            <div className="space-y-2.5">
              {db.audit.slice(0, 5).map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border/70 px-3 py-2"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <Activity className="h-4 w-4 shrink-0 text-primary" />
                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold capitalize">
                        {log.action.replaceAll("_", " ")}
                      </p>
                      <p className="truncate text-[11px] text-muted-foreground">{log.entity}</p>
                    </div>
                  </div>
                  <span className="shrink-0 text-[11px] text-muted-foreground">
                    {new Date(log.created_at).toLocaleDateString()}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <div className="grid gap-2.5 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                className="justify-start"
                onClick={() => onNavigate("create-assignments")}
              >
                <ClipboardList className="h-4 w-4" />
                Create Assignment
              </Button>
              <Button
                type="button"
                variant="outline"
                className="justify-start"
                onClick={() => onNavigate("quizzes-exams")}
              >
                <Award className="h-4 w-4" />
                Create Quiz / Exam
              </Button>
              <Button
                type="button"
                variant="outline"
                className="justify-start"
                onClick={() => onNavigate("course-materials")}
              >
                <BookOpen className="h-4 w-4" />
                Upload Course Material
              </Button>
              <Button
                type="button"
                variant="outline"
                className="justify-start"
                onClick={() => onNavigate("performance-reports")}
              >
                <TrendingUp className="h-4 w-4" />
                Performance Reports
              </Button>
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}
