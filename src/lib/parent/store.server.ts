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
import type { ParentCoursePublicMeta, ScopedParentWorkspace } from "./types";

export interface ParentScope {
  parentId: string;
  linkedChildIds: string[];
  linkedChildSet: Set<string>;
  relationshipsByChild: Record<string, string>;
  enrolledCourseByChild: Record<string, string[]>;
  assignedClassByChild: Record<string, string[]>;
  paidCourseByChild: Record<string, string[]>;
  allEnrolledCourseIds: Set<string>;
  allAssignedClassIds: Set<string>;
  allPaidCourseIds: Set<string>;
  authorizedInstructorIds: Set<string>;
  authorizedAdminIds: Set<string>;
  authorizedRecipientIds: Set<string>;
}

const DEFAULT_ACCOUNT_PREFS: AccountPreferences = {
  language: "en",
  timezone: "Africa/Addis_Ababa",
  emailNotifications: true,
  inAppNotifications: true,
  paymentReviewDigest: true,
  weeklyExecutiveSummary: true,
};

export async function authorizeParentApi(
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
    const effectiveRoles: AppRole[] = roles.length ? roles : ["parent"];
    if (!effectiveRoles.includes("parent") && !effectiveRoles.includes("owner")) {
      return {
        ok: false,
        response: new Response("Forbidden: parent role required.", { status: 403 }),
      };
    }
    const state = getOwnerWorkspaceState();
    const checkRoles: AppRole[] = effectiveRoles.includes("owner") ? effectiveRoles : ["parent"];
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
  if (!roles.includes("parent") && !roles.includes("owner")) {
    return {
      ok: false,
      response: new Response("Forbidden: parent role required.", { status: 403 }),
    };
  }

  const state = getOwnerWorkspaceState();
  const checkRoles: AppRole[] = roles.includes("owner") ? roles : ["parent"];
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

export async function resolveParentScope(
  supabase: ReturnType<typeof createAuthedSupabase>,
  parentId: string,
  workspace: OwnerWorkspaceState,
  _isMock = false,
): Promise<ParentScope> {
  const { data: linkRows } = await supabase
    .from("parent_links")
    .select("student_id, relationship")
    .eq("parent_id", parentId)
    .order("created_at");

  const linkedChildIds: string[] = [];
  const linkedChildSet = new Set<string>();
  const relationshipsByChild: Record<string, string> = {};

  for (const row of linkRows ?? []) {
    if (!linkedChildSet.has(row.student_id)) {
      linkedChildSet.add(row.student_id);
      linkedChildIds.push(row.student_id);
    }
    relationshipsByChild[row.student_id] = row.relationship || "Parent";
  }

  const enrolledCourseByChild: Record<string, string[]> = {};
  const assignedClassByChild: Record<string, string[]> = {};
  const paidCourseByChild: Record<string, string[]> = {};
  const allEnrolledCourseIds = new Set<string>();
  const allAssignedClassIds = new Set<string>();
  const allPaidCourseIds = new Set<string>();
  const authorizedInstructorIds = new Set<string>();
  const authorizedAdminIds = new Set<string>();
  const authorizedRecipientIds = new Set<string>();

  for (const cid of linkedChildIds) {
    enrolledCourseByChild[cid] = [];
    assignedClassByChild[cid] = [];
    paidCourseByChild[cid] = [];
  }

  const [{ data: enrollments }, { data: approvedPayments }, { data: pubCourses }, { data: staffRoles }] =
    await Promise.all([
      linkedChildIds.length
        ? supabase.from("enrollments").select("user_id, course_id").in("user_id", linkedChildIds)
        : Promise.resolve({ data: [] as { user_id: string; course_id: string }[] }),
      linkedChildIds.length
        ? supabase
            .from("payments")
            .select("user_id, course_id")
            .in("user_id", linkedChildIds)
            .eq("status", "approved")
        : Promise.resolve({ data: [] as { user_id: string; course_id: string }[] }),
      supabase.from("courses").select("id, instructor_id").eq("status", "published"),
      supabase.from("user_roles").select("user_id, role").in("role", ["owner", "admin"]),
    ]);

  for (const e of enrollments ?? []) {
    if (!linkedChildSet.has(e.user_id)) continue;
    allEnrolledCourseIds.add(e.course_id);
    const list = enrolledCourseByChild[e.user_id] ?? [];
    if (!list.includes(e.course_id)) {
      list.push(e.course_id);
      enrolledCourseByChild[e.user_id] = list;
    }
  }

  for (const p of approvedPayments ?? []) {
    if (!linkedChildSet.has(p.user_id)) continue;
    allPaidCourseIds.add(p.course_id);
    const list = paidCourseByChild[p.user_id] ?? [];
    if (!list.includes(p.course_id)) {
      list.push(p.course_id);
      paidCourseByChild[p.user_id] = list;
    }
  }

  for (const childId of linkedChildIds) {
    const classSet = new Set<string>();
    const meta = workspace.studentMeta[childId];
    if (meta?.classSectionId) {
      classSet.add(meta.classSectionId);
    }
    for (const cls of workspace.classes) {
      if (cls.studentIds.includes(childId)) {
        classSet.add(cls.id);
      }
    }
    for (const courseId of enrolledCourseByChild[childId] ?? []) {
      const cMeta = workspace.courseMeta[courseId];
      if (cMeta?.classSectionId) {
        classSet.add(cMeta.classSectionId);
      }
    }
    assignedClassByChild[childId] = [...classSet];
    for (const clsId of classSet) {
      allAssignedClassIds.add(clsId);
    }
  }

  for (const cls of workspace.classes) {
    if (allAssignedClassIds.has(cls.id) && cls.instructorId) {
      authorizedInstructorIds.add(cls.instructorId);
    }
  }
  for (const c of pubCourses ?? []) {
    if (c.instructor_id && allEnrolledCourseIds.has(c.id)) {
      authorizedInstructorIds.add(c.instructor_id);
    }
  }

  for (const sr of staffRoles ?? []) {
    authorizedAdminIds.add(sr.user_id);
  }

  for (const im of workspace.internalMessages) {
    if (!im.deleted && im.recipientId === parentId && im.senderId) {
      if (!authorizedAdminIds.has(im.senderId)) {
        authorizedInstructorIds.add(im.senderId);
      }
    }
  }

  for (const id of authorizedInstructorIds) authorizedRecipientIds.add(id);
  for (const id of authorizedAdminIds) authorizedRecipientIds.add(id);

  return {
    parentId,
    linkedChildIds,
    linkedChildSet,
    relationshipsByChild,
    enrolledCourseByChild,
    assignedClassByChild,
    paidCourseByChild,
    allEnrolledCourseIds,
    allAssignedClassIds,
    allPaidCourseIds,
    authorizedInstructorIds,
    authorizedAdminIds,
    authorizedRecipientIds,
  };
}

function sanitizeExamForParent(
  exam: ExamAssessment,
  submissionsForExam: { status: "pending" | "submitted" | "graded" }[],
): ExamAssessment {
  const revealAnswers =
    exam.status === "completed" || submissionsForExam.some((s) => s.status === "graded");
  if (revealAnswers) return exam;
  return {
    ...exam,
    questions: exam.questions.map((q) => ({
      ...q,
      correctAnswer: "",
    })),
  };
}

export function scopeWorkspaceForParent(
  workspace: OwnerWorkspaceState,
  scope: ParentScope,
): ScopedParentWorkspace {
  const {
    parentId,
    linkedChildIds,
    linkedChildSet,
    relationshipsByChild,
    enrolledCourseByChild,
    assignedClassByChild,
    paidCourseByChild,
    allEnrolledCourseIds,
    allAssignedClassIds,
    allPaidCourseIds,
    authorizedInstructorIds,
    authorizedAdminIds,
    authorizedRecipientIds,
  } = scope;

  // Strip sensitive integration keys (e.g., YouTube API keys) from courseMeta
  const courseMeta: Record<string, ParentCoursePublicMeta> = {};
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

  // Strip unlinked peer studentIds from class rosters
  const classes = workspace.classes
    .filter((c) => allAssignedClassIds.has(c.id))
    .map((c) => ({
      ...c,
      studentIds: c.studentIds.filter((sid) => linkedChildSet.has(sid)),
    }));

  const studentMetaByChild: Record<string, StudentRecordMeta> = {};
  for (const childId of linkedChildIds) {
    studentMetaByChild[childId] = workspace.studentMeta[childId] ?? {
      userId: childId,
      studentCode: `STU-${childId.slice(0, 6).toUpperCase()}`,
      classSectionId: assignedClassByChild[childId]?.[0] ?? null,
      academicYearId: workspace.academicYears.find((y) => y.isCurrent)?.id ?? null,
      guardianName: "",
      guardianPhone: "",
      address: "",
      dateOfBirth: "",
      notes: "",
    };
  }

  const enrollmentMeta: OwnerWorkspaceState["enrollmentMeta"] = {};
  for (const [key, meta] of Object.entries(workspace.enrollmentMeta)) {
    const childId = key.split(":")[0] ?? "";
    if (linkedChildSet.has(childId)) {
      enrollmentMeta[key] = meta;
    }
  }

  const childExamSubmissions = workspace.examSubmissions.filter((s) =>
    linkedChildSet.has(s.studentId),
  );

  const visibleExams = workspace.exams
    .filter(
      (ex) =>
        ex.status !== "draft" &&
        (allEnrolledCourseIds.has(ex.courseId) ||
          (ex.classSectionId !== null &&
            ex.classSectionId !== undefined &&
            allAssignedClassIds.has(ex.classSectionId))),
    )
    .map((ex) =>
      sanitizeExamForParent(
        ex,
        childExamSubmissions.filter((s) => s.examId === ex.id),
      ),
    );
  const visibleExamIds = new Set(visibleExams.map((ex) => ex.id));

  const visibleAssignments = workspace.assignments.filter(
    (a) =>
      a.status !== "draft" &&
      (allEnrolledCourseIds.has(a.courseId) ||
        (a.classSectionId !== null && allAssignedClassIds.has(a.classSectionId))),
  );
  const visibleAssignmentIds = new Set(visibleAssignments.map((a) => a.id));

  const issuedCertificates = workspace.issuedCertificates.filter((c) =>
    linkedChildSet.has(c.studentId),
  );
  const usedTemplateIds = new Set(issuedCertificates.map((c) => c.templateId));

  const announcementMeta: OwnerWorkspaceState["announcementMeta"] = {};
  for (const [aid, meta] of Object.entries(workspace.announcementMeta)) {
    if (
      (!meta.targetCourseId && !meta.targetClassId) ||
      (meta.targetCourseId && allEnrolledCourseIds.has(meta.targetCourseId)) ||
      (meta.targetClassId && allAssignedClassIds.has(meta.targetClassId))
    ) {
      announcementMeta[aid] = meta;
    }
  }

  const defaultPerms = createDefaultRolePermissions().parent;

  return {
    parentId,
    linkedChildIds,
    relationshipsByChild,
    enrolledCourseByChild,
    assignedClassByChild,
    paidCourseByChild,
    authorizedInstructorIds: [...authorizedInstructorIds],
    authorizedAdminIds: [...authorizedAdminIds],
    authorizedRecipientIds: [...authorizedRecipientIds],
    academicYears: workspace.academicYears,
    terms: workspace.terms,
    departments: workspace.departments,
    calendarEvents: workspace.calendarEvents,
    classes,
    subjects: workspace.subjects,
    courseMeta,
    studentMetaByChild,
    enrollmentRequests: workspace.enrollmentRequests.filter((r) =>
      linkedChildSet.has(r.studentId),
    ),
    enrollmentMeta,
    timetables: workspace.timetables.filter(
      (t) =>
        (t.courseId !== null && allEnrolledCourseIds.has(t.courseId)) ||
        (t.classSectionId !== null && allAssignedClassIds.has(t.classSectionId)),
    ),
    attendance: workspace.attendance.filter(
      (a) => a.personType === "student" && linkedChildSet.has(a.personId),
    ),
    attendanceDisputes: (workspace.attendanceDisputes ?? []).filter((d) =>
      linkedChildSet.has(d.studentId),
    ),
    gradingScales: workspace.gradingScales,
    grades: workspace.grades.filter((g) => linkedChildSet.has(g.studentId)),
    courseMaterials: workspace.courseMaterials.filter(
      (m) => m.visibleToEnrolled && allEnrolledCourseIds.has(m.courseId),
    ),
    resources: workspace.resources.filter((r) => {
      if (r.accessLevel === "staff_only") return false;
      if (r.accessLevel === "public") return true;
      if (r.accessLevel === "enrolled") {
        return !r.courseId || allEnrolledCourseIds.has(r.courseId);
      }
      if (r.accessLevel === "pro_paid") {
        return r.courseId !== null && allPaidCourseIds.has(r.courseId);
      }
      return false;
    }),
    liveClasses: workspace.liveClasses.filter(
      (lc) =>
        allEnrolledCourseIds.has(lc.courseId) ||
        (lc.classSectionId !== null && allAssignedClassIds.has(lc.classSectionId)) ||
        lc.participantIds.some((pid) => linkedChildSet.has(pid)),
    ),
    assignments: visibleAssignments,
    assignmentSubmissions: workspace.assignmentSubmissions.filter(
      (s) => linkedChildSet.has(s.studentId) && visibleAssignmentIds.has(s.assignmentId),
    ),
    exams: visibleExams,
    examSubmissions: childExamSubmissions.filter((s) => visibleExamIds.has(s.examId)),
    courseCompletions: workspace.courseCompletions.filter((cc) =>
      linkedChildSet.has(cc.studentId),
    ),
    certificateTemplates: workspace.certificateTemplates.filter(
      (t) => t.isDefault || usedTemplateIds.has(t.id),
    ),
    issuedCertificates,
    feePlans: workspace.feePlans.filter((f) => linkedChildSet.has(f.studentId)),
    invoices: workspace.invoices.filter((inv) => linkedChildSet.has(inv.studentId)),
    paymentReminders: workspace.paymentReminders.filter((pr) =>
      linkedChildSet.has(pr.studentId),
    ),
    parentMessages: workspace.parentMessages.filter(
      (pm) => pm.parentId === parentId || (pm.studentId !== null && linkedChildSet.has(pm.studentId)),
    ),
    internalMessages: workspace.internalMessages.filter(
      (m) => !m.deleted && (m.senderId === parentId || m.recipientId === parentId),
    ),
    notifications: workspace.notifications.filter(
      (n) =>
        n.targetUserId === parentId ||
        (Boolean(n.targetUserId) && linkedChildSet.has(n.targetUserId!)) ||
        ((n.targetRole === "all" || n.targetRole === "parent") &&
          (!n.targetClassId || allAssignedClassIds.has(n.targetClassId)) &&
          (!n.targetCourseId || allEnrolledCourseIds.has(n.targetCourseId))),
    ),
    announcementMeta,
    profileCorrectionRequests: (workspace.profileCorrectionRequests ?? []).filter(
      (req) => req.requesterId === parentId || linkedChildSet.has(req.studentId),
    ),
    childLinkRequests: (workspace.childLinkRequests ?? []).filter(
      (req) => req.parentId === parentId,
    ),
    myAccountPrefs: workspace.accountPrefsByUser[parentId] ?? DEFAULT_ACCOUNT_PREFS,
    myPermissions: workspace.rolePermissions?.parent ?? defaultPerms,
    currency: workspace.systemSettings.currency,
    platformName: workspace.systemSettings.platformName,
    minPasswordLength: workspace.systemSettings.minPasswordLength,
  };
}

const ALLOWED_PARENT_MUTATION_TYPES = new Set<WorkspaceMutationPayload["type"]>([
  "report_attendance_discrepancy",
  "request_profile_correction",
  "request_child_link",
  "send_internal_message",
  "update_internal_message",
  "send_parent_message",
  "mark_parent_message_read",
  "mark_notification_read",
  "update_account_prefs",
]);

export function sanitizeAndAssertParentMutation(
  mutation: WorkspaceMutationPayload,
  scope: ParentScope,
  workspace: OwnerWorkspaceState,
  isMock = false,
): WorkspaceMutationPayload {
  if (!ALLOWED_PARENT_MUTATION_TYPES.has(mutation.type)) {
    throw new Error(
      "Forbidden: parents cannot modify official academic, attendance, grade, certificate, or fee records.",
    );
  }

  switch (mutation.type) {
    case "report_attendance_discrepancy": {
      if (!scope.linkedChildSet.has(mutation.payload.studentId)) {
        throw new Error("Forbidden: attendance discrepancy must reference a linked child.");
      }
      const rec = workspace.attendance.find(
        (a) =>
          a.id === mutation.payload.attendanceId &&
          a.personType === "student" &&
          a.personId === mutation.payload.studentId,
      );
      if (!rec) {
        throw new Error("Attendance entry not found for the selected linked child.");
      }
      return {
        type: "report_attendance_discrepancy",
        payload: {
          attendanceId: rec.id,
          studentId: mutation.payload.studentId,
          courseId: rec.courseId,
          date: rec.date,
          reason: mutation.payload.reason.trim(),
        },
      };
    }

    case "request_profile_correction": {
      const isSelfParent =
        mutation.payload.targetType === "parent" && mutation.payload.studentId === scope.parentId;
      if (!isSelfParent && !scope.linkedChildSet.has(mutation.payload.studentId)) {
        throw new Error("Forbidden: correction request must belong to your account or a linked child.");
      }
      return {
        type: "request_profile_correction",
        payload: {
          studentId: isSelfParent ? scope.parentId : mutation.payload.studentId,
          requesterId: scope.parentId,
          targetType: isSelfParent ? "parent" : "student",
          field: mutation.payload.field,
          requestedValue: mutation.payload.requestedValue.trim(),
          reason: mutation.payload.reason.trim(),
        },
      };
    }

    case "request_child_link": {
      if (!mutation.payload.studentIdentifier.trim() && !mutation.payload.studentName.trim()) {
        throw new Error("Enter the student's name or student code/email.");
      }
      if (
        mutation.payload.requestType === "correction" &&
        mutation.payload.targetStudentId &&
        !scope.linkedChildSet.has(mutation.payload.targetStudentId)
      ) {
        throw new Error("Forbidden: cannot request link corrections for an unlinked student.");
      }
      return {
        type: "request_child_link",
        payload: {
          parentId: scope.parentId,
          studentIdentifier: mutation.payload.studentIdentifier.trim(),
          studentName: mutation.payload.studentName.trim(),
          relationship: mutation.payload.relationship.trim() || "Parent",
          requestType: mutation.payload.requestType === "correction" ? "correction" : "link",
          targetStudentId: mutation.payload.targetStudentId ?? null,
          notes: mutation.payload.notes.trim(),
        },
      };
    }

    case "send_internal_message": {
      if (mutation.payload.senderId !== scope.parentId) {
        throw new Error("Forbidden: sender must match your parent account.");
      }
      if (!isMock && !scope.authorizedRecipientIds.has(mutation.payload.recipientId)) {
        throw new Error(
          "Forbidden: you can only message instructors teaching your children or academy administrators.",
        );
      }
      return {
        type: "send_internal_message",
        payload: {
          ...mutation.payload,
          senderId: scope.parentId,
          subject: mutation.payload.subject.trim(),
          body: mutation.payload.body.trim(),
        },
      };
    }

    case "update_internal_message": {
      const msg = workspace.internalMessages.find((m) => m.id === mutation.id);
      if (msg && msg.senderId !== scope.parentId && msg.recipientId !== scope.parentId) {
        throw new Error("Forbidden: message does not belong to your account.");
      }
      return mutation;
    }

    case "send_parent_message": {
      if (mutation.payload.senderId !== scope.parentId) {
        throw new Error("Forbidden: sender must match your parent account.");
      }
      if (mutation.payload.studentId && !scope.linkedChildSet.has(mutation.payload.studentId)) {
        throw new Error("Forbidden: teacher communication must reference a linked child.");
      }
      return {
        type: "send_parent_message",
        payload: {
          ...mutation.payload,
          parentId: scope.parentId,
          studentId: mutation.payload.studentId ?? scope.linkedChildIds[0] ?? null,
          senderId: scope.parentId,
          senderRole: "parent",
          includeSnapshot: false,
          snapshotSummary: null,
          subject: mutation.payload.subject.trim(),
          body: mutation.payload.body.trim(),
        },
      };
    }

    case "mark_parent_message_read": {
      const pm = workspace.parentMessages.find((m) => m.id === mutation.id);
      if (
        pm &&
        pm.parentId !== scope.parentId &&
        (!pm.studentId || !scope.linkedChildSet.has(pm.studentId))
      ) {
        throw new Error("Forbidden: communication record belongs outside your account.");
      }
      return mutation;
    }

    case "mark_notification_read":
    case "update_account_prefs":
      return mutation;

    default:
      throw new Error("Forbidden: unsupported parent action.");
  }
}

export function resolveParentMutationPermission(mutation: WorkspaceMutationPayload): {
  module: PermissionModule;
  action: PermissionAction;
} {
  if (
    mutation.type === "request_profile_correction" ||
    mutation.type === "request_child_link" ||
    mutation.type === "mark_notification_read" ||
    mutation.type === "update_account_prefs"
  ) {
    return { module: "overview", action: "view" };
  }
  if (mutation.type === "send_internal_message" || mutation.type === "send_parent_message") {
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

export async function applyScopedParentMutation(
  supabase: ReturnType<typeof createAuthedSupabase>,
  parentId: string,
  roles: AppRole[],
  mutation: WorkspaceMutationPayload,
  isMock = false,
): Promise<{
  scopedState: ScopedParentWorkspace;
  auditAction: string;
  entity: string;
  entityId: string | null;
}> {
  const workspace = getOwnerWorkspaceState();
  const scope = await resolveParentScope(supabase, parentId, workspace, isMock);
  const safeMutation = sanitizeAndAssertParentMutation(mutation, scope, workspace, isMock);

  const { state, auditAction, entity, entityId } = applyWorkspaceMutation(
    safeMutation,
    parentId,
    roles,
  );
  const refreshedScope = await resolveParentScope(supabase, parentId, state, isMock);
  return {
    scopedState: scopeWorkspaceForParent(state, refreshedScope),
    auditAction,
    entity,
    entityId,
  };
}
