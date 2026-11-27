import type { AppRole } from "@/lib/auth";
import { createMockSupabaseClient } from "@/integrations/supabase/mock";
import { createDefaultRolePermissions, hasModulePermission } from "@/lib/owner/logic";
import {
  applyWorkspaceMutation,
  createAuthedSupabase,
  getOwnerWorkspaceState,
  resolvePermissionForMutation,
  type WorkspaceMutationPayload,
} from "@/lib/owner/store.server";
import type {
  AccountPreferences,
  ExamAssessment,
  OwnerWorkspaceState,
  PermissionAction,
  PermissionModule,
  StudentRecordMeta,
} from "@/lib/owner/types";
import type { ScopedStudentWorkspace, StudentCoursePublicMeta } from "./types";

export interface StudentScope {
  studentId: string;
  enrolledCourseIds: Set<string>;
  assignedClassIds: Set<string>;
  paidCourseIds: Set<string>;
  linkedParentIds: Set<string>;
  authorizedRecipientIds: Set<string>;
  courseEnrollmentCounts: Record<string, number>;
}

const DEFAULT_ACCOUNT_PREFS: AccountPreferences = {
  language: "en",
  timezone: "Africa/Addis_Ababa",
  emailNotifications: true,
  inAppNotifications: true,
  paymentReviewDigest: false,
  weeklyExecutiveSummary: false,
};

export async function authorizeStudentApi(
  request: Request,
  module: PermissionModule,
  action: PermissionAction,
): Promise<
  | {
      ok: true;
      userId: string;
      roles: AppRole[];
      supabase: ReturnType<typeof createAuthedSupabase>;
      isMock: boolean;
    }
  | { ok: false; response: Response }
> {
  const supabaseUrl = process.env["SUPABASE_URL"];
  const supabaseKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
  const authHeader = request.headers.get("authorization");

  if (!supabaseUrl || !supabaseKey) {
    const mockClient = createMockSupabaseClient();
    const token = authHeader?.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    let userId: string | null = null;
    if (token.startsWith("mock.")) {
      try {
        userId = Buffer.from(token.split(".")[1] ?? "", "base64").toString("utf8");
      } catch {
        userId = null;
      }
    }
    if (!userId) {
      const { data } = await mockClient.auth.getUser();
      userId = data.user?.id ?? null;
    }
    if (!userId) {
      return {
        ok: false,
        response: new Response("Unauthorized: sign in required.", { status: 401 }),
      };
    }
    const { data: roleRows } = await mockClient
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    const roles = (roleRows ?? []).map((r) => r.role as AppRole);
    const effectiveRoles: AppRole[] = roles.length ? roles : ["student"];
    if (!effectiveRoles.includes("student") && !effectiveRoles.includes("owner")) {
      return {
        ok: false,
        response: new Response("Forbidden: student role required.", { status: 403 }),
      };
    }
    const state = getOwnerWorkspaceState();
    const checkRoles: AppRole[] = effectiveRoles.includes("owner") ? effectiveRoles : ["student"];
    if (!hasModulePermission(state.rolePermissions, checkRoles, module, action)) {
      return {
        ok: false,
        response: new Response(`Forbidden: missing "${action}" permission on ${module}.`, {
          status: 403,
        }),
      };
    }
    return {
      ok: true,
      userId,
      roles: effectiveRoles,
      supabase: mockClient as unknown as ReturnType<typeof createAuthedSupabase>,
      isMock: true,
    };
  }

  if (!authHeader?.startsWith("Bearer ")) {
    return {
      ok: false,
      response: new Response("Unauthorized: Bearer token required.", { status: 401 }),
    };
  }
  const token = authHeader.slice(7).trim();
  const supabase = createAuthedSupabase(supabaseUrl, supabaseKey, token);
  const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
  const userId = claimsData?.claims?.sub;
  if (claimsError || !userId) {
    return { ok: false, response: new Response("Unauthorized: invalid session.", { status: 401 }) };
  }

  const { data: roleRows, error: roleError } = await supabase
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (roleError) {
    return { ok: false, response: new Response("Could not verify user roles.", { status: 500 }) };
  }
  const roles = (roleRows ?? []).map((r) => r.role);
  if (!roles.includes("student") && !roles.includes("owner")) {
    return {
      ok: false,
      response: new Response("Forbidden: student role required.", { status: 403 }),
    };
  }

  const state = getOwnerWorkspaceState();
  const checkRoles: AppRole[] = roles.includes("owner") ? roles : ["student"];
  if (!hasModulePermission(state.rolePermissions, checkRoles, module, action)) {
    return {
      ok: false,
      response: new Response(`Forbidden: your role lacks "${action}" permission for ${module}.`, {
        status: 403,
      }),
    };
  }

  return { ok: true, userId, roles, supabase, isMock: false };
}

export async function resolveStudentScope(
  supabase: ReturnType<typeof createAuthedSupabase>,
  studentId: string,
  workspace: OwnerWorkspaceState,
  _isMock = false,
): Promise<StudentScope> {
  const enrolledCourseIds = new Set<string>();
  const assignedClassIds = new Set<string>();
  const paidCourseIds = new Set<string>();
  const linkedParentIds = new Set<string>();
  const authorizedRecipientIds = new Set<string>();
  const courseEnrollmentCounts: Record<string, number> = {};

  const [{ data: myEnrollments }, { data: myPayments }, { data: myParents }, { data: pubCourses }] =
    await Promise.all([
      supabase.from("enrollments").select("course_id").eq("user_id", studentId),
      supabase
        .from("payments")
        .select("course_id")
        .eq("user_id", studentId)
        .eq("status", "approved"),
      supabase.from("parent_links").select("parent_id").eq("student_id", studentId),
      supabase.from("courses").select("id, instructor_id").eq("status", "published"),
    ]);

  for (const e of myEnrollments ?? []) {
    enrolledCourseIds.add(e.course_id);
  }
  for (const p of myPayments ?? []) {
    paidCourseIds.add(p.course_id);
  }
  for (const l of myParents ?? []) {
    linkedParentIds.add(l.parent_id);
  }

  const studentMeta = workspace.studentMeta[studentId];
  if (studentMeta?.classSectionId) {
    assignedClassIds.add(studentMeta.classSectionId);
  }
  for (const cls of workspace.classes) {
    if (cls.studentIds.includes(studentId)) {
      assignedClassIds.add(cls.id);
    }
    if (assignedClassIds.has(cls.id) && cls.instructorId) {
      authorizedRecipientIds.add(cls.instructorId);
    }
  }
  for (const [cid, meta] of Object.entries(workspace.courseMeta)) {
    if (enrolledCourseIds.has(cid) && meta.classSectionId) {
      assignedClassIds.add(meta.classSectionId);
    }
  }

  for (const c of pubCourses ?? []) {
    if (c.instructor_id && enrolledCourseIds.has(c.id)) {
      authorizedRecipientIds.add(c.instructor_id);
    }
  }

  // Allow messaging academy support staff (owner / admin) and instructors who sent messages to student
  const { data: staffRoles } = await supabase
    .from("user_roles")
    .select("user_id, role")
    .in("role", ["owner", "admin"]);
  for (const r of staffRoles ?? []) {
    authorizedRecipientIds.add(r.user_id);
  }
  for (const im of workspace.internalMessages) {
    if (!im.deleted && im.recipientId === studentId && im.senderId) {
      authorizedRecipientIds.add(im.senderId);
    }
  }

  // Course capacity check counts (counts only, never peer identities)
  const enrolledList = [...enrolledCourseIds];
  if ((pubCourses ?? []).length > 0) {
    const courseIds = (pubCourses ?? []).map((c) => c.id);
    const { data: allEnr } = await supabase
      .from("enrollments")
      .select("course_id")
      .in("course_id", courseIds);
    for (const row of allEnr ?? []) {
      courseEnrollmentCounts[row.course_id] = (courseEnrollmentCounts[row.course_id] ?? 0) + 1;
    }
  }
  for (const cid of enrolledList) {
    courseEnrollmentCounts[cid] = Math.max(courseEnrollmentCounts[cid] ?? 0, 1);
  }

  return {
    studentId,
    enrolledCourseIds,
    assignedClassIds,
    paidCourseIds,
    linkedParentIds,
    authorizedRecipientIds,
    courseEnrollmentCounts,
  };
}

function sanitizeExamForStudent(
  exam: ExamAssessment,
  submissionStatus: "pending" | "submitted" | "graded" | undefined,
): ExamAssessment {
  const revealAnswers = submissionStatus === "graded" || exam.status === "completed";
  if (revealAnswers) return exam;
  return {
    ...exam,
    questions: exam.questions.map((q) => ({
      ...q,
      correctAnswer: "",
    })),
  };
}

export function scopeWorkspaceForStudent(
  workspace: OwnerWorkspaceState,
  scope: StudentScope,
): ScopedStudentWorkspace {
  const {
    studentId,
    enrolledCourseIds,
    assignedClassIds,
    paidCourseIds,
    linkedParentIds,
    authorizedRecipientIds,
    courseEnrollmentCounts,
  } = scope;

  // Strip sensitive integration keys (like YouTube API keys) from courseMeta
  const courseMeta: Record<string, StudentCoursePublicMeta> = {};
  for (const [cid, meta] of Object.entries(workspace.courseMeta)) {
    courseMeta[cid] = {
      courseId: meta.courseId,
      priceEtb: meta.priceEtb,
      enrollmentMode: meta.enrollmentMode,
      maxCapacity: meta.maxCapacity,
      classSectionId: meta.classSectionId,
      academicTermId: meta.academicTermId,
    };
  }

  const classes = workspace.classes
    .filter((c) => assignedClassIds.has(c.id))
    .map((c) => ({
      ...c,
      // Do not expose peer student IDs to other students
      studentIds: c.studentIds.includes(studentId) ? [studentId] : [],
    }));

  const myStudentMeta: StudentRecordMeta = workspace.studentMeta[studentId] ?? {
    userId: studentId,
    studentCode: `STU-${studentId.slice(0, 6).toUpperCase()}`,
    classSectionId: classes[0]?.id ?? null,
    academicYearId: workspace.academicYears.find((y) => y.isCurrent)?.id ?? null,
    guardianName: "",
    guardianPhone: "",
    address: "",
    dateOfBirth: "",
    notes: "",
  };

  const enrollmentMeta: OwnerWorkspaceState["enrollmentMeta"] = {};
  for (const [key, meta] of Object.entries(workspace.enrollmentMeta)) {
    if (key.startsWith(`${studentId}:`)) {
      enrollmentMeta[key] = meta;
    }
  }

  const myExamSubmissions = workspace.examSubmissions.filter((s) => s.studentId === studentId);
  const subByExam = new Map(myExamSubmissions.map((s) => [s.examId, s]));

  const visibleExams = workspace.exams
    .filter(
      (ex) =>
        ex.status !== "draft" &&
        (enrolledCourseIds.has(ex.courseId) ||
          (ex.classSectionId !== null &&
            ex.classSectionId !== undefined &&
            assignedClassIds.has(ex.classSectionId))),
    )
    .map((ex) => sanitizeExamForStudent(ex, subByExam.get(ex.id)?.status));

  const visibleExamIds = new Set(visibleExams.map((ex) => ex.id));

  const visibleAssignments = workspace.assignments.filter(
    (a) =>
      a.status !== "draft" &&
      (enrolledCourseIds.has(a.courseId) ||
        (a.classSectionId !== null && assignedClassIds.has(a.classSectionId))),
  );
  const visibleAssignmentIds = new Set(visibleAssignments.map((a) => a.id));

  const discussionThreads = workspace.discussionThreads.filter((t) =>
    enrolledCourseIds.has(t.courseId),
  );
  const visibleThreadIds = new Set(discussionThreads.map((t) => t.id));

  const issuedCertificates = workspace.issuedCertificates.filter((c) => c.studentId === studentId);
  const usedTemplateIds = new Set(issuedCertificates.map((c) => c.templateId));

  const announcementMeta: OwnerWorkspaceState["announcementMeta"] = {};
  for (const [aid, meta] of Object.entries(workspace.announcementMeta)) {
    if (
      (!meta.targetCourseId && !meta.targetClassId) ||
      (meta.targetCourseId && enrolledCourseIds.has(meta.targetCourseId)) ||
      (meta.targetClassId && assignedClassIds.has(meta.targetClassId))
    ) {
      announcementMeta[aid] = meta;
    }
  }

  const defaultPerms = createDefaultRolePermissions().student;

  return {
    studentId,
    enrolledCourseIds: [...enrolledCourseIds],
    assignedClassIds: [...assignedClassIds],
    paidCourseIds: [...paidCourseIds],
    linkedParentIds: [...linkedParentIds],
    authorizedRecipientIds: [...authorizedRecipientIds],
    courseEnrollmentCounts,
    academicYears: workspace.academicYears,
    terms: workspace.terms,
    departments: workspace.departments,
    calendarEvents: workspace.calendarEvents,
    classes,
    subjects: workspace.subjects,
    courseMeta,
    myStudentMeta,
    enrollmentRequests: workspace.enrollmentRequests.filter((r) => r.studentId === studentId),
    enrollmentMeta,
    timetables: workspace.timetables.filter(
      (t) =>
        (t.courseId !== null && enrolledCourseIds.has(t.courseId)) ||
        (t.classSectionId !== null && assignedClassIds.has(t.classSectionId)),
    ),
    attendance: workspace.attendance.filter(
      (a) => a.personType === "student" && a.personId === studentId,
    ),
    attendanceDisputes: (workspace.attendanceDisputes ?? []).filter(
      (d) => d.studentId === studentId,
    ),
    gradingScales: workspace.gradingScales,
    grades: workspace.grades.filter((g) => g.studentId === studentId),
    courseMaterials: workspace.courseMaterials.filter(
      (m) => m.visibleToEnrolled && enrolledCourseIds.has(m.courseId),
    ),
    resources: workspace.resources.filter((r) => {
      if (r.accessLevel === "staff_only") return false;
      if (r.accessLevel === "public") return true;
      if (r.accessLevel === "enrolled") {
        return !r.courseId || enrolledCourseIds.has(r.courseId);
      }
      if (r.accessLevel === "pro_paid") {
        return r.courseId !== null && paidCourseIds.has(r.courseId);
      }
      return false;
    }),
    liveClasses: workspace.liveClasses.filter(
      (lc) =>
        enrolledCourseIds.has(lc.courseId) ||
        (lc.classSectionId !== null && assignedClassIds.has(lc.classSectionId)) ||
        lc.participantIds.includes(studentId),
    ),
    assignments: visibleAssignments,
    assignmentSubmissions: workspace.assignmentSubmissions.filter(
      (s) => s.studentId === studentId && visibleAssignmentIds.has(s.assignmentId),
    ),
    exams: visibleExams,
    examSubmissions: myExamSubmissions.filter((s) => visibleExamIds.has(s.examId)),
    courseCompletions: workspace.courseCompletions.filter((cc) => cc.studentId === studentId),
    certificateTemplates: workspace.certificateTemplates.filter(
      (t) => t.isDefault || usedTemplateIds.has(t.id),
    ),
    issuedCertificates,
    feePlans: workspace.feePlans.filter((f) => f.studentId === studentId),
    invoices: workspace.invoices.filter((inv) => inv.studentId === studentId),
    paymentReminders: workspace.paymentReminders.filter((pr) => pr.studentId === studentId),
    parentMessages: workspace.parentMessages.filter(
      (pm) => pm.studentId === studentId || linkedParentIds.has(pm.parentId),
    ),
    internalMessages: workspace.internalMessages.filter(
      (m) => !m.deleted && (m.senderId === studentId || m.recipientId === studentId),
    ),
    discussionThreads,
    discussionPosts: workspace.discussionPosts.filter(
      (p) => !p.moderatedHidden && visibleThreadIds.has(p.threadId),
    ),
    notifications: workspace.notifications.filter(
      (n) =>
        n.targetUserId === studentId ||
        ((n.targetRole === "all" || n.targetRole === "student") &&
          (!n.targetClassId || assignedClassIds.has(n.targetClassId)) &&
          (!n.targetCourseId || enrolledCourseIds.has(n.targetCourseId))),
    ),
    announcementMeta,
    profileCorrectionRequests: (workspace.profileCorrectionRequests ?? []).filter(
      (req) => req.studentId === studentId,
    ),
    myAccountPrefs: workspace.accountPrefsByUser[studentId] ?? DEFAULT_ACCOUNT_PREFS,
    myPermissions: workspace.rolePermissions?.student ?? defaultPerms,
    currency: workspace.systemSettings.currency,
    platformName: workspace.systemSettings.platformName,
    minPasswordLength: workspace.systemSettings.minPasswordLength,
  };
}

const ALLOWED_STUDENT_MUTATION_TYPES = new Set<WorkspaceMutationPayload["type"]>([
  "upsert_enrollment_request",
  "upsert_assignment_submission",
  "upsert_exam_submission",
  "report_attendance_discrepancy",
  "request_profile_correction",
  "upsert_student_meta",
  "send_internal_message",
  "update_internal_message",
  "send_parent_message",
  "mark_parent_message_read",
  "upsert_discussion_thread",
  "add_discussion_post",
  "mark_notification_read",
  "update_account_prefs",
]);

export function sanitizeAndAssertStudentMutation(
  mutation: WorkspaceMutationPayload,
  scope: StudentScope,
  workspace: OwnerWorkspaceState,
  isMock = false,
): WorkspaceMutationPayload {
  if (!ALLOWED_STUDENT_MUTATION_TYPES.has(mutation.type)) {
    throw new Error("Forbidden: students cannot modify official academy records or staff data.");
  }

  const ensureCourseEnrolled = (courseId: string | null | undefined) => {
    if (!courseId) throw new Error("Course identifier is required.");
    if (!isMock && !scope.enrolledCourseIds.has(courseId)) {
      throw new Error("Forbidden: you are not enrolled in this course.");
    }
  };

  switch (mutation.type) {
    case "upsert_enrollment_request": {
      if (mutation.payload.studentId !== scope.studentId) {
        throw new Error("Forbidden: enrollment requests must belong to your account.");
      }
      if (scope.enrolledCourseIds.has(mutation.payload.courseId)) {
        throw new Error("You are already enrolled in this course.");
      }
      const meta = workspace.courseMeta[mutation.payload.courseId];
      if (meta?.enrollmentMode === "closed") {
        throw new Error("Enrollment is currently closed for this course.");
      }
      if (
        meta?.maxCapacity !== null &&
        meta?.maxCapacity !== undefined &&
        (scope.courseEnrollmentCounts[mutation.payload.courseId] ?? 0) >= meta.maxCapacity
      ) {
        throw new Error("This course has reached maximum enrollment capacity.");
      }
      const existingPending = workspace.enrollmentRequests.find(
        (r) =>
          r.studentId === scope.studentId &&
          r.courseId === mutation.payload.courseId &&
          r.status === "pending",
      );
      if (existingPending) {
        throw new Error("You already have a pending enrollment request for this course.");
      }
      return {
        type: "upsert_enrollment_request",
        payload: {
          ...mutation.payload,
          studentId: scope.studentId,
          requestedBy: scope.studentId,
        },
      };
    }

    case "upsert_assignment_submission": {
      if (mutation.payload.studentId !== scope.studentId) {
        throw new Error("Forbidden: cannot submit assignments for another student.");
      }
      const assignment = workspace.assignments.find(
        (a) => a.id === mutation.payload.assignmentId,
      );
      if (!assignment) {
        throw new Error("Assignment not found.");
      }
      if (assignment.status !== "published") {
        throw new Error("This assignment is no longer accepting submissions.");
      }
      ensureCourseEnrolled(assignment.courseId);

      const existing = workspace.assignmentSubmissions.find(
        (s) =>
          s.assignmentId === assignment.id && s.studentId === scope.studentId,
      );
      if (existing?.status === "graded") {
        throw new Error("Forbidden: graded assignment submissions cannot be altered.");
      }

      const isDraft = mutation.payload.status === "pending";
      const nowIso = new Date().toISOString();
      const todayIso = nowIso.slice(0, 10);
      const isLate = Boolean(assignment.dueDate && todayIso > assignment.dueDate);

      return {
        type: "upsert_assignment_submission",
        payload: {
          id: existing?.id ?? (mutation.payload.id || crypto.randomUUID()),
          assignmentId: assignment.id,
          courseId: assignment.courseId,
          studentId: scope.studentId,
          submittedText: mutation.payload.submittedText.trim(),
          attachmentUrl: mutation.payload.attachmentUrl.trim(),
          submittedAt: isDraft ? null : nowIso,
          status: isDraft ? "pending" : isLate ? "late" : "submitted",
          score: existing?.score ?? null,
          feedback: existing?.feedback ?? "",
          gradedBy: existing?.gradedBy ?? null,
          gradedAt: existing?.gradedAt ?? null,
          returnedAt: existing?.returnedAt ?? null,
        },
      };
    }

    case "upsert_exam_submission": {
      if (mutation.payload.studentId !== scope.studentId) {
        throw new Error("Forbidden: cannot submit exams for another student.");
      }
      const exam = workspace.exams.find((ex) => ex.id === mutation.payload.examId);
      if (!exam) {
        throw new Error("Assessment not found.");
      }
      ensureCourseEnrolled(exam.courseId);
      if (exam.status !== "active") {
        throw new Error(
          exam.status === "completed"
            ? "This assessment window has closed."
            : "This assessment is not currently open for submission.",
        );
      }
      const existing = workspace.examSubmissions.find(
        (s) => s.examId === exam.id && s.studentId === scope.studentId,
      );
      if (existing?.status === "graded") {
        throw new Error("Forbidden: graded assessment records cannot be altered.");
      }

      const answers = mutation.payload.answers ?? existing?.answers ?? {};
      const isSubmit = mutation.payload.status === "submitted";
      const nowIso = new Date().toISOString();

      if (!isSubmit) {
        return {
          type: "upsert_exam_submission",
          payload: {
            id: existing?.id ?? (mutation.payload.id || crypto.randomUUID()),
            examId: exam.id,
            studentId: scope.studentId,
            score: 0,
            status: "pending",
            submittedAt: null,
            gradedAt: null,
            feedback: "",
            answers,
          },
        };
      }

      // Compute score strictly on the server; never accept client-submitted scores
      const allObjective =
        exam.questions.length > 0 &&
        exam.questions.every(
          (q) =>
            (q.questionType === "multiple_choice" || q.questionType === "true_false") &&
            q.correctAnswer.trim() !== "",
        );
      let objectiveEarned = 0;
      let totalQuestionPoints = 0;
      for (const q of exam.questions) {
        totalQuestionPoints += q.points;
        if (
          (q.questionType === "multiple_choice" || q.questionType === "true_false") &&
          q.correctAnswer.trim() !== ""
        ) {
          const given = (answers[q.id] ?? "").trim().toLowerCase();
          if (given && given === q.correctAnswer.trim().toLowerCase()) {
            objectiveEarned += q.points;
          }
        }
      }
      const scaledScore =
        totalQuestionPoints > 0
          ? Math.min(
              exam.maxScore,
              Math.round((objectiveEarned / totalQuestionPoints) * exam.maxScore),
            )
          : 0;

      return {
        type: "upsert_exam_submission",
        payload: {
          id: existing?.id ?? (mutation.payload.id || crypto.randomUUID()),
          examId: exam.id,
          studentId: scope.studentId,
          score: scaledScore,
          status: allObjective ? "graded" : "submitted",
          submittedAt: nowIso,
          gradedAt: allObjective ? nowIso : null,
          feedback: allObjective
            ? `Auto-graded objective assessment (${scaledScore}/${exam.maxScore}).`
            : "",
          answers,
        },
      };
    }

    case "report_attendance_discrepancy": {
      if (mutation.payload.studentId !== scope.studentId) {
        throw new Error("Forbidden: discrepancy report must belong to your account.");
      }
      const rec = workspace.attendance.find(
        (a) =>
          a.id === mutation.payload.attendanceId &&
          a.personType === "student" &&
          a.personId === scope.studentId,
      );
      if (!rec) {
        throw new Error("Attendance entry not found for your account.");
      }
      return {
        type: "report_attendance_discrepancy",
        payload: {
          attendanceId: rec.id,
          studentId: scope.studentId,
          courseId: rec.courseId,
          date: rec.date,
          reason: mutation.payload.reason.trim(),
        },
      };
    }

    case "request_profile_correction": {
      if (mutation.payload.studentId !== scope.studentId) {
        throw new Error("Forbidden: correction request must belong to your account.");
      }
      return {
        type: "request_profile_correction",
        payload: {
          studentId: scope.studentId,
          field: mutation.payload.field,
          requestedValue: mutation.payload.requestedValue.trim(),
          reason: mutation.payload.reason.trim(),
        },
      };
    }

    case "upsert_student_meta": {
      if (mutation.payload.userId !== scope.studentId) {
        throw new Error("Forbidden: cannot update another student's record.");
      }
      // Preserve academy-controlled academic identity fields
      const existing = workspace.studentMeta[scope.studentId];
      return {
        type: "upsert_student_meta",
        payload: {
          userId: scope.studentId,
          studentCode: existing?.studentCode ?? `STU-${scope.studentId.slice(0, 6).toUpperCase()}`,
          classSectionId: existing?.classSectionId ?? null,
          academicYearId: existing?.academicYearId ?? null,
          dateOfBirth: existing?.dateOfBirth ?? "",
          notes: existing?.notes ?? "",
          guardianName: mutation.payload.guardianName.trim(),
          guardianPhone: mutation.payload.guardianPhone.trim(),
          address: mutation.payload.address.trim(),
        },
      };
    }

    case "send_internal_message":
      if (mutation.payload.senderId !== scope.studentId) {
        throw new Error("Forbidden: sender must match your account.");
      }
      if (!isMock && !scope.authorizedRecipientIds.has(mutation.payload.recipientId)) {
        throw new Error("Forbidden: you can only message instructors of your courses or academy staff.");
      }
      return mutation;

    case "update_internal_message": {
      const msg = workspace.internalMessages.find((m) => m.id === mutation.id);
      if (msg && msg.senderId !== scope.studentId && msg.recipientId !== scope.studentId) {
        throw new Error("Forbidden: message does not belong to you.");
      }
      return mutation;
    }

    case "send_parent_message":
      if (mutation.payload.senderId !== scope.studentId) {
        throw new Error("Forbidden: sender must match your account.");
      }
      if (!isMock && !scope.linkedParentIds.has(mutation.payload.parentId)) {
        throw new Error("Forbidden: you can only message a parent linked to your account.");
      }
      return {
        type: "send_parent_message",
        payload: {
          ...mutation.payload,
          studentId: scope.studentId,
          senderId: scope.studentId,
          senderRole: "student",
          includeSnapshot: false,
          snapshotSummary: null,
        },
      };

    case "mark_parent_message_read": {
      const pm = workspace.parentMessages.find((m) => m.id === mutation.id);
      if (
        pm &&
        pm.studentId !== scope.studentId &&
        !scope.linkedParentIds.has(pm.parentId)
      ) {
        throw new Error("Forbidden: parent communication record belongs outside your account.");
      }
      return mutation;
    }

    case "upsert_discussion_thread":
      ensureCourseEnrolled(mutation.payload.courseId);
      if (mutation.payload.authorId !== scope.studentId) {
        throw new Error("Forbidden: thread author must match your account.");
      }
      return {
        type: "upsert_discussion_thread",
        payload: {
          ...mutation.payload,
          authorId: scope.studentId,
          authorRole: "student",
          pinned: false,
          locked: false,
        },
      };

    case "add_discussion_post":
      ensureCourseEnrolled(mutation.payload.courseId);
      if (mutation.payload.authorId !== scope.studentId) {
        throw new Error("Forbidden: reply author must match your account.");
      }
      return {
        type: "add_discussion_post",
        payload: {
          ...mutation.payload,
          authorId: scope.studentId,
          authorRole: "student",
        },
      };

    case "mark_notification_read":
    case "update_account_prefs":
      return mutation;

    default:
      throw new Error("Forbidden: unsupported student action.");
  }
}

export function resolveStudentMutationPermission(mutation: WorkspaceMutationPayload): {
  module: PermissionModule;
  action: PermissionAction;
} {
  if (
    mutation.type === "upsert_student_meta" ||
    mutation.type === "request_profile_correction" ||
    mutation.type === "mark_notification_read" ||
    mutation.type === "update_account_prefs"
  ) {
    return { module: "overview", action: "view" };
  }
  if (
    mutation.type === "send_internal_message" ||
    mutation.type === "send_parent_message" ||
    mutation.type === "add_discussion_post" ||
    mutation.type === "upsert_discussion_thread"
  ) {
    return { module: "communication", action: "create" };
  }
  if (
    mutation.type === "update_internal_message" ||
    mutation.type === "mark_parent_message_read"
  ) {
    return { module: "communication", action: "view" };
  }
  return resolvePermissionForMutation(mutation);
}

export async function applyScopedStudentMutation(
  supabase: ReturnType<typeof createAuthedSupabase>,
  studentId: string,
  roles: AppRole[],
  mutation: WorkspaceMutationPayload,
  isMock = false,
): Promise<{
  scopedState: ScopedStudentWorkspace;
  auditAction: string;
  entity: string;
  entityId: string | null;
}> {
  const workspace = getOwnerWorkspaceState();
  const scope = await resolveStudentScope(supabase, studentId, workspace, isMock);
  const safeMutation = sanitizeAndAssertStudentMutation(mutation, scope, workspace, isMock);

  const { state, auditAction, entity, entityId } = applyWorkspaceMutation(
    safeMutation,
    studentId,
    roles,
  );
  const refreshedScope = await resolveStudentScope(supabase, studentId, state, isMock);
  return {
    scopedState: scopeWorkspaceForStudent(state, refreshedScope),
    auditAction,
    entity,
    entityId,
  };
}
