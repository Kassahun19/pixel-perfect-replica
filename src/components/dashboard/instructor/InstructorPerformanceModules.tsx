import { useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownToLine,
  Award,
  BarChart3,
  CheckCircle2,
  Printer,
  Search,
  TrendingUp,
} from "lucide-react";
import { displayName, useAuth } from "@/lib/auth";
import { downloadExcelXls } from "@/lib/export";
import { computeAttendanceStats, computeGradeOutcome, paginateRows } from "@/lib/owner/logic";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  EmptyState,
  PageHeader,
  Pager,
  Panel,
  StatCard,
} from "@/components/dashboard/ui";
import type { InstructorDataHandle } from "./useInstructorData";

/* ========================================================================== */
/* STUDENT PROGRESS                                                           */
/* ========================================================================== */

export function InstructorStudentProgressModule({ data }: { data: InstructorDataHandle }) {
  const { db, workspace, maps } = data;
  const [courseFilter, setCourseFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [supportOnly, setSupportOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const scale = workspace?.gradingScales.find((s) => s.isDefault) ?? workspace?.gradingScales[0];

  const progressRows = useMemo(() => {
    return db.enrollments
      .filter((e) => (courseFilter === "all" ? true : e.course_id === courseFilter))
      .map((e) => {
        const student = maps.profilesById.get(e.user_id);
        const course = maps.coursesById.get(e.course_id);
        const meta = workspace?.studentMeta[e.user_id];
        const totalLessons = (maps.lessonsByCourse.get(e.course_id) ?? []).length;
        const completedLessons = db.progress.filter(
          (p) => p.user_id === e.user_id && p.course_id === e.course_id,
        ).length;
        const lessonPct =
          totalLessons > 0 ? Math.min(100, Math.round((completedLessons / totalLessons) * 100)) : 0;

        const grades = (workspace?.grades ?? []).filter(
          (g) => g.studentId === e.user_id && g.courseId === e.course_id,
        );
        const avgGrade =
          grades.length && scale
            ? Math.round(
                grades.reduce(
                  (s, g) => s + computeGradeOutcome(g.score, g.maxScore, scale).percent,
                  0,
                ) / grades.length,
              )
            : null;

        const att = computeAttendanceStats(
          (workspace?.attendance ?? []).filter(
            (a) => a.personType === "student" && a.personId === e.user_id && a.courseId === e.course_id,
          ),
        );
        const needsSupport =
          (avgGrade !== null && avgGrade < 65) ||
          (att.total >= 2 && att.attendanceRate < 75) ||
          (totalLessons > 2 && lessonPct < 25);

        return {
          key: `${e.user_id}:${e.course_id}`,
          studentId: e.user_id,
          studentName: student ? displayName(student) : "Learner",
          studentEmail: student?.email ?? "",
          classSectionId: meta?.classSectionId ?? null,
          courseTitle: course?.title ?? "Course",
          completedLessons,
          totalLessons,
          lessonPct,
          avgGrade,
          attendanceRate: att.total ? att.attendanceRate : null,
          needsSupport,
        };
      })
      .filter((r) => {
        if (classFilter !== "all" && r.classSectionId !== classFilter) return false;
        if (supportOnly && !r.needsSupport) return false;
        if (!search.trim()) return true;
        return `${r.studentName} ${r.courseTitle} ${r.studentEmail}`
          .toLowerCase()
          .includes(search.trim().toLowerCase());
      });
  }, [db.enrollments, db.progress, courseFilter, classFilter, supportOnly, search, maps, workspace, scale]);

  const paged = useMemo(() => paginateRows(progressRows, page, 10), [progressRows, page]);

  const supportCount = progressRows.filter((r) => r.needsSupport).length;
  const avgCompletion = progressRows.length
    ? Math.round(progressRows.reduce((s, r) => s + r.lessonPct, 0) / progressRows.length)
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Student Progress"
        description="Monitor individual course completion, assessment averages, and flag learners needing academic support."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Tracked Enrollments" value={progressRows.length} icon={TrendingUp} index={0} />
        <StatCard label="Average Completion" value={`${avgCompletion}%`} icon={CheckCircle2} tone="gold" index={1} />
        <StatCard label="Needs Support" value={supportCount} icon={AlertTriangle} tone="deep" index={2} />
      </div>

      <Panel
        title="Learner Progress Matrix"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search student or course…"
              className="h-9 w-44 text-xs"
            />
            <select
              value={courseFilter}
              onChange={(e) => {
                setCourseFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 rounded-md border border-input bg-background px-2.5 text-xs"
            >
              <option value="all">All courses</option>
              {db.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <select
              value={classFilter}
              onChange={(e) => {
                setClassFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 rounded-md border border-input bg-background px-2.5 text-xs"
            >
              <option value="all">All classes</option>
              {(workspace?.classes ?? []).map((cl) => (
                <option key={cl.id} value={cl.id}>
                  {cl.name}
                </option>
              ))}
            </select>
            <label className="flex items-center gap-1.5 text-xs font-medium">
              <input
                type="checkbox"
                checked={supportOnly}
                onChange={(e) => {
                  setSupportOnly(e.target.checked);
                  setPage(1);
                }}
              />
              Needs support only
            </label>
          </div>
        }
      >
        {paged.items.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Lesson Completion</TableHead>
                  <TableHead>Assessment Avg</TableHead>
                  <TableHead>Attendance</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.items.map((r) => (
                  <TableRow key={r.key}>
                    <TableCell>
                      <p className="font-semibold text-sm">{r.studentName}</p>
                      <p className="text-xs text-muted-foreground">{r.studentEmail}</p>
                    </TableCell>
                    <TableCell className="text-xs">{r.courseTitle}</TableCell>
                    <TableCell className="min-w-[140px]">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span>
                          {r.completedLessons}/{r.totalLessons}
                        </span>
                        <span className="font-semibold">{r.lessonPct}%</span>
                      </div>
                      <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary"
                          style={{ width: `${r.lessonPct}%` }}
                        />
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-semibold">
                      {r.avgGrade !== null ? `${r.avgGrade}%` : "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.attendanceRate !== null ? `${r.attendanceRate}%` : "No logs"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={r.needsSupport ? "destructive" : "success"}>
                        {r.needsSupport ? "Needs Support" : "On Track"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pager page={paged.page} pageCount={paged.pageCount} onPage={setPage} />
          </>
        ) : (
          <EmptyState
            title="No progress records match"
            text="Student course enrollments and lesson progress appear here."
            icon={TrendingUp}
          />
        )}
      </Panel>
    </div>
  );
}

/* ========================================================================== */
/* PERFORMANCE REPORTS                                                        */
/* ========================================================================== */

export function InstructorPerformanceReportsModule({ data }: { data: InstructorDataHandle }) {
  const { db, workspace, maps, can, setPrintable } = data;
  const [courseId, setCourseId] = useState("all");

  const scale = workspace?.gradingScales.find((s) => s.isDefault) ?? workspace?.gradingScales[0];

  const reportRows = useMemo(() => {
    return maps.students.map((stu) => {
      const stuGrades = (workspace?.grades ?? []).filter(
        (g) => g.studentId === stu.id && (courseId === "all" || g.courseId === courseId),
      );
      const stuAtt = computeAttendanceStats(
        (workspace?.attendance ?? []).filter(
          (a) =>
            a.personType === "student" &&
            a.personId === stu.id &&
            (courseId === "all" || a.courseId === courseId),
        ),
      );
      const avgScore =
        stuGrades.length && scale
          ? Math.round(
              stuGrades.reduce(
                (s, g) => s + computeGradeOutcome(g.score, g.maxScore, scale).percent,
                0,
              ) / stuGrades.length,
            )
          : 0;
      const subsCount = (workspace?.assignmentSubmissions ?? []).filter(
        (s) =>
          s.studentId === stu.id &&
          s.status !== "pending" &&
          (courseId === "all" || s.courseId === courseId),
      ).length;
      const doneLessons = db.progress.filter(
        (p) => p.user_id === stu.id && (courseId === "all" || p.course_id === courseId),
      ).length;

      const strength =
        avgScore >= 85
          ? "Strong Assessment Mastery"
          : stuAtt.attendanceRate >= 90
            ? "Consistent Attendance"
            : doneLessons >= 3
              ? "Active Lesson Progress"
              : "Needs Engagement";

      return {
        studentId: stu.id,
        name: displayName(stu),
        email: stu.email,
        gradesCount: stuGrades.length,
        avgScore,
        attendanceRate: stuAtt.total ? stuAtt.attendanceRate : 0,
        subsCount,
        doneLessons,
        strength,
      };
    });
  }, [maps.students, workspace, db.progress, courseId, scale]);

  function exportExcel() {
    downloadExcelXls(
      "ezana-instructor-performance-report",
      "Performance Report",
      reportRows.map((r) => ({
        Student: r.name,
        Email: r.email,
        LessonsDone: r.doneLessons,
        Submissions: r.subsCount,
        GradedItems: r.gradesCount,
        AveragePercent: `${r.avgScore}%`,
        AttendancePercent: `${r.attendanceRate}%`,
        Insight: r.strength,
      })),
      "Instructor Student Performance Report",
    );
  }

  function printPdf() {
    setPrintable({
      title: "Student Academic Performance Report",
      subtitle:
        courseId === "all"
          ? "All Assigned Courses"
          : (maps.coursesById.get(courseId)?.title ?? "Assigned Course"),
      columns: ["Student", "Lessons", "Submissions", "Avg Score", "Attendance", "Insight"],
      rows: reportRows.map((r) => [
        r.name,
        r.doneLessons,
        r.subsCount,
        `${r.avgScore}%`,
        `${r.attendanceRate}%`,
        r.strength,
      ]),
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Performance Reports"
        description="Compare student academic results, attendance, and assessment trends across your assigned courses."
        actions={
          can("reports", "export") &&
          reportRows.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" size="sm" onClick={exportExcel}>
                <ArrowDownToLine className="h-4 w-4" />
                Export Excel
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={printPdf}>
                <Printer className="h-4 w-4" />
                Print PDF
              </Button>
            </div>
          )
        }
      />

      <Panel
        title="Comparative Performance Breakdown"
        actions={
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2.5 text-xs"
          >
            <option value="all">All assigned courses</option>
            {db.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        }
      >
        {reportRows.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Lessons</TableHead>
                <TableHead>Submissions</TableHead>
                <TableHead>Avg Grade</TableHead>
                <TableHead>Attendance</TableHead>
                <TableHead>Performance Insight</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {reportRows.map((r) => (
                <TableRow key={r.studentId}>
                  <TableCell>
                    <p className="font-semibold text-sm">{r.name}</p>
                    <p className="text-xs text-muted-foreground">{r.email}</p>
                  </TableCell>
                  <TableCell className="text-xs">{r.doneLessons}</TableCell>
                  <TableCell className="text-xs">{r.subsCount}</TableCell>
                  <TableCell className="text-xs font-semibold">{r.avgScore}%</TableCell>
                  <TableCell className="text-xs">{r.attendanceRate}%</TableCell>
                  <TableCell>
                    <Badge variant={r.avgScore >= 80 ? "success" : "secondary"}>
                      {r.strength}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="No performance data yet"
            text="Enrolled students and graded assessments will generate comparative performance reports here."
            icon={BarChart3}
          />
        )}
      </Panel>
    </div>
  );
}

/* ========================================================================== */
/* LEARNING ACTIVITIES                                                        */
/* ========================================================================== */

export function InstructorLearningActivitiesModule({ data }: { data: InstructorDataHandle }) {
  const { db, workspace, maps } = data;
  const [search, setSearch] = useState("");
  const [inactiveOnly, setInactiveOnly] = useState(false);

  const activityRows = useMemo(() => {
    return maps.students
      .map((stu) => {
        const lessonsDone = db.progress.filter((p) => p.user_id === stu.id).length;
        const assignSubs = (workspace?.assignmentSubmissions ?? []).filter(
          (s) => s.studentId === stu.id && s.status !== "pending",
        ).length;
        const examSubs = (workspace?.examSubmissions ?? []).filter(
          (s) => s.studentId === stu.id && s.status !== "pending",
        ).length;
        const forumPosts = (workspace?.discussionPosts ?? []).filter(
          (p) => p.authorId === stu.id,
        ).length;
        const totalActions = lessonsDone + assignSubs + examSubs + forumPosts;
        const lastProgress = db.progress
          .filter((p) => p.user_id === stu.id)
          .sort((a, b) => b.completed_at.localeCompare(a.completed_at))[0];

        return {
          studentId: stu.id,
          name: displayName(stu),
          email: stu.email,
          lessonsDone,
          assignSubs,
          examSubs,
          forumPosts,
          totalActions,
          lastActive: lastProgress?.completed_at ?? null,
          inactive: totalActions === 0,
        };
      })
      .filter((r) => {
        if (inactiveOnly && !r.inactive) return false;
        if (!search.trim()) return true;
        return `${r.name} ${r.email}`.toLowerCase().includes(search.trim().toLowerCase());
      });
  }, [maps.students, db.progress, workspace, inactiveOnly, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Learning Activities"
        description="Track student participation across lessons, assignments, quizzes, and discussion forums to identify inactive learners."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Active Learners" value={activityRows.filter((r) => !r.inactive).length} icon={Activity} index={0} />
        <StatCard
          label="Inactive Learners"
          value={activityRows.filter((r) => r.inactive).length}
          icon={AlertTriangle}
          tone="gold"
          index={1}
        />
        <StatCard
          label="Forum Contributions"
          value={(workspace?.discussionPosts ?? []).length}
          icon={TrendingUp}
          tone="deep"
          index={2}
        />
      </div>

      <Panel
        title="Student Engagement & Participation"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student…"
                className="h-9 w-44 pl-8 text-xs"
              />
            </div>
            <label className="flex items-center gap-1.5 text-xs font-medium">
              <input
                type="checkbox"
                checked={inactiveOnly}
                onChange={(e) => setInactiveOnly(e.target.checked)}
              />
              Inactive only
            </label>
          </div>
        }
      >
        {activityRows.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Lessons</TableHead>
                <TableHead>Assignments</TableHead>
                <TableHead>Quizzes / Exams</TableHead>
                <TableHead>Forum Posts</TableHead>
                <TableHead>Activity Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {activityRows.map((r) => (
                <TableRow key={r.studentId}>
                  <TableCell>
                    <p className="font-semibold text-sm">{r.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {r.lastActive
                        ? `Last lesson: ${new Date(r.lastActive).toLocaleDateString()}`
                        : "No recorded activity"}
                    </p>
                  </TableCell>
                  <TableCell className="text-xs">{r.lessonsDone}</TableCell>
                  <TableCell className="text-xs">{r.assignSubs}</TableCell>
                  <TableCell className="text-xs">{r.examSubs}</TableCell>
                  <TableCell className="text-xs">{r.forumPosts}</TableCell>
                  <TableCell>
                    <Badge variant={r.inactive ? "destructive" : "success"}>
                      {r.inactive ? "Follow-up Needed" : "Engaged"}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="No activity rows match"
            text="Assigned students and their learning activities appear here."
            icon={Activity}
          />
        )}
      </Panel>
    </div>
  );
}

/* ========================================================================== */
/* COURSE COMPLETION                                                          */
/* ========================================================================== */

export function InstructorCourseCompletionModule({ data }: { data: InstructorDataHandle }) {
  const { user } = useAuth();
  const { db, workspace, maps, mutateWorkspace, can } = data;
  const [courseFilter, setCourseFilter] = useState("all");

  const completionRows = useMemo(() => {
    return db.enrollments
      .filter((e) => (courseFilter === "all" ? true : e.course_id === courseFilter))
      .map((e) => {
        const student = maps.profilesById.get(e.user_id);
        const course = maps.coursesById.get(e.course_id);
        const totalLessons = (maps.lessonsByCourse.get(e.course_id) ?? []).length;
        const completedLessons = db.progress.filter(
          (p) => p.user_id === e.user_id && p.course_id === e.course_id,
        ).length;
        const pct =
          totalLessons > 0 ? Math.min(100, Math.round((completedLessons / totalLessons) * 100)) : 0;
        const existingRecord = (workspace?.courseCompletions ?? []).find(
          (cc) => cc.studentId === e.user_id && cc.courseId === e.course_id,
        );
        const status =
          existingRecord?.status ?? (pct >= 100 ? "completed" : "in_progress");
        return {
          id: existingRecord?.id ?? `${e.user_id}:${e.course_id}`,
          studentId: e.user_id,
          studentName: student ? displayName(student) : "Learner",
          courseId: e.course_id,
          courseTitle: course?.title ?? "Course",
          completedLessons,
          pendingLessons: Math.max(0, totalLessons - completedLessons),
          totalLessons,
          pct,
          status,
        };
      });
  }, [db.enrollments, db.progress, courseFilter, maps, workspace?.courseCompletions]);

  async function confirmCompletion(row: (typeof completionRows)[number]) {
    if (!user) return;
    await mutateWorkspace(
      {
        type: "upsert_course_completion",
        payload: {
          id: row.id,
          studentId: row.studentId,
          courseId: row.courseId,
          completionPercent: row.pct,
          status: "confirmed",
          confirmedBy: user.id,
          confirmedAt: new Date().toISOString(),
          notes: "Confirmed by course instructor",
          updatedAt: new Date().toISOString(),
        },
      },
      `Confirmed course completion for ${row.studentName}`,
    );
  }

  function exportCompletion() {
    downloadExcelXls(
      "ezana-course-completion",
      "Completion",
      completionRows.map((r) => ({
        Student: r.studentName,
        Course: r.courseTitle,
        CompletedLessons: r.completedLessons,
        PendingLessons: r.pendingLessons,
        CompletionPercent: `${r.pct}%`,
        Status: r.status,
      })),
      "Course Completion Records",
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Course Completion"
        description="Track completed vs pending lessons and confirm student completion eligibility."
        actions={
          completionRows.length > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={exportCompletion}>
              <ArrowDownToLine className="h-4 w-4" />
              Export Excel
            </Button>
          )
        }
      />

      <Panel
        title="Completion Tracker"
        actions={
          <select
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2.5 text-xs"
          >
            <option value="all">All courses</option>
            {db.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        }
      >
        {completionRows.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Completed / Pending</TableHead>
                <TableHead>Progress</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {completionRows.map((row) => (
                <TableRow key={row.id}>
                  <TableCell className="font-semibold text-sm">{row.studentName}</TableCell>
                  <TableCell className="text-xs">{row.courseTitle}</TableCell>
                  <TableCell className="text-xs">
                    {row.completedLessons} done · {row.pendingLessons} pending
                  </TableCell>
                  <TableCell className="text-xs font-semibold">{row.pct}%</TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        row.status === "confirmed"
                          ? "success"
                          : row.status === "completed"
                            ? "gold"
                            : "outline"
                      }
                    >
                      {row.status.replace("_", " ")}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {can("grades", "edit") && row.status !== "confirmed" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        disabled={data.mutating}
                        onClick={() => void confirmCompletion(row)}
                      >
                        Confirm Completion
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="No enrollments to track"
            text="Enrolled students in your courses will display completion milestones here."
            icon={Award}
          />
        )}
      </Panel>
    </div>
  );
}
