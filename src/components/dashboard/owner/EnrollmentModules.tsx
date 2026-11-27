import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  ArrowDownToLine,
  BookOpen,
  Check,
  CheckCircle2,
  Clock,
  FolderTree,
  Plus,
  Search,
  Trash2,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { displayName, useAuth } from "@/lib/auth";
import { logAudit } from "@/lib/csv";
import { downloadExcelXls } from "@/lib/export";
import { paginateRows } from "@/lib/owner/logic";
import type { EnrollmentMeta, EnrollmentRequest } from "@/lib/owner/types";
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
  StatCard,
} from "@/components/dashboard/ui";
import type { OwnerDataHandle } from "./useOwnerData";

export type EnrollmentTab = "enrollments" | "registration" | "requests" | "classes";

export function EnrollmentModules({
  data,
  initialTab = "enrollments",
}: {
  data: OwnerDataHandle;
  initialTab?: EnrollmentTab;
}) {
  const { user } = useAuth();
  const { db, workspace, maps, mutateWorkspace, callUserApi, refreshAll, can, mutating } = data;
  const [tab, setTab] = useState<EnrollmentTab>(initialTab);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  // Course Enrollment filters & modal
  const [enrollSearch, setEnrollSearch] = useState("");
  const [courseFilter, setCourseFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [enrollPage, setEnrollPage] = useState(1);
  const [enrollOpen, setEnrollOpen] = useState(false);
  const [enrollForm, setEnrollForm] = useState({
    studentId: "",
    courseId: "",
    classSectionId: "",
    notes: "",
  });

  // Student Registration form
  const [regForm, setRegForm] = useState({
    first_name: "",
    last_name: "",
    email: "",
    phone: "",
    password: "",
    studentCode: "",
    classSectionId: "",
    courseId: "",
    guardianName: "",
    guardianPhone: "",
    address: "",
    dateOfBirth: "",
    notes: "",
  });

  // Enrollment Requests filters & modal
  const [reqStatusFilter, setReqStatusFilter] = useState("all");
  const [reqSearch, setReqSearch] = useState("");
  const [reqOpen, setReqOpen] = useState(false);
  const [reqForm, setReqForm] = useState({
    studentId: "",
    courseId: "",
    classSectionId: "",
    notes: "",
  });
  const [reviewingReq, setReviewingReq] = useState<EnrollmentRequest | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  // Class Assignments
  const [selectedClassId, setSelectedClassId] = useState("");
  const [assignStudentId, setAssignStudentId] = useState("");
  const [classSearch, setClassSearch] = useState("");

  const canCreate = can("enrollments", "create");
  const canEdit = can("enrollments", "edit");
  const canApprove = can("enrollments", "approve");
  const canDelete = can("enrollments", "delete");
  const canExport = can("enrollments", "export");

  const students = useMemo(
    () => db.profiles.filter((p) => (maps.rolesByUser.get(p.id) ?? []).includes("student")),
    [db.profiles, maps.rolesByUser],
  );
  const classes = workspace?.classes ?? [];
  const requests = workspace?.enrollmentRequests ?? [];
  const pendingRequestsCount = requests.filter((r) => r.status === "pending").length;

  // Enriched course enrollments
  const enrichedEnrollments = useMemo(() => {
    const q = enrollSearch.trim().toLowerCase();
    return db.enrollments
      .map((e) => {
        const student = maps.profilesById.get(e.user_id);
        const course = maps.coursesById.get(e.course_id);
        const key = `${e.user_id}:${e.course_id}`;
        const meta = workspace?.enrollmentMeta?.[key];
        const totalLessons = (maps.lessonsByCourse.get(e.course_id) ?? []).length;
        const completedLessons = db.progress.filter(
          (p) => p.user_id === e.user_id && p.course_id === e.course_id,
        ).length;
        const progressPct = totalLessons
          ? Math.min(100, Math.round((completedLessons / totalLessons) * 100))
          : 0;
        const computedStatus: EnrollmentMeta["status"] =
          meta?.status ?? (progressPct >= 100 && totalLessons > 0 ? "completed" : "active");
        const studentClassId = workspace?.studentMeta[e.user_id]?.classSectionId;
        const className = studentClassId ? (maps.classesById.get(studentClassId)?.name ?? "") : "";
        return {
          ...e,
          key,
          student,
          course,
          className,
          progressPct,
          completedLessons,
          totalLessons,
          enrollmentStatus: computedStatus,
          notes: meta?.notes ?? "",
        };
      })
      .filter((row) => {
        if (courseFilter !== "all" && row.course_id !== courseFilter) return false;
        if (statusFilter !== "all" && row.enrollmentStatus !== statusFilter) return false;
        if (!q) return true;
        return `${row.student ? displayName(row.student) : ""} ${row.student?.email ?? ""} ${row.course?.title ?? ""}`
          .toLowerCase()
          .includes(q);
      });
  }, [
    db.enrollments,
    db.progress,
    maps,
    workspace?.enrollmentMeta,
    workspace?.studentMeta,
    enrollSearch,
    courseFilter,
    statusFilter,
  ]);

  const pagedEnrollments = paginateRows(enrichedEnrollments, enrollPage, 10);

  const filteredRequests = useMemo(() => {
    const q = reqSearch.trim().toLowerCase();
    return requests.filter((r) => {
      if (reqStatusFilter !== "all" && r.status !== reqStatusFilter) return false;
      if (!q) return true;
      const student = maps.profilesById.get(r.studentId);
      const course = maps.coursesById.get(r.courseId);
      return `${student ? displayName(student) : ""} ${student?.email ?? ""} ${course?.title ?? ""} ${r.notes}`
        .toLowerCase()
        .includes(q);
    });
  }, [requests, reqStatusFilter, reqSearch, maps]);

  const activeClass = useMemo(
    () => classes.find((c) => c.id === selectedClassId) ?? classes[0] ?? null,
    [classes, selectedClassId],
  );

  async function enrollStudentDirect(e: React.FormEvent) {
    e.preventDefault();
    if (!enrollForm.studentId || !enrollForm.courseId) {
      toast.error("Select both a student and a course.");
      return;
    }
    const duplicate = db.enrollments.some(
      (en) => en.user_id === enrollForm.studentId && en.course_id === enrollForm.courseId,
    );
    if (duplicate) {
      toast.error("This student is already enrolled in the selected course.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.from("enrollments").insert({
        user_id: enrollForm.studentId,
        course_id: enrollForm.courseId,
      });
      if (error) throw error;

      await mutateWorkspace({
        type: "upsert_enrollment_meta",
        payload: {
          enrollmentKey: `${enrollForm.studentId}:${enrollForm.courseId}`,
          status: "active",
          updatedAt: new Date().toISOString(),
          notes: enrollForm.notes.trim(),
        },
      });

      if (enrollForm.classSectionId) {
        await mutateWorkspace({
          type: "assign_student_class",
          studentId: enrollForm.studentId,
          classSectionId: enrollForm.classSectionId,
        });
      }

      if (user) {
        await logAudit("student_enrolled", "enrollment", enrollForm.courseId, {
          student_id: enrollForm.studentId,
        });
      }
      await refreshAll("Student enrolled in course");
      setEnrollOpen(false);
      setEnrollForm({ studentId: "", courseId: "", classSectionId: "", notes: "" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not enroll student.");
    } finally {
      setBusy(false);
    }
  }

  async function updateEnrollmentStatus(
    userId: string,
    courseId: string,
    status: EnrollmentMeta["status"],
  ) {
    await mutateWorkspace(
      {
        type: "upsert_enrollment_meta",
        payload: {
          enrollmentKey: `${userId}:${courseId}`,
          status,
          updatedAt: new Date().toISOString(),
          notes: workspace?.enrollmentMeta?.[`${userId}:${courseId}`]?.notes ?? "",
        },
      },
      `Enrollment marked ${status}`,
    );
  }

  async function removeEnrollment(enrollmentId: string, studentName: string) {
    setBusy(true);
    try {
      const { error } = await supabase.from("enrollments").delete().eq("id", enrollmentId);
      if (error) throw error;
      if (user) {
        await logAudit("enrollment_removed", "enrollment", enrollmentId, {
          student: studentName,
        });
      }
      await refreshAll("Enrollment removed");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove enrollment.");
    } finally {
      setBusy(false);
    }
  }

  async function handleRegisterStudentFlow(e: React.FormEvent) {
    e.preventDefault();
    if (regForm.password.length < 8) {
      toast.error("Initial password must be at least 8 characters.");
      return;
    }
    const normalizedEmail = regForm.email.trim().toLowerCase();
    if (db.profiles.some((p) => p.email.trim().toLowerCase() === normalizedEmail)) {
      toast.error(
        "A user with this email address has already been registered. Enroll the existing student directly instead.",
      );
      return;
    }
    setBusy(true);
    let userApiToasted = false;
    try {
      let res: { userId?: string };
      try {
        res = (await callUserApi({
          action: "create",
          first_name: regForm.first_name.trim(),
          last_name: regForm.last_name.trim(),
          email: normalizedEmail,
          phone: regForm.phone.trim(),
          password: regForm.password,
          role: "student",
          status: "active",
        })) as { userId?: string };
      } catch (err) {
        userApiToasted = true;
        throw err;
      }

      if (res?.userId) {
        await mutateWorkspace({
          type: "upsert_student_meta",
          payload: {
            userId: res.userId,
            studentCode:
              regForm.studentCode.trim() || `STU-${res.userId.slice(0, 6).toUpperCase()}`,
            classSectionId: regForm.classSectionId || null,
            academicYearId: workspace?.academicYears.find((y) => y.isCurrent)?.id ?? null,
            guardianName: regForm.guardianName.trim(),
            guardianPhone: regForm.guardianPhone.trim(),
            address: regForm.address.trim(),
            dateOfBirth: regForm.dateOfBirth,
            notes: regForm.notes.trim(),
          },
        });

        if (regForm.classSectionId) {
          await mutateWorkspace({
            type: "assign_student_class",
            studentId: res.userId,
            classSectionId: regForm.classSectionId,
          });
        }

        if (regForm.courseId) {
          await supabase.from("enrollments").insert({
            user_id: res.userId,
            course_id: regForm.courseId,
          });
        }
      }

      await refreshAll(
        `Registered student ${regForm.first_name.trim()} ${regForm.last_name.trim()}`,
      );
      setRegForm({
        first_name: "",
        last_name: "",
        email: "",
        phone: "",
        password: "",
        studentCode: "",
        classSectionId: "",
        courseId: "",
        guardianName: "",
        guardianPhone: "",
        address: "",
        dateOfBirth: "",
        notes: "",
      });
    } catch (err) {
      if (!userApiToasted) {
        toast.error(err instanceof Error ? err.message : "Could not complete registration.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleCreateRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!reqForm.studentId || !reqForm.courseId) {
      toast.error("Choose student and course.");
      return;
    }
    await mutateWorkspace(
      {
        type: "upsert_enrollment_request",
        payload: {
          studentId: reqForm.studentId,
          courseId: reqForm.courseId,
          classSectionId: reqForm.classSectionId || null,
          requestedBy: user?.id ?? null,
          notes: reqForm.notes.trim(),
        },
      },
      "Enrollment request logged",
    );
    setReqOpen(false);
    setReqForm({ studentId: "", courseId: "", classSectionId: "", notes: "" });
  }

  async function handleReviewRequest(
    req: EnrollmentRequest,
    decision: "approved" | "rejected",
    note: string,
  ) {
    setBusy(true);
    try {
      if (decision === "approved") {
        const exists = db.enrollments.some(
          (e) => e.user_id === req.studentId && e.course_id === req.courseId,
        );
        if (!exists) {
          const { error } = await supabase.from("enrollments").insert({
            user_id: req.studentId,
            course_id: req.courseId,
          });
          if (error) throw error;
        }
      }

      await mutateWorkspace(
        {
          type: "review_enrollment_request",
          id: req.id,
          status: decision,
          reviewNote: note.trim(),
        },
        decision === "approved" ? "Enrollment approved & learner activated" : "Request declined",
      );
      await refreshAll();
      setReviewingReq(null);
      setReviewNote("");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not process request.");
    } finally {
      setBusy(false);
    }
  }

  function exportEnrollments() {
    if (!enrichedEnrollments.length) {
      toast.error("No enrollments to export.");
      return;
    }
    downloadExcelXls(
      "ezana-enrollments.xls",
      "Enrollments",
      enrichedEnrollments.map((r) => ({
        Student: r.student ? displayName(r.student) : "Student",
        Email: r.student?.email ?? "",
        Course: r.course?.title ?? "Course",
        Class: r.className || "Unassigned",
        Status: r.enrollmentStatus,
        Progress: `${r.progressPct}%`,
        EnrolledDate: r.created_at.slice(0, 10),
      })),
      "Ezana Academy — Course Enrollments",
    );
    toast.success("Enrollment report downloaded");
  }

  const pageMeta: Record<EnrollmentTab, { title: string; description: string }> = {
    enrollments: {
      title: "Course Enrollment",
      description:
        "Enroll students into courses, update active/completed/suspended statuses, and track learning progress.",
    },
    registration: {
      title: "Student Registration",
      description:
        "Complete new student admission with account creation, class placement, guardian info, and initial course enrollment.",
    },
    requests: {
      title: "Enrollment Requests",
      description:
        "Review incoming enrollment applications, approve or reject requests, and notify learners automatically.",
    },
    classes: {
      title: "Class Assignments",
      description:
        "Assign students to academic classes and sections, balance cohort capacity, and transfer learners.",
    },
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title={pageMeta[tab].title}
        description={pageMeta[tab].description}
        actions={
          <div className="flex flex-wrap gap-2">
            {tab === "enrollments" && canExport && (
              <Button size="sm" variant="outline" onClick={exportEnrollments}>
                <ArrowDownToLine className="h-4 w-4" /> Export Excel
              </Button>
            )}
            {tab === "enrollments" && canCreate && (
              <Button
                size="sm"
                variant="emerald"
                onClick={() => {
                  setEnrollForm({
                    studentId: students[0]?.id ?? "",
                    courseId: db.courses[0]?.id ?? "",
                    classSectionId: classes[0]?.id ?? "",
                    notes: "",
                  });
                  setEnrollOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> Enroll Student
              </Button>
            )}
            {tab === "requests" && canCreate && (
              <Button
                size="sm"
                variant="emerald"
                onClick={() => {
                  setReqForm({
                    studentId: students[0]?.id ?? "",
                    courseId: db.courses[0]?.id ?? "",
                    classSectionId: classes[0]?.id ?? "",
                    notes: "",
                  });
                  setReqOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> New Request
              </Button>
            )}
          </div>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active Course Enrollments"
          value={db.enrollments.length}
          icon={BookOpen}
          tone="emerald"
          index={0}
        />
        <StatCard
          label="Registered Students"
          value={students.length}
          icon={Users}
          tone="gold"
          index={1}
        />
        <StatCard
          label="Pending Enrollment Requests"
          value={pendingRequestsCount}
          icon={Clock}
          tone="deep"
          index={2}
        />
        <StatCard
          label="Active Classes & Sections"
          value={classes.length}
          icon={FolderTree}
          tone="plain"
          index={3}
        />
      </div>

      {/* Sub-navigation Tabs */}
      <div className="flex flex-wrap gap-2">
        {(
          [
            ["enrollments", "Course Enrollment"],
            ["registration", "Student Registration"],
            ["requests", "Enrollment Requests"],
            ["classes", "Class Assignments"],
          ] as const
        ).map(([id, label]) => (
          <Button
            key={id}
            size="sm"
            variant={tab === id ? "emerald" : "outline"}
            onClick={() => setTab(id)}
          >
            {label}
          </Button>
        ))}
      </div>

      {/* TAB 1: Course Enrollment */}
      {tab === "enrollments" && (
        <Panel>
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={enrollSearch}
                onChange={(e) => {
                  setEnrollSearch(e.target.value);
                  setEnrollPage(1);
                }}
                placeholder="Search student or course…"
                className="pl-9"
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <select
                value={courseFilter}
                onChange={(e) => {
                  setCourseFilter(e.target.value);
                  setEnrollPage(1);
                }}
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
                onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setEnrollPage(1);
                }}
                className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="completed">Completed</option>
                <option value="suspended">Suspended</option>
              </select>
            </div>
          </div>

          {pagedEnrollments.items.length > 0 ? (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Course & Class</TableHead>
                    <TableHead>Progress</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Enrolled</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pagedEnrollments.items.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <p className="font-semibold">
                          {row.student ? displayName(row.student) : "Student"}
                        </p>
                        <p className="text-xs text-muted-foreground">{row.student?.email ?? "—"}</p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{row.course?.title ?? "Course"}</p>
                        <p className="text-xs text-muted-foreground">
                          {row.className || "No class assigned"}
                        </p>
                      </TableCell>
                      <TableCell className="text-xs tabular-nums">
                        <span className="font-semibold">{row.progressPct}%</span>{" "}
                        <span className="text-muted-foreground">
                          ({row.completedLessons}/{row.totalLessons})
                        </span>
                      </TableCell>
                      <TableCell>
                        {canEdit ? (
                          <select
                            aria-label="Enrollment status"
                            value={row.enrollmentStatus}
                            onChange={(e) =>
                              void updateEnrollmentStatus(
                                row.user_id,
                                row.course_id,
                                e.target.value as EnrollmentMeta["status"],
                              )
                            }
                            className="h-8 rounded-md border border-input bg-background px-2 text-xs font-medium capitalize"
                          >
                            <option value="active">Active</option>
                            <option value="completed">Completed</option>
                            <option value="suspended">Suspended</option>
                          </select>
                        ) : (
                          <Badge
                            variant={
                              row.enrollmentStatus === "completed"
                                ? "success"
                                : row.enrollmentStatus === "suspended"
                                  ? "destructive"
                                  : "gold"
                            }
                            className="capitalize"
                          >
                            {row.enrollmentStatus}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        {row.created_at.slice(0, 10)}
                      </TableCell>
                      <TableCell className="text-right">
                        {canDelete && (
                          <ConfirmButton
                            title="Remove course enrollment?"
                            description="This unenrolls the student from this course."
                            confirmLabel="Unenroll"
                            onConfirm={() =>
                              void removeEnrollment(
                                row.id,
                                row.student ? displayName(row.student) : "Student",
                              )
                            }
                            trigger={
                              <Button
                                size="sm"
                                variant="ghost"
                                disabled={busy}
                                className="text-destructive"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            }
                          />
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <Pager
                page={pagedEnrollments.page}
                pageCount={pagedEnrollments.pageCount}
                onPage={setEnrollPage}
              />
            </>
          ) : (
            <EmptyState
              title="No enrollments match"
              text="Enroll a student into a course or reset your filters."
              icon={BookOpen}
            />
          )}
        </Panel>
      )}

      {/* TAB 2: Student Registration */}
      {tab === "registration" && (
        <Panel title="Register & Admit New Student">
          {canCreate ? (
            <form
              className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
              onSubmit={(e) => void handleRegisterStudentFlow(e)}
            >
              <label className="space-y-1 text-sm font-medium">
                First Name *
                <Input
                  required
                  value={regForm.first_name}
                  onChange={(e) => setRegForm((f) => ({ ...f, first_name: e.target.value }))}
                />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Last Name *
                <Input
                  required
                  value={regForm.last_name}
                  onChange={(e) => setRegForm((f) => ({ ...f, last_name: e.target.value }))}
                />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Email Address *
                <Input
                  type="email"
                  required
                  value={regForm.email}
                  onChange={(e) => setRegForm((f) => ({ ...f, email: e.target.value }))}
                />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Phone Number
                <Input
                  value={regForm.phone}
                  onChange={(e) => setRegForm((f) => ({ ...f, phone: e.target.value }))}
                  placeholder="+251 9…"
                />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Initial Password *
                <Input
                  type="password"
                  required
                  minLength={8}
                  value={regForm.password}
                  onChange={(e) => setRegForm((f) => ({ ...f, password: e.target.value }))}
                  placeholder="Min 8 characters"
                />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Student Code
                <Input
                  value={regForm.studentCode}
                  onChange={(e) => setRegForm((f) => ({ ...f, studentCode: e.target.value }))}
                  placeholder="Auto-generated if empty"
                />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Assign Class / Section
                <select
                  value={regForm.classSectionId}
                  onChange={(e) => setRegForm((f) => ({ ...f, classSectionId: e.target.value }))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">Unassigned</option>
                  {classes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} ({c.studentIds.length}/{c.capacity})
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium">
                Initial Course Enrollment
                <select
                  value={regForm.courseId}
                  onChange={(e) => setRegForm((f) => ({ ...f, courseId: e.target.value }))}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">None yet</option>
                  {db.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium">
                Date of Birth
                <Input
                  type="date"
                  value={regForm.dateOfBirth}
                  onChange={(e) => setRegForm((f) => ({ ...f, dateOfBirth: e.target.value }))}
                />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Guardian Name
                <Input
                  value={regForm.guardianName}
                  onChange={(e) => setRegForm((f) => ({ ...f, guardianName: e.target.value }))}
                />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Guardian Phone
                <Input
                  value={regForm.guardianPhone}
                  onChange={(e) => setRegForm((f) => ({ ...f, guardianPhone: e.target.value }))}
                />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Residential Address
                <Input
                  value={regForm.address}
                  onChange={(e) => setRegForm((f) => ({ ...f, address: e.target.value }))}
                />
              </label>
              <label className="space-y-1 text-sm font-medium sm:col-span-2 lg:col-span-3">
                Admission Notes
                <Textarea
                  rows={2}
                  value={regForm.notes}
                  onChange={(e) => setRegForm((f) => ({ ...f, notes: e.target.value }))}
                />
              </label>
              <div className="sm:col-span-2 lg:col-span-3">
                <Button type="submit" variant="emerald" disabled={busy || mutating}>
                  <UserPlus className="h-4 w-4" />
                  {busy ? "Registering…" : "Complete Student Registration"}
                </Button>
              </div>
            </form>
          ) : (
            <EmptyState
              title="Registration disabled"
              text="You do not have permission to register new students."
            />
          )}
        </Panel>
      )}

      {/* TAB 3: Enrollment Requests */}
      {tab === "requests" && (
        <Panel>
          <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="relative w-full md:max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={reqSearch}
                onChange={(e) => setReqSearch(e.target.value)}
                placeholder="Search student or course…"
                className="pl-9"
              />
            </div>
            <select
              value={reqStatusFilter}
              onChange={(e) => setReqStatusFilter(e.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="all">All Requests</option>
              <option value="pending">Pending</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {filteredRequests.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Course & Class</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Requested</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredRequests.map((req) => {
                  const student = maps.profilesById.get(req.studentId);
                  const course = maps.coursesById.get(req.courseId);
                  const cls = req.classSectionId
                    ? maps.classesById.get(req.classSectionId)
                    : undefined;
                  return (
                    <TableRow key={req.id}>
                      <TableCell>
                        <p className="font-semibold">
                          {student ? displayName(student) : "Student"}
                        </p>
                        <p className="text-xs text-muted-foreground">{student?.email ?? "—"}</p>
                      </TableCell>
                      <TableCell>
                        <p className="font-medium">{course?.title ?? "Course"}</p>
                        <p className="text-xs text-muted-foreground">{cls?.name ?? "Open cohort"}</p>
                      </TableCell>
                      <TableCell className="max-w-xs text-xs text-muted-foreground">
                        {req.notes || req.reviewNote || "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={
                            req.status === "approved"
                              ? "success"
                              : req.status === "rejected"
                                ? "destructive"
                                : "warning"
                          }
                          className="capitalize"
                        >
                          {req.status}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground tabular-nums">
                        {req.createdAt.slice(0, 10)}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1.5">
                          {req.status === "pending" && canApprove && (
                            <>
                              <Button
                                size="sm"
                                variant="emerald"
                                disabled={busy || mutating}
                                onClick={() => void handleReviewRequest(req, "approved", "")}
                              >
                                <Check className="h-3.5 w-3.5" /> Approve
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                disabled={busy || mutating}
                                onClick={() => {
                                  setReviewingReq(req);
                                  setReviewNote("");
                                }}
                              >
                                <X className="h-3.5 w-3.5" /> Reject
                              </Button>
                            </>
                          )}
                          {canDelete && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() =>
                                void mutateWorkspace(
                                  { type: "delete_enrollment_request", id: req.id },
                                  "Enrollment request deleted",
                                )
                              }
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
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
              title="No enrollment requests"
              text="Incoming student enrollment requests appear here for approval or rejection."
              icon={Clock}
            />
          )}
        </Panel>
      )}

      {/* TAB 4: Class Assignments */}
      {tab === "classes" && (
        <div className="grid gap-6 xl:grid-cols-[320px_minmax(0,1fr)]">
          <Panel title="Classes & Cohorts">
            {classes.length > 0 ? (
              <div className="space-y-2">
                {classes.map((cls) => {
                  const isSelected = activeClass?.id === cls.id;
                  return (
                    <button
                      key={cls.id}
                      type="button"
                      onClick={() => setSelectedClassId(cls.id)}
                      className={`w-full rounded-xl border p-3 text-left transition-colors ${
                        isSelected
                          ? "border-primary bg-primary/5"
                          : "border-border hover:bg-secondary/50"
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="font-semibold text-sm">{cls.name}</p>
                        <Badge variant="outline" className="tabular-nums">
                          {cls.studentIds.length}/{cls.capacity}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {cls.sectionCode} · {cls.room}
                      </p>
                    </button>
                  );
                })}
              </div>
            ) : (
              <EmptyState title="No classes defined" text="Create a class section first." />
            )}
          </Panel>

          <Panel
            title={
              activeClass
                ? `${activeClass.name} — Roster (${activeClass.studentIds.length}/${activeClass.capacity})`
                : "Class Roster"
            }
          >
            {activeClass ? (
              <div className="space-y-4">
                {canEdit && (
                  <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-secondary/30 p-3">
                    <label className="min-w-[220px] flex-1 space-y-1 text-xs font-medium">
                      Assign or Transfer Student to {activeClass.sectionCode}
                      <select
                        value={assignStudentId}
                        onChange={(e) => setAssignStudentId(e.target.value)}
                        className="h-9 w-full rounded-md border border-input bg-background px-2.5 text-sm"
                      >
                        <option value="">Choose student…</option>
                        {students
                          .filter((s) => !activeClass.studentIds.includes(s.id))
                          .map((s) => {
                            const curClassId = workspace?.studentMeta[s.id]?.classSectionId;
                            const curClass = curClassId
                              ? maps.classesById.get(curClassId)?.sectionCode
                              : null;
                            return (
                              <option key={s.id} value={s.id}>
                                {displayName(s)} {curClass ? `(currently ${curClass})` : ""}
                              </option>
                            );
                          })}
                      </select>
                    </label>
                    <Button
                      size="sm"
                      variant="emerald"
                      disabled={!assignStudentId || mutating}
                      onClick={() => {
                        if (!assignStudentId) return;
                        void mutateWorkspace(
                          {
                            type: "assign_student_class",
                            studentId: assignStudentId,
                            classSectionId: activeClass.id,
                          },
                          "Student assigned to class",
                        ).then(() => setAssignStudentId(""));
                      }}
                    >
                      <CheckCircle2 className="h-4 w-4" /> Assign to Class
                    </Button>
                  </div>
                )}

                <div className="relative max-w-sm">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={classSearch}
                    onChange={(e) => setClassSearch(e.target.value)}
                    placeholder="Filter assigned students…"
                    className="pl-9"
                  />
                </div>

                {activeClass.studentIds.length > 0 ? (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student</TableHead>
                        <TableHead>Student ID</TableHead>
                        <TableHead>Enrolled Courses</TableHead>
                        <TableHead className="text-right">Action</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {activeClass.studentIds
                        .map((sid) => maps.profilesById.get(sid))
                        .filter((s): s is NonNullable<typeof s> => {
                          if (!s) return false;
                          if (!classSearch.trim()) return true;
                          return `${displayName(s)} ${s.email}`
                            .toLowerCase()
                            .includes(classSearch.trim().toLowerCase());
                        })
                        .map((student) => {
                          const meta = workspace?.studentMeta[student.id];
                          const courseCount = db.enrollments.filter(
                            (e) => e.user_id === student.id,
                          ).length;
                          return (
                            <TableRow key={student.id}>
                              <TableCell>
                                <p className="font-semibold">{displayName(student)}</p>
                                <p className="text-xs text-muted-foreground">{student.email}</p>
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {meta?.studentCode ?? `STU-${student.id.slice(0, 6).toUpperCase()}`}
                              </TableCell>
                              <TableCell className="text-xs tabular-nums">
                                {courseCount} courses
                              </TableCell>
                              <TableCell className="text-right">
                                {canEdit && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-destructive"
                                    onClick={() =>
                                      void mutateWorkspace(
                                        {
                                          type: "assign_student_class",
                                          studentId: student.id,
                                          classSectionId: null,
                                        },
                                        "Removed from class section",
                                      )
                                    }
                                  >
                                    Unassign
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
                    title="No students in this class yet"
                    text="Use the selector above to assign students to this class."
                    icon={Users}
                  />
                )}
              </div>
            ) : (
              <EmptyState title="Select a class section" />
            )}
          </Panel>
        </div>
      )}

      {/* Direct Enroll Modal */}
      <Dialog open={enrollOpen} onOpenChange={setEnrollOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Enroll Student in Course</DialogTitle>
            <DialogDescription>
              Grant immediate course access and optionally link a class cohort.
            </DialogDescription>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => void enrollStudentDirect(e)}>
            <label className="block space-y-1 text-sm font-medium">
              Student
              <select
                required
                value={enrollForm.studentId}
                onChange={(e) => setEnrollForm((f) => ({ ...f, studentId: e.target.value }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Choose student…</option>
                {students.map((s) => (
                  <option key={s.id} value={s.id}>
                    {displayName(s)} ({s.email})
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm font-medium">
              Course
              <select
                required
                value={enrollForm.courseId}
                onChange={(e) => setEnrollForm((f) => ({ ...f, courseId: e.target.value }))}
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
              Assign Class / Section (optional)
              <select
                value={enrollForm.classSectionId}
                onChange={(e) => setEnrollForm((f) => ({ ...f, classSectionId: e.target.value }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Keep current</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm font-medium">
              Notes
              <Input
                value={enrollForm.notes}
                onChange={(e) => setEnrollForm((f) => ({ ...f, notes: e.target.value }))}
                placeholder="Scholarship, cohort transfer, etc."
              />
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEnrollOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="emerald" disabled={busy || mutating}>
                {busy ? "Enrolling…" : "Confirm Enrollment"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* New Enrollment Request Modal */}
      <Dialog open={reqOpen} onOpenChange={setReqOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Log Enrollment Request</DialogTitle>
          </DialogHeader>
          <form className="space-y-3" onSubmit={(e) => void handleCreateRequest(e)}>
            <label className="block space-y-1 text-sm font-medium">
              Student
              <select
                required
                value={reqForm.studentId}
                onChange={(e) => setReqForm((f) => ({ ...f, studentId: e.target.value }))}
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
              Requested Course
              <select
                required
                value={reqForm.courseId}
                onChange={(e) => setReqForm((f) => ({ ...f, courseId: e.target.value }))}
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
              Preferred Class / Section
              <select
                value={reqForm.classSectionId}
                onChange={(e) => setReqForm((f) => ({ ...f, classSectionId: e.target.value }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Any available</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>
            <label className="block space-y-1 text-sm font-medium">
              Application Notes
              <Textarea
                rows={2}
                value={reqForm.notes}
                onChange={(e) => setReqForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setReqOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="emerald" disabled={mutating}>
                Submit Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Reject Request Modal */}
      <Dialog open={!!reviewingReq} onOpenChange={(o) => !o && setReviewingReq(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Decline Enrollment Request</DialogTitle>
            <DialogDescription>
              Provide a brief reason sent to the learner notification feed.
            </DialogDescription>
          </DialogHeader>
          {reviewingReq && (
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                void handleReviewRequest(reviewingReq, "rejected", reviewNote);
              }}
            >
              <label className="block space-y-1 text-sm font-medium">
                Reason / Note
                <Textarea
                  required
                  rows={3}
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  placeholder="Prerequisites incomplete, cohort full, etc."
                />
              </label>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setReviewingReq(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="destructive" disabled={busy || mutating}>
                  Reject Request
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
