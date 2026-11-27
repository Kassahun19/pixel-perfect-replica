import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowDownToLine,
  Award,
  BarChart3,
  CalendarClock,
  CalendarDays,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  Clock,
  ExternalLink,
  FileCheck2,
  FileSpreadsheet,
  PlayCircle,
  Printer,
  Send,
} from "lucide-react";
import { displayName, useAuth } from "@/lib/auth";
import { downloadCsv } from "@/lib/csv";
import {
  computeAttendanceStats,
  computeGradeOutcome,
  paginateRows,
} from "@/lib/owner/logic";
import type {
  AttendanceRecord,
  CourseAssignment,
  ExamAssessment,
} from "@/lib/owner/types";
import type { StudentSubmenuId } from "@/lib/student/types";
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
import { Label } from "@/components/ui/label";
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
import type { StudentDataHandle } from "./useStudentData";

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

const WEEKDAYS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
] as const;

/* ========================================================================== */
/* 3.1 MY TIMETABLE                                                           */
/* ========================================================================== */

export function StudentTimetableModule({ data }: { data: StudentDataHandle }) {
  const { workspace, maps } = data;
  const [viewMode, setViewMode] = useState<"weekly" | "daily">("weekly");
  const todayDay = new Date().toLocaleDateString("en-US", { weekday: "long" });
  const [selectedDay, setSelectedDay] = useState<string>(todayDay);

  const slots = useMemo(() => {
    const list = workspace?.timetables ?? [];
    if (viewMode === "daily") {
      return list.filter((s) => s.dayOfWeek === selectedDay);
    }
    return [...list].sort((a, b) => {
      const da = WEEKDAYS.indexOf(a.dayOfWeek);
      const dbIdx = WEEKDAYS.indexOf(b.dayOfWeek);
      if (da !== dbIdx) return da - dbIdx;
      return a.startTime.localeCompare(b.startTime);
    });
  }, [selectedDay, viewMode, workspace?.timetables]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Timetable"
        description="Daily and weekly class times, courses, assigned instructors, rooms, and online session links."
      />

      <Panel>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-1.5 rounded-lg bg-secondary/70 p-1">
            <button
              type="button"
              onClick={() => setViewMode("weekly")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                viewMode === "weekly"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Weekly Schedule
            </button>
            <button
              type="button"
              onClick={() => setViewMode("daily")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                viewMode === "daily"
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Daily View
            </button>
          </div>
          {viewMode === "daily" && (
            <select
              aria-label="Choose day of week"
              value={selectedDay}
              onChange={(e) => setSelectedDay(e.target.value)}
              className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold"
            >
              {WEEKDAYS.map((day) => (
                <option key={day} value={day}>
                  {day}
                </option>
              ))}
            </select>
          )}
        </div>

        {slots.length === 0 ? (
          <EmptyState
            title="No timetable slots scheduled"
            text="Sessions assigned to your courses or class cohort will appear here."
            icon={CalendarClock}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Day</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Session &amp; Course</TableHead>
                <TableHead>Instructor</TableHead>
                <TableHead>Room / Link</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {slots.map((slot) => {
                const inst = slot.instructorId ? maps.profilesById.get(slot.instructorId) : null;
                const meetingHref = safeHref(slot.meetingUrl);
                return (
                  <TableRow key={slot.id}>
                    <TableCell className="font-semibold">{slot.dayOfWeek}</TableCell>
                    <TableCell className="font-mono text-xs tabular-nums">
                      {slot.startTime}–{slot.endTime}
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold">{slot.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {slot.courseId
                          ? maps.coursesById.get(slot.courseId)?.title ?? "Course"
                          : "Class Cohort"}{" "}
                        · {slot.sessionType.replace("_", " ")}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs">
                      {inst ? displayName(inst) : "Assigned Instructor"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span>{slot.room || "Online"}</span>
                        {meetingHref && (
                          <Button asChild size="sm" variant="outline" className="h-7 px-2 text-xs">
                            <a href={meetingHref} target="_blank" rel="noopener noreferrer">
                              <ExternalLink className="h-3 w-3" /> Join
                            </a>
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Panel>
    </div>
  );
}

/* ========================================================================== */
/* 3.2 MY ATTENDANCE                                                          */
/* ========================================================================== */

export function StudentAttendanceModule({ data }: { data: StudentDataHandle }) {
  const { user } = useAuth();
  const { workspace, maps, mutateWorkspace, mutating } = data;
  const [courseFilter, setCourseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);

  const [disputeTarget, setDisputeTarget] = useState<AttendanceRecord | null>(null);
  const [disputeReason, setDisputeReason] = useState("");

  const records = useMemo(() => {
    return (workspace?.attendance ?? []).filter((a) => {
      if (courseFilter !== "all" && a.courseId !== courseFilter) return false;
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      return true;
    });
  }, [courseFilter, statusFilter, workspace?.attendance]);

  const stats = useMemo(() => computeAttendanceStats(records), [records]);
  const { items: rows, pageCount, page: safePage } = paginateRows(records, page, 10);

  async function submitDiscrepancy() {
    if (!user || !disputeTarget || !disputeReason.trim()) return;
    await mutateWorkspace(
      {
        type: "report_attendance_discrepancy",
        payload: {
          attendanceId: disputeTarget.id,
          studentId: user.id,
          courseId: disputeTarget.courseId,
          date: disputeTarget.date,
          reason: disputeReason.trim(),
        },
      },
      "Attendance discrepancy report sent to your instructor",
    );
    setDisputeTarget(null);
    setDisputeReason("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Attendance"
        description="Read-only personal attendance log across enrolled courses, plus discrepancy reporting if a session was recorded in error."
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Attendance Rate"
          value={<span className="tabular-nums">{stats.total ? `${stats.attendanceRate}%` : "—"}</span>}
          icon={CalendarDays}
          hint={`${stats.total} recorded sessions`}
          index={0}
        />
        <StatCard
          label="Present"
          value={<span className="tabular-nums">{stats.present}</span>}
          icon={CheckCircle2}
          tone="gold"
          index={1}
        />
        <StatCard
          label="Late"
          value={<span className="tabular-nums">{stats.late}</span>}
          icon={Clock}
          tone="deep"
          index={2}
        />
        <StatCard
          label="Absent / Excused"
          value={<span className="tabular-nums">{stats.absent + stats.excused}</span>}
          icon={AlertCircle}
          hint={`${stats.absent} absent · ${stats.excused} excused`}
          tone="plain"
          index={3}
        />
      </div>

      <Panel>
        <div className="mb-4 flex flex-wrap gap-3">
          <select
            aria-label="Filter attendance by course"
            value={courseFilter}
            onChange={(e) => {
              setCourseFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
          >
            <option value="all">All Courses</option>
            {maps.myCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter attendance by status"
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPage(1);
            }}
            className="h-10 rounded-lg border border-border bg-background px-3 text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="present">Present</option>
            <option value="late">Late</option>
            <option value="absent">Absent</option>
            <option value="excused">Excused</option>
          </select>
        </div>

        {rows.length === 0 ? (
          <EmptyState
            title="No attendance entries found"
            text="Your personal attendance sessions marked by instructors will appear here."
            icon={CalendarDays}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Course / Cohort</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Notes</TableHead>
                <TableHead className="text-right">Discrepancy</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((rec) => (
                <TableRow key={rec.id}>
                  <TableCell className="font-mono text-xs tabular-nums">{rec.date}</TableCell>
                  <TableCell className="font-medium">
                    {rec.courseId
                      ? maps.coursesById.get(rec.courseId)?.title ?? "Course"
                      : rec.classSectionId
                        ? maps.classesById.get(rec.classSectionId)?.name ?? "Class"
                        : "Session"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        rec.status === "present"
                          ? "success"
                          : rec.status === "absent"
                            ? "destructive"
                            : rec.status === "late"
                              ? "warning"
                              : "secondary"
                      }
                      className="capitalize"
                    >
                      {rec.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {rec.notes || "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        setDisputeTarget(rec);
                        setDisputeReason("");
                      }}
                    >
                      Report Discrepancy
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        <Pager page={safePage} pageCount={pageCount} onPage={setPage} />
      </Panel>

      {(workspace?.attendanceDisputes ?? []).length > 0 && (
        <Panel title="Submitted Discrepancy Reports">
          <div className="divide-y divide-border">
            {(workspace?.attendanceDisputes ?? []).map((d) => (
              <div
                key={d.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-xs"
              >
                <div>
                  <p className="font-semibold tabular-nums">
                    {d.date} · {d.courseId ? maps.coursesById.get(d.courseId)?.title ?? "Course" : "Session"}
                  </p>
                  <p className="text-muted-foreground">{d.reason}</p>
                </div>
                <Badge variant={STATUS_BADGE[d.status] ?? "warning"} className="capitalize">
                  {d.status}
                </Badge>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Dialog open={!!disputeTarget} onOpenChange={(open) => !open && setDisputeTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Report Attendance Discrepancy</DialogTitle>
            <DialogDescription>
              Flag session on {disputeTarget?.date} for instructor review.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="dispute-reason">Explanation</Label>
            <Textarea
              id="dispute-reason"
              rows={3}
              value={disputeReason}
              onChange={(e) => setDisputeReason(e.target.value)}
              placeholder="Describe why this attendance entry should be reviewed…"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setDisputeTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="emerald"
              disabled={!disputeReason.trim() || mutating}
              onClick={() => void submitDiscrepancy()}
            >
              Submit Report
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ========================================================================== */
/* 3.3 MY ASSIGNMENTS                                                         */
/* ========================================================================== */

export function StudentAssignmentsModule({ data }: { data: StudentDataHandle }) {
  const { user } = useAuth();
  const { workspace, maps, mutateWorkspace, mutating } = data;
  const [courseFilter, setCourseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "submitted" | "graded">("all");
  const [activeAssignment, setActiveAssignment] = useState<CourseAssignment | null>(null);
  const [submittedText, setSubmittedText] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState("");

  const subByAssignment = useMemo(
    () => new Map((workspace?.assignmentSubmissions ?? []).map((s) => [s.assignmentId, s])),
    [workspace?.assignmentSubmissions],
  );

  const todayIso = new Date().toISOString().slice(0, 10);

  const list = useMemo(() => {
    return (workspace?.assignments ?? []).filter((a) => {
      if (courseFilter !== "all" && a.courseId !== courseFilter) return false;
      const sub = subByAssignment.get(a.id);
      if (statusFilter === "pending") {
        return !sub || sub.status === "pending" || sub.status === "returned";
      }
      if (statusFilter === "submitted") {
        return sub?.status === "submitted" || sub?.status === "late";
      }
      if (statusFilter === "graded") {
        return sub?.status === "graded";
      }
      return true;
    });
  }, [courseFilter, statusFilter, subByAssignment, workspace?.assignments]);

  function openSubmissionDialog(a: CourseAssignment) {
    const existing = subByAssignment.get(a.id);
    setActiveAssignment(a);
    setSubmittedText(existing?.submittedText ?? "");
    setAttachmentUrl(existing?.attachmentUrl ?? "");
  }

  async function saveSubmission(mode: "pending" | "submitted") {
    if (!user || !activeAssignment) return;
    if (mode === "submitted" && !submittedText.trim() && !attachmentUrl.trim()) {
      toast.error("Provide a written response or an attachment link before submitting.");
      return;
    }
    await mutateWorkspace(
      {
        type: "upsert_assignment_submission",
        payload: {
          id: subByAssignment.get(activeAssignment.id)?.id || crypto.randomUUID(),
          assignmentId: activeAssignment.id,
          courseId: activeAssignment.courseId,
          studentId: user.id,
          submittedText: submittedText.trim(),
          attachmentUrl: attachmentUrl.trim(),
          submittedAt: null,
          status: mode,
          score: null,
          feedback: "",
          gradedBy: null,
          gradedAt: null,
          returnedAt: null,
        },
      },
      mode === "submitted"
        ? `Submitted "${activeAssignment.title}"`
        : "Saved assignment draft",
    );
    setActiveAssignment(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Assignments"
        description="Read assignment briefs, track due dates, upload or write your submissions, and inspect instructor feedback."
      />

      <Panel>
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5 rounded-lg bg-secondary/70 p-1">
            {(
              [
                ["all", "All"],
                ["pending", "To Submit"],
                ["submitted", "Submitted"],
                ["graded", "Graded"],
              ] as const
            ).map(([val, label]) => (
              <button
                key={val}
                type="button"
                onClick={() => setStatusFilter(val)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-colors ${
                  statusFilter === val
                    ? "bg-card text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {label}
              </button>
            ))}
          </div>
          <select
            aria-label="Filter assignments by course"
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold"
          >
            <option value="all">All Courses</option>
            {maps.myCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        {list.length === 0 ? (
          <EmptyState
            title="No assignments in this view"
            text="Published assignments for your enrolled courses will appear here."
            icon={ClipboardList}
          />
        ) : (
          <div className="space-y-3">
            {list.map((a) => {
              const sub = subByAssignment.get(a.id);
              const overdue =
                Boolean(a.dueDate && todayIso > a.dueDate) &&
                (!sub || sub.status === "pending");
              const briefHref = safeHref(a.attachmentUrl);
              const canEdit = a.status === "published" && sub?.status !== "graded";
              return (
                <div
                  key={a.id}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-border p-4 md:flex-row md:items-center"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold">{a.title}</h3>
                      <Badge
                        variant={
                          sub?.status === "graded"
                            ? "success"
                            : overdue
                              ? "destructive"
                              : STATUS_BADGE[sub?.status ?? "pending"] ?? "warning"
                        }
                        className="capitalize"
                      >
                        {sub ? sub.status : overdue ? "overdue" : "not submitted"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {maps.coursesById.get(a.courseId)?.title ?? "Course"} · Due {a.dueDate} · Max{" "}
                      {a.maxScore} pts
                      {sub?.status === "graded" && sub.score !== null
                        ? ` · Score: ${sub.score}/${a.maxScore}`
                        : ""}
                    </p>
                    <p className="text-xs text-foreground/85">{a.instructions || a.description}</p>
                    {sub?.feedback && (
                      <p className="text-xs text-primary">Instructor Feedback: {sub.feedback}</p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {briefHref && (
                      <Button asChild size="sm" variant="outline">
                        <a href={briefHref} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-3.5 w-3.5" /> {a.attachmentName || "Brief"}
                        </a>
                      </Button>
                    )}
                    {canEdit && (
                      <Button
                        type="button"
                        size="sm"
                        variant={sub?.status === "submitted" ? "outline" : "emerald"}
                        onClick={() => openSubmissionDialog(a)}
                      >
                        <Send className="h-3.5 w-3.5" />
                        {sub?.status === "submitted" || sub?.status === "late"
                          ? "Update Submission"
                          : sub?.status === "returned"
                            ? "Resubmit"
                            : "Submit Work"}
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Dialog
        open={!!activeAssignment}
        onOpenChange={(open) => !open && setActiveAssignment(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{activeAssignment?.title ?? "Submit Assignment"}</DialogTitle>
            <DialogDescription>
              Due {activeAssignment?.dueDate} · Maximum {activeAssignment?.maxScore} points
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {activeAssignment?.instructions && (
              <div className="rounded-xl bg-secondary/45 p-3 text-xs text-muted-foreground">
                {activeAssignment.instructions}
              </div>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="asg-text">Written Response</Label>
              <Textarea
                id="asg-text"
                rows={5}
                value={submittedText}
                onChange={(e) => setSubmittedText(e.target.value)}
                placeholder="Write your solution, summary, or notes here…"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="asg-link">Attachment / Document URL (optional)</Label>
              <Input
                id="asg-link"
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                placeholder="https://drive.google.com/…"
              />
            </div>
          </div>
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={mutating}
              onClick={() => void saveSubmission("pending")}
            >
              Save Draft
            </Button>
            <Button
              type="button"
              variant="emerald"
              disabled={mutating}
              onClick={() => void saveSubmission("submitted")}
            >
              Submit Final Work
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ========================================================================== */
/* 3.4 QUIZZES & EXAMS                                                        */
/* ========================================================================== */

export function StudentExamsModule({
  data,
  onNavigate,
}: {
  data: StudentDataHandle;
  onNavigate: (menu: StudentSubmenuId) => void;
}) {
  const { user } = useAuth();
  const { workspace, maps, mutateWorkspace, mutating } = data;
  const [courseFilter, setCourseFilter] = useState("all");
  const [takingExam, setTakingExam] = useState<ExamAssessment | null>(null);
  const [answers, setAnswers] = useState<Record<string, string>>({});

  const subByExam = useMemo(
    () => new Map((workspace?.examSubmissions ?? []).map((s) => [s.examId, s])),
    [workspace?.examSubmissions],
  );

  const list = useMemo(() => {
    return (workspace?.exams ?? []).filter(
      (ex) => courseFilter === "all" || ex.courseId === courseFilter,
    );
  }, [courseFilter, workspace?.exams]);

  function openExam(ex: ExamAssessment) {
    const existing = subByExam.get(ex.id);
    setTakingExam(ex);
    setAnswers(existing?.answers ?? {});
  }

  async function saveExam(status: "pending" | "submitted") {
    if (!user || !takingExam) return;
    await mutateWorkspace(
      {
        type: "upsert_exam_submission",
        payload: {
          id: subByExam.get(takingExam.id)?.id || crypto.randomUUID(),
          examId: takingExam.id,
          studentId: user.id,
          score: 0,
          status,
          submittedAt: null,
          gradedAt: null,
          feedback: "",
          answers,
        },
      },
      status === "submitted"
        ? `Assessment "${takingExam.title}" submitted`
        : "Assessment answers saved",
    );
    setTakingExam(null);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quizzes & Exams"
        description="Check scheduled windows, read instructions, answer questions during active assessments, and submit cleanly."
        actions={
          <Button type="button" variant="outline" size="sm" onClick={() => onNavigate("exam-results")}>
            <FileCheck2 className="h-4 w-4" /> Exam Results
          </Button>
        }
      />

      <Panel>
        <div className="mb-4 flex items-center justify-between gap-3">
          <select
            aria-label="Filter assessments by course"
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold"
          >
            <option value="all">All Enrolled Courses</option>
            {maps.myCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        {list.length === 0 ? (
          <EmptyState
            title="No quizzes or examinations published yet"
            text="Upcoming and active assessments for your enrolled courses will appear here."
            icon={ClipboardCheck}
          />
        ) : (
          <div className="space-y-3">
            {list.map((ex) => {
              const sub = subByExam.get(ex.id);
              const isGraded = sub?.status === "graded";
              const isSubmitted = sub?.status === "submitted" || isGraded;
              const isOpen = ex.status === "active" && !isGraded;
              return (
                <div
                  key={ex.id}
                  className="flex flex-col justify-between gap-3 rounded-xl border border-border p-4 md:flex-row md:items-center"
                >
                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold">{ex.title}</h3>
                      <Badge
                        variant={
                          ex.status === "active"
                            ? "success"
                            : ex.status === "scheduled"
                              ? "warning"
                              : "secondary"
                        }
                        className="capitalize"
                      >
                        {ex.status}
                      </Badge>
                      {sub && (
                        <Badge variant={STATUS_BADGE[sub.status] ?? "secondary"} className="capitalize">
                          {sub.status}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {maps.coursesById.get(ex.courseId)?.title ?? "Course"} · {ex.examType} ·{" "}
                      {ex.scheduledDate} at {ex.startTime} · {ex.durationMinutes} min ·{" "}
                      {ex.questions.length} questions · Pass {ex.passingScore}/{ex.maxScore}
                    </p>
                    {ex.instructions && (
                      <p className="text-xs text-muted-foreground">{ex.instructions}</p>
                    )}
                  </div>

                  <div className="flex items-center gap-2">
                    {isGraded ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => onNavigate("exam-results")}
                      >
                        View Score ({sub.score}/{ex.maxScore})
                      </Button>
                    ) : isOpen ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="emerald"
                        onClick={() => openExam(ex)}
                      >
                        <PlayCircle className="h-3.5 w-3.5" />
                        {isSubmitted ? "Review / Update" : "Take Assessment"}
                      </Button>
                    ) : (
                      <span className="text-xs text-muted-foreground">
                        {ex.status === "scheduled" ? "Not open yet" : "Window closed"}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Panel>

      <Dialog open={!!takingExam} onOpenChange={(open) => !open && setTakingExam(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{takingExam?.title ?? "Online Assessment"}</DialogTitle>
            <DialogDescription>
              {takingExam?.durationMinutes} minutes · Total {takingExam?.maxScore} points ·
              Passing score {takingExam?.passingScore}
            </DialogDescription>
          </DialogHeader>
          {takingExam && (
            <div className="space-y-4">
              {takingExam.instructions && (
                <div className="rounded-xl bg-secondary/45 p-3 text-xs text-muted-foreground">
                  {takingExam.instructions}
                </div>
              )}

              {takingExam.questions.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border p-4 text-center text-xs text-muted-foreground">
                  No structured questions attached. Submit confirmation when ready.
                </p>
              ) : (
                <div className="space-y-4">
                  {takingExam.questions.map((q, idx) => (
                    <div key={q.id} className="rounded-xl border border-border p-3.5 space-y-2">
                      <p className="text-xs font-semibold">
                        Question {idx + 1} ({q.points} pts)
                      </p>
                      <p className="text-sm">{q.prompt}</p>
                      {(q.questionType === "multiple_choice" || q.questionType === "true_false") &&
                      q.options.length > 0 ? (
                        <div className="grid gap-1.5 pt-1">
                          {q.options.map((opt) => (
                            <label
                              key={opt}
                              className="flex cursor-pointer items-center gap-2 rounded-lg border border-border/70 px-3 py-2 text-xs hover:bg-secondary/50"
                            >
                              <input
                                type="radio"
                                name={`q-${q.id}`}
                                checked={(answers[q.id] ?? "") === opt}
                                onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt }))}
                              />
                              <span>{opt}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <Textarea
                          rows={3}
                          value={answers[q.id] ?? ""}
                          onChange={(e) =>
                            setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))
                          }
                          placeholder="Type your response here…"
                        />
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={mutating}
              onClick={() => void saveExam("pending")}
            >
              Save Progress
            </Button>
            <ConfirmButton
              title="Submit assessment?"
              description="Submitted answers will be locked once graded by the academy or auto-grader."
              confirmLabel="Submit Assessment"
              destructive={false}
              onConfirm={() => void saveExam("submitted")}
              trigger={
                <Button type="button" variant="emerald" disabled={mutating}>
                  <Send className="h-4 w-4" /> Submit Final Answers
                </Button>
              }
            />
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ========================================================================== */
/* 3.5 EXAM RESULTS                                                           */
/* ========================================================================== */

export function StudentExamResultsModule({ data }: { data: StudentDataHandle }) {
  const { profile } = useAuth();
  const { workspace, maps, setPrintable } = data;
  const [courseFilter, setCourseFilter] = useState("all");

  const results = useMemo(() => {
    const examsById = new Map((workspace?.exams ?? []).map((e) => [e.id, e]));
    return (workspace?.examSubmissions ?? [])
      .map((s) => {
        const exam = examsById.get(s.examId);
        if (!exam) return null;
        if (courseFilter !== "all" && exam.courseId !== courseFilter) return null;
        const pct = exam.maxScore ? Math.round((s.score / exam.maxScore) * 100) : 0;
        const passed = s.status === "graded" && s.score >= exam.passingScore;
        return { submission: s, exam, pct, passed };
      })
      .filter((x): x is NonNullable<typeof x> => Boolean(x));
  }, [courseFilter, workspace?.examSubmissions, workspace?.exams]);

  function printResults() {
    setPrintable({
      title: "Official Examination & Quiz Results",
      subtitle: `${profile ? displayName(profile) : "Student"} · ${workspace?.myStudentMeta.studentCode ?? ""}`,
      meta: [
        { label: "Total Assessments", value: String(results.length) },
        {
          label: "Passed",
          value: String(results.filter((r) => r.passed).length),
        },
        { label: "Status", value: "Student Transcript Summary" },
      ],
      columns: ["Assessment", "Course", "Type", "Score", "Status", "Feedback"],
      rows: results.map((r) => [
        r.exam.title,
        maps.coursesById.get(r.exam.courseId)?.title ?? "Course",
        r.exam.examType,
        r.submission.status === "graded"
          ? `${r.submission.score}/${r.exam.maxScore} (${r.pct}%)`
          : "Pending review",
        r.submission.status === "graded"
          ? r.passed
            ? "Passed"
            : "Needs Review"
          : r.submission.status,
        r.submission.feedback || "—",
      ]),
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Exam Results"
        description="Released quiz and examination scores, pass thresholds, and instructor feedback."
        actions={
          results.length > 0 && (
            <Button type="button" variant="outline" size="sm" onClick={printResults}>
              <Printer className="h-4 w-4" /> Print Results
            </Button>
          )
        }
      />

      <Panel>
        <div className="mb-4">
          <select
            aria-label="Filter exam results by course"
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold"
          >
            <option value="all">All Enrolled Courses</option>
            {maps.myCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>

        {results.length === 0 ? (
          <EmptyState
            title="No exam results released yet"
            text="Submitted quizzes and instructor-graded examinations appear here once recorded."
            icon={FileCheck2}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Assessment</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Result</TableHead>
                <TableHead>Feedback</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {results.map(({ submission, exam, pct, passed }) => (
                <TableRow key={submission.id}>
                  <TableCell>
                    <p className="font-semibold">{exam.title}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {exam.examType} · Submitted{" "}
                      {submission.submittedAt
                        ? new Date(submission.submittedAt).toLocaleDateString()
                        : "Draft"}
                    </p>
                  </TableCell>
                  <TableCell className="text-xs">
                    {maps.coursesById.get(exam.courseId)?.title ?? "Course"}
                  </TableCell>
                  <TableCell className="font-mono text-xs font-bold tabular-nums">
                    {submission.status === "graded"
                      ? `${submission.score}/${exam.maxScore} (${pct}%)`
                      : "Awaiting grade"}
                  </TableCell>
                  <TableCell>
                    {submission.status === "graded" ? (
                      <Badge variant={passed ? "success" : "destructive"}>
                        {passed ? "Passed" : "Needs Review"}
                      </Badge>
                    ) : (
                      <Badge variant="warning" className="capitalize">
                        {submission.status}
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {submission.feedback || "—"}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>
    </div>
  );
}

/* ========================================================================== */
/* 3.6 MY GRADES & REPORT CARDS                                               */
/* ========================================================================== */

export function StudentGradesReportCardsModule({ data }: { data: StudentDataHandle }) {
  const { profile } = useAuth();
  const { workspace, maps, setPrintable, can } = data;
  const [courseFilter, setCourseFilter] = useState("all");
  const [termFilter, setTermFilter] = useState("all");

  const scale = workspace?.gradingScales.find((s) => s.isDefault) ?? workspace?.gradingScales[0];
  const filteredGrades = useMemo(() => {
    return (workspace?.grades ?? []).filter((g) => {
      if (courseFilter !== "all" && g.courseId !== courseFilter) return false;
      if (termFilter !== "all" && g.termId !== termFilter) return false;
      return true;
    });
  }, [courseFilter, termFilter, workspace?.grades]);

  const summary = useMemo(() => {
    if (!filteredGrades.length || !scale) return { avgPct: 0, avgGpa: 0, letter: "—" };
    let totalWeight = 0;
    let weightedSum = 0;
    let gpaSum = 0;
    for (const g of filteredGrades) {
      const outcome = computeGradeOutcome(g.score, g.maxScore, scale);
      const w = g.weight > 0 ? g.weight : 1;
      totalWeight += w;
      weightedSum += outcome.percent * w;
      gpaSum += outcome.gpa * w;
    }
    const avgPct = totalWeight ? Math.round((weightedSum / totalWeight) * 10) / 10 : 0;
    const avgGpa = totalWeight ? Math.round((gpaSum / totalWeight) * 100) / 100 : 0;
    const band = computeGradeOutcome(avgPct, 100, scale);
    return { avgPct, avgGpa, letter: band.letter };
  }, [filteredGrades, scale]);

  function openReportCard() {
    setPrintable({
      title: "Student Academic Report Card",
      subtitle: `${profile ? displayName(profile) : "Student"} · ID ${workspace?.myStudentMeta.studentCode ?? ""}`,
      meta: [
        { label: "Overall Average", value: `${summary.avgPct}% (${summary.letter})` },
        { label: "Weighted GPA", value: summary.avgGpa.toFixed(2) },
        { label: "Graded Assessments", value: String(filteredGrades.length) },
      ],
      columns: ["Course", "Assessment", "Type", "Score", "Percentage", "Grade", "Remarks"],
      rows: filteredGrades.map((g) => {
        const outcome = scale ? computeGradeOutcome(g.score, g.maxScore, scale) : null;
        return [
          maps.coursesById.get(g.courseId)?.title ?? "Course",
          g.assessmentTitle,
          g.assessmentType,
          `${g.score}/${g.maxScore}`,
          `${outcome?.percent ?? 0}%`,
          outcome?.letter ?? "—",
          g.remarks || outcome?.remark || "—",
        ];
      }),
      footerNote: "Official student copy generated from Ezana Academy academic records.",
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Grades & Report Cards"
        description="Read-only assessment grades by course and term, GPA breakdown, and printable report cards."
        actions={
          can("grades", "export") &&
          filteredGrades.length > 0 && (
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() =>
                  downloadCsv(
                    "my-grades.csv",
                    filteredGrades.map((g) => ({
                      course: maps.coursesById.get(g.courseId)?.title ?? g.courseId,
                      assessment: g.assessmentTitle,
                      type: g.assessmentType,
                      score: g.score,
                      maxScore: g.maxScore,
                      gradedAt: g.gradedAt,
                    })),
                  )
                }
              >
                <ArrowDownToLine className="h-4 w-4" /> Export CSV
              </Button>
              <Button type="button" variant="emerald" size="sm" onClick={openReportCard}>
                <Printer className="h-4 w-4" /> Print Report Card
              </Button>
            </div>
          )
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Weighted Average"
          value={<span className="tabular-nums">{filteredGrades.length ? `${summary.avgPct}%` : "—"}</span>}
          icon={FileSpreadsheet}
          index={0}
        />
        <StatCard
          label="Cumulative GPA"
          value={<span className="tabular-nums">{filteredGrades.length ? summary.avgGpa.toFixed(2) : "—"}</span>}
          icon={Award}
          tone="gold"
          hint={`Standing: ${summary.letter}`}
          index={1}
        />
        <StatCard
          label="Released Grades"
          value={<span className="tabular-nums">{filteredGrades.length}</span>}
          icon={CheckCircle2}
          tone="deep"
          index={2}
        />
      </div>

      <Panel>
        <div className="mb-4 flex flex-wrap gap-3">
          <select
            aria-label="Filter grades by course"
            value={courseFilter}
            onChange={(e) => setCourseFilter(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold"
          >
            <option value="all">All Courses</option>
            {maps.myCourses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
          <select
            aria-label="Filter grades by term"
            value={termFilter}
            onChange={(e) => setTermFilter(e.target.value)}
            className="h-9 rounded-lg border border-border bg-background px-3 text-xs font-semibold"
          >
            <option value="all">All Terms</option>
            {(workspace?.terms ?? []).map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        {filteredGrades.length === 0 ? (
          <EmptyState
            title="No grade entries released yet"
            text="Official grades recorded by your instructors will appear here automatically."
            icon={FileSpreadsheet}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Assessment</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Letter</TableHead>
                <TableHead>Remarks</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredGrades.map((g) => {
                const outcome = scale ? computeGradeOutcome(g.score, g.maxScore, scale) : null;
                return (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium">
                      {maps.coursesById.get(g.courseId)?.title ?? "Course"}
                    </TableCell>
                    <TableCell>{g.assessmentTitle}</TableCell>
                    <TableCell className="text-xs capitalize text-muted-foreground">
                      {g.assessmentType}
                    </TableCell>
                    <TableCell className="font-mono text-xs font-bold tabular-nums">
                      {g.score}/{g.maxScore} ({outcome?.percent ?? 0}%)
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">{outcome?.letter ?? "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {g.remarks || outcome?.remark || "—"}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Panel>
    </div>
  );
}

/* ========================================================================== */
/* 3.7 LEARNING PROGRESS                                                      */
/* ========================================================================== */

export function StudentLearningProgressModule({
  data,
  onStartCourse,
}: {
  data: StudentDataHandle;
  onStartCourse: (courseId: string, lessonId?: string) => void;
}) {
  const { db, workspace, maps } = data;

  const courseRows = useMemo(() => {
    return maps.myCourses.map((course) => {
      const lessons = maps.lessonsByCourse.get(course.id) ?? [];
      const done = lessons.filter((l) => maps.completedLessonIdSet.has(l.id)).length;
      const pct = lessons.length ? Math.round((done / lessons.length) * 100) : 0;
      const nextLesson = lessons.find((l) => !maps.completedLessonIdSet.has(l.id)) ?? lessons[0];
      const completion = workspace?.courseCompletions.find((cc) => cc.courseId === course.id);
      const assignmentsForCourse = (workspace?.assignments ?? []).filter(
        (a) => a.courseId === course.id,
      );
      const completedAssignments = (workspace?.assignmentSubmissions ?? []).filter(
        (s) => s.courseId === course.id && (s.status === "submitted" || s.status === "graded"),
      ).length;
      return {
        course,
        lessonsTotal: lessons.length,
        lessonsDone: done,
        pct,
        nextLesson,
        completion,
        assignmentsTotal: assignmentsForCourse.length,
        completedAssignments,
      };
    });
  }, [maps, workspace]);

  const totalLessons = courseRows.reduce((s, r) => s + r.lessonsTotal, 0);
  const totalDone = courseRows.reduce((s, r) => s + r.lessonsDone, 0);
  const overallPct = totalLessons ? Math.round((totalDone / totalLessons) * 100) : 0;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Learning Progress"
        description="Track completed lessons, remaining milestones, and official completion status across every enrolled course."
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Overall Curriculum Progress"
          value={<span className="tabular-nums">{overallPct}%</span>}
          icon={BarChart3}
          hint={`${totalDone} of ${totalLessons} lessons finished`}
          index={0}
        />
        <StatCard
          label="Recent Lesson Completions"
          value={<span className="tabular-nums">{db.progress.length}</span>}
          icon={CheckCircle2}
          tone="gold"
          index={1}
        />
        <StatCard
          label="Confirmed Completions"
          value={
            <span className="tabular-nums">
              {
                courseRows.filter(
                  (r) =>
                    r.completion?.status === "confirmed" ||
                    r.completion?.status === "completed" ||
                    (r.lessonsTotal > 0 && r.lessonsDone >= r.lessonsTotal),
                ).length
              }
            </span>
          }
          icon={Award}
          tone="deep"
          index={2}
        />
      </div>

      <Panel title="Per-Course Milestone Breakdown">
        {courseRows.length === 0 ? (
          <EmptyState
            title="No courses in progress"
            text="Enroll in a course to track your lesson and assessment milestones."
            icon={BarChart3}
          />
        ) : (
          <div className="space-y-4">
            {courseRows.map((row) => (
              <div
                key={row.course.id}
                className="rounded-xl border border-border p-4 space-y-3"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-semibold">{row.course.title}</h3>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      Lessons: {row.lessonsDone}/{row.lessonsTotal} · Assignments:{" "}
                      {row.completedAssignments}/{row.assignmentsTotal} · Status:{" "}
                      {row.completion?.status ?? (row.pct >= 100 ? "completed" : "in progress")}
                    </p>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => onStartCourse(row.course.id, row.nextLesson?.id)}
                  >
                    <PlayCircle className="h-3.5 w-3.5" /> Resume
                  </Button>
                </div>
                <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-all"
                    style={{ width: `${row.pct}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ========================================================================== */
/* 3.8 MY CERTIFICATES                                                        */
/* ========================================================================== */

export function StudentCertificatesModule({ data }: { data: StudentDataHandle }) {
  const { profile } = useAuth();
  const { workspace, maps, setPrintable, can } = data;
  const certs = (workspace?.issuedCertificates ?? []).filter((c) => c.status === "issued");
  const templatesById = useMemo(
    () => new Map((workspace?.certificateTemplates ?? []).map((t) => [t.id, t])),
    [workspace?.certificateTemplates],
  );

  function printCertificate(certId: string) {
    const cert = certs.find((c) => c.id === certId);
    if (!cert) return;
    const tpl =
      templatesById.get(cert.templateId) ?? workspace?.certificateTemplates[0];
    const courseTitle = maps.coursesById.get(cert.courseId)?.title ?? "Ezana Academy Course";
    const studentName = profile ? displayName(profile) : "Student";
    setPrintable({
      title: tpl?.title ?? "Certificate of Completion",
      subtitle: tpl?.subtitle ?? "Ezana Academy",
      meta: [
        { label: "Recipient", value: studentName },
        { label: "Course", value: courseTitle },
        { label: "Verification Code", value: cert.certificateCode },
      ],
      columns: ["Detail", "Record"],
      rows: [
        ["Statement", tpl?.bodyText ?? "Successfully completed all course requirements."],
        ["Completion", `${cert.completionPercent}%`],
        ["Final Grade", cert.finalGrade || "Pass"],
        ["Issued Date", new Date(cert.issuedAt).toLocaleDateString()],
        ["Signatory", `${tpl?.signatoryName ?? "Ezana Academy"} (${tpl?.signatoryTitle ?? "Academic Board"})`],
      ],
      footerNote: `Verified by Ezana Academy · Certificate ID ${cert.certificateCode}`,
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Certificates"
        description="Official earned completion certificates issued after finishing required coursework."
      />

      <Panel>
        {certs.length === 0 ? (
          <EmptyState
            title="No certificates issued yet"
            text="Complete your enrolled courses and assessments to receive verified certificates from Ezana Academy."
            icon={Award}
          />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {certs.map((cert) => {
              const courseTitle = maps.coursesById.get(cert.courseId)?.title ?? "Course";
              return (
                <article
                  key={cert.id}
                  className="flex flex-col justify-between rounded-2xl border border-gold/40 bg-secondary/25 p-5"
                >
                  <div>
                    <p className="font-mono text-xs font-bold text-primary tabular-nums">
                      Code: {cert.certificateCode}
                    </p>
                    <h3 className="mt-1 font-display text-lg font-semibold">{courseTitle}</h3>
                    <p className="mt-1 text-xs text-muted-foreground tabular-nums">
                      Completion: {cert.completionPercent}% · Final Grade:{" "}
                      {cert.finalGrade || "Pass"} · Issued{" "}
                      {new Date(cert.issuedAt).toLocaleDateString()}
                    </p>
                    {cert.notes && (
                      <p className="mt-2 text-xs text-muted-foreground">{cert.notes}</p>
                    )}
                  </div>
                  <div className="mt-4 flex justify-end border-t border-border pt-3">
                    {can("certificates", "export") && (
                      <Button
                        type="button"
                        size="sm"
                        variant="emerald"
                        onClick={() => printCertificate(cert.id)}
                      >
                        <Printer className="h-3.5 w-3.5" /> View / Print Certificate
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </Panel>
    </div>
  );
}
