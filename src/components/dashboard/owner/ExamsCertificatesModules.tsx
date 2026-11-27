import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownToLine,
  Award,
  CheckCircle2,
  ClipboardList,
  FileCheck2,
  FileSpreadsheet,
  Pencil,
  Plus,
  Printer,
  Search,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { displayName } from "@/lib/auth";
import { downloadExcelXls } from "@/lib/export";
import { buildReportCard, computeExamStats } from "@/lib/owner/logic";
import type {
  CertificateTemplate,
  ExamAssessment,
  ExamQuestion,
  ExamSubmission,
  IssuedCertificate,
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
  Panel,
  StatCard,
} from "@/components/dashboard/ui";
import type { OwnerDataHandle } from "./useOwnerData";

/* ========================================================================== */
/* EXAMINATIONS & ASSESSMENTS                                                 */
/* ========================================================================== */

export function ExamsAssessmentsModule({ data }: { data: OwnerDataHandle }) {
  const { db, workspace, maps, mutateWorkspace, setPrintable, can, mutating } = data;
  const [search, setSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");

  const [examDialog, setExamDialog] = useState<ExamAssessment | null>(null);
  const [newQuestion, setNewQuestion] = useState<Omit<ExamQuestion, "id">>({
    prompt: "",
    questionType: "multiple_choice",
    options: ["", "", "", ""],
    correctAnswer: "",
    points: 10,
  });

  const [submissionsExam, setSubmissionsExam] = useState<ExamAssessment | null>(null);
  const [submissionForm, setSubmissionForm] = useState({
    studentId: "",
    score: "0",
    status: "graded" as ExamSubmission["status"],
    feedback: "",
    syncToGradebook: true,
  });

  const canCreate = can("exams", "create");
  const canEdit = can("exams", "edit");
  const canDelete = can("exams", "delete");
  const canExport = can("exams", "export");

  const exams = workspace?.exams ?? [];
  const submissions = workspace?.examSubmissions ?? [];
  const students = useMemo(
    () => db.profiles.filter((p) => (maps.rolesByUser.get(p.id) ?? []).includes("student")),
    [db.profiles, maps.rolesByUser],
  );

  const filteredExams = useMemo(() => {
    const q = search.trim().toLowerCase();
    return exams.filter((ex) => {
      if (courseFilter !== "all" && ex.courseId !== courseFilter) return false;
      if (statusFilter !== "all" && ex.status !== statusFilter) return false;
      if (!q) return true;
      const courseTitle = maps.coursesById.get(ex.courseId)?.title ?? "";
      return `${ex.title} ${ex.examType} ${courseTitle}`.toLowerCase().includes(q);
    });
  }, [exams, courseFilter, statusFilter, search, maps.coursesById]);

  const totals = useMemo(() => {
    const activeCount = exams.filter((e) => e.status === "scheduled" || e.status === "active").length;
    const totalQuestions = exams.reduce((s, e) => s + e.questions.length, 0);
    const gradedCount = submissions.filter((s) => s.status === "graded").length;
    return { activeCount, totalQuestions, gradedCount };
  }, [exams, submissions]);

  function addQuestionToDraft() {
    if (!examDialog || !newQuestion.prompt.trim()) {
      toast.error("Enter a question prompt.");
      return;
    }
    const q: ExamQuestion = {
      id: crypto.randomUUID(),
      prompt: newQuestion.prompt.trim(),
      questionType: newQuestion.questionType,
      options:
        newQuestion.questionType === "multiple_choice"
          ? newQuestion.options.map((o) => o.trim()).filter(Boolean)
          : [],
      correctAnswer: newQuestion.correctAnswer.trim(),
      points: Math.max(1, Number(newQuestion.points) || 10),
    };
    setExamDialog({ ...examDialog, questions: [...examDialog.questions, q] });
    setNewQuestion({
      prompt: "",
      questionType: "multiple_choice",
      options: ["", "", "", ""],
      correctAnswer: "",
      points: 10,
    });
  }

  async function saveSubmission(e: React.FormEvent) {
    e.preventDefault();
    if (!submissionsExam || !submissionForm.studentId) return;
    const score = Number(submissionForm.score);
    if (!Number.isFinite(score) || score < 0 || score > submissionsExam.maxScore) {
      toast.error(`Score must be between 0 and ${submissionsExam.maxScore}.`);
      return;
    }

    const now = new Date().toISOString();
    await mutateWorkspace(
      {
        type: "upsert_exam_submission",
        payload: {
          id: `${submissionsExam.id}:${submissionForm.studentId}`,
          examId: submissionsExam.id,
          studentId: submissionForm.studentId,
          score,
          status: submissionForm.status,
          submittedAt: now,
          gradedAt: submissionForm.status === "graded" ? now : null,
          feedback: submissionForm.feedback.trim(),
        },
      },
      "Student exam score saved",
    );

    if (submissionForm.syncToGradebook && submissionForm.status === "graded") {
      await mutateWorkspace({
        type: "upsert_grade",
        payload: {
          id: `exam-${submissionsExam.id}-${submissionForm.studentId}`,
          studentId: submissionForm.studentId,
          courseId: submissionsExam.courseId,
          termId: submissionsExam.termId,
          assessmentTitle: submissionsExam.title,
          assessmentType: submissionsExam.examType === "quiz" ? "quiz" : "exam",
          score,
          maxScore: submissionsExam.maxScore,
          weight: submissionsExam.examType === "final" ? 3 : 1,
          remarks: submissionForm.feedback.trim() || `Exam score (${submissionsExam.examType})`,
          gradedAt: now.slice(0, 10),
        },
      });
    }
    setSubmissionForm((f) => ({ ...f, score: "0", feedback: "" }));
  }

  function exportExamReport() {
    if (!exams.length) {
      toast.error("No examinations to export.");
      return;
    }
    downloadExcelXls(
      "ezana-examinations.xls",
      "Examinations",
      exams.map((ex) => {
        const stats = computeExamStats(ex, submissions);
        return {
          Title: ex.title,
          Course: maps.coursesById.get(ex.courseId)?.title ?? "Course",
          Type: ex.examType,
          Date: ex.scheduledDate,
          DurationMin: ex.durationMinutes,
          MaxScore: ex.maxScore,
          PassingScore: ex.passingScore,
          Questions: ex.questions.length,
          Submissions: stats.totalSubmissions,
          AverageScore: stats.averageScore,
          PassRate: `${stats.passRate}%`,
          Status: ex.status,
        };
      }),
      "Ezana Academy — Examinations & Assessments",
    );
    toast.success("Exam report exported");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Examinations & Assessments"
        description="Create exams and quizzes, manage question banks, schedule test windows, grade submissions, and sync scores to gradebooks."
        actions={
          <div className="flex flex-wrap gap-2">
            {canExport && (
              <Button size="sm" variant="outline" onClick={exportExamReport}>
                <ArrowDownToLine className="h-4 w-4" /> Export Excel
              </Button>
            )}
            {canCreate && (
              <Button
                size="sm"
                variant="emerald"
                onClick={() =>
                  setExamDialog({
                    id: crypto.randomUUID(),
                    title: "",
                    courseId: db.courses[0]?.id ?? "",
                    termId: workspace?.terms.find((t) => t.isCurrent)?.id ?? null,
                    examType: "midterm",
                    scheduledDate: new Date().toISOString().slice(0, 10),
                    startTime: "09:00",
                    durationMinutes: 60,
                    maxScore: 100,
                    passingScore: 60,
                    instructions: "",
                    questions: [],
                    status: "scheduled",
                    createdAt: new Date().toISOString(),
                  })
                }
              >
                <Plus className="h-4 w-4" /> Create Examination
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total Examinations" value={exams.length} icon={ClipboardList} index={0} />
        <StatCard
          label="Scheduled / Active"
          value={totals.activeCount}
          icon={CheckCircle2}
          tone="gold"
          index={1}
        />
        <StatCard
          label="Question Bank Items"
          value={totals.totalQuestions}
          icon={FileCheck2}
          tone="deep"
          index={2}
        />
        <StatCard
          label="Graded Submissions"
          value={totals.gradedCount}
          icon={Award}
          tone="plain"
          index={3}
        />
      </div>

      <Panel>
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="relative w-full md:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search exams or courses…"
              className="pl-9"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={courseFilter}
              onChange={(e) => setCourseFilter(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">All Courses</option>
              {db.courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.title}
                </option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="draft">Draft</option>
              <option value="scheduled">Scheduled</option>
              <option value="active">Active</option>
              <option value="completed">Completed</option>
            </select>
          </div>
        </div>

        {filteredExams.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Examination & Course</TableHead>
                <TableHead>Schedule & Duration</TableHead>
                <TableHead>Questions & Scoring</TableHead>
                <TableHead>Results</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredExams.map((ex) => {
                const stats = computeExamStats(ex, submissions);
                return (
                  <TableRow key={ex.id}>
                    <TableCell>
                      <p className="font-semibold">{ex.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {maps.coursesById.get(ex.courseId)?.title ?? "Course"} ·{" "}
                        <span className="capitalize">{ex.examType}</span>
                      </p>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      <p className="font-mono font-semibold">{ex.scheduledDate}</p>
                      <p className="text-muted-foreground">
                        {ex.startTime} · {ex.durationMinutes} min
                      </p>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      <p className="font-semibold">{ex.questions.length} questions</p>
                      <p className="text-muted-foreground">
                        Pass {ex.passingScore}/{ex.maxScore}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      <p className="font-semibold">{stats.gradedCount} graded</p>
                      <p className="text-muted-foreground">
                        {stats.gradedCount > 0
                          ? `Avg ${stats.averageScore} · ${stats.passRate}% pass`
                          : "Awaiting scores"}
                      </p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          ex.status === "completed"
                            ? "success"
                            : ex.status === "active"
                              ? "gold"
                              : ex.status === "scheduled"
                                ? "outline"
                                : "muted"
                        }
                        className="capitalize"
                      >
                        {ex.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            setSubmissionsExam(ex);
                            setSubmissionForm({
                              studentId: students[0]?.id ?? "",
                              score: String(ex.passingScore),
                              status: "graded",
                              feedback: "",
                              syncToGradebook: true,
                            });
                          }}
                        >
                          Submissions ({stats.totalSubmissions})
                        </Button>
                        {canEdit && (
                          <Button size="sm" variant="outline" onClick={() => setExamDialog(ex)}>
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        {canDelete && (
                          <ConfirmButton
                            title={`Delete "${ex.title}"?`}
                            description="All recorded submissions for this exam will also be removed."
                            confirmLabel="Delete exam"
                            onConfirm={() =>
                              void mutateWorkspace(
                                { type: "delete_exam", id: ex.id },
                                "Examination deleted",
                              )
                            }
                            trigger={
                              <Button size="sm" variant="ghost" className="text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
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
            title="No examinations created yet"
            text="Create an examination, quiz, or practical assessment to manage questions and student scores."
            icon={ClipboardList}
          />
        )}
      </Panel>

      {/* Exam Editor + Question Bank Dialog */}
      <Dialog open={!!examDialog} onOpenChange={(o) => !o && setExamDialog(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Examination & Question Bank</DialogTitle>
            <DialogDescription>
              Configure exam rules, schedule, and add assessment questions.
            </DialogDescription>
          </DialogHeader>
          {examDialog && (
            <form
              className="space-y-4"
              onSubmit={(e) => {
                e.preventDefault();
                void mutateWorkspace(
                  { type: "upsert_exam", payload: examDialog },
                  "Examination saved",
                ).then(() => setExamDialog(null));
              }}
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="space-y-1 text-sm font-medium sm:col-span-2">
                  Exam Title
                  <Input
                    required
                    value={examDialog.title}
                    onChange={(e) => setExamDialog({ ...examDialog, title: e.target.value })}
                    placeholder="MS Office Practical Midterm"
                  />
                </label>
                <label className="space-y-1 text-sm font-medium">
                  Course
                  <select
                    required
                    value={examDialog.courseId}
                    onChange={(e) => setExamDialog({ ...examDialog, courseId: e.target.value })}
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">Choose course…</option>
                    {db.courses.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.title}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm font-medium">
                  Assessment Type
                  <select
                    value={examDialog.examType}
                    onChange={(e) =>
                      setExamDialog({
                        ...examDialog,
                        examType: e.target.value as ExamAssessment["examType"],
                      })
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="quiz">Quiz</option>
                    <option value="midterm">Midterm Exam</option>
                    <option value="final">Final Exam</option>
                    <option value="practical">Practical Assessment</option>
                    <option value="assignment">Graded Assignment</option>
                  </select>
                </label>
                <label className="space-y-1 text-sm font-medium">
                  Exam Date
                  <Input
                    type="date"
                    required
                    value={examDialog.scheduledDate}
                    onChange={(e) =>
                      setExamDialog({ ...examDialog, scheduledDate: e.target.value })
                    }
                  />
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="space-y-1 text-sm font-medium">
                    Start Time
                    <Input
                      type="time"
                      value={examDialog.startTime}
                      onChange={(e) => setExamDialog({ ...examDialog, startTime: e.target.value })}
                    />
                  </label>
                  <label className="space-y-1 text-sm font-medium">
                    Duration (min)
                    <Input
                      type="number"
                      min={5}
                      value={examDialog.durationMinutes}
                      onChange={(e) =>
                        setExamDialog({
                          ...examDialog,
                          durationMinutes: Number(e.target.value) || 60,
                        })
                      }
                    />
                  </label>
                </div>
                <label className="space-y-1 text-sm font-medium">
                  Max Score
                  <Input
                    type="number"
                    min={1}
                    value={examDialog.maxScore}
                    onChange={(e) =>
                      setExamDialog({ ...examDialog, maxScore: Number(e.target.value) || 100 })
                    }
                  />
                </label>
                <label className="space-y-1 text-sm font-medium">
                  Passing Score
                  <Input
                    type="number"
                    min={0}
                    value={examDialog.passingScore}
                    onChange={(e) =>
                      setExamDialog({ ...examDialog, passingScore: Number(e.target.value) || 0 })
                    }
                  />
                </label>
                <label className="space-y-1 text-sm font-medium">
                  Semester / Term
                  <select
                    value={examDialog.termId ?? ""}
                    onChange={(e) =>
                      setExamDialog({ ...examDialog, termId: e.target.value || null })
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">General</option>
                    {(workspace?.terms ?? []).map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1 text-sm font-medium">
                  Status
                  <select
                    value={examDialog.status}
                    onChange={(e) =>
                      setExamDialog({
                        ...examDialog,
                        status: e.target.value as ExamAssessment["status"],
                      })
                    }
                    className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="draft">Draft</option>
                    <option value="scheduled">Scheduled</option>
                    <option value="active">Active</option>
                    <option value="completed">Completed</option>
                  </select>
                </label>
                <label className="space-y-1 text-sm font-medium sm:col-span-2">
                  Instructions
                  <Textarea
                    rows={2}
                    value={examDialog.instructions}
                    onChange={(e) =>
                      setExamDialog({ ...examDialog, instructions: e.target.value })
                    }
                  />
                </label>
              </div>

              {/* Question Bank Builder */}
              <div className="space-y-3 rounded-xl border border-border bg-secondary/20 p-3.5">
                <p className="text-sm font-semibold">
                  Question Bank ({examDialog.questions.length} items)
                </p>
                {examDialog.questions.length > 0 && (
                  <div className="space-y-2">
                    {examDialog.questions.map((q, idx) => (
                      <div
                        key={q.id}
                        className="flex items-start justify-between gap-2 rounded-lg border border-border bg-background p-2.5 text-xs"
                      >
                        <div>
                          <p className="font-semibold">
                            {idx + 1}. {q.prompt}
                          </p>
                          <p className="text-muted-foreground">
                            {q.questionType.replace("_", " ")} · {q.points} pts
                            {q.correctAnswer ? ` · Answer: ${q.correctAnswer}` : ""}
                          </p>
                        </div>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="text-destructive"
                          onClick={() =>
                            setExamDialog({
                              ...examDialog,
                              questions: examDialog.questions.filter((item) => item.id !== q.id),
                            })
                          }
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="grid gap-2 sm:grid-cols-3">
                  <Input
                    className="sm:col-span-2"
                    placeholder="Question prompt…"
                    value={newQuestion.prompt}
                    onChange={(e) =>
                      setNewQuestion((nq) => ({ ...nq, prompt: e.target.value }))
                    }
                  />
                  <div className="flex gap-2">
                    <select
                      value={newQuestion.questionType}
                      onChange={(e) =>
                        setNewQuestion((nq) => ({
                          ...nq,
                          questionType: e.target.value as ExamQuestion["questionType"],
                        }))
                      }
                      className="h-10 flex-1 rounded-md border border-input bg-background px-2 text-xs"
                    >
                      <option value="multiple_choice">MCQ</option>
                      <option value="short_answer">Short Answer</option>
                      <option value="practical">Practical</option>
                    </select>
                    <Input
                      type="number"
                      min={1}
                      className="w-16"
                      value={newQuestion.points}
                      onChange={(e) =>
                        setNewQuestion((nq) => ({
                          ...nq,
                          points: Number(e.target.value) || 10,
                        }))
                      }
                    />
                  </div>
                  {newQuestion.questionType === "multiple_choice" && (
                    <div className="grid grid-cols-2 gap-2 sm:col-span-3">
                      {newQuestion.options.map((opt, idx) => (
                        <Input
                          key={idx}
                          placeholder={`Option ${idx + 1}`}
                          value={opt}
                          onChange={(e) => {
                            const updated = [...newQuestion.options];
                            updated[idx] = e.target.value;
                            setNewQuestion((nq) => ({ ...nq, options: updated }));
                          }}
                        />
                      ))}
                    </div>
                  )}
                  <Input
                    className="sm:col-span-2"
                    placeholder="Correct answer / grading key"
                    value={newQuestion.correctAnswer}
                    onChange={(e) =>
                      setNewQuestion((nq) => ({ ...nq, correctAnswer: e.target.value }))
                    }
                  />
                  <Button type="button" variant="outline" size="sm" onClick={addQuestionToDraft}>
                    <Plus className="h-3.5 w-3.5" /> Add Question
                  </Button>
                </div>
              </div>

              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setExamDialog(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="emerald" disabled={mutating}>
                  Save Examination
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Submissions & Grading Dialog */}
      <Dialog open={!!submissionsExam} onOpenChange={(o) => !o && setSubmissionsExam(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{submissionsExam?.title} — Student Submissions</DialogTitle>
            <DialogDescription>
              Max score: {submissionsExam?.maxScore} · Passing: {submissionsExam?.passingScore}
            </DialogDescription>
          </DialogHeader>
          {submissionsExam && (
            <div className="space-y-4">
              {canEdit && (
                <form
                  className="grid gap-3 rounded-xl border border-border bg-secondary/20 p-3 sm:grid-cols-4"
                  onSubmit={(e) => void saveSubmission(e)}
                >
                  <label className="space-y-1 text-xs font-medium sm:col-span-2">
                    Student
                    <select
                      required
                      value={submissionForm.studentId}
                      onChange={(e) =>
                        setSubmissionForm((f) => ({ ...f, studentId: e.target.value }))
                      }
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="">Choose student…</option>
                      {students.map((s) => (
                        <option key={s.id} value={s.id}>
                          {displayName(s)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="space-y-1 text-xs font-medium">
                    Score (/{submissionsExam.maxScore})
                    <Input
                      type="number"
                      min={0}
                      max={submissionsExam.maxScore}
                      required
                      value={submissionForm.score}
                      onChange={(e) =>
                        setSubmissionForm((f) => ({ ...f, score: e.target.value }))
                      }
                    />
                  </label>
                  <label className="space-y-1 text-xs font-medium">
                    Status
                    <select
                      value={submissionForm.status}
                      onChange={(e) =>
                        setSubmissionForm((f) => ({
                          ...f,
                          status: e.target.value as ExamSubmission["status"],
                        }))
                      }
                      className="h-9 w-full rounded-md border border-input bg-background px-2 text-sm"
                    >
                      <option value="graded">Graded</option>
                      <option value="submitted">Submitted</option>
                      <option value="pending">Pending</option>
                    </select>
                  </label>
                  <Input
                    className="sm:col-span-3"
                    placeholder="Feedback or remarks"
                    value={submissionForm.feedback}
                    onChange={(e) =>
                      setSubmissionForm((f) => ({ ...f, feedback: e.target.value }))
                    }
                  />
                  <Button type="submit" variant="emerald" size="sm" disabled={mutating}>
                    Save Score
                  </Button>
                  <label className="flex cursor-pointer items-center gap-2 text-xs sm:col-span-4">
                    <input
                      type="checkbox"
                      checked={submissionForm.syncToGradebook}
                      onChange={(e) =>
                        setSubmissionForm((f) => ({ ...f, syncToGradebook: e.target.checked }))
                      }
                    />
                    Also post graded score directly to Grades & Report Cards
                  </label>
                </form>
              )}

              {submissions.filter((s) => s.examId === submissionsExam.id).length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Student</TableHead>
                      <TableHead>Score</TableHead>
                      <TableHead>Result</TableHead>
                      <TableHead>Feedback</TableHead>
                      <TableHead className="text-right">Action</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {submissions
                      .filter((s) => s.examId === submissionsExam.id)
                      .map((sub) => {
                        const st = maps.profilesById.get(sub.studentId);
                        const passed = sub.score >= submissionsExam.passingScore;
                        return (
                          <TableRow key={sub.id}>
                            <TableCell className="font-semibold">
                              {st ? displayName(st) : "Student"}
                            </TableCell>
                            <TableCell className="tabular-nums font-bold">
                              {sub.score} / {submissionsExam.maxScore}
                            </TableCell>
                            <TableCell>
                              <Badge
                                variant={
                                  sub.status !== "graded"
                                    ? "warning"
                                    : passed
                                      ? "success"
                                      : "destructive"
                                }
                              >
                                {sub.status !== "graded"
                                  ? sub.status
                                  : passed
                                    ? "Pass"
                                    : "Below Pass"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {sub.feedback || "—"}
                            </TableCell>
                            <TableCell className="text-right">
                              {canDelete && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive"
                                  onClick={() =>
                                    void mutateWorkspace(
                                      { type: "delete_exam_submission", id: sub.id },
                                      "Submission removed",
                                    )
                                  }
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
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
                  title="No submissions logged"
                  text="Record student scores above or wait for submissions."
                />
              )}
              {submissions.filter((s) => s.examId === submissionsExam.id).length > 0 && (
                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() =>
                      setPrintable({
                        title: `${submissionsExam.title} — Results Sheet`,
                        subtitle: maps.coursesById.get(submissionsExam.courseId)?.title ?? "Course",
                        columns: ["Student", "Score", "Max", "Status", "Feedback"],
                        rows: submissions
                          .filter((s) => s.examId === submissionsExam.id)
                          .map((sub) => [
                            maps.profilesById.get(sub.studentId)
                              ? displayName(maps.profilesById.get(sub.studentId)!)
                              : "Student",
                            sub.score,
                            submissionsExam.maxScore,
                            sub.score >= submissionsExam.passingScore ? "Pass" : "Fail",
                            sub.feedback || "—",
                          ]),
                      })
                    }
                  >
                    <Printer className="h-4 w-4" /> Print Results
                  </Button>
                </DialogFooter>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ========================================================================== */
/* CERTIFICATES                                                               */
/* ========================================================================== */

export function CertificatesModule({ data }: { data: OwnerDataHandle }) {
  const { db, workspace, maps, mutateWorkspace, can, mutating } = data;
  const [search, setSearch] = useState("");
  const [verifyCode, setVerifyCode] = useState("");
  const [issueOpen, setIssueOpen] = useState(false);
  const [issueForm, setIssueForm] = useState({
    studentId: "",
    courseId: "",
    templateId: "",
    notes: "",
  });
  const [templateDialog, setTemplateDialog] = useState<CertificateTemplate | null>(null);
  const [previewCert, setPreviewCert] = useState<IssuedCertificate | null>(null);

  const canCreate = can("certificates", "create");
  const canEdit = can("certificates", "edit");
  const canDelete = can("certificates", "delete");

  const templates = workspace?.certificateTemplates ?? [];
  const issued = workspace?.issuedCertificates ?? [];
  const defaultScale =
    workspace?.gradingScales.find((s) => s.isDefault) ?? workspace?.gradingScales[0];
  const students = useMemo(
    () => db.profiles.filter((p) => (maps.rolesByUser.get(p.id) ?? []).includes("student")),
    [db.profiles, maps.rolesByUser],
  );

  // Eligible learners based on enrollment + lesson progress / grades
  const eligibilityRows = useMemo(() => {
    return db.enrollments.map((en) => {
      const student = maps.profilesById.get(en.user_id);
      const course = maps.coursesById.get(en.course_id);
      const totalLessons = (maps.lessonsByCourse.get(en.course_id) ?? []).length;
      const doneLessons = db.progress.filter(
        (p) => p.user_id === en.user_id && p.course_id === en.course_id,
      ).length;
      const completionPercent = totalLessons
        ? Math.min(100, Math.round((doneLessons / totalLessons) * 100))
        : 100;
      const card = defaultScale
        ? buildReportCard(en.user_id, workspace?.grades ?? [], defaultScale, maps.coursesById)
        : null;
      const courseGrade = card?.lines.find((l) => l.courseId === en.course_id);
      const existingCert = issued.find(
        (c) => c.studentId === en.user_id && c.courseId === en.course_id && c.status === "issued",
      );
      return {
        studentId: en.user_id,
        courseId: en.course_id,
        studentName: student ? displayName(student) : "Student",
        studentEmail: student?.email ?? "",
        courseTitle: course?.title ?? "Course",
        completionPercent,
        finalGrade: courseGrade ? `${courseGrade.letter} (${courseGrade.weightedPercent}%)` : "Pass",
        alreadyIssued: Boolean(existingCert),
      };
    });
  }, [db.enrollments, db.progress, maps, defaultScale, workspace?.grades, issued]);

  const filteredCerts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return issued.filter((c) => {
      if (!q) return true;
      const st = maps.profilesById.get(c.studentId);
      const cr = maps.coursesById.get(c.courseId);
      return `${c.certificateCode} ${st ? displayName(st) : ""} ${cr?.title ?? ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [issued, search, maps]);

  const verifiedMatch = useMemo(() => {
    const code = verifyCode.trim().toLowerCase();
    if (!code) return null;
    return issued.find((c) => c.certificateCode.toLowerCase() === code) ?? "not_found";
  }, [issued, verifyCode]);

  async function handleIssueCertificate(e: React.FormEvent) {
    e.preventDefault();
    if (!issueForm.studentId || !issueForm.courseId) {
      toast.error("Select both a student and course.");
      return;
    }
    const elig = eligibilityRows.find(
      (r) => r.studentId === issueForm.studentId && r.courseId === issueForm.courseId,
    );
    await mutateWorkspace(
      {
        type: "issue_certificate",
        payload: {
          studentId: issueForm.studentId,
          courseId: issueForm.courseId,
          templateId: issueForm.templateId || templates[0]?.id || "cert-default",
          completionPercent: elig?.completionPercent ?? 100,
          finalGrade: elig?.finalGrade ?? "Pass",
          notes: issueForm.notes.trim(),
        },
      },
      "Official certificate issued",
    );
    setIssueOpen(false);
    setIssueForm({ studentId: "", courseId: "", templateId: "", notes: "" });
  }

  const previewTemplate = useMemo(() => {
    if (!previewCert) return templates[0];
    return templates.find((t) => t.id === previewCert.templateId) ?? templates[0];
  }, [previewCert, templates]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Certificates"
        description="Manage certificate templates, verify learner eligibility, issue completion certificates, and print or download PDF credentials."
        actions={
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setTemplateDialog(
                    templates[0] ?? {
                      id: crypto.randomUUID(),
                      name: "Ezana Completion Certificate",
                      title: "Certificate of Completion",
                      subtitle: "Ezana Academy",
                      bodyText:
                        "This certifies that the student below has completed the required coursework.",
                      signatoryName: "Director of Academics",
                      signatoryTitle: "Ezana Academy",
                      accentColor: "#0f5132",
                      isDefault: true,
                    },
                  )
                }
              >
                <Pencil className="h-4 w-4" /> Edit Template
              </Button>
            )}
            {canCreate && (
              <Button
                size="sm"
                variant="emerald"
                onClick={() => {
                  setIssueForm({
                    studentId: students[0]?.id ?? "",
                    courseId: db.courses[0]?.id ?? "",
                    templateId: templates.find((t) => t.isDefault)?.id ?? templates[0]?.id ?? "",
                    notes: "",
                  });
                  setIssueOpen(true);
                }}
              >
                <Award className="h-4 w-4" /> Issue Certificate
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Issued Certificates"
          value={issued.filter((c) => c.status === "issued").length}
          icon={Award}
          tone="emerald"
          index={0}
        />
        <StatCard
          label="Eligible Enrollments"
          value={eligibilityRows.filter((r) => r.completionPercent >= 80 && !r.alreadyIssued).length}
          icon={CheckCircle2}
          tone="gold"
          index={1}
        />
        <StatCard
          label="Certificate Templates"
          value={templates.length}
          icon={FileSpreadsheet}
          tone="deep"
          index={2}
        />
      </div>

      {/* Verification Lookup */}
      <Panel title="Verify Certificate Authenticity">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value)}
              placeholder="Enter certificate code (e.g. EZN-CERT-2026-0001)…"
              className="pl-9 font-mono"
            />
          </div>
          {verifiedMatch && verifiedMatch !== "not_found" && (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-50 px-3 py-2 text-xs text-emerald-900">
              <ShieldCheck className="h-4 w-4 text-emerald-700" />
              <span>
                <strong>Valid ({verifiedMatch.status})</strong>:{" "}
                {maps.profilesById.get(verifiedMatch.studentId)
                  ? displayName(maps.profilesById.get(verifiedMatch.studentId)!)
                  : "Student"}{" "}
                — {maps.coursesById.get(verifiedMatch.courseId)?.title ?? "Course"} (
                {verifiedMatch.issuedAt.slice(0, 10)})
              </span>
            </div>
          )}
          {verifiedMatch === "not_found" && (
            <Badge variant="destructive">No certificate matching that code</Badge>
          )}
        </div>
      </Panel>

      {/* Issued Certificates Table */}
      <Panel
        title="Issued Certificates Registry"
        actions={
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter student, course, code…"
              className="h-9 pl-8 text-xs"
            />
          </div>
        }
      >
        {filteredCerts.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Certificate Code</TableHead>
                <TableHead>Student</TableHead>
                <TableHead>Course & Grade</TableHead>
                <TableHead>Issued</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredCerts.map((cert) => {
                const st = maps.profilesById.get(cert.studentId);
                const cr = maps.coursesById.get(cert.courseId);
                return (
                  <TableRow key={cert.id}>
                    <TableCell className="font-mono text-xs font-bold">
                      {cert.certificateCode}
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold">{st ? displayName(st) : "Student"}</p>
                      <p className="text-xs text-muted-foreground">{st?.email ?? "—"}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium">{cr?.title ?? "Course"}</p>
                      <p className="text-xs text-muted-foreground">
                        {cert.completionPercent}% complete · {cert.finalGrade}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums text-muted-foreground">
                      {cert.issuedAt.slice(0, 10)}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={cert.status === "issued" ? "success" : "destructive"}
                        className="capitalize"
                      >
                        {cert.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setPreviewCert(cert)}>
                          <Printer className="h-3.5 w-3.5" /> View / PDF
                        </Button>
                        {canEdit && (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() =>
                              void mutateWorkspace(
                                {
                                  type: "update_certificate_status",
                                  id: cert.id,
                                  status: cert.status === "issued" ? "revoked" : "issued",
                                },
                                cert.status === "issued"
                                  ? "Certificate revoked"
                                  : "Certificate reinstated",
                              )
                            }
                          >
                            {cert.status === "issued" ? "Revoke" : "Reinstate"}
                          </Button>
                        )}
                        {canDelete && (
                          <ConfirmButton
                            title="Delete certificate record?"
                            confirmLabel="Delete"
                            onConfirm={() =>
                              void mutateWorkspace(
                                { type: "delete_certificate", id: cert.id },
                                "Certificate deleted",
                              )
                            }
                            trigger={
                              <Button size="sm" variant="ghost" className="text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
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
            title="No certificates issued yet"
            text="Issue official completion certificates to eligible students above."
            icon={Award}
          />
        )}
      </Panel>

      {/* Eligibility Queue */}
      <Panel title="Course Completion & Eligibility">
        {eligibilityRows.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Student</TableHead>
                <TableHead>Course</TableHead>
                <TableHead>Completion</TableHead>
                <TableHead>Grade Summary</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eligibilityRows.slice(0, 15).map((r) => (
                <TableRow key={`${r.studentId}:${r.courseId}`}>
                  <TableCell>
                    <p className="font-semibold">{r.studentName}</p>
                    <p className="text-xs text-muted-foreground">{r.studentEmail}</p>
                  </TableCell>
                  <TableCell className="text-sm">{r.courseTitle}</TableCell>
                  <TableCell className="tabular-nums text-xs font-semibold">
                    {r.completionPercent}%
                  </TableCell>
                  <TableCell className="text-xs">{r.finalGrade}</TableCell>
                  <TableCell className="text-right">
                    {r.alreadyIssued ? (
                      <Badge variant="success">Issued</Badge>
                    ) : (
                      canCreate && (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={mutating}
                          onClick={() =>
                            void mutateWorkspace(
                              {
                                type: "issue_certificate",
                                payload: {
                                  studentId: r.studentId,
                                  courseId: r.courseId,
                                  templateId:
                                    templates.find((t) => t.isDefault)?.id ??
                                    templates[0]?.id ??
                                    "cert-default",
                                  completionPercent: r.completionPercent,
                                  finalGrade: r.finalGrade,
                                  notes: "",
                                },
                              },
                              `Issued certificate for ${r.studentName}`,
                            )
                          }
                        >
                          <Award className="h-3.5 w-3.5" /> Issue
                        </Button>
                      )
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState title="No active course enrollments to evaluate" />
        )}
      </Panel>

      {/* Issue Certificate Modal */}
      <Dialog open={issueOpen} onOpenChange={setIssueOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Issue Completion Certificate</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => void handleIssueCertificate(e)}>
            <label className="block space-y-1 text-sm font-medium">
              Student
              <select
                required
                value={issueForm.studentId}
                onChange={(e) => setIssueForm((f) => ({ ...f, studentId: e.target.value }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Choose student…</option>
                {students.map((s) => (
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
                value={issueForm.courseId}
                onChange={(e) => setIssueForm((f) => ({ ...f, courseId: e.target.value }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Choose course…</option>
                {db.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm font-medium">
              Template
              <select
                value={issueForm.templateId}
                onChange={(e) => setIssueForm((f) => ({ ...f, templateId: e.target.value }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {templates.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm font-medium">
              Honors / Remarks
              <Input
                value={issueForm.notes}
                onChange={(e) => setIssueForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="With Distinction"
              />
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIssueOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="emerald" disabled={mutating}>
                Issue Certificate
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Template Editor Modal */}
      <Dialog open={!!templateDialog} onOpenChange={(o) => !o && setTemplateDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Certificate Template</DialogTitle>
          </DialogHeader>
          {templateDialog && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void mutateWorkspace(
                  { type: "upsert_certificate_template", payload: templateDialog },
                  "Certificate template saved",
                ).then(() => setTemplateDialog(null));
              }}
            >
              <label className="block space-y-1 text-sm font-medium">
                Heading Title
                <Input
                  required
                  value={templateDialog.title}
                  onChange={(e) =>
                    setTemplateDialog({ ...templateDialog, title: e.target.value })
                  }
                />
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Subtitle
                <Input
                  value={templateDialog.subtitle}
                  onChange={(e) =>
                    setTemplateDialog({ ...templateDialog, subtitle: e.target.value })
                  }
                />
              </label>
              <label className="block space-y-1 text-sm font-medium">
                Citation Body
                <Textarea
                  rows={3}
                  value={templateDialog.bodyText}
                  onChange={(e) =>
                    setTemplateDialog({ ...templateDialog, bodyText: e.target.value })
                  }
                />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="space-y-1 text-sm font-medium">
                  Signatory Name
                  <Input
                    value={templateDialog.signatoryName}
                    onChange={(e) =>
                      setTemplateDialog({ ...templateDialog, signatoryName: e.target.value })
                    }
                  />
                </label>
                <label className="space-y-1 text-sm font-medium">
                  Signatory Title
                  <Input
                    value={templateDialog.signatoryTitle}
                    onChange={(e) =>
                      setTemplateDialog({ ...templateDialog, signatoryTitle: e.target.value })
                    }
                  />
                </label>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setTemplateDialog(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="emerald" disabled={mutating}>
                  Save Template
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      {/* Printable Certificate Preview Modal */}
      <Dialog open={!!previewCert} onOpenChange={(o) => !o && setPreviewCert(null)}>
        <DialogContent className="max-w-3xl print:border-0 print:shadow-none">
          {previewCert && previewTemplate && (
            <>
              <div className="rounded-2xl border-4 border-double border-emerald-800 bg-[#fdfcf8] p-8 text-center text-slate-900">
                <p className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-800">
                  {db.settings?.name || "Ezana Academy"}
                </p>
                <h2 className="mt-2 font-display text-3xl font-bold text-slate-900">
                  {previewTemplate.title}
                </h2>
                <p className="mt-1 text-xs text-slate-600">{previewTemplate.subtitle}</p>

                <p className="mx-auto mt-6 max-w-xl text-sm text-slate-700">
                  {previewTemplate.bodyText}
                </p>

                <p className="mt-5 font-display text-2xl font-bold text-emerald-900 underline decoration-amber-500/60 underline-offset-8">
                  {maps.profilesById.get(previewCert.studentId)
                    ? displayName(maps.profilesById.get(previewCert.studentId)!)
                    : "Student"}
                </p>

                <p className="mt-4 text-sm font-semibold text-slate-800">
                  Program: {maps.coursesById.get(previewCert.courseId)?.title ?? "Course"}
                </p>
                <p className="mt-1 text-xs text-slate-600">
                  Completion: {previewCert.completionPercent}% · Standing: {previewCert.finalGrade}
                  {previewCert.notes ? ` · ${previewCert.notes}` : ""}
                </p>

                <div className="mt-8 flex items-end justify-between border-t border-slate-200 pt-4 text-left text-xs">
                  <div>
                    <p className="font-mono font-bold text-slate-800">
                      {previewCert.certificateCode}
                    </p>
                    <p className="text-slate-500">
                      Issued {previewCert.issuedAt.slice(0, 10)} · Status: {previewCert.status}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-slate-900">{previewTemplate.signatoryName}</p>
                    <p className="text-slate-500">{previewTemplate.signatoryTitle}</p>
                  </div>
                </div>
              </div>
              <DialogFooter className="print:hidden">
                <Button type="button" variant="outline" onClick={() => setPreviewCert(null)}>
                  Close
                </Button>
                <Button type="button" variant="emerald" onClick={() => window.print()}>
                  <Printer className="h-4 w-4" /> Print / Save PDF
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
