import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  Archive,
  ArrowDownToLine,
  Award,
  CheckCircle2,
  ClipboardList,
  ExternalLink,
  FileCheck2,
  FilePlus2,
  HelpCircle,
  Lock,
  Plus,
  Printer,
  RotateCcw,
  Search,
  Trash2,
} from "lucide-react";
import { displayName, useAuth } from "@/lib/auth";
import { downloadExcelXls } from "@/lib/export";
import {
  buildReportCard,
  computeAssignmentStats,
  computeExamStats,
  computeGradeOutcome,
  paginateRows,
} from "@/lib/owner/logic";
import type {
  AssignmentSubmission,
  CourseAssignment,
  ExamAssessment,
  ExamQuestion,
  GradeAssessmentType,
  QuestionBankItem,
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
  if (t.startsWith("/")) return t;
  try {
    const u = new URL(t);
    if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
  } catch {
    return "";
  }
  return "";
}

/* ========================================================================== */
/* CREATE & MANAGE ASSIGNMENTS                                                */
/* ========================================================================== */

export function InstructorAssignmentsModule({
  data,
  mode = "manage",
}: {
  data: InstructorDataHandle;
  mode?: "create" | "manage";
}) {
  const { user } = useAuth();
  const { db, workspace, maps, mutateWorkspace, can } = data;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [courseFilter, setCourseFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [editing, setEditing] = useState<CourseAssignment | null>(null);
  const [editorOpen, setEditorOpen] = useState(mode === "create");

  const [form, setForm] = useState({
    courseId: db.courses[0]?.id ?? "",
    classSectionId: "",
    title: "",
    description: "",
    instructions: "",
    dueDate: new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10),
    maxScore: "100",
    attachmentUrl: "",
    attachmentName: "",
    status: "published" as CourseAssignment["status"],
  });

  useEffect(() => {
    if (mode === "create") {
      openEditor(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode]);

  function openEditor(a: CourseAssignment | null) {
    setEditing(a);
    setForm({
      courseId: a?.courseId ?? db.courses[0]?.id ?? "",
      classSectionId: a?.classSectionId ?? "",
      title: a?.title ?? "",
      description: a?.description ?? "",
      instructions: a?.instructions ?? "",
      dueDate: a?.dueDate ?? new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10),
      maxScore: String(a?.maxScore ?? 100),
      attachmentUrl: a?.attachmentUrl ?? "",
      attachmentName: a?.attachmentName ?? "",
      status: a?.status ?? "published",
    });
    setEditorOpen(true);
  }

  const filtered = useMemo(() => {
    return (workspace?.assignments ?? []).filter((a) => {
      if (statusFilter !== "all" && a.status !== statusFilter) return false;
      if (courseFilter !== "all" && a.courseId !== courseFilter) return false;
      if (!search.trim()) return true;
      return `${a.title} ${a.description}`.toLowerCase().includes(search.trim().toLowerCase());
    });
  }, [workspace?.assignments, statusFilter, courseFilter, search]);

  const paged = useMemo(() => paginateRows(filtered, page, 8), [filtered, page]);

  async function saveAssignment(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !form.courseId || !form.title.trim()) return;
    const cleanUrl = form.attachmentUrl.trim() ? safeUrl(form.attachmentUrl) : "";
    if (form.attachmentUrl.trim() && !cleanUrl) {
      toast.error("Attachment URL must be http/https or site-relative.");
      return;
    }
    const now = new Date().toISOString();
    const payload: CourseAssignment = {
      id: editing?.id ?? crypto.randomUUID(),
      courseId: form.courseId,
      classSectionId: form.classSectionId || null,
      instructorId: user.id,
      title: form.title.trim(),
      description: form.description.trim(),
      instructions: form.instructions.trim(),
      dueDate: form.dueDate,
      maxScore: Math.max(1, Number(form.maxScore) || 100),
      attachmentUrl: cleanUrl,
      attachmentName: form.attachmentName.trim() || (cleanUrl ? "Assignment Brief" : ""),
      status: form.status,
      createdAt: editing?.createdAt ?? now,
      updatedAt: now,
    };
    await mutateWorkspace(
      { type: "upsert_assignment", payload },
      editing ? "Assignment updated" : "Assignment saved",
    );
    if (!editing && payload.status === "published") {
      await mutateWorkspace({
        type: "create_notification",
        payload: {
          title: `New Assignment: ${payload.title}`,
          message: `Due ${payload.dueDate} (${payload.maxScore} pts).`,
          category: "academic",
          targetRole: "student",
          targetCourseId: payload.courseId,
          targetClassId: payload.classSectionId,
        },
      });
    }
    setEditorOpen(false);
  }

  async function setAssignmentStatus(a: CourseAssignment, status: CourseAssignment["status"]) {
    await mutateWorkspace(
      { type: "upsert_assignment", payload: { ...a, status } },
      `Assignment marked ${status}`,
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title={mode === "create" ? "Create Assignments" : "Manage Assignments"}
        description={
          mode === "create"
            ? "Create assignments with instructions, submission deadlines, maximum points, and supporting attachments."
            : "Update assignment instructions and deadlines, track submission progress, and close, reopen, or archive work."
        }
        actions={
          can("exams", "edit") && (
            <Button
              type="button"
              variant="emerald"
              size="sm"
              disabled={db.courses.length === 0}
              onClick={() => openEditor(null)}
            >
              <FilePlus2 className="h-4 w-4" />
              New Assignment
            </Button>
          )
        }
      />

      <Panel
        title="Course Assignments"
        actions={
          <div className="flex flex-wrap gap-2">
            <Input
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              placeholder="Search assignment…"
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
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value);
                setPage(1);
              }}
              className="h-9 rounded-md border border-input bg-background px-2.5 text-xs"
            >
              <option value="all">All statuses</option>
              <option value="published">Published</option>
              <option value="draft">Draft</option>
              <option value="closed">Closed</option>
              <option value="archived">Archived</option>
            </select>
          </div>
        }
      >
        {paged.items.length > 0 ? (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Assignment</TableHead>
                  <TableHead>Course</TableHead>
                  <TableHead>Deadline</TableHead>
                  <TableHead>Submissions</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.items.map((a) => {
                  const enrolledCount = db.enrollments.filter((e) => e.course_id === a.courseId).length;
                  const st = computeAssignmentStats(
                    a,
                    workspace?.assignmentSubmissions ?? [],
                    enrolledCount,
                  );
                  return (
                    <TableRow key={a.id}>
                      <TableCell>
                        <p className="font-semibold text-sm">{a.title}</p>
                        <p className="text-xs text-muted-foreground">Max {a.maxScore} pts</p>
                      </TableCell>
                      <TableCell className="text-xs">
                        {maps.coursesById.get(a.courseId)?.title ?? "Course"}
                      </TableCell>
                      <TableCell className="text-xs">{a.dueDate}</TableCell>
                      <TableCell className="text-xs">
                        <p>
                          {st.submittedCount}/{enrolledCount} submitted
                        </p>
                        <p className="text-muted-foreground">{st.gradedCount} graded</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant={STATUS_BADGE[a.status] ?? "outline"}>{a.status}</Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="inline-flex flex-wrap justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => openEditor(a)}
                          >
                            Edit
                          </Button>
                          {a.status === "published" && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void setAssignmentStatus(a, "closed")}
                            >
                              <Lock className="h-3.5 w-3.5" />
                              Close
                            </Button>
                          )}
                          {(a.status === "closed" || a.status === "draft") && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void setAssignmentStatus(a, "published")}
                            >
                              <RotateCcw className="h-3.5 w-3.5" />
                              {a.status === "draft" ? "Publish" : "Reopen"}
                            </Button>
                          )}
                          {a.status !== "archived" && (
                            <Button
                              type="button"
                              size="sm"
                              variant="outline"
                              onClick={() => void setAssignmentStatus(a, "archived")}
                            >
                              <Archive className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {can("exams", "delete") && (
                            <ConfirmButton
                              title="Delete Assignment?"
                              description={`Delete "${a.title}" and its submission records?`}
                              onConfirm={() =>
                                void mutateWorkspace(
                                  { type: "delete_assignment", id: a.id },
                                  "Assignment deleted",
                                )
                              }
                              trigger={
                                <Button type="button" variant="ghost" size="sm" aria-label="Delete assignment">
                                  <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                </Button>
                              }
                            />
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
            <Pager page={paged.page} pageCount={paged.pageCount} onPage={setPage} />
          </>
        ) : (
          <EmptyState
            title="No assignments created yet"
            text="Create an assignment to collect student submissions and evaluate practical coursework."
            icon={ClipboardList}
          />
        )}
      </Panel>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Assignment" : "Create Assignment"}</DialogTitle>
            <DialogDescription>
              Assign coursework with clear guidelines, due dates, and maximum marks.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => void saveAssignment(e)}>
            <label className="block space-y-1 text-sm font-medium">
              Assignment Title
              <Input
                required
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Excel Sales Dashboard Exercise"
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
                Due Date
                <Input
                  type="date"
                  required
                  value={form.dueDate}
                  onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
                />
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Max Score
                <Input
                  type="number"
                  min={1}
                  required
                  value={form.maxScore}
                  onChange={(e) => setForm((f) => ({ ...f, maxScore: e.target.value }))}
                />
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Status
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value as CourseAssignment["status"] }))
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="published">Published</option>
                  <option value="draft">Draft</option>
                  <option value="closed">Closed</option>
                </select>
              </label>
            </div>
            <label className="block space-y-1 text-sm font-medium">
              Summary Description
              <Input
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Brief overview shown in assignment cards"
              />
            </label>
            <label className="block space-y-1 text-sm font-medium">
              Detailed Instructions
              <Textarea
                rows={4}
                value={form.instructions}
                onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
                placeholder="Step-by-step deliverables, rubric criteria, and format expectations…"
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm font-medium">
                Supporting Material URL (optional)
                <Input
                  value={form.attachmentUrl}
                  onChange={(e) => setForm((f) => ({ ...f, attachmentUrl: e.target.value }))}
                  placeholder="https://..."
                />
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Attachment Label
                <Input
                  value={form.attachmentName}
                  onChange={(e) => setForm((f) => ({ ...f, attachmentName: e.target.value }))}
                  placeholder="Starter Dataset.xlsx"
                />
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="emerald" disabled={data.mutating}>
                {editing ? "Update Assignment" : "Save Assignment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ========================================================================== */
/* QUIZZES & EXAMS                                                            */
/* ========================================================================== */

export function InstructorExamsModule({ data }: { data: InstructorDataHandle }) {
  const { user } = useAuth();
  const { db, workspace, maps, mutateWorkspace, can } = data;
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<ExamAssessment | null>(null);
  const [form, setForm] = useState({
    title: "",
    courseId: db.courses[0]?.id ?? "",
    termId: workspace?.terms[0]?.id ?? "",
    examType: "quiz" as ExamAssessment["examType"],
    scheduledDate: new Date().toISOString().slice(0, 10),
    dueDate: new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10),
    startTime: "09:00",
    durationMinutes: "45",
    maxScore: "100",
    passingScore: "60",
    instructions: "",
    status: "scheduled" as ExamAssessment["status"],
    questions: [] as ExamQuestion[],
  });

  function openEditor(ex: ExamAssessment | null) {
    setEditing(ex);
    setForm({
      title: ex?.title ?? "",
      courseId: ex?.courseId ?? db.courses[0]?.id ?? "",
      termId: ex?.termId ?? workspace?.terms[0]?.id ?? "",
      examType: ex?.examType ?? "quiz",
      scheduledDate: ex?.scheduledDate ?? new Date().toISOString().slice(0, 10),
      dueDate: ex?.dueDate ?? new Date(Date.now() + 7 * 86400_000).toISOString().slice(0, 10),
      startTime: ex?.startTime ?? "09:00",
      durationMinutes: String(ex?.durationMinutes ?? 45),
      maxScore: String(ex?.maxScore ?? 100),
      passingScore: String(ex?.passingScore ?? 60),
      instructions: ex?.instructions ?? "",
      status: ex?.status ?? "scheduled",
      questions: ex?.questions ?? [],
    });
    setEditorOpen(true);
  }

  function addInlineQuestion() {
    setForm((f) => ({
      ...f,
      questions: [
        ...f.questions,
        {
          id: crypto.randomUUID(),
          prompt: "",
          questionType: "multiple_choice",
          options: ["Option A", "Option B", "Option C", "Option D"],
          correctAnswer: "Option A",
          points: 10,
        },
      ],
    }));
  }

  function importFromQuestionBank(q: QuestionBankItem) {
    if (form.questions.some((x) => x.id === q.id)) return;
    setForm((f) => ({
      ...f,
      questions: [
        ...f.questions,
        {
          id: q.id,
          prompt: q.prompt,
          questionType: q.questionType,
          options: q.options,
          correctAnswer: q.correctAnswer,
          points: q.points,
        },
      ],
    }));
    toast.success("Added question from Question Bank");
  }

  async function saveExam(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !form.courseId || !form.title.trim()) return;
    const payload: ExamAssessment = {
      id: editing?.id ?? crypto.randomUUID(),
      title: form.title.trim(),
      courseId: form.courseId,
      termId: form.termId || null,
      instructorId: user.id,
      examType: form.examType,
      scheduledDate: form.scheduledDate,
      dueDate: form.dueDate || null,
      startTime: form.startTime,
      durationMinutes: Math.max(5, Number(form.durationMinutes) || 45),
      maxScore: Math.max(1, Number(form.maxScore) || 100),
      passingScore: Math.max(0, Number(form.passingScore) || 50),
      instructions: form.instructions.trim(),
      questions: form.questions.filter((q) => q.prompt.trim()),
      status: form.status,
      createdAt: editing?.createdAt ?? new Date().toISOString(),
    };
    await mutateWorkspace(
      { type: "upsert_exam", payload },
      editing ? "Assessment updated" : "Quiz / Exam saved",
    );
    setEditorOpen(false);
  }

  const courseQuestions = useMemo(
    () => (workspace?.questionBank ?? []).filter((q) => q.courseId === form.courseId),
    [workspace?.questionBank, form.courseId],
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quizzes & Exams"
        description="Build quizzes and examinations, attach Question Bank items, set time windows, and monitor completion."
        actions={
          can("exams", "edit") && (
            <Button
              type="button"
              variant="emerald"
              size="sm"
              disabled={db.courses.length === 0}
              onClick={() => openEditor(null)}
            >
              <Plus className="h-4 w-4" />
              Create Quiz / Exam
            </Button>
          )
        }
      />

      <Panel title="Scheduled Quizzes & Examinations">
        {(workspace?.exams ?? []).length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Assessment</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Date & Duration</TableHead>
                <TableHead>Completion & Pass Rate</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(workspace?.exams ?? []).map((ex) => {
                const st = computeExamStats(ex, workspace?.examSubmissions ?? []);
                return (
                  <TableRow key={ex.id}>
                    <TableCell>
                      <p className="font-semibold text-sm">{ex.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {ex.examType} · {ex.questions.length} questions · Pass {ex.passingScore}/
                        {ex.maxScore}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs">
                      {maps.coursesById.get(ex.courseId)?.title ?? "Course"}
                    </TableCell>
                    <TableCell className="text-xs">
                      <p>{ex.scheduledDate}</p>
                      <p className="text-muted-foreground">
                        {ex.startTime} ({ex.durationMinutes} min)
                      </p>
                    </TableCell>
                    <TableCell className="text-xs">
                      <p>
                        {st.gradedCount}/{st.totalSubmissions} graded
                      </p>
                      <p className="text-muted-foreground">
                        Avg {st.averageScore} · Pass {st.passRate}%
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge variant={STATUS_BADGE[ex.status] ?? "outline"}>{ex.status}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => openEditor(ex)}
                        >
                          Edit
                        </Button>
                        {can("exams", "delete") && (
                          <ConfirmButton
                            title="Delete Assessment?"
                            description={`Remove "${ex.title}"?`}
                            onConfirm={() =>
                              void mutateWorkspace(
                                { type: "delete_exam", id: ex.id },
                                "Assessment deleted",
                              )
                            }
                            trigger={
                              <Button type="button" variant="ghost" size="sm" aria-label="Delete assessment">
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            }
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="No quizzes or exams yet"
            text="Create a quiz or examination for your assigned courses."
            icon={FileCheck2}
          />
        )}
      </Panel>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Quiz / Exam" : "Create Quiz / Exam"}</DialogTitle>
            <DialogDescription>
              Configure scoring rules, dates, and attach questions inline or from your Question Bank.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-4" onSubmit={(e) => void saveExam(e)}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm font-medium">
                Title
                <Input
                  required
                  value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                />
              </label>
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
            </div>

            <div className="grid gap-3 sm:grid-cols-4">
              <label className="block space-y-1 text-sm font-medium">
                Type
                <select
                  value={form.examType}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      examType: e.target.value as ExamAssessment["examType"],
                    }))
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="quiz">Quiz</option>
                  <option value="midterm">Midterm</option>
                  <option value="final">Final Exam</option>
                  <option value="practical">Practical</option>
                </select>
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Date
                <Input
                  type="date"
                  value={form.scheduledDate}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledDate: e.target.value }))}
                />
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Duration (min)
                <Input
                  type="number"
                  min={5}
                  value={form.durationMinutes}
                  onChange={(e) => setForm((f) => ({ ...f, durationMinutes: e.target.value }))}
                />
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Status
                <select
                  value={form.status}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, status: e.target.value as ExamAssessment["status"] }))
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="draft">Draft</option>
                  <option value="scheduled">Scheduled</option>
                  <option value="active">Active</option>
                  <option value="completed">Completed</option>
                </select>
              </label>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm font-medium">
                Max Score
                <Input
                  type="number"
                  min={1}
                  value={form.maxScore}
                  onChange={(e) => setForm((f) => ({ ...f, maxScore: e.target.value }))}
                />
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Passing Score
                <Input
                  type="number"
                  min={0}
                  value={form.passingScore}
                  onChange={(e) => setForm((f) => ({ ...f, passingScore: e.target.value }))}
                />
              </label>
            </div>

            <label className="block space-y-1 text-sm font-medium">
              Instructions
              <Textarea
                rows={2}
                value={form.instructions}
                onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
              />
            </label>

            {courseQuestions.length > 0 && (
              <div className="rounded-xl border border-border bg-secondary/25 p-3 space-y-2">
                <p className="text-xs font-semibold">Reuse Questions from Question Bank</p>
                <div className="flex flex-wrap gap-1.5">
                  {courseQuestions.map((q) => (
                    <Button
                      key={q.id}
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => importFromQuestionBank(q)}
                    >
                      + {q.prompt.slice(0, 36)}
                      {q.prompt.length > 36 ? "…" : ""} ({q.points} pts)
                    </Button>
                  ))}
                </div>
              </div>
            )}

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">Questions ({form.questions.length})</p>
                <Button type="button" size="sm" variant="outline" onClick={addInlineQuestion}>
                  <Plus className="h-3.5 w-3.5" />
                  Add Question
                </Button>
              </div>
              {form.questions.map((q, idx) => (
                <div key={q.id} className="rounded-xl border border-border p-3 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-semibold">Question #{idx + 1}</span>
                    <button
                      type="button"
                      className="text-xs text-destructive hover:underline"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          questions: f.questions.filter((x) => x.id !== q.id),
                        }))
                      }
                    >
                      Remove
                    </button>
                  </div>
                  <Input
                    placeholder="Question prompt"
                    value={q.prompt}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        questions: f.questions.map((x) =>
                          x.id === q.id ? { ...x, prompt: e.target.value } : x,
                        ),
                      }))
                    }
                  />
                  <div className="grid gap-2 sm:grid-cols-3">
                    <select
                      value={q.questionType}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          questions: f.questions.map((x) =>
                            x.id === q.id
                              ? {
                                  ...x,
                                  questionType: e.target.value as ExamQuestion["questionType"],
                                }
                              : x,
                          ),
                        }))
                      }
                      className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value="multiple_choice">Multiple Choice</option>
                      <option value="true_false">True / False</option>
                      <option value="short_answer">Short Answer</option>
                      <option value="practical">Practical</option>
                    </select>
                    <Input
                      placeholder="Answer key"
                      value={q.correctAnswer}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          questions: f.questions.map((x) =>
                            x.id === q.id ? { ...x, correctAnswer: e.target.value } : x,
                          ),
                        }))
                      }
                      className="h-9 text-xs"
                    />
                    <Input
                      type="number"
                      min={1}
                      placeholder="Points"
                      value={q.points}
                      onChange={(e) =>
                        setForm((f) => ({
                          ...f,
                          questions: f.questions.map((x) =>
                            x.id === q.id ? { ...x, points: Number(e.target.value) || 1 } : x,
                          ),
                        }))
                      }
                      className="h-9 text-xs"
                    />
                  </div>
                </div>
              ))}
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="emerald" disabled={data.mutating}>
                Save Assessment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ========================================================================== */
/* QUESTION BANK                                                              */
/* ========================================================================== */

export function InstructorQuestionBankModule({ data }: { data: InstructorDataHandle }) {
  const { user } = useAuth();
  const { db, workspace, maps, mutateWorkspace, can } = data;
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [editorOpen, setEditorOpen] = useState(false);
  const [editing, setEditing] = useState<QuestionBankItem | null>(null);
  const [form, setForm] = useState({
    courseId: db.courses[0]?.id ?? "",
    subjectId: "",
    topic: "",
    prompt: "",
    questionType: "multiple_choice" as QuestionBankItem["questionType"],
    optionsText: "Option A\nOption B\nOption C\nOption D",
    correctAnswer: "Option A",
    points: "5",
    difficulty: "medium" as QuestionBankItem["difficulty"],
  });

  const questions = useMemo(() => {
    return (workspace?.questionBank ?? []).filter((q) => {
      if (courseFilter !== "all" && q.courseId !== courseFilter) return false;
      if (typeFilter !== "all" && q.questionType !== typeFilter) return false;
      if (!search.trim()) return true;
      return `${q.prompt} ${q.topic}`.toLowerCase().includes(search.trim().toLowerCase());
    });
  }, [workspace?.questionBank, courseFilter, typeFilter, search]);

  function openEditor(q: QuestionBankItem | null) {
    setEditing(q);
    setForm({
      courseId: q?.courseId ?? db.courses[0]?.id ?? "",
      subjectId: q?.subjectId ?? "",
      topic: q?.topic ?? "",
      prompt: q?.prompt ?? "",
      questionType: q?.questionType ?? "multiple_choice",
      optionsText: (q?.options ?? ["Option A", "Option B", "Option C", "Option D"]).join("\n"),
      correctAnswer: q?.correctAnswer ?? "",
      points: String(q?.points ?? 5),
      difficulty: q?.difficulty ?? "medium",
    });
    setEditorOpen(true);
  }

  async function saveQuestion(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !form.courseId || !form.prompt.trim()) return;
    const options =
      form.questionType === "true_false"
        ? ["True", "False"]
        : form.questionType === "multiple_choice"
          ? form.optionsText
              .split("\n")
              .map((s) => s.trim())
              .filter(Boolean)
          : [];
    const now = new Date().toISOString();
    await mutateWorkspace(
      {
        type: "upsert_question_bank_item",
        payload: {
          id: editing?.id ?? crypto.randomUUID(),
          courseId: form.courseId,
          subjectId: form.subjectId || null,
          instructorId: user.id,
          topic: form.topic.trim() || "General",
          prompt: form.prompt.trim(),
          questionType: form.questionType,
          options,
          correctAnswer: form.correctAnswer.trim(),
          points: Math.max(1, Number(form.points) || 5),
          difficulty: form.difficulty,
          createdAt: editing?.createdAt ?? now,
          updatedAt: now,
        },
      },
      editing ? "Question updated" : "Question added to bank",
    );
    setEditorOpen(false);
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Question Bank"
        description="Build and organize reusable multiple-choice, true/false, short-answer, and practical questions by course and topic."
        actions={
          can("exams", "edit") && (
            <Button
              type="button"
              variant="emerald"
              size="sm"
              disabled={db.courses.length === 0}
              onClick={() => openEditor(null)}
            >
              <Plus className="h-4 w-4" />
              Add Question
            </Button>
          )
        }
      />

      <Panel
        title="Assessment Question Repository"
        actions={
          <div className="flex flex-wrap gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search question or topic…"
              className="h-9 w-44 text-xs"
            />
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
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2.5 text-xs"
            >
              <option value="all">All types</option>
              <option value="multiple_choice">Multiple Choice</option>
              <option value="true_false">True / False</option>
              <option value="short_answer">Short Answer</option>
              <option value="practical">Practical</option>
            </select>
          </div>
        }
      >
        {questions.length > 0 ? (
          <div className="space-y-2.5">
            {questions.map((q) => (
              <div
                key={q.id}
                className="flex flex-wrap items-start justify-between gap-3 rounded-xl border border-border p-3.5"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant="outline">{q.questionType.replace("_", " ")}</Badge>
                    <Badge variant="secondary">{q.difficulty}</Badge>
                    <span className="text-xs text-muted-foreground">
                      {maps.coursesById.get(q.courseId)?.title ?? "Course"} · {q.topic} ·{" "}
                      {q.points} pts
                    </span>
                  </div>
                  <p className="mt-1.5 text-sm font-medium">{q.prompt}</p>
                  {q.correctAnswer && (
                    <p className="mt-1 text-xs text-muted-foreground">Answer: {q.correctAnswer}</p>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button type="button" size="sm" variant="outline" onClick={() => openEditor(q)}>
                    Edit
                  </Button>
                  {can("exams", "delete") && (
                    <ConfirmButton
                      title="Delete Question?"
                      description="Remove this question from the Question Bank?"
                      onConfirm={() =>
                        void mutateWorkspace(
                          { type: "delete_question_bank_item", id: q.id },
                          "Question deleted",
                        )
                      }
                      trigger={
                        <Button type="button" variant="ghost" size="sm" aria-label="Delete question">
                          <Trash2 className="h-3.5 w-3.5 text-destructive" />
                        </Button>
                      }
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Question Bank is empty"
            text="Add questions here so you can reuse them across quizzes and exams."
            icon={HelpCircle}
          />
        )}
      </Panel>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Edit Question" : "Add Question Bank Item"}</DialogTitle>
            <DialogDescription>Organize reusable questions by course and topic.</DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => void saveQuestion(e)}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm font-medium">
                Course
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
                Topic
                <Input
                  value={form.topic}
                  onChange={(e) => setForm((f) => ({ ...f, topic: e.target.value }))}
                  placeholder="Formulas & Functions"
                />
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block space-y-1 text-sm font-medium">
                Type
                <select
                  value={form.questionType}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      questionType: e.target.value as QuestionBankItem["questionType"],
                    }))
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="multiple_choice">Multiple Choice</option>
                  <option value="true_false">True / False</option>
                  <option value="short_answer">Short Answer</option>
                  <option value="practical">Practical</option>
                </select>
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Difficulty
                <select
                  value={form.difficulty}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      difficulty: e.target.value as QuestionBankItem["difficulty"],
                    }))
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Points
                <Input
                  type="number"
                  min={1}
                  value={form.points}
                  onChange={(e) => setForm((f) => ({ ...f, points: e.target.value }))}
                />
              </label>
            </div>
            <label className="block space-y-1 text-sm font-medium">
              Question Prompt
              <Textarea
                required
                rows={3}
                value={form.prompt}
                onChange={(e) => setForm((f) => ({ ...f, prompt: e.target.value }))}
              />
            </label>
            {form.questionType === "multiple_choice" && (
              <label className="block space-y-1 text-sm font-medium">
                Answer Choices (one per line)
                <Textarea
                  rows={3}
                  value={form.optionsText}
                  onChange={(e) => setForm((f) => ({ ...f, optionsText: e.target.value }))}
                />
              </label>
            )}
            <label className="block space-y-1 text-sm font-medium">
              Correct Answer / Expected Key
              <Input
                value={form.correctAnswer}
                onChange={(e) => setForm((f) => ({ ...f, correctAnswer: e.target.value }))}
              />
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="emerald" disabled={data.mutating}>
                Save Question
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ========================================================================== */
/* SUBMISSIONS & GRADING EVALUATION                                           */
/* ========================================================================== */

export function InstructorSubmissionsModule({
  data,
  mode = "submissions",
}: {
  data: InstructorDataHandle;
  mode?: "submissions" | "grading";
}) {
  const { db, workspace, maps, mutateWorkspace, can } = data;
  const [assignmentId, setAssignmentId] = useState(workspace?.assignments[0]?.id ?? "");
  const [statusFilter, setStatusFilter] = useState(mode === "grading" ? "needs_grading" : "all");
  const [search, setSearch] = useState("");
  const [gradingTarget, setGradingTarget] = useState<{
    submission: AssignmentSubmission | null;
    assignment: CourseAssignment;
    studentId: string;
  } | null>(null);
  const [gradeForm, setGradeForm] = useState({
    score: "0",
    feedback: "",
    status: "graded" as "graded" | "returned",
    syncToGradebook: true,
  });

  const activeAssignment =
    (workspace?.assignments ?? []).find((a) => a.id === assignmentId) ??
    workspace?.assignments[0] ??
    null;

  const rosterRows = useMemo(() => {
    if (!activeAssignment) return [];
    const enrolledStudents = db.enrollments
      .filter((e) => e.course_id === activeAssignment.courseId)
      .map((e) => e.user_id);

    const subsByStudent = new Map<string, AssignmentSubmission>();
    for (const s of workspace?.assignmentSubmissions ?? []) {
      if (s.assignmentId === activeAssignment.id) {
        subsByStudent.set(s.studentId, s);
      }
    }

    return enrolledStudents
      .map((sid) => {
        const student = maps.profilesById.get(sid);
        const submission = subsByStudent.get(sid) ?? null;
        const derivedStatus = submission ? submission.status : "missing";
        return { studentId: sid, student, submission, derivedStatus };
      })
      .filter((row) => {
        if (statusFilter === "needs_grading") {
          if (row.derivedStatus !== "submitted" && row.derivedStatus !== "late") return false;
        } else if (statusFilter !== "all" && row.derivedStatus !== statusFilter) {
          return false;
        }
        if (!search.trim()) return true;
        const name = row.student ? displayName(row.student) : "";
        return `${name} ${row.student?.email ?? ""}`
          .toLowerCase()
          .includes(search.trim().toLowerCase());
      });
  }, [activeAssignment, db.enrollments, workspace?.assignmentSubmissions, maps.profilesById, statusFilter, search]);

  function openGradeDialog(
    assignment: CourseAssignment,
    studentId: string,
    submission: AssignmentSubmission | null,
  ) {
    setGradingTarget({ assignment, studentId, submission });
    setGradeForm({
      score: String(submission?.score ?? assignment.maxScore),
      feedback: submission?.feedback ?? "",
      status: "returned",
      syncToGradebook: true,
    });
  }

  async function submitGrade(e: React.FormEvent) {
    e.preventDefault();
    if (!gradingTarget) return;
    const scoreNum = Number(gradeForm.score);
    if (
      !Number.isFinite(scoreNum) ||
      scoreNum < 0 ||
      scoreNum > gradingTarget.assignment.maxScore
    ) {
      toast.error(`Score must be between 0 and ${gradingTarget.assignment.maxScore}.`);
      return;
    }

    await mutateWorkspace(
      {
        type: "grade_assignment_submission",
        payload: {
          submissionId: gradingTarget.submission?.id ?? crypto.randomUUID(),
          assignmentId: gradingTarget.assignment.id,
          courseId: gradingTarget.assignment.courseId,
          studentId: gradingTarget.studentId,
          score: scoreNum,
          feedback: gradeForm.feedback.trim(),
          status: gradeForm.status,
        },
      },
      gradeForm.status === "returned" ? "Work graded and returned to student" : "Grade saved",
    );

    if (gradeForm.syncToGradebook) {
      await mutateWorkspace({
        type: "upsert_grade",
        payload: {
          id: `asg-${gradingTarget.assignment.id}-${gradingTarget.studentId}`,
          studentId: gradingTarget.studentId,
          courseId: gradingTarget.assignment.courseId,
          termId: workspace?.terms.find((t) => t.isCurrent)?.id ?? null,
          assessmentTitle: gradingTarget.assignment.title,
          assessmentType: "assignment",
          score: scoreNum,
          maxScore: gradingTarget.assignment.maxScore,
          weight: 1,
          remarks: gradeForm.feedback.trim(),
          gradedAt: new Date().toISOString(),
        },
      });
    }
    setGradingTarget(null);
  }

  const pendingEvalTotal = (workspace?.assignmentSubmissions ?? []).filter(
    (s) => s.status === "submitted" || s.status === "late",
  ).length;
  const gradedTotal = (workspace?.assignmentSubmissions ?? []).filter(
    (s) => s.status === "graded" || s.status === "returned",
  ).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title={mode === "grading" ? "Grading & Evaluation" : "Submissions"}
        description={
          mode === "grading"
            ? "Score submitted assignments, write evaluation feedback, return graded work, and sync marks to the Gradebook."
            : "Review submitted, late, pending, and missing student work across your course assignments."
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Pending Evaluation"
          value={pendingEvalTotal}
          icon={ClipboardList}
          index={0}
        />
        <StatCard label="Graded & Returned" value={gradedTotal} icon={CheckCircle2} tone="gold" index={1} />
        <StatCard
          label="Active Assignments"
          value={(workspace?.assignments ?? []).filter((a) => a.status === "published").length}
          icon={Award}
          tone="deep"
          index={2}
        />
      </div>

      <Panel
        title={
          activeAssignment
            ? `Submissions — ${activeAssignment.title} (Max ${activeAssignment.maxScore})`
            : "Assignment Submissions"
        }
        actions={
          <div className="flex flex-wrap gap-2">
            <select
              value={activeAssignment?.id ?? ""}
              onChange={(e) => setAssignmentId(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2.5 text-xs"
            >
              {(workspace?.assignments ?? []).map((a) => (
                <option key={a.id} value={a.id}>
                  {a.title} ({maps.coursesById.get(a.courseId)?.title ?? "Course"})
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-9 rounded-md border border-input bg-background px-2.5 text-xs"
            >
              <option value="all">All students</option>
              <option value="needs_grading">Needs evaluation</option>
              <option value="submitted">Submitted</option>
              <option value="late">Late</option>
              <option value="missing">Not submitted</option>
              <option value="graded">Graded</option>
              <option value="returned">Returned</option>
            </select>
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search student…"
                className="h-9 w-40 pl-8 text-xs"
              />
            </div>
          </div>
        }
      >
        {activeAssignment && rosterRows.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submission Content</TableHead>
                <TableHead>Score</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rosterRows.map((row) => {
                const attHref = row.submission?.attachmentUrl
                  ? safeUrl(row.submission.attachmentUrl)
                  : "";
                return (
                  <TableRow key={row.studentId}>
                    <TableCell>
                      <p className="font-semibold text-sm">
                        {row.student ? displayName(row.student) : "Student"}
                      </p>
                      <p className="text-xs text-muted-foreground">{row.student?.email ?? "—"}</p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          row.derivedStatus === "returned" || row.derivedStatus === "graded"
                            ? "success"
                            : row.derivedStatus === "missing" || row.derivedStatus === "late"
                              ? "destructive"
                              : "secondary"
                        }
                      >
                        {row.derivedStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-xs text-xs">
                      <p className="line-clamp-2 text-muted-foreground">
                        {row.submission?.submittedText || "No text submitted yet."}
                      </p>
                      {attHref && (
                        <a
                          href={attHref}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="mt-1 inline-flex items-center gap-1 font-semibold text-primary hover:underline"
                        >
                          View Attachment <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </TableCell>
                    <TableCell className="text-xs font-semibold">
                      {row.submission?.score !== null && row.submission?.score !== undefined
                        ? `${row.submission.score}/${activeAssignment.maxScore}`
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {can("grades", "edit") && (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() =>
                            openGradeDialog(activeAssignment, row.studentId, row.submission)
                          }
                        >
                          {row.submission?.score !== null && row.submission?.score !== undefined
                            ? "Update Grade"
                            : "Evaluate & Grade"}
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title={activeAssignment ? "No matching student submissions" : "No assignments available"}
            text={
              activeAssignment
                ? "Adjust filters or wait for enrolled learners to submit work."
                : "Create an assignment first to inspect and grade student submissions."
            }
            icon={ClipboardList}
          />
        )}
      </Panel>

      <Dialog open={!!gradingTarget} onOpenChange={(o) => !o && setGradingTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Evaluate & Grade Submission</DialogTitle>
            <DialogDescription>
              {gradingTarget?.assignment.title} · Student:{" "}
              {gradingTarget
                ? (() => {
                    const p = maps.profilesById.get(gradingTarget.studentId);
                    return p ? displayName(p) : "Student";
                  })()
                : ""}
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => void submitGrade(e)}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm font-medium">
                Score (0 – {gradingTarget?.assignment.maxScore ?? 100})
                <Input
                  type="number"
                  min={0}
                  max={gradingTarget?.assignment.maxScore ?? 100}
                  step="0.5"
                  required
                  value={gradeForm.score}
                  onChange={(e) => setGradeForm((f) => ({ ...f, score: e.target.value }))}
                />
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Return Status
                <select
                  value={gradeForm.status}
                  onChange={(e) =>
                    setGradeForm((f) => ({
                      ...f,
                      status: e.target.value as "graded" | "returned",
                    }))
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="returned">Graded & Return to Student</option>
                  <option value="graded">Save Draft Grade</option>
                </select>
              </label>
            </div>
            <label className="block space-y-1 text-sm font-medium">
              Feedback & Rubric Comments
              <Textarea
                rows={4}
                value={gradeForm.feedback}
                onChange={(e) => setGradeForm((f) => ({ ...f, feedback: e.target.value }))}
                placeholder="Highlight strengths, deductions, and next steps…"
              />
            </label>
            <label className="flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={gradeForm.syncToGradebook}
                onChange={(e) =>
                  setGradeForm((f) => ({ ...f, syncToGradebook: e.target.checked }))
                }
              />
              Automatically sync score into Grades & Report Cards
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setGradingTarget(null)}>
                Cancel
              </Button>
              <Button type="submit" variant="emerald" disabled={data.mutating}>
                Save Evaluation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ========================================================================== */
/* GRADES & REPORT CARDS                                                      */
/* ========================================================================== */

export function InstructorGradebookModule({ data }: { data: InstructorDataHandle }) {
  const { db, workspace, maps, mutateWorkspace, can, setPrintable } = data;
  const [courseFilter, setCourseFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [editorOpen, setEditorOpen] = useState(false);
  const [form, setForm] = useState({
    studentId: maps.students[0]?.id ?? "",
    courseId: db.courses[0]?.id ?? "",
    assessmentTitle: "",
    assessmentType: "quiz" as GradeAssessmentType,
    score: "85",
    maxScore: "100",
    weight: "1",
    remarks: "",
  });

  const scale = workspace?.gradingScales.find((s) => s.isDefault) ?? workspace?.gradingScales[0];

  const grades = useMemo(() => {
    return (workspace?.grades ?? []).filter((g) => {
      if (courseFilter !== "all" && g.courseId !== courseFilter) return false;
      if (!search.trim()) return true;
      const stu = maps.profilesById.get(g.studentId);
      const name = stu ? displayName(stu) : "";
      return `${name} ${g.assessmentTitle}`.toLowerCase().includes(search.trim().toLowerCase());
    });
  }, [workspace?.grades, courseFilter, search, maps.profilesById]);

  async function saveGrade(e: React.FormEvent) {
    e.preventDefault();
    if (!form.studentId || !form.courseId || !form.assessmentTitle.trim()) return;
    await mutateWorkspace(
      {
        type: "upsert_grade",
        payload: {
          id: crypto.randomUUID(),
          studentId: form.studentId,
          courseId: form.courseId,
          termId: workspace?.terms.find((t) => t.isCurrent)?.id ?? null,
          assessmentTitle: form.assessmentTitle.trim(),
          assessmentType: form.assessmentType,
          score: Number(form.score) || 0,
          maxScore: Math.max(1, Number(form.maxScore) || 100),
          weight: Math.max(0.1, Number(form.weight) || 1),
          remarks: form.remarks.trim(),
          gradedAt: new Date().toISOString(),
        },
      },
      "Grade recorded",
    );
    setEditorOpen(false);
    setForm((f) => ({ ...f, assessmentTitle: "", remarks: "" }));
  }

  function printStudentReportCard(studentId: string) {
    if (!scale) return;
    const stu = maps.profilesById.get(studentId);
    const card = buildReportCard(studentId, workspace?.grades ?? [], scale, maps.coursesById);
    setPrintable({
      title: `Academic Report Card — ${stu ? displayName(stu) : "Student"}`,
      subtitle: `Assigned Courses Performance Summary · GPA ${card.overallGpa} (${card.overallPercent}%)`,
      columns: ["Course", "Assessments", "Weighted %", "Letter", "GPA", "Remark"],
      rows: card.lines.map((l) => [
        l.courseTitle,
        l.entries.length,
        `${l.weightedPercent}%`,
        l.letter,
        l.gpa,
        l.remark,
      ]),
    });
  }

  function exportGradebook() {
    downloadExcelXls(
      "ezana-instructor-gradebook",
      "Grades",
      grades.map((g) => {
        const stu = maps.profilesById.get(g.studentId);
        const outcome = scale ? computeGradeOutcome(g.score, g.maxScore, scale) : null;
        return {
          Student: stu ? displayName(stu) : "Student",
          Course: maps.coursesById.get(g.courseId)?.title ?? "Course",
          Assessment: g.assessmentTitle,
          Type: g.assessmentType,
          Score: `${g.score}/${g.maxScore}`,
          Percent: outcome ? `${outcome.percent}%` : "",
          Grade: outcome?.letter ?? "",
          Remarks: g.remarks,
        };
      }),
      "Instructor Gradebook",
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Grades & Report Cards"
        description="Record and manage marks for assigned students and generate printable academic report cards."
        actions={
          <div className="flex flex-wrap gap-2">
            {can("grades", "export") && grades.length > 0 && (
              <Button type="button" variant="outline" size="sm" onClick={exportGradebook}>
                <ArrowDownToLine className="h-4 w-4" />
                Export Excel
              </Button>
            )}
            {can("grades", "create") && (
              <Button
                type="button"
                variant="emerald"
                size="sm"
                disabled={db.courses.length === 0 || maps.students.length === 0}
                onClick={() => setEditorOpen(true)}
              >
                <Plus className="h-4 w-4" />
                Record Grade
              </Button>
            )}
          </div>
        }
      />

      <Panel
        title="Gradebook Entries"
        actions={
          <div className="flex flex-wrap gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search student or assessment…"
              className="h-9 w-48 text-xs"
            />
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
          </div>
        }
      >
        {grades.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Course & Assessment</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Letter</TableHead>
                <TableHead className="text-right">Report Card</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {grades.map((g) => {
                const stu = maps.profilesById.get(g.studentId);
                const out = scale ? computeGradeOutcome(g.score, g.maxScore, scale) : null;
                return (
                  <TableRow key={g.id}>
                    <TableCell className="font-medium text-sm">
                      {stu ? displayName(stu) : "Student"}
                    </TableCell>
                    <TableCell className="text-xs">
                      <p className="font-semibold">{g.assessmentTitle}</p>
                      <p className="text-muted-foreground">
                        {maps.coursesById.get(g.courseId)?.title ?? "Course"} · {g.assessmentType}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs">
                      {g.score}/{g.maxScore} {out ? `(${out.percent}%)` : ""}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline">{out?.letter ?? "—"}</Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="inline-flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => printStudentReportCard(g.studentId)}
                        >
                          <Printer className="h-3.5 w-3.5" />
                          Report Card
                        </Button>
                        {can("grades", "delete") && (
                          <ConfirmButton
                            title="Delete Grade Entry?"
                            description={`Remove ${g.assessmentTitle} mark?`}
                            onConfirm={() =>
                              void mutateWorkspace(
                                { type: "delete_grade", id: g.id },
                                "Grade removed",
                              )
                            }
                            trigger={
                              <Button type="button" variant="ghost" size="sm" aria-label="Delete grade entry">
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            }
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="No grade records yet"
            text="Record assignment, quiz, or exam marks for students enrolled in your courses."
            icon={Award}
          />
        )}
      </Panel>

      <Dialog open={editorOpen} onOpenChange={setEditorOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Assessment Grade</DialogTitle>
            <DialogDescription>
              Add a grade entry for a student enrolled in one of your courses.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => void saveGrade(e)}>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm font-medium">
                Student
                <select
                  required
                  value={form.studentId}
                  onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {maps.students.map((s) => (
                    <option key={s.id} value={s.id}>
                      {displayName(s)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Course
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
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block space-y-1 text-sm font-medium">
                Assessment Title
                <Input
                  required
                  value={form.assessmentTitle}
                  onChange={(e) => setForm((f) => ({ ...f, assessmentTitle: e.target.value }))}
                  placeholder="Midterm Practical"
                />
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Type
                <select
                  value={form.assessmentType}
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      assessmentType: e.target.value as GradeAssessmentType,
                    }))
                  }
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="quiz">Quiz</option>
                  <option value="assignment">Assignment</option>
                  <option value="exam">Exam</option>
                  <option value="project">Project</option>
                </select>
              </label>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block space-y-1 text-sm font-medium">
                Score
                <Input
                  type="number"
                  min={0}
                  value={form.score}
                  onChange={(e) => setForm((f) => ({ ...f, score: e.target.value }))}
                />
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Max Score
                <Input
                  type="number"
                  min={1}
                  value={form.maxScore}
                  onChange={(e) => setForm((f) => ({ ...f, maxScore: e.target.value }))}
                />
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Weight
                <Input
                  type="number"
                  min={0.1}
                  step="0.1"
                  value={form.weight}
                  onChange={(e) => setForm((f) => ({ ...f, weight: e.target.value }))}
                />
              </label>
            </div>
            <label className="block space-y-1 text-sm font-medium">
              Remarks
              <Input
                value={form.remarks}
                onChange={(e) => setForm((f) => ({ ...f, remarks: e.target.value }))}
              />
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditorOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="emerald" disabled={data.mutating}>
                Save Grade
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
