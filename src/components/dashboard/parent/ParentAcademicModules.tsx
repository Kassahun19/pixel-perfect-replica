import { useMemo, useState } from "react";
import {
  AlertTriangle,
  Award,
  BarChart3,
  BookOpen,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  Download,
  ExternalLink,
  FileCheck2,
  FileSpreadsheet,
  Film,
  Library,
  Printer,
  Search,
  TrendingUp,
} from "lucide-react";
import { displayName } from "@/lib/auth";
import { downloadCsv } from "@/lib/csv";
import { formatCompactDate, paginateRows, resolveGradeBand } from "@/lib/owner/logic";
import type { CourseRow, LearningResource, TimetableSlot } from "@/lib/owner/types";
import { CourseThumbnail } from "@/components/site/CourseThumbnail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  EmptyState,
  PageHeader,
  Pager,
  Panel,
  StatCard,
  STATUS_BADGE,
} from "@/components/dashboard/ui";
import { VideoPlayer } from "@/components/dashboard/VideoPlayer";
import type { ParentDataHandle } from "./useParentData";

const WEEK_DAYS: TimetableSlot["dayOfWeek"][] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

function safeHref(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return "";
  if (trimmed.startsWith("/")) return trimmed;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === "http:" || parsed.protocol === "https:") {
      return parsed.toString();
    }
  } catch {
    return "";
  }
  return "";
}

export function ParentEnrolledCoursesModule({ data }: { data: ParentDataHandle }) {
  const child = data.activeChild;
  const ws = data.workspace;
  const [search, setSearch] = useState("");
  const [detailCourse, setDetailCourse] = useState<CourseRow | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return child.courses.filter(
      (c) =>
        !q ||
        c.title.toLowerCase().includes(q) ||
        c.short_description.toLowerCase().includes(q) ||
        c.level.toLowerCase().includes(q),
    );
  }, [child.courses, search]);

  if (!child.childId) {
    return (
      <EmptyState
        title="No child selected"
        text="Select a linked child to view enrolled courses."
        icon={BookOpen}
      />
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Enrolled Courses"
        description={`Active courses, instructors, learning objectives, and lesson syllabus for ${child.profile ? displayName(child.profile) : "your child"}.`}
      />

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search enrolled courses…"
          className="pl-9"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title="No enrolled courses found"
          text="Enrolled courses for the selected child appear here."
          icon={BookOpen}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {filtered.map((course) => {
            const lessons = data.maps.lessonsByCourse.get(course.id) ?? [];
            const done = child.progress.filter((p) => p.course_id === course.id).length;
            const pct = lessons.length
              ? Math.min(100, Math.round((done / lessons.length) * 100))
              : 0;
            const materials = (ws?.courseMaterials ?? []).filter(
              (m) => m.courseId === course.id,
            );
            const cat = course.category_id
              ? data.maps.categoriesById.get(course.category_id)?.name
              : "General";

            return (
              <Panel
                key={course.id}
                title={course.title}
                actions={
                  <Badge variant={pct === 100 ? "success" : "outline"}>{course.level}</Badge>
                }
              >
                <div className="flex gap-3">
                  <CourseThumbnail
                    imageUrl={course.image_url}
                    course={course}
                    alt={course.title}
                    className="h-16 w-24 shrink-0 rounded-xl"
                  />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-xs text-muted-foreground">
                      {cat} · Instructor:{" "}
                      <span className="font-semibold text-foreground">
                        {data.maps.resolvePersonName(course.instructor_id, "Ezana Faculty")}
                      </span>
                    </p>
                    <p className="line-clamp-2 text-xs text-muted-foreground">
                      {course.short_description}
                    </p>
                  </div>
                </div>

                <div className="mt-4 space-y-1.5">
                  <div className="flex justify-between text-xs tabular-nums">
                    <span className="text-muted-foreground">
                      {done} of {lessons.length} lessons · {materials.length} shared materials
                    </span>
                    <span className="font-mono font-semibold">{pct}%</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>

                <div className="mt-4 flex justify-end">
                  <Button size="sm" variant="outline" onClick={() => setDetailCourse(course)}>
                    View Syllabus & Materials
                  </Button>
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      <Dialog open={!!detailCourse} onOpenChange={(o) => !o && setDetailCourse(null)}>
        <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
          {detailCourse && (
            <>
              <DialogHeader>
                <DialogTitle>{detailCourse.title}</DialogTitle>
                <DialogDescription>
                  Instructor:{" "}
                  {data.maps.resolvePersonName(detailCourse.instructor_id, "Ezana Faculty")} ·{" "}
                  {detailCourse.level} · {detailCourse.duration_hours} hrs
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 text-sm">
                <p className="text-muted-foreground">{detailCourse.description}</p>
                {detailCourse.objectives.length > 0 && (
                  <div>
                    <h4 className="mb-1.5 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Learning Objectives
                    </h4>
                    <ul className="list-disc space-y-1 pl-5 text-xs text-foreground">
                      {detailCourse.objectives.map((obj, idx) => (
                        <li key={idx}>{obj}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <div>
                  <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Lessons & Completion
                  </h4>
                  <div className="max-h-60 space-y-1.5 overflow-y-auto pr-1">
                    {(data.maps.lessonsByCourse.get(detailCourse.id) ?? []).map((lesson) => {
                      const done = child.completedLessonIdSet.has(lesson.id);
                      return (
                        <div
                          key={lesson.id}
                          className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2 text-xs"
                        >
                          <span className="truncate font-medium">
                            {lesson.position}. {lesson.title}
                          </span>
                          <Badge variant={done ? "success" : "muted"} className="shrink-0">
                            {done ? "Completed" : `${lesson.duration_minutes} min`}
                          </Badge>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDetailCourse(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ParentCourseProgressModule({ data }: { data: ParentDataHandle }) {
  const child = data.activeChild;
  const lessonsById = useMemo(
    () => new Map(data.db.lessons.map((l) => [l.id, l])),
    [data.db.lessons],
  );

  const totalLessons = child.courses.reduce(
    (sum, c) => sum + (data.maps.lessonsByCourse.get(c.id)?.length ?? 0),
    0,
  );
  const completedLessons = child.progress.filter((p) =>
    child.enrolledCourseIdSet.has(p.course_id),
  ).length;
  const overallPct = totalLessons
    ? Math.min(100, Math.round((completedLessons / totalLessons) * 100))
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Course Progress"
        description="Per-course lesson completion metrics, remaining coursework, and recent study activity."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Overall Progress" value={`${overallPct}%`} icon={TrendingUp} index={0} />
        <StatCard
          label="Completed Lessons"
          value={completedLessons}
          icon={CheckCircle2}
          tone="gold"
          index={1}
        />
        <StatCard
          label="Remaining Lessons"
          value={Math.max(0, totalLessons - completedLessons)}
          icon={BookOpen}
          tone="deep"
          index={2}
        />
      </div>

      <Panel title="Course-by-Course Progress">
        {child.courses.length === 0 ? (
          <EmptyState
            title="No enrolled courses"
            text="Course progress will display once the child is enrolled in courses."
            icon={TrendingUp}
          />
        ) : (
          <div className="space-y-4">
            {child.courses.map((course) => {
              const total = data.maps.lessonsByCourse.get(course.id)?.length ?? 0;
              const done = child.progress.filter((p) => p.course_id === course.id).length;
              const remaining = Math.max(0, total - done);
              const pct = total ? Math.min(100, Math.round((done / total) * 100)) : 0;
              return (
                <div
                  key={course.id}
                  className="rounded-xl border border-border p-4 space-y-2 tabular-nums"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold">{course.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {done} completed · {remaining} remaining · Instructor:{" "}
                        {data.maps.resolvePersonName(course.instructor_id, "Ezana Faculty")}
                      </p>
                    </div>
                    <Badge variant={pct === 100 ? "success" : "gold"}>{pct}%</Badge>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Panel title="Recent Study Activity">
        {child.progress.length === 0 ? (
          <p className="text-sm text-muted-foreground">No completed lesson timestamps recorded yet.</p>
        ) : (
          <div className="divide-y divide-border">
            {child.progress.slice(0, 12).map((p) => {
              const lesson = lessonsById.get(p.lesson_id);
              const course = data.maps.coursesById.get(p.course_id);
              return (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate font-semibold">
                      {lesson?.title ?? "Completed Lesson"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {course?.title ?? "Course"}
                    </p>
                  </div>
                  <span className="shrink-0 font-mono text-xs text-muted-foreground tabular-nums">
                    {formatCompactDate(p.completed_at)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}

export function ParentTimetablesModule({ data }: { data: ParentDataHandle }) {
  const child = data.activeChild;
  const ws = data.workspace;
  const [selectedDay, setSelectedDay] = useState<string>("all");

  const childSlots = useMemo(
    () =>
      (ws?.timetables ?? []).filter(
        (t) =>
          (t.courseId !== null && child.enrolledCourseIdSet.has(t.courseId)) ||
          (t.classSectionId !== null && child.assignedClassIdSet.has(t.classSectionId)),
      ),
    [child.assignedClassIdSet, child.enrolledCourseIdSet, ws?.timetables],
  );

  const visibleSlots = useMemo(
    () =>
      selectedDay === "all"
        ? childSlots
        : childSlots.filter((s) => s.dayOfWeek === selectedDay),
    [childSlots, selectedDay],
  );

  const upcomingLives = useMemo(
    () =>
      (ws?.liveClasses ?? []).filter(
        (lc) =>
          lc.status !== "cancelled" &&
          (child.enrolledCourseIdSet.has(lc.courseId) ||
            (lc.classSectionId !== null && child.assignedClassIdSet.has(lc.classSectionId)) ||
            lc.participantIds.includes(child.childId)),
      ),
    [child, ws?.liveClasses],
  );

  const upcomingExams = useMemo(
    () =>
      (ws?.exams ?? []).filter(
        (ex) =>
          child.enrolledCourseIdSet.has(ex.courseId) ||
          (ex.classSectionId !== null &&
            ex.classSectionId !== undefined &&
            child.assignedClassIdSet.has(ex.classSectionId)),
      ),
    [child.assignedClassIdSet, child.enrolledCourseIdSet, ws?.exams],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timetables & Scheduling"
        description="Weekly class timetable, live sessions, rooms, instructors, and upcoming exam dates."
        actions={
          <select
            aria-label="Filter timetable day"
            value={selectedDay}
            onChange={(e) => setSelectedDay(e.target.value)}
            className="h-9 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold"
          >
            <option value="all">Full Weekly View</option>
            {WEEK_DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        }
      />

      <Panel title="Weekly Class Schedule">
        {visibleSlots.length === 0 ? (
          <EmptyState
            title="No timetable slots published"
            text="Scheduled weekly sessions for your child's classes and courses appear here."
            icon={CalendarClock}
          />
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {visibleSlots.map((slot) => (
              <div
                key={slot.id}
                className="flex flex-col justify-between rounded-xl border border-border p-4"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <Badge variant="outline">{slot.dayOfWeek}</Badge>
                    <span className="font-mono text-xs font-semibold tabular-nums">
                      {slot.startTime}–{slot.endTime}
                    </span>
                  </div>
                  <p className="mt-2 font-semibold">{slot.title}</p>
                  <p className="text-xs text-muted-foreground">
                    {slot.courseId ? data.maps.coursesById.get(slot.courseId)?.title : "Class Session"}{" "}
                    · Room: {slot.room || "Online"}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Instructor: {data.maps.resolvePersonName(slot.instructorId, "Faculty")}
                  </p>
                </div>
                <div className="mt-2">
                  <Badge variant="secondary" className="text-[10px]">
                    {slot.sessionType.replace("_", " ")}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Live Class Sessions">
          {upcomingLives.length === 0 ? (
            <p className="text-sm text-muted-foreground">No scheduled live classes.</p>
          ) : (
            <div className="space-y-2.5">
              {upcomingLives.map((lc) => (
                <div
                  key={lc.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{lc.title}</p>
                    <p className="truncate text-xs text-muted-foreground tabular-nums">
                      {lc.scheduledDate} · {lc.startTime}–{lc.endTime} ·{" "}
                      {data.maps.resolvePersonName(lc.instructorId, "Instructor")}
                    </p>
                  </div>
                  <Badge variant={lc.status === "live" ? "success" : "outline"}>
                    {lc.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Scheduled Examinations">
          {upcomingExams.length === 0 ? (
            <p className="text-sm text-muted-foreground">No upcoming examinations scheduled.</p>
          ) : (
            <div className="space-y-2.5">
              {upcomingExams.map((ex) => (
                <div
                  key={ex.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold">{ex.title}</p>
                    <p className="truncate text-xs text-muted-foreground tabular-nums">
                      {data.maps.coursesById.get(ex.courseId)?.title ?? "Course"} ·{" "}
                      {ex.scheduledDate} {ex.startTime}
                    </p>
                  </div>
                  <Badge variant={ex.status === "completed" ? "success" : "gold"}>
                    {ex.status}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

export function ParentAttendanceModule({ data }: { data: ParentDataHandle }) {
  const child = data.activeChild;
  const ws = data.workspace;
  const [courseFilter, setCourseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [disputeTargetId, setDisputeTargetId] = useState<string | null>(null);
  const [disputeReason, setDisputeReason] = useState("");

  const filtered = useMemo(
    () =>
      child.attendance.filter(
        (a) =>
          (courseFilter === "all" || a.courseId === courseFilter) &&
          (statusFilter === "all" || a.status === statusFilter),
      ),
    [child.attendance, courseFilter, statusFilter],
  );

  const paged = paginateRows(filtered, page, 12);

  const summary = useMemo(() => {
    const present = child.attendance.filter((a) => a.status === "present").length;
    const late = child.attendance.filter((a) => a.status === "late").length;
    const absent = child.attendance.filter((a) => a.status === "absent").length;
    const excused = child.attendance.filter((a) => a.status === "excused").length;
    const total = child.attendance.length;
    const rate = total ? Math.round(((present + late) / total) * 100) : null;
    return { present, late, absent, excused, total, rate };
  }, [child.attendance]);

  const childDisputes = useMemo(
    () => (ws?.attendanceDisputes ?? []).filter((d) => d.studentId === child.childId),
    [child.childId, ws?.attendanceDisputes],
  );

  async function submitDispute(e: React.FormEvent) {
    e.preventDefault();
    if (!disputeTargetId || !disputeReason.trim() || !child.childId) return;
    const entry = child.attendance.find((a) => a.id === disputeTargetId);
    if (!entry) return;
    await data.mutateWorkspace(
      {
        type: "report_attendance_discrepancy",
        payload: {
          attendanceId: entry.id,
          studentId: child.childId,
          courseId: entry.courseId,
          date: entry.date,
          reason: disputeReason.trim(),
        },
      },
      "Attendance discrepancy inquiry submitted to instructor/admin",
    );
    setDisputeReason("");
    setDisputeTargetId(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Tracking"
        description="Daily attendance logs, summary rates, absence tracking, and discrepancy reporting."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Attendance Rate"
          value={summary.rate !== null ? `${summary.rate}%` : "N/A"}
          icon={CalendarDays}
          hint={`${summary.total} logged sessions`}
          index={0}
        />
        <StatCard label="Present" value={summary.present} icon={CheckCircle2} tone="gold" index={1} />
        <StatCard label="Late / Excused" value={summary.late + summary.excused} icon={CalendarClock} tone="deep" index={2} />
        <StatCard label="Absences" value={summary.absent} icon={AlertTriangle} tone="plain" index={3} />
      </div>

      <Panel
        title="Attendance Log"
        actions={
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Filter by course"
              value={courseFilter}
              onChange={(e) => {
                setCourseFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
            >
              <option value="all">All Courses</option>
              {child.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by attendance status"
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
            >
              <option value="all">All Statuses</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
              <option value="late">Late</option>
              <option value="excused">Excused</option>
            </select>
          </div>
        }
      >
        {paged.items.length === 0 ? (
          <EmptyState
            title="No attendance records match"
            text="Attendance entries recorded by instructors appear here."
            icon={CalendarDays}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Course</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Notes</th>
                    <th className="py-2 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border tabular-nums">
                  {paged.items.map((a) => (
                    <tr key={a.id} className="hover:bg-secondary/30">
                      <td className="py-2.5 pr-4 font-mono text-xs">{a.date}</td>
                      <td className="py-2.5 pr-4 font-medium">
                        {a.courseId
                          ? data.maps.coursesById.get(a.courseId)?.title ?? "Course"
                          : "Homeroom"}
                      </td>
                      <td className="py-2.5 pr-4">
                        <Badge
                          variant={
                            STATUS_BADGE[a.status] ??
                            (a.status === "present"
                              ? "success"
                              : a.status === "absent"
                                ? "destructive"
                                : "gold")
                          }
                        >
                          {a.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 pr-4 text-xs text-muted-foreground">
                        {a.notes || "—"}
                      </td>
                      <td className="py-2.5 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => setDisputeTargetId(a.id)}
                        >
                          Report Discrepancy
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager
              page={paged.page}
              pageCount={paged.pageCount}
              onPage={setPage}
            />
          </>
        )}
      </Panel>

      {childDisputes.length > 0 && (
        <Panel title="Submitted Attendance Inquiries">
          <div className="divide-y divide-border">
            {childDisputes.map((d) => (
              <div
                key={d.id}
                className="flex items-center justify-between gap-3 py-2.5 text-sm first:pt-0 last:pb-0"
              >
                <div>
                  <p className="font-semibold font-mono text-xs">{d.date}</p>
                  <p className="text-xs text-muted-foreground">{d.reason}</p>
                </div>
                <Badge variant={d.status === "resolved" ? "success" : "gold"}>{d.status}</Badge>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Dialog open={!!disputeTargetId} onOpenChange={(o) => !o && setDisputeTargetId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Attendance Discrepancy</DialogTitle>
            <DialogDescription>
              Notify the course instructor and administration if an attendance mark appears
              incorrect.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void submitDispute(e)} className="space-y-3">
            <Textarea
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Explain why this attendance date or status needs review…"
              rows={3}
              required
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDisputeTargetId(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="emerald" disabled={data.mutating}>
                Submit Inquiry
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function ParentGradesModule({ data }: { data: ParentDataHandle }) {
  const child = data.activeChild;
  const ws = data.workspace;
  const [courseFilter, setCourseFilter] = useState("all");
  const [termFilter, setTermFilter] = useState("all");
  const defaultScale = ws?.gradingScales.find((s) => s.isDefault) ?? ws?.gradingScales[0];
  const childName = child.profile ? displayName(child.profile) : "Student";

  const filtered = useMemo(
    () =>
      child.grades.filter(
        (g) =>
          (courseFilter === "all" || g.courseId === courseFilter) &&
          (termFilter === "all" || g.termId === termFilter),
      ),
    [child.grades, courseFilter, termFilter],
  );

  const avgPct = filtered.length
    ? Math.round(
        filtered.reduce((s, g) => s + (g.maxScore > 0 ? (g.score / g.maxScore) * 100 : 0), 0) /
          filtered.length,
      )
    : 0;
  const overallBand = defaultScale && filtered.length ? resolveGradeBand(avgPct, defaultScale) : null;

  function exportCsv() {
    downloadCsv(
      `grades-${child.meta?.studentCode ?? "child"}.csv`,
      filtered.map((g) => {
        const pct = g.maxScore > 0 ? Math.round((g.score / g.maxScore) * 100) : 0;
        const band = defaultScale ? resolveGradeBand(pct, defaultScale) : null;
        return {
          Course: data.maps.coursesById.get(g.courseId)?.title ?? "Course",
          Assessment: g.assessmentTitle,
          Type: g.assessmentType,
          Score: g.score,
          "Max Score": g.maxScore,
          Percent: `${pct}%`,
          Letter: band?.letter ?? "—",
          Remarks: g.remarks,
        };
      }),
    );
  }

  function printReportCard() {
    data.setPrintable({
      title: `Official Academic Report Card — ${childName}`,
      subtitle: `${child.meta?.studentCode ?? "Student"} · Overall Average: ${filtered.length ? `${avgPct}% (${overallBand?.letter ?? "—"})` : "Pending"}`,
      columns: ["Course", "Assessment", "Type", "Score", "Percent", "Grade", "Remarks"],
      rows: filtered.map((g) => {
        const pct = g.maxScore > 0 ? Math.round((g.score / g.maxScore) * 100) : 0;
        const band = defaultScale ? resolveGradeBand(pct, defaultScale) : null;
        return [
          data.maps.coursesById.get(g.courseId)?.title ?? "Course",
          g.assessmentTitle,
          g.assessmentType,
          `${g.score}/${g.maxScore}`,
          `${pct}%`,
          band?.letter ?? "—",
          g.remarks || band?.remark || "—",
        ];
      }),
      footerNote: `Class: ${child.classSection?.name ?? "Unassigned"} · Parent/Guardian View`,
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Grades & Report Cards"
        description="Official course grades, percentages, letter scales, remarks, and printable report cards."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={exportCsv} disabled={!filtered.length}>
              <Download className="h-4 w-4" />
              Export CSV
            </Button>
            <Button
              variant="emerald"
              size="sm"
              onClick={printReportCard}
              disabled={!filtered.length}
            >
              <Printer className="h-4 w-4" />
              Print Report Card
            </Button>
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Cumulative Average"
          value={filtered.length ? `${avgPct}%` : "N/A"}
          icon={FileSpreadsheet}
          hint={overallBand ? `${overallBand.letter} · ${overallBand.remark}` : "No grades released"}
          index={0}
        />
        <StatCard
          label="Graded Items"
          value={filtered.length}
          icon={ClipboardCheck}
          tone="gold"
          index={1}
        />
        <StatCard
          label="GPA Equivalent"
          value={overallBand ? overallBand.gpa.toFixed(1) : "—"}
          icon={Award}
          tone="deep"
          index={2}
        />
      </div>

      <Panel
        title="Grade Breakdown"
        actions={
          <div className="flex flex-wrap gap-2">
            <select
              aria-label="Filter by course"
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
            >
              <option value="all">All Courses</option>
              {child.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <select
              aria-label="Filter by term"
              value={termFilter}
              onChange={(e) => setTermFilter(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-2 text-xs"
            >
              <option value="all">All Terms</option>
              {(ws?.terms ?? []).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>
          </div>
        }
      >
        {filtered.length === 0 ? (
          <EmptyState
            title="No grades recorded yet"
            text="Released assignment, quiz, and examination grades appear here."
            icon={FileSpreadsheet}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">Course</th>
                  <th className="py-2 pr-4">Assessment</th>
                  <th className="py-2 pr-4">Type</th>
                  <th className="py-2 pr-4 text-right">Score</th>
                  <th className="py-2 pr-4 text-right">Grade</th>
                  <th className="py-2">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border tabular-nums">
                {filtered.map((g) => {
                  const pct = g.maxScore > 0 ? Math.round((g.score / g.maxScore) * 100) : 0;
                  const band = defaultScale ? resolveGradeBand(pct, defaultScale) : null;
                  return (
                    <tr key={g.id} className="hover:bg-secondary/30">
                      <td className="py-2.5 pr-4 font-semibold">
                        {data.maps.coursesById.get(g.courseId)?.title ?? "Course"}
                      </td>
                      <td className="py-2.5 pr-4">{g.assessmentTitle}</td>
                      <td className="py-2.5 pr-4 capitalize text-xs text-muted-foreground">
                        {g.assessmentType}
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono">
                        {g.score}/{g.maxScore} ({pct}%)
                      </td>
                      <td className="py-2.5 pr-4 text-right">
                        <Badge variant={pct >= 75 ? "success" : pct >= 60 ? "gold" : "destructive"}>
                          {band?.letter ?? `${pct}%`}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-xs text-muted-foreground">
                        {g.remarks || band?.remark || "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

export function ParentAssignmentsExamsModule({ data }: { data: ParentDataHandle }) {
  const child = data.activeChild;
  const ws = data.workspace;
  const [filterCourse, setFilterCourse] = useState("all");

  const assignments = useMemo(
    () =>
      (ws?.assignments ?? []).filter(
        (a) =>
          (filterCourse === "all" || a.courseId === filterCourse) &&
          (child.enrolledCourseIdSet.has(a.courseId) ||
            (a.classSectionId !== null && child.assignedClassIdSet.has(a.classSectionId))),
      ),
    [child.assignedClassIdSet, child.enrolledCourseIdSet, filterCourse, ws?.assignments],
  );

  const exams = useMemo(
    () =>
      (ws?.exams ?? []).filter(
        (ex) =>
          (filterCourse === "all" || ex.courseId === filterCourse) &&
          (child.enrolledCourseIdSet.has(ex.courseId) ||
            (ex.classSectionId !== null &&
              ex.classSectionId !== undefined &&
              child.assignedClassIdSet.has(ex.classSectionId))),
      ),
    [child.assignedClassIdSet, child.enrolledCourseIdSet, filterCourse, ws?.exams],
  );

  const subByAsg = useMemo(
    () => new Map(child.assignmentSubmissions.map((s) => [s.assignmentId, s])),
    [child.assignmentSubmissions],
  );
  const subByExam = useMemo(
    () => new Map(child.examSubmissions.map((s) => [s.examId, s])),
    [child.examSubmissions],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Assignments & Exams"
        description="Monitor due dates, submission statuses, late/pending flags, and instructor evaluation notes."
        actions={
          <select
            aria-label="Filter assignments by course"
            value={filterCourse}
            onChange={(e) => setFilterCourse(e.target.value)}
            className="h-9 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold"
          >
            <option value="all">All Courses</option>
            {child.courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={`Assignments (${assignments.length})`}>
          {assignments.length === 0 ? (
            <EmptyState
              title="No assignments posted"
              text="Published course assignments for your child appear here."
              icon={ClipboardCheck}
            />
          ) : (
            <div className="space-y-3">
              {assignments.map((a) => {
                const sub = subByAsg.get(a.id);
                const status = sub?.status ?? "pending";
                return (
                  <div key={a.id} className="rounded-xl border border-border p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-sm">{a.title}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {data.maps.coursesById.get(a.courseId)?.title ?? "Course"} · Due{" "}
                          {a.dueDate || "Open"} · Max {a.maxScore} pts
                        </p>
                      </div>
                      <Badge
                        variant={
                          status === "graded"
                            ? "success"
                            : status === "late" || status === "returned"
                              ? "destructive"
                              : status === "submitted"
                                ? "default"
                                : "gold"
                        }
                      >
                        {status}
                      </Badge>
                    </div>
                    {sub?.feedback && (
                      <p className="mt-2 rounded-lg bg-secondary/50 px-2.5 py-1.5 text-xs text-foreground">
                        Instructor note: {sub.feedback}
                      </p>
                    )}
                    {sub?.score !== null && sub?.score !== undefined && (
                      <p className="mt-1.5 font-mono text-xs font-semibold text-emerald-700 tabular-nums">
                        Score: {sub.score}/{a.maxScore}
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title={`Scheduled & Active Exams (${exams.length})`}>
          {exams.length === 0 ? (
            <EmptyState
              title="No exams or quizzes scheduled"
              text="Upcoming and active examinations appear here."
              icon={FileCheck2}
            />
          ) : (
            <div className="space-y-3">
              {exams.map((ex) => {
                const sub = subByExam.get(ex.id);
                return (
                  <div key={ex.id} className="rounded-xl border border-border p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate font-semibold text-sm">{ex.title}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {data.maps.coursesById.get(ex.courseId)?.title ?? "Course"} ·{" "}
                          {ex.scheduledDate} {ex.startTime} · {ex.durationMinutes} min
                        </p>
                      </div>
                      <Badge
                        variant={
                          sub?.status === "graded"
                            ? "success"
                            : sub?.status === "submitted"
                              ? "default"
                              : "gold"
                        }
                      >
                        {sub?.status ?? ex.status}
                      </Badge>
                    </div>
                    {sub?.status === "graded" && (
                      <p className="mt-2 font-mono text-xs font-semibold tabular-nums">
                        Score: {sub.score}/{ex.maxScore} (Pass: {ex.passingScore})
                      </p>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

export function ParentExamResultsModule({ data }: { data: ParentDataHandle }) {
  const child = data.activeChild;
  const ws = data.workspace;
  const childName = child.profile ? displayName(child.profile) : "Student";
  const examById = useMemo(() => new Map((ws?.exams ?? []).map((ex) => [ex.id, ex])), [ws?.exams]);

  const released = useMemo(
    () =>
      child.examSubmissions
        .filter((s) => s.status === "graded")
        .map((sub) => {
          const exam = examById.get(sub.examId);
          const maxScore = exam?.maxScore ?? 100;
          const passingScore = exam?.passingScore ?? 50;
          const pct = maxScore > 0 ? Math.round((sub.score / maxScore) * 100) : 0;
          return {
            sub,
            exam,
            pct,
            passed: sub.score >= passingScore,
          };
        }),
    [child.examSubmissions, examById],
  );

  function printResults() {
    data.setPrintable({
      title: `Examination Results — ${childName}`,
      subtitle: `${child.meta?.studentCode ?? "Student"} · Released Assessment Transcript`,
      columns: ["Exam", "Course", "Date", "Score", "Percent", "Outcome", "Remarks"],
      rows: released.map(({ sub, exam, pct, passed }) => [
        exam?.title ?? "Examination",
        exam ? data.maps.coursesById.get(exam.courseId)?.title ?? "Course" : "Course",
        exam?.scheduledDate ?? formatCompactDate(sub.gradedAt ?? ""),
        `${sub.score}/${exam?.maxScore ?? 100}`,
        `${pct}%`,
        passed ? "Passed" : "Needs Support",
        sub.feedback || "—",
      ]),
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Examination Results"
        description="Released quiz and exam results with pass indicators and instructor feedback."
        actions={
          <Button variant="emerald" size="sm" onClick={printResults} disabled={!released.length}>
            <Printer className="h-4 w-4" />
            Print Exam Results
          </Button>
        }
      />

      <Panel title="Published Exam Scores">
        {released.length === 0 ? (
          <EmptyState
            title="No released examination results"
            text="Completed and graded exam results for your child will display here."
            icon={FileCheck2}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">Exam</th>
                  <th className="py-2 pr-4">Course</th>
                  <th className="py-2 pr-4">Date</th>
                  <th className="py-2 pr-4 text-right">Score</th>
                  <th className="py-2 pr-4 text-right">Status</th>
                  <th className="py-2">Feedback</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border tabular-nums">
                {released.map(({ sub, exam, pct, passed }) => (
                  <tr key={sub.id} className="hover:bg-secondary/30">
                    <td className="py-2.5 pr-4 font-semibold">{exam?.title ?? "Assessment"}</td>
                    <td className="py-2.5 pr-4 text-muted-foreground">
                      {exam ? data.maps.coursesById.get(exam.courseId)?.title ?? "Course" : "—"}
                    </td>
                    <td className="py-2.5 pr-4 font-mono text-xs">{exam?.scheduledDate ?? "—"}</td>
                    <td className="py-2.5 pr-4 text-right font-mono">
                      {sub.score}/{exam?.maxScore ?? 100} ({pct}%)
                    </td>
                    <td className="py-2.5 pr-4 text-right">
                      <Badge variant={passed ? "success" : "destructive"}>
                        {passed ? "Passed" : "Needs Support"}
                      </Badge>
                    </td>
                    <td className="py-2.5 text-xs text-muted-foreground">
                      {sub.feedback || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

export function ParentLearningProgressModule({ data }: { data: ParentDataHandle }) {
  const child = data.activeChild;
  const ws = data.workspace;

  const insights = useMemo(() => {
    return child.courses.map((course) => {
      const totalLessons = data.maps.lessonsByCourse.get(course.id)?.length ?? 0;
      const completedLessons = child.progress.filter((p) => p.course_id === course.id).length;
      const lessonPct = totalLessons
        ? Math.min(100, Math.round((completedLessons / totalLessons) * 100))
        : 0;
      const courseGrades = child.grades.filter((g) => g.courseId === course.id);
      const gradeAvg = courseGrades.length
        ? Math.round(
            courseGrades.reduce(
              (s, g) => s + (g.maxScore > 0 ? (g.score / g.maxScore) * 100 : 0),
              0,
            ) / courseGrades.length,
          )
        : null;
      const pendingTasks = (ws?.assignments ?? []).filter(
        (a) =>
          a.courseId === course.id &&
          a.status === "published" &&
          !child.assignmentSubmissions.some(
            (s) =>
              s.assignmentId === a.id && (s.status === "submitted" || s.status === "graded"),
          ),
      ).length;
      const needsSupport = (gradeAvg !== null && gradeAvg < 65) || (totalLessons > 0 && lessonPct < 25);
      return { course, totalLessons, completedLessons, lessonPct, gradeAvg, pendingTasks, needsSupport };
    });
  }, [child, data.maps.lessonsByCourse, ws?.assignments]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Learning Progress"
        description="Holistic academic momentum across lessons, assessments, and subjects needing extra support."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Active Courses" value={child.courses.length} icon={BarChart3} index={0} />
        <StatCard
          label="Completed Certificates"
          value={child.certificates.length}
          icon={Award}
          tone="gold"
          index={1}
        />
        <StatCard
          label="Need Extra Support"
          value={insights.filter((i) => i.needsSupport).length}
          icon={AlertTriangle}
          tone="deep"
          index={2}
        />
      </div>

      <Panel title="Subject & Course Momentum">
        {insights.length === 0 ? (
          <EmptyState
            title="No courses to analyze yet"
            text="Once the selected child enrolls in courses, progress milestones appear here."
            icon={BarChart3}
          />
        ) : (
          <div className="space-y-4">
            {insights.map((row) => (
              <div key={row.course.id} className="rounded-xl border border-border p-4 tabular-nums">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{row.course.title}</p>
                    <p className="text-xs text-muted-foreground">
                      Lessons: {row.completedLessons}/{row.totalLessons} ({row.lessonPct}%) ·
                      Grade Avg: {row.gradeAvg !== null ? `${row.gradeAvg}%` : "N/A"} · Pending
                      Tasks: {row.pendingTasks}
                    </p>
                  </div>
                  <Badge variant={row.needsSupport ? "destructive" : "success"}>
                    {row.needsSupport ? "Needs Support" : "On Track"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

export function ParentCertificatesModule({ data }: { data: ParentDataHandle }) {
  const child = data.activeChild;
  const ws = data.workspace;
  const childName = child.profile ? displayName(child.profile) : "Student";

  function printCert(certId: string) {
    const cert = child.certificates.find((c) => c.id === certId);
    if (!cert) return;
    const template = ws?.certificateTemplates.find((t) => t.id === cert.templateId);
    const courseTitle = data.maps.coursesById.get(cert.courseId)?.title ?? "Course Program";
    data.setPrintable({
      title: `${template?.title ?? "Certificate of Completion"} — ${childName}`,
      subtitle: `${template?.subtitle ?? "Ezana Academy"} · Code: ${cert.certificateCode}`,
      columns: ["Student", "Course", "Final Grade", "Completion", "Issued Date", "Verification"],
      rows: [
        [
          childName,
          courseTitle,
          cert.finalGrade || "Pass",
          `${cert.completionPercent}%`,
          formatCompactDate(cert.issuedAt),
          cert.certificateCode,
        ],
      ],
      footerNote: `${template?.bodyText ?? ""} · Signed by ${template?.signatoryName ?? "Ezana Academy"}`,
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Certificates & Achievements"
        description="Official course completion certificates, grades, and printable verification records."
      />

      {child.certificates.length === 0 ? (
        <EmptyState
          title="No certificates issued yet"
          text="Official completion certificates awarded to the selected child appear here."
          icon={Award}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {child.certificates.map((cert) => {
            const course = data.maps.coursesById.get(cert.courseId);
            return (
              <Panel
                key={cert.id}
                title={course?.title ?? "Completed Course"}
                actions={
                  <Badge variant={cert.status === "issued" ? "success" : "destructive"}>
                    {cert.status}
                  </Badge>
                }
              >
                <div className="space-y-2 text-sm tabular-nums">
                  <p className="text-xs text-muted-foreground">
                    Verification Code:{" "}
                    <span className="font-mono font-bold text-foreground">
                      {cert.certificateCode}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Completion: {cert.completionPercent}% · Final Grade:{" "}
                    {cert.finalGrade || "Passed"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Issued: {formatCompactDate(cert.issuedAt)}
                  </p>
                </div>
                <div className="mt-4 flex justify-end">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => printCert(cert.id)}
                    disabled={cert.status !== "issued"}
                  >
                    <Printer className="h-3.5 w-3.5" />
                    Print Certificate
                  </Button>
                </div>
              </Panel>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ParentResourcesModule({ data }: { data: ParentDataHandle }) {
  const ws = data.workspace;
  const child = data.activeChild;
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [previewResource, setPreviewResource] = useState<LearningResource | null>(null);

  const visibleResources = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (ws?.resources ?? []).filter((r) => {
      const courseMatch =
        !r.courseId ||
        child.enrolledCourseIdSet.has(r.courseId) ||
        r.accessLevel === "public";
      const typeMatch = typeFilter === "all" || r.type === typeFilter;
      const textMatch =
        !q ||
        r.title.toLowerCase().includes(q) ||
        r.description.toLowerCase().includes(q);
      return courseMatch && typeMatch && textMatch;
    });
  }, [child.enrolledCourseIdSet, search, typeFilter, ws?.resources]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="E-Learning Resources"
        description="Approved study materials, videos, documents, and subject references supporting your child."
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search study resources…"
            className="pl-9"
          />
        </div>
        <select
          aria-label="Filter resource type"
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="h-10 rounded-lg border border-border bg-card px-3 text-xs font-semibold"
        >
          <option value="all">All Types</option>
          <option value="video">Video</option>
          <option value="pdf">PDF</option>
          <option value="document">Document</option>
          <option value="presentation">Presentation</option>
          <option value="link">Link</option>
        </select>
      </div>

      {visibleResources.length === 0 ? (
        <EmptyState
          title="No e-learning resources available"
          text="Approved study resources for your child's enrolled courses appear here."
          icon={Library}
        />
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {visibleResources.map((r) => {
            const href = safeHref(r.url);
            return (
              <Panel
                key={r.id}
                title={r.title}
                actions={<Badge variant="outline">{r.type}</Badge>}
              >
                <p className="text-xs text-muted-foreground">
                  {r.courseId
                    ? data.maps.coursesById.get(r.courseId)?.title ?? "Course Resource"
                    : "General Academy Resource"}{" "}
                  · {r.fileSizeLabel || r.accessLevel}
                </p>
                {r.description && (
                  <p className="mt-2 line-clamp-2 text-xs text-foreground/85">{r.description}</p>
                )}
                <div className="mt-4 flex flex-wrap gap-2">
                  {r.type === "video" && href ? (
                    <Button size="sm" variant="emerald" onClick={() => setPreviewResource(r)}>
                      <Film className="h-3.5 w-3.5" />
                      Watch Video
                    </Button>
                  ) : href ? (
                    <Button size="sm" variant="outline" asChild>
                      <a href={href} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-3.5 w-3.5" />
                        Open Resource
                      </a>
                    </Button>
                  ) : null}
                </div>
              </Panel>
            );
          })}
        </div>
      )}

      <Dialog open={!!previewResource} onOpenChange={(o) => !o && setPreviewResource(null)}>
        <DialogContent className="max-w-3xl">
          {previewResource && (
            <>
              <DialogHeader>
                <DialogTitle>{previewResource.title}</DialogTitle>
                <DialogDescription>{previewResource.description}</DialogDescription>
              </DialogHeader>
              <VideoPlayer
                url={previewResource.url}
                title={previewResource.title}
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setPreviewResource(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
