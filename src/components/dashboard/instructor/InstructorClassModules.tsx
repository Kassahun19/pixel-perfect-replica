import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertTriangle,
  ArrowDownToLine,
  CalendarClock,
  ClipboardCheck,
  ExternalLink,
  FolderTree,
  GraduationCap,
  Play,
  Plus,
  Printer,
  Search,
  Square,
  Trash2,
  Users,
  Video,
} from "lucide-react";
import { displayName, useAuth } from "@/lib/auth";
import { downloadExcelXls } from "@/lib/export";
import {
  computeAttendanceStats,
  computeGradeOutcome,
  detectTimetableConflicts,
  paginateRows,
} from "@/lib/owner/logic";
import type {
  AttendanceRecord,
  AttendanceStatus,
  ClassSection,
  LiveClassSession,
  ProfileRow,
  TimetableSlot,
} from "@/lib/owner/types";
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ConfirmButton,
  EmptyState,
  PageHeader,
  Pager,
  Panel,
  STATUS_BADGE,
  StatCard,
} from "@/components/dashboard/ui";
import type { InstructorDataHandle } from "./useInstructorData";

function safeUrl(raw: string): string {
  const t = raw.trim();
  if (!t) return "";
  try {
    const u = new URL(t);
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
  } catch {
    return "";
  }
  return "";
}

/* ========================================================================== */
/* MY CLASSES                                                                 */
/* ========================================================================== */

export function InstructorClassesModule({ data }: { data: InstructorDataHandle }) {
  const { db, workspace, maps } = data;
  const [search, setSearch] = useState("");
  const [selectedClass, setSelectedClass] = useState<ClassSection | null>(null);

  const classes = useMemo(() => {
    return (workspace?.classes ?? []).filter((c) => {
      if (!search.trim()) return true;
      return `${c.name} ${c.sectionCode} ${c.room}`
        .toLowerCase()
        .includes(search.trim().toLowerCase());
    });
  }, [workspace?.classes, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Classes"
        description="Manage assigned classes and sections, monitor cohort schedules, attendance rates, and student performance."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Assigned Classes" value={classes.length} icon={FolderTree} index={0} />
        <StatCard
          label="Students in Classes"
          value={new Set(classes.flatMap((c) => c.studentIds)).size}
          icon={Users}
          tone="gold"
          index={1}
        />
        <StatCard
          label="Weekly Sessions"
          value={(workspace?.timetables ?? []).length}
          icon={CalendarClock}
          tone="deep"
          index={2}
        />
      </div>

      <Panel
        title="Assigned Classes & Sections"
        actions={
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Filter class or room…"
            className="h-9 w-48 text-xs"
          />
        }
      >
        {classes.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2">
            {classes.map((cls) => {
              const slots = (workspace?.timetables ?? []).filter((t) => t.classSectionId === cls.id);
              const att = computeAttendanceStats(
                (workspace?.attendance ?? []).filter(
                  (a) => a.personType === "student" && a.classSectionId === cls.id,
                ),
              );
              const year = (workspace?.academicYears ?? []).find((y) => y.id === cls.academicYearId);
              return (
                <div key={cls.id} className="rounded-2xl border border-border p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h3 className="font-display text-base font-semibold">{cls.name}</h3>
                      <p className="text-xs text-muted-foreground">
                        Section {cls.sectionCode} · {year?.name ?? "Academic Year"} ·{" "}
                        {cls.room || "Online"}
                      </p>
                    </div>
                    <Badge variant="outline">
                      {cls.studentIds.length}/{cls.capacity}
                    </Badge>
                  </div>
                  <div className="grid grid-cols-2 gap-2 rounded-xl bg-secondary/45 p-3 text-xs">
                    <div>
                      <p className="text-muted-foreground">Class Attendance</p>
                      <p className="font-semibold">
                        {att.total > 0 ? `${att.attendanceRate}%` : "No logs"}
                      </p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Timetable Slots</p>
                      <p className="font-semibold">{slots.length} weekly</p>
                    </div>
                  </div>
                  <div className="flex justify-end">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setSelectedClass(cls)}
                    >
                      View Class Roster & Schedule
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No classes assigned yet"
            text="Classes and cohort sections assigned to your account or courses will appear here."
            icon={FolderTree}
          />
        )}
      </Panel>

      <Dialog open={!!selectedClass} onOpenChange={(o) => !o && setSelectedClass(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>{selectedClass?.name}</DialogTitle>
            <DialogDescription>
              Section {selectedClass?.sectionCode} · Room: {selectedClass?.room || "Online"}
            </DialogDescription>
          </DialogHeader>
          {selectedClass && (
            <div className="space-y-4">
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Enrolled Students ({selectedClass.studentIds.length})
                </p>
                {selectedClass.studentIds.length > 0 ? (
                  <div className="max-h-56 space-y-1.5 overflow-y-auto">
                    {selectedClass.studentIds.map((sid) => {
                      const stu = maps.profilesById.get(sid);
                      const completed = db.progress.filter((p) => p.user_id === sid).length;
                      return (
                        <div
                          key={sid}
                          className="flex items-center justify-between rounded-lg border border-border px-3 py-2 text-xs"
                        >
                          <span className="font-medium">
                            {stu ? displayName(stu) : "Student"} ({stu?.email ?? "—"})
                          </span>
                          <span className="text-muted-foreground">{completed} lessons completed</span>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">No students assigned to this section yet.</p>
                )}
              </div>
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Class Schedule
                </p>
                {(workspace?.timetables ?? [])
                  .filter((t) => t.classSectionId === selectedClass.id)
                  .map((slot) => (
                    <div
                      key={slot.id}
                      className="flex items-center justify-between rounded-lg bg-secondary/45 px-3 py-2 text-xs mb-1.5"
                    >
                      <span className="font-medium">{slot.title}</span>
                      <span>
                        {slot.dayOfWeek} · {slot.startTime}–{slot.endTime}
                      </span>
                    </div>
                  ))}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ========================================================================== */
/* MY STUDENTS & STUDENT RECORDS                                              */
/* ========================================================================== */

export function InstructorStudentsModule({
  data,
  mode = "students",
}: {
  data: InstructorDataHandle;
  mode?: "students" | "records";
}) {
  const { db, workspace, maps, mutateWorkspace, can } = data;
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [detailStudent, setDetailStudent] = useState<ProfileRow | null>(null);
  const [notesDraft, setNotesDraft] = useState("");

  const scale = workspace?.gradingScales.find((s) => s.isDefault) ?? workspace?.gradingScales[0];

  const rows = useMemo(() => {
    return maps.students
      .map((student) => {
        const meta = workspace?.studentMeta[student.id];
        const enrollments = db.enrollments.filter((e) => e.user_id === student.id);
        const courseIds = enrollments.map((e) => e.course_id);
        const cls = meta?.classSectionId ? maps.classesById.get(meta.classSectionId) : undefined;
        const att = computeAttendanceStats(
          (workspace?.attendance ?? []).filter(
            (a) => a.personType === "student" && a.personId === student.id,
          ),
        );
        const grades = (workspace?.grades ?? []).filter((g) => g.studentId === student.id);
        const avgGrade =
          grades.length && scale
            ? Math.round(
                grades.reduce(
                  (s, g) => s + computeGradeOutcome(g.score, g.maxScore, scale).percent,
                  0,
                ) / grades.length,
              )
            : null;
        const doneLessons = db.progress.filter((p) => p.user_id === student.id).length;
        const totalLessons = courseIds.reduce(
          (s, cid) => s + (maps.lessonsByCourse.get(cid)?.length ?? 0),
          0,
        );
        return {
          student,
          meta,
          enrollments,
          courseIds,
          cls,
          att,
          grades,
          avgGrade,
          doneLessons,
          totalLessons,
        };
      })
      .filter((r) => {
        if (courseFilter !== "all" && !r.courseIds.includes(courseFilter)) return false;
        if (classFilter !== "all" && r.meta?.classSectionId !== classFilter) return false;
        if (!search.trim()) return true;
        return `${displayName(r.student)} ${r.student.email} ${r.meta?.studentCode ?? ""}`
          .toLowerCase()
          .includes(search.trim().toLowerCase());
      });
  }, [maps, workspace, db.enrollments, db.progress, scale, courseFilter, classFilter, search]);

  const paged = useMemo(() => paginateRows(rows, page, 10), [rows, page]);

  function openRecord(stu: ProfileRow) {
    setDetailStudent(stu);
    setNotesDraft(workspace?.studentMeta[stu.id]?.notes ?? "");
  }

  async function saveStudentNotes(e: React.FormEvent) {
    e.preventDefault();
    if (!detailStudent) return;
    const existing = workspace?.studentMeta[detailStudent.id];
    await mutateWorkspace(
      {
        type: "upsert_student_meta",
        payload: {
          userId: detailStudent.id,
          studentCode: existing?.studentCode ?? `STU-${detailStudent.id.slice(0, 6).toUpperCase()}`,
          classSectionId: existing?.classSectionId ?? null,
          academicYearId: existing?.academicYearId ?? null,
          guardianName: existing?.guardianName ?? "",
          guardianPhone: existing?.guardianPhone ?? "",
          address: existing?.address ?? "",
          dateOfBirth: existing?.dateOfBirth ?? "",
          notes: notesDraft.trim(),
        },
      },
      "Student academic notes updated",
    );
  }

  function exportStudents() {
    downloadExcelXls(
      "ezana-instructor-students",
      "Students",
      rows.map((r) => ({
        StudentCode: r.meta?.studentCode ?? "",
        Name: displayName(r.student),
        Email: r.student.email,
        Class: r.cls ? r.cls.name : "Unassigned",
        EnrolledCourses: r.enrollments.length,
        LessonsCompleted: `${r.doneLessons}/${r.totalLessons}`,
        AttendanceRate: r.att.total ? `${r.att.attendanceRate}%` : "No logs",
        AverageGrade: r.avgGrade !== null ? `${r.avgGrade}%` : "N/A",
      })),
      "Assigned Students & Academic Records",
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={mode === "records" ? "Student Records" : "My Students"}
        description={
          mode === "records"
            ? "Review permitted student profiles, enrollment history, attendance logs, grades, and academic remarks."
            : "Monitor students enrolled in your assigned courses and classes, attendance, and learning progress."
        }
        actions={
          can("students", "export") &&
          rows.length > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={exportStudents}>
              <ArrowDownToLine className="h-4 w-4" />
              Export Excel
            </Button>
          )
        }
      />

      <Panel
        title="Assigned Students"
        actions={
          <div className="flex flex-wrap gap-2">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setPage(1);
                }}
                placeholder="Search name, ID, email…"
                className="h-9 w-48 pl-8 text-xs"
              />
            </div>
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
          </div>
        }
      >
        {paged.items.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Class</TableHead>
                  <TableHead>Progress</TableHead>
                  <TableHead>Attendance</TableHead>
                  <TableHead>Avg Grade</TableHead>
                  <TableHead className="text-right">Record</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.items.map((r) => (
                  <TableRow key={r.student.id}>
                    <TableCell>
                      <p className="text-[11px] font-mono text-muted-foreground">
                        {r.meta?.studentCode ?? `STU-${r.student.id.slice(0, 6).toUpperCase()}`}
                      </p>
                      <p className="font-semibold text-sm">{displayName(r.student)}</p>
                      <p className="text-xs text-muted-foreground">{r.student.email}</p>
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.cls ? `${r.cls.name} (${r.cls.sectionCode})` : "Unassigned"}
                    </TableCell>
                    <TableCell className="text-xs">
                      <p>
                        {r.enrollments.length} courses · {r.doneLessons}/{r.totalLessons} lessons
                      </p>
                    </TableCell>
                    <TableCell className="text-xs">
                      {r.att.total > 0 ? `${r.att.attendanceRate}%` : "No logs"}
                    </TableCell>
                    <TableCell className="text-xs font-semibold">
                      {r.avgGrade !== null ? `${r.avgGrade}%` : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => openRecord(r.student)}
                      >
                        <GraduationCap className="h-3.5 w-3.5" />
                        View Record
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <Pager page={paged.page} pageCount={paged.pageCount} onPage={setPage} />
          </>
        ) : (
          <EmptyState
            title="No matching students"
            text="Students enrolled in your courses or assigned classes appear here."
            icon={Users}
          />
        )}
      </Panel>

      <Dialog open={!!detailStudent} onOpenChange={(o) => !o && setDetailStudent(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{detailStudent ? displayName(detailStudent) : ""}</DialogTitle>
            <DialogDescription>{detailStudent?.email}</DialogDescription>
          </DialogHeader>
          {detailStudent && (
            <div className="space-y-4 text-sm">
              <div className="grid gap-3 rounded-xl bg-secondary/45 p-3 sm:grid-cols-2">
                <div>
                  <p className="text-xs text-muted-foreground">Enrolled Assigned Courses</p>
                  <ul className="mt-1 space-y-1 text-xs">
                    {db.enrollments
                      .filter((e) => e.user_id === detailStudent.id)
                      .map((e) => (
                        <li key={e.id} className="font-medium">
                          • {maps.coursesById.get(e.course_id)?.title ?? "Course"}
                        </li>
                      ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Assessment Marks</p>
                  {(workspace?.grades ?? []).filter((g) => g.studentId === detailStudent.id).length >
                  0 ? (
                    <ul className="mt-1 space-y-1 text-xs">
                      {(workspace?.grades ?? [])
                        .filter((g) => g.studentId === detailStudent.id)
                        .map((g) => (
                          <li key={g.id}>
                            {g.assessmentTitle}:{" "}
                            <span className="font-semibold">
                              {g.score}/{g.maxScore}
                            </span>
                          </li>
                        ))}
                    </ul>
                  ) : (
                    <p className="mt-1 text-xs text-muted-foreground">No grades recorded yet.</p>
                  )}
                </div>
              </div>

              {can("students", "edit") ? (
                <form className="space-y-2" onSubmit={(e) => void saveStudentNotes(e)}>
                  <label className="block space-y-1 text-xs font-semibold">
                    Academic Remarks & Advisor Notes
                    <Textarea
                      rows={3}
                      value={notesDraft}
                      onChange={(e) => setNotesDraft(e.target.value)}
                      placeholder="Record learning observations, strengths, or follow-up plans…"
                    />
                  </label>
                  <Button type="submit" size="sm" variant="emerald" disabled={data.mutating}>
                    Save Academic Notes
                  </Button>
                </form>
              ) : (
                workspace?.studentMeta[detailStudent.id]?.notes && (
                  <div className="rounded-xl border border-border p-3 text-xs">
                    <p className="font-semibold">Academic Notes</p>
                    <p className="mt-1 text-muted-foreground">
                      {workspace.studentMeta[detailStudent.id]?.notes}
                    </p>
                  </div>
                )
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ========================================================================== */
/* TIMETABLES & SCHEDULING                                                    */
/* ========================================================================== */

const DAYS: TimetableSlot["dayOfWeek"][] = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];

export function InstructorTimetableModule({ data }: { data: InstructorDataHandle }) {
  const { user } = useAuth();
  const { db, workspace, maps, mutateWorkspace, can } = data;
  const [dayFilter, setDayFilter] = useState("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<TimetableSlot | null>(null);
  const [form, setForm] = useState({
    title: "",
    sessionType: "lesson" as TimetableSlot["sessionType"],
    courseId: "",
    classSectionId: "",
    dayOfWeek: "Monday" as TimetableSlot["dayOfWeek"],
    startTime: "09:00",
    endTime: "10:30",
    room: "",
    meetingUrl: "",
  });

  const canManageSchedule = can("timetables", "edit") || can("timetables", "create");

  const slots = useMemo(() => {
    return (workspace?.timetables ?? []).filter((s) =>
      dayFilter === "all" ? true : s.dayOfWeek === dayFilter,
    );
  }, [workspace?.timetables, dayFilter]);

  const conflictWarnings = useMemo(() => {
    const all = workspace?.timetables ?? [];
    const idsWithConflict = new Set<string>();
    for (const s of all) {
      if (detectTimetableConflicts(all, s).length > 0) {
        idsWithConflict.add(s.id);
      }
    }
    return idsWithConflict;
  }, [workspace?.timetables]);

  const candidateConflicts = useMemo(() => {
    if (!editorOpen) return [];
    return detectTimetableConflicts(workspace?.timetables ?? [], {
      ...(editing?.id ? { id: editing.id } : {}),
      title: form.title,
      sessionType: form.sessionType,
      courseId: form.courseId || null,
      classSectionId: form.classSectionId || null,
      instructorId: user?.id ?? null,
      dayOfWeek: form.dayOfWeek,
      startTime: form.startTime,
      endTime: form.endTime,
      room: form.room,
      meetingUrl: form.meetingUrl,
    });
  }, [editorOpen, editing?.id, form, user?.id, workspace?.timetables]);

  function openEditor(slot: TimetableSlot | null) {
    setEditing(slot);
    setForm({
      title: slot?.title ?? "",
      sessionType: slot?.sessionType ?? "lesson",
      courseId: slot?.courseId ?? db.courses[0]?.id ?? "",
      classSectionId: slot?.classSectionId ?? workspace?.classes[0]?.id ?? "",
      dayOfWeek: slot?.dayOfWeek ?? "Monday",
      startTime: slot?.startTime ?? "09:00",
      endTime: slot?.endTime ?? "10:30",
      room: slot?.room ?? "Online",
      meetingUrl: slot?.meetingUrl ?? "",
    });
    setEditorOpen(true);
  }

  async function saveSlot(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !form.title.trim()) return;
    if (form.endTime <= form.startTime) {
      toast.error("End time must be after start time.");
      return;
    }
    await mutateWorkspace(
      {
        type: "upsert_timetable",
        payload: {
          id: editing?.id ?? crypto.randomUUID(),
          title: form.title.trim(),
          sessionType: form.sessionType,
          courseId: form.courseId || null,
          classSectionId: form.classSectionId || null,
          instructorId: user.id,
          dayOfWeek: form.dayOfWeek,
          startTime: form.startTime,
          endTime: form.endTime,
          room: form.room.trim() || "Online",
          meetingUrl: safeUrl(form.meetingUrl),
        },
      },
      editing ? "Timetable updated" : "Timetable slot scheduled",
    );
    setEditorOpen(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Timetables & Scheduling"
        description="View your teaching schedule, exam dates, room locations, and automatic conflict alerts."
        actions={
          canManageSchedule && (
            <Button
              type="button"
              variant="emerald"
              size="sm"
              disabled={db.courses.length === 0}
              onClick={() => openEditor(null)}
            >
              <Plus className="h-4 w-4" />
              Schedule Session
            </Button>
          )
        }
      />

      {conflictWarnings.size > 0 && (
        <div className="flex items-center gap-3 rounded-xl border border-amber-500/40 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4 shrink-0" />
          <span>
            Schedule overlap detected in {conflictWarnings.size} slot(s). Review conflicting times
            or rooms.
          </span>
        </div>
      )}

      <Panel
        title="Teaching & Exam Schedule"
        actions={
          <select
            value={dayFilter}
            onChange={(e) => setDayFilter(e.target.value)}
            className="h-9 rounded-md border border-input bg-background px-2.5 text-xs"
          >
            <option value="all">All days</option>
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        }
      >
        {slots.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Day & Time</TableHead>
                <TableHead>Session</TableHead>
                <TableHead>Course / Class</TableHead>
                <TableHead>Location</TableHead>
                {canManageSchedule && <TableHead className="text-right">Actions</TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {slots.map((slot) => {
                const course = slot.courseId ? maps.coursesById.get(slot.courseId) : undefined;
                const cls = slot.classSectionId
                  ? maps.classesById.get(slot.classSectionId)
                  : undefined;
                return (
                  <TableRow key={slot.id}>
                    <TableCell className="text-xs font-medium">
                      <p>{slot.dayOfWeek}</p>
                      <p className="text-muted-foreground">
                        {slot.startTime}–{slot.endTime}
                      </p>
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold text-sm">{slot.title}</p>
                      <Badge variant="outline" className="mt-1">
                        {slot.sessionType.replace("_", " ")}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs">
                      <p>{course?.title ?? "Course"}</p>
                      <p className="text-muted-foreground">{cls?.name ?? "All sections"}</p>
                    </TableCell>
                    <TableCell className="text-xs">{slot.room || "Online"}</TableCell>
                    {canManageSchedule && (
                      <TableCell className="text-right">
                        <div className="inline-flex gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openEditor(slot)}
                          >
                            Edit
                          </Button>
                          {can("timetables", "delete") && (
                            <ConfirmButton
                              title="Delete Timetable Slot?"
                              description={`Remove "${slot.title}"?`}
                              onConfirm={() =>
                                void mutateWorkspace(
                                  { type: "delete_timetable", id: slot.id },
                                  "Timetable slot deleted",
                                )
                              }
                              trigger={
                                <Button type="button" variant="ghost" size="sm" aria-label="Delete timetable slot">
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              }
                            />
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="No timetable slots found"
            text="Assigned teaching sessions and scheduled exams appear here."
            icon={CalendarClock}
          />
        )}
      </Panel>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Timetable Slot" : "Schedule Lesson / Exam"}</DialogTitle>
            <DialogDescription>
              Schedule overlaps with your classes or rooms are automatically flagged.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => void saveSlot(e)}>
            <label className="block space-y-1 text-sm font-medium">
              Session Title
              <Input
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm font-medium">
                Course
                <select
                  value={form.courseId}
                  onChange={(e) => setForm((f) => ({ ...f, courseId: e.target.value }))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {db.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Type
                <select
                  value={form.sessionType}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      sessionType: e.target.value as TimetableSlot["sessionType"],
                    }))
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="lesson">Lesson</option>
                  <option value="live_class">Live Class</option>
                  <option value="exam">Examination</option>
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block space-y-1 text-sm font-medium">
                Day
                <select
                  value={form.dayOfWeek}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      dayOfWeek: e.target.value as TimetableSlot["dayOfWeek"],
                    }))
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {DAYS.map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Start
                <Input
                  type="time"
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                />
              </label>
              <label className="block space-y-1 text-sm font-medium">
                End
                <Input
                  type="time"
                  value={form.endTime}
                  onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                />
              </label>
            </div>
            <label className="block space-y-1 text-sm font-medium">
              Room / Location
              <Input
                value={form.room}
                onChange={(e) => setForm((f) => ({ ...f, room: e.target.value }))}
              />
            </label>
            {candidateConflicts.length > 0 && (
              <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-2.5 text-xs text-destructive">
                Conflict detected: {candidateConflicts[0]!.reasons.join("; ")}
              </div>
            )}
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="emerald"
                disabled={data.mutating || candidateConflicts.length > 0}
              >
                Save Schedule
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ========================================================================== */
/* ATTENDANCE TRACKING                                                        */
/* ========================================================================== */

export function InstructorAttendanceModule({ data }: { data: InstructorDataHandle }) {
  const { user } = useAuth();
  const { db, workspace, maps, mutateWorkspace, can, setPrintable } = data;
  const [courseId, setCourseId] = useState(db.courses[0]?.id ?? "");
  const [date, setDate] = useState(new Date().toISOString().slice(0, 10));
  const [draft, setDraft] = useState<Record<string, { status: AttendanceStatus; notes: string }>>(
    {},
  );

  const activeCourseId = courseId || db.courses[0]?.id || "";

  const targetStudents = useMemo(() => {
    const enrolledIds = new Set(
      db.enrollments.filter((e) => e.course_id === activeCourseId).map((e) => e.user_id),
    );
    return maps.students.filter((s) => enrolledIds.has(s.id));
  }, [db.enrollments, activeCourseId, maps.students]);

  const existingByStudent = useMemo(() => {
    const map = new Map<string, AttendanceRecord>();
    for (const r of workspace?.attendance ?? []) {
      if (r.personType === "student" && r.courseId === activeCourseId && r.date === date) {
        map.set(r.personId, r);
      }
    }
    return map;
  }, [workspace?.attendance, activeCourseId, date]);

  const overallStats = useMemo(
    () =>
      computeAttendanceStats(
        (workspace?.attendance ?? []).filter(
          (a) =>
            a.personType === "student" && (!activeCourseId || a.courseId === activeCourseId),
        ),
      ),
    [workspace?.attendance, activeCourseId],
  );

  async function saveAttendance() {
    if (!activeCourseId || targetStudents.length === 0) return;
    const records: AttendanceRecord[] = targetStudents.map((stu) => {
      const existing = existingByStudent.get(stu.id);
      const d = draft[stu.id];
      return {
        id: existing?.id ?? crypto.randomUUID(),
        personId: stu.id,
        personType: "student",
        courseId: activeCourseId,
        classSectionId: workspace?.studentMeta[stu.id]?.classSectionId ?? null,
        date,
        status: d?.status ?? existing?.status ?? "present",
        notes: d?.notes ?? existing?.notes ?? "",
        markedBy: user?.id ?? null,
      };
    });
    await mutateWorkspace(
      { type: "upsert_attendance_batch", records },
      `Saved attendance for ${records.length} student(s)`,
    );
  }

  function exportAttendanceSummary() {
    const rows = targetStudents.map((stu) => {
      const hist = (workspace?.attendance ?? []).filter(
        (a) =>
          a.personType === "student" && a.personId === stu.id && a.courseId === activeCourseId,
      );
      const st = computeAttendanceStats(hist);
      return {
        Student: displayName(stu),
        Email: stu.email,
        SessionsLogged: st.total,
        Present: st.present,
        Late: st.late,
        Absent: st.absent,
        AttendanceRate: `${st.attendanceRate}%`,
      };
    });
    downloadExcelXls(
      "ezana-course-attendance",
      "Attendance",
      rows,
      `Attendance Summary — ${maps.coursesById.get(activeCourseId)?.title ?? "Course"}`,
    );
  }

  function printAttendanceSummary() {
    setPrintable({
      title: "Course Attendance Summary",
      subtitle: `${maps.coursesById.get(activeCourseId)?.title ?? "Assigned Course"} · Date: ${date}`,
      columns: ["Student", "Logged Sessions", "Present", "Late", "Absent", "Rate"],
      rows: targetStudents.map((stu) => {
        const hist = (workspace?.attendance ?? []).filter(
          (a) =>
            a.personType === "student" && a.personId === stu.id && a.courseId === activeCourseId,
        );
        const st = computeAttendanceStats(hist);
        return [
          displayName(stu),
          st.total,
          st.present,
          st.late,
          st.absent,
          `${st.attendanceRate}%`,
        ];
      }),
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Attendance Tracking"
        description="Mark daily student attendance, update existing logs, and review class attendance percentages."
        actions={
          <div className="flex flex-wrap gap-2">
            {can("attendance", "export") && targetStudents.length > 0 && (
              <>
                <Button type="button" variant="outline" size="sm" onClick={exportAttendanceSummary}>
                  <ArrowDownToLine className="h-4 w-4" />
                  Export Excel
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={printAttendanceSummary}>
                  <Printer className="h-4 w-4" />
                  Print Summary
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard label="Attendance Rate" value={`${overallStats.attendanceRate}%`} icon={ClipboardCheck} index={0} />
        <StatCard label="Present" value={overallStats.present} icon={Users} tone="gold" index={1} />
        <StatCard label="Late" value={overallStats.late} icon={CalendarClock} tone="deep" index={2} />
        <StatCard label="Absent" value={overallStats.absent} icon={AlertTriangle} tone="plain" index={3} />
      </div>

      <Panel
        title="Record Class Attendance"
        actions={
          <div className="flex flex-wrap gap-2">
            <select
              value={activeCourseId}
              onChange={(e) => {
                setCourseId(e.target.value);
                setDraft({});
              }}
              className="h-9 rounded-md border border-input bg-background px-2.5 text-xs"
            >
              {db.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <Input
              type="date"
              value={date}
              onChange={(e) => {
                setDate(e.target.value);
                setDraft({});
              }}
              className="h-9 w-40 text-xs"
            />
            {can("attendance", "edit") && targetStudents.length > 0 && (
              <Button
                type="button"
                size="sm"
                variant="emerald"
                disabled={data.mutating}
                onClick={() => void saveAttendance()}
              >
                Save Attendance
              </Button>
            )}
          </div>
        }
      >
        {targetStudents.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Overall %</TableHead>
                <TableHead>Status ({date})</TableHead>
                <TableHead>Notes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {targetStudents.map((stu) => {
                const existing = existingByStudent.get(stu.id);
                const status = draft[stu.id]?.status ?? existing?.status ?? "present";
                const notes = draft[stu.id]?.notes ?? existing?.notes ?? "";
                const hist = computeAttendanceStats(
                  (workspace?.attendance ?? []).filter(
                    (a) =>
                      a.personType === "student" &&
                      a.personId === stu.id &&
                      a.courseId === activeCourseId,
                  ),
                );
                return (
                  <TableRow key={stu.id}>
                    <TableCell>
                      <p className="font-semibold text-sm">{displayName(stu)}</p>
                      <p className="text-xs text-muted-foreground">{stu.email}</p>
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {hist.total > 0 ? `${hist.attendanceRate}% (${hist.total})` : "No logs"}
                    </TableCell>
                    <TableCell>
                      <select
                        disabled={!can("attendance", "edit")}
                        value={status}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            [stu.id]: {
                              status: e.target.value as AttendanceStatus,
                              notes,
                            },
                          }))
                        }
                        className="h-9 rounded-md border border-input bg-background px-2.5 text-xs"
                      >
                        <option value="present">Present</option>
                        <option value="late">Late</option>
                        <option value="absent">Absent</option>
                        <option value="excused">Excused</option>
                      </select>
                    </TableCell>
                    <TableCell>
                      <Input
                        disabled={!can("attendance", "edit")}
                        value={notes}
                        onChange={(e) =>
                          setDraft((prev) => ({
                            ...prev,
                            [stu.id]: { status, notes: e.target.value },
                          }))
                        }
                        placeholder="Optional remark…"
                        className="h-9 text-xs"
                      />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="No enrolled students in this course"
            text="Select an assigned course with enrolled learners to mark attendance."
            icon={ClipboardCheck}
          />
        )}
      </Panel>
    </div>
  );
}

/* ========================================================================== */
/* LIVE CLASSES                                                               */
/* ========================================================================== */

export function InstructorLiveClassesModule({ data }: { data: InstructorDataHandle }) {
  const { user } = useAuth();
  const { db, workspace, maps, mutateWorkspace, can } = data;
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<LiveClassSession | null>(null);
  const [participantsSession, setParticipantsSession] = useState<LiveClassSession | null>(null);
  const [form, setForm] = useState({
    title: "",
    courseId: "",
    classSectionId: "",
    scheduledDate: new Date().toISOString().slice(0, 10),
    startTime: "10:00",
    endTime: "11:00",
    meetingUrl: "https://meet.google.com/",
    notes: "",
  });

  const sessions = workspace?.liveClasses ?? [];

  function openEditor(lc: LiveClassSession | null) {
    setEditing(lc);
    setForm({
      title: lc?.title ?? "",
      courseId: lc?.courseId ?? db.courses[0]?.id ?? "",
      classSectionId: lc?.classSectionId ?? "",
      scheduledDate: lc?.scheduledDate ?? new Date().toISOString().slice(0, 10),
      startTime: lc?.startTime ?? "10:00",
      endTime: lc?.endTime ?? "11:00",
      meetingUrl: lc?.meetingUrl ?? "https://meet.google.com/",
      notes: lc?.notes ?? "",
    });
    setEditorOpen(true);
  }

  async function saveSession(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !form.courseId || !form.title.trim()) return;
    const cleanMeeting = safeUrl(form.meetingUrl);
    if (!cleanMeeting) {
      toast.error("Enter a valid https:// meeting URL.");
      return;
    }
    const payload: LiveClassSession = {
      id: editing?.id ?? crypto.randomUUID(),
      courseId: form.courseId,
      classSectionId: form.classSectionId || null,
      instructorId: user.id,
      title: form.title.trim(),
      scheduledDate: form.scheduledDate,
      startTime: form.startTime,
      endTime: form.endTime,
      meetingUrl: cleanMeeting,
      status: editing?.status ?? "scheduled",
      participantIds: editing?.participantIds ?? [],
      attachedMaterialIds: editing?.attachedMaterialIds ?? [],
      notes: form.notes.trim(),
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    };
    await mutateWorkspace(
      { type: "upsert_live_class", payload },
      editing ? "Live class updated" : "Live class scheduled",
    );
    if (!editing) {
      await mutateWorkspace({
        type: "create_notification",
        payload: {
          title: `Live Class Scheduled: ${payload.title}`,
          message: `Join on ${payload.scheduledDate} at ${payload.startTime}.`,
          category: "academic",
          targetRole: "student",
          targetCourseId: payload.courseId,
          targetClassId: payload.classSectionId,
        },
      });
    }
    setEditorOpen(false);
  }

  async function setSessionStatus(lc: LiveClassSession, status: LiveClassSession["status"]) {
    await mutateWorkspace(
      { type: "upsert_live_class", payload: { ...lc, status } },
      `Live session marked ${status}`,
    );
  }

  async function toggleParticipant(lc: LiveClassSession, studentId: string) {
    const exists = lc.participantIds.includes(studentId);
    const nextIds = exists
      ? lc.participantIds.filter((id) => id !== studentId)
      : [...lc.participantIds, studentId];
    const updated = { ...lc, participantIds: nextIds };
    setParticipantsSession(updated);
    await mutateWorkspace(
      { type: "upsert_live_class", payload: updated },
      exists ? "Removed participant check-in" : "Participant attendance recorded",
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Live Classes"
        description="Schedule online live classes, start or end sessions, share meeting links, and record participant attendance."
        actions={
          can("courses", "edit") && (
            <Button
              type="button"
              variant="emerald"
              size="sm"
              disabled={db.courses.length === 0}
              onClick={() => openEditor(null)}
            >
              <Plus className="h-4 w-4" />
              Schedule Live Class
            </Button>
          )
        }
      />

      <Panel title="Scheduled & Past Live Sessions">
        {sessions.length > 0 ? (
          <div className="space-y-3">
            {sessions.map((lc) => {
              const course = maps.coursesById.get(lc.courseId);
              const link = safeUrl(lc.meetingUrl);
              return (
                <div
                  key={lc.id}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="font-semibold text-sm">{lc.title}</h4>
                      <Badge variant={STATUS_BADGE[lc.status] ?? "outline"}>{lc.status}</Badge>
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {course?.title ?? "Course"} · {lc.scheduledDate} · {lc.startTime}–{lc.endTime}{" "}
                      · {lc.participantIds.length} attended
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {link && (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex h-8 items-center gap-1 rounded-md border border-border px-2.5 text-xs font-semibold text-primary hover:bg-secondary"
                      >
                        Join Room <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {lc.status === "scheduled" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="emerald"
                        onClick={() => void setSessionStatus(lc, "live")}
                      >
                        <Play className="h-3.5 w-3.5" />
                        Start
                      </Button>
                    )}
                    {lc.status === "live" && (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => void setSessionStatus(lc, "ended")}
                      >
                        <Square className="h-3.5 w-3.5" />
                        End Session
                      </Button>
                    )}
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => setParticipantsSession(lc)}
                    >
                      <Users className="h-3.5 w-3.5" />
                      Attendance
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => openEditor(lc)}
                    >
                      Edit
                    </Button>
                    {can("courses", "delete") && (
                      <ConfirmButton
                        title="Delete Live Session?"
                        description={`Remove "${lc.title}"?`}
                        onConfirm={() =>
                          void mutateWorkspace(
                            { type: "delete_live_class", id: lc.id },
                            "Live class deleted",
                          )
                        }
                        trigger={
                          <Button type="button" variant="ghost" size="sm" aria-label="Delete live session">
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        }
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <EmptyState
            title="No live classes scheduled"
            text="Create a live class session and notify enrolled learners automatically."
            icon={Video}
          />
        )}
      </Panel>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Live Class" : "Schedule Live Class"}</DialogTitle>
            <DialogDescription>
              Configure date, time, and video conferencing link for enrolled students.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => void saveSession(e)}>
            <label className="block space-y-1 text-sm font-medium">
              Session Title
              <Input
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Week 2 Live Q&A & Walkthrough"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm font-medium">
                Assigned Course
                <select
                  required
                  value={form.courseId}
                  onChange={(e) => setForm((f) => ({ ...f, courseId: e.target.value }))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {db.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Class / Section (optional)
                <select
                  value={form.classSectionId}
                  onChange={(e) => setForm((f) => ({ ...f, classSectionId: e.target.value }))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">All course students</option>
                  {(workspace?.classes ?? []).map((cl) => (
                    <option key={cl.id} value={cl.id}>
                      {cl.name}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block space-y-1 text-sm font-medium">
                Date
                <Input
                  type="date"
                  required
                  value={form.scheduledDate}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))}
                />
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Start
                <Input
                  type="time"
                  required
                  value={form.startTime}
                  onChange={(e) => setForm((f) => ({ ...f, startTime: e.target.value }))}
                />
              </label>
              <label className="block space-y-1 text-sm font-medium">
                End
                <Input
                  type="time"
                  required
                  value={form.endTime}
                  onChange={(e) => setForm((f) => ({ ...f, endTime: e.target.value }))}
                />
              </label>
            </div>
            <label className="block space-y-1 text-sm font-medium">
              Live Meeting URL
              <Input
                required
                value={form.meetingUrl}
                onChange={(e) => setForm((f) => ({ ...f, meetingUrl: e.target.value }))}
              />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              Session Agenda / Notes
              <Textarea
                rows={2}
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="emerald" disabled={data.mutating}>
                Save Session
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!participantsSession}
        onOpenChange={(o) => !o && setParticipantsSession(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Participant Attendance — {participantsSession?.title}</DialogTitle>
            <DialogDescription>
              Check off students who joined this live session.
            </DialogDescription>
          </DialogHeader>
          {participantsSession && (
            <div className="max-h-72 space-y-2 overflow-y-auto">
              {db.enrollments
                .filter((e) => e.course_id === participantsSession.courseId)
                .map((e) => {
                  const stu = maps.profilesById.get(e.user_id);
                  const checked = participantsSession.participantIds.includes(e.user_id);
                  return (
                    <label
                      key={e.id}
                      className="flex cursor-pointer items-center justify-between rounded-lg border border-border px-3 py-2 text-xs hover:bg-secondary/40"
                    >
                      <span className="font-medium">
                        {stu ? displayName(stu) : "Student"} ({stu?.email ?? "—"})
                      </span>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => void toggleParticipant(participantsSession, e.user_id)}
                      />
                    </label>
                  );
                })}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
