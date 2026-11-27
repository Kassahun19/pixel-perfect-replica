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
  InstructorRecordMeta,
  OwnerWorkspaceState,
  PermissionAction,
  PermissionModule,
} from "@/lib/owner/types";
import type { ScopedInstructorWorkspace } from "./types";

export interface InstructorScope {
  instructorId: string;
  assignedCourseIds: Set<string>;
  assignedClassIds: Set<string>;
  assignedStudentIds: Set<string>;
  linkedParentIds: Set<string>;
}

const DEFAULT_ACCOUNT_PREFS: AccountPreferences = {
  language: "en",
  timezone: "Africa/Addis_Ababa",
  emailNotifications: true,
  inAppNotifications: true,
  paymentReviewDigest: false,
  weeklyExecutiveSummary: false,
};

export async function authorizeInstructorApi(
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
    const effectiveRoles: AppRole[] = roles.length ? roles : ["instructor"];
    if (!effectiveRoles.includes("instructor") && !effectiveRoles.includes("owner")) {
      return {
        ok: false,
        response: new Response("Forbidden: instructor role required.", { status: 403 }),
      };
    }
    const state = getOwnerWorkspaceState();
    const checkRoles: AppRole[] = effectiveRoles.includes("owner") ? effectiveRoles : ["instructor"];
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
  if (!roles.includes("instructor") && !roles.includes("owner")) {
    return {
      ok: false,
      response: new Response("Forbidden: instructor role required.", { status: 403 }),
    };
  }

  const state = getOwnerWorkspaceState();
  const checkRoles: AppRole[] = roles.includes("owner") ? roles : ["instructor"];
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

export async function resolveInstructorScope(
  supabase: ReturnType<typeof createAuthedSupabase>,
  instructorId: string,
  workspace: OwnerWorkspaceState,
  isMock = false,
): Promise<InstructorScope> {
  const assignedCourseIds = new Set<string>();
  const assignedClassIds = new Set<string>();
  const assignedStudentIds = new Set<string>();
  const linkedParentIds = new Set<string>();

  const { data: ownedCourses } = await supabase
    .from("courses")
    .select("id")
    .eq("instructor_id", instructorId);

  for (const c of ownedCourses ?? []) {
    assignedCourseIds.add(c.id);
  }

  // Also include courses linked via assigned classes or timetable slots for this instructor
  for (const cls of workspace.classes) {
    if (cls.instructorId === instructorId) {
      assignedClassIds.add(cls.id);
      for (const sid of cls.studentIds) {
        assignedStudentIds.add(sid);
      }
    }
  }

  for (const [courseId, meta] of Object.entries(workspace.courseMeta)) {
    if (assignedCourseIds.has(courseId) && meta.classSectionId) {
      assignedClassIds.add(meta.classSectionId);
    }
    if (meta.classSectionId && assignedClassIds.has(meta.classSectionId)) {
      assignedCourseIds.add(courseId);
    }
  }

  if (isMock && assignedCourseIds.size === 0) {
    // In local preview mock mode, include classes/courses directly linked via instructor's timetables
    for (const slot of workspace.timetables) {
      if (slot.instructorId === instructorId) {
        if (slot.courseId) assignedCourseIds.add(slot.courseId);
        if (slot.classSectionId) assignedClassIds.add(slot.classSectionId);
      }
    }
  }

  const courseIdList = [...assignedCourseIds];
  if (courseIdList.length > 0) {
    const { data: enrollments } = await supabase
      .from("enrollments")
      .select("user_id")
      .in("course_id", courseIdList);
    for (const e of enrollments ?? []) {
      assignedStudentIds.add(e.user_id);
    }
  }

  for (const cls of workspace.classes) {
    if (assignedClassIds.has(cls.id)) {
      for (const sid of cls.studentIds) {
        assignedStudentIds.add(sid);
      }
    }
  }

  const studentIdList = [...assignedStudentIds];
  if (studentIdList.length > 0) {
    const { data: links } = await supabase
      .from("parent_links")
      .select("parent_id")
      .in("student_id", studentIdList);
    for (const l of links ?? []) {
      linkedParentIds.add(l.parent_id);
    }
  }

  return {
    instructorId,
    assignedCourseIds,
    assignedClassIds,
    assignedStudentIds,
    linkedParentIds,
  };
}

export function scopeWorkspaceForInstructor(
  workspace: OwnerWorkspaceState,
  scope: InstructorScope,
): ScopedInstructorWorkspace {
  const { instructorId, assignedCourseIds, assignedClassIds, assignedStudentIds, linkedParentIds } =
    scope;

  const courseMeta: OwnerWorkspaceState["courseMeta"] = {};
  for (const [cid, meta] of Object.entries(workspace.courseMeta)) {
    if (assignedCourseIds.has(cid)) {
      courseMeta[cid] = meta;
    }
  }

  const studentMeta: OwnerWorkspaceState["studentMeta"] = {};
  for (const [sid, meta] of Object.entries(workspace.studentMeta)) {
    if (assignedStudentIds.has(sid)) {
      studentMeta[sid] = meta;
    }
  }

  const enrollmentMeta: OwnerWorkspaceState["enrollmentMeta"] = {};
  for (const [key, meta] of Object.entries(workspace.enrollmentMeta)) {
    const [sid, cid] = key.split(":");
    if (sid && cid && assignedCourseIds.has(cid) && assignedStudentIds.has(sid)) {
      enrollmentMeta[key] = meta;
    }
  }

  const classes = workspace.classes.filter(
    (c) => assignedClassIds.has(c.id) || c.instructorId === instructorId,
  );

  const myInstructorMeta: InstructorRecordMeta = workspace.instructorMeta[instructorId] ?? {
    userId: instructorId,
    qualifications: "",
    experienceYears: 0,
    expertise: [],
    departmentId: null,
    weeklyHoursLimit: 20,
    scheduleSummary: "",
    hourlyRate: 0,
  };

  const assignmentIds = new Set(
    workspace.assignments
      .filter((a) => assignedCourseIds.has(a.courseId) || a.instructorId === instructorId)
      .map((a) => a.id),
  );
  const examIds = new Set(
    workspace.exams
      .filter((ex) => assignedCourseIds.has(ex.courseId) || ex.instructorId === instructorId)
      .map((ex) => ex.id),
  );
  const threadIds = new Set(
    workspace.discussionThreads
      .filter((t) => assignedCourseIds.has(t.courseId))
      .map((t) => t.id),
  );

  const announcementMeta: OwnerWorkspaceState["announcementMeta"] = {};
  for (const [aid, meta] of Object.entries(workspace.announcementMeta)) {
    if (
      (meta.targetCourseId && assignedCourseIds.has(meta.targetCourseId)) ||
      (meta.targetClassId && assignedClassIds.has(meta.targetClassId))
    ) {
      announcementMeta[aid] = meta;
    }
  }

  const defaultPerms = createDefaultRolePermissions().instructor;

  return {
    instructorId,
    assignedCourseIds: [...assignedCourseIds],
    assignedClassIds: [...assignedClassIds],
    assignedStudentIds: [...assignedStudentIds],
    linkedParentIds: [...linkedParentIds],
    academicYears: workspace.academicYears,
    terms: workspace.terms,
    departments: workspace.departments,
    classes,
    subjects: workspace.subjects,
    courseMeta,
    studentMeta,
    myInstructorMeta,
    enrollmentMeta,
    timetables: workspace.timetables.filter(
      (t) =>
        t.instructorId === instructorId ||
        (t.courseId !== null && assignedCourseIds.has(t.courseId)) ||
        (t.classSectionId !== null && assignedClassIds.has(t.classSectionId)),
    ),
    attendance: workspace.attendance.filter(
      (a) =>
        (a.personType === "instructor" && a.personId === instructorId) ||
        (a.courseId !== null && assignedCourseIds.has(a.courseId)) ||
        (a.classSectionId !== null && assignedClassIds.has(a.classSectionId)),
    ),
    gradingScales: workspace.gradingScales,
    grades: workspace.grades.filter(
      (g) => assignedCourseIds.has(g.courseId) && assignedStudentIds.has(g.studentId),
    ),
    courseMaterials: workspace.courseMaterials.filter(
      (m) => assignedCourseIds.has(m.courseId) || m.uploadedBy === instructorId,
    ),
    resources: workspace.resources.filter(
      (r) =>
        r.accessLevel === "public" ||
        (r.courseId !== null && assignedCourseIds.has(r.courseId)),
    ),
    liveClasses: workspace.liveClasses.filter(
      (lc) => lc.instructorId === instructorId || assignedCourseIds.has(lc.courseId),
    ),
    assignments: workspace.assignments.filter(
      (a) => a.instructorId === instructorId || assignedCourseIds.has(a.courseId),
    ),
    assignmentSubmissions: workspace.assignmentSubmissions.filter(
      (s) => assignmentIds.has(s.assignmentId) || assignedCourseIds.has(s.courseId),
    ),
    exams: workspace.exams.filter(
      (ex) => ex.instructorId === instructorId || assignedCourseIds.has(ex.courseId),
    ),
    examSubmissions: workspace.examSubmissions.filter((s) => examIds.has(s.examId)),
    questionBank: workspace.questionBank.filter(
      (q) => q.instructorId === instructorId || assignedCourseIds.has(q.courseId),
    ),
    discussionThreads: workspace.discussionThreads.filter((t) => assignedCourseIds.has(t.courseId)),
    discussionPosts: workspace.discussionPosts.filter((p) => threadIds.has(p.threadId)),
    courseCompletions: workspace.courseCompletions.filter(
      (cc) => assignedCourseIds.has(cc.courseId) && assignedStudentIds.has(cc.studentId),
    ),
    issuedCertificates: workspace.issuedCertificates.filter(
      (cert) => assignedCourseIds.has(cert.courseId) && assignedStudentIds.has(cert.studentId),
    ),
    parentMessages: workspace.parentMessages.filter(
      (pm) =>
        pm.senderId === instructorId ||
        linkedParentIds.has(pm.parentId) ||
        (pm.studentId !== null && assignedStudentIds.has(pm.studentId)),
    ),
    internalMessages: workspace.internalMessages.filter(
      (m) => !m.deleted && (m.senderId === instructorId || m.recipientId === instructorId),
    ),
    notifications: workspace.notifications.filter(
      (n) =>
        n.targetUserId === instructorId ||
        ((n.targetRole === "all" || n.targetRole === "instructor") &&
          (!n.targetClassId || assignedClassIds.has(n.targetClassId)) &&
          (!n.targetCourseId || assignedCourseIds.has(n.targetCourseId))),
    ),
    announcementMeta,
    payouts: workspace.instructorPayouts.filter((p) => p.instructorId === instructorId),
    myAccountPrefs: workspace.accountPrefsByUser[instructorId] ?? DEFAULT_ACCOUNT_PREFS,
    myPermissions: workspace.rolePermissions?.instructor ?? defaultPerms,
    currency: workspace.systemSettings.currency,
  };
}

const ALLOWED_INSTRUCTOR_MUTATION_TYPES = new Set<WorkspaceMutationPayload["type"]>([
  "upsert_course_meta",
  "upsert_course_material",
  "delete_course_material",
  "upsert_resource",
  "delete_resource",
  "upsert_live_class",
  "delete_live_class",
  "upsert_timetable",
  "delete_timetable",
  "upsert_attendance_batch",
  "upsert_student_meta",
  "upsert_instructor_meta",
  "upsert_assignment",
  "delete_assignment",
  "upsert_assignment_submission",
  "grade_assignment_submission",
  "upsert_exam",
  "delete_exam",
  "upsert_exam_submission",
  "upsert_question_bank_item",
  "delete_question_bank_item",
  "upsert_grade",
  "delete_grade",
  "upsert_course_completion",
  "send_parent_message",
  "mark_parent_message_read",
  "send_internal_message",
  "update_internal_message",
  "upsert_discussion_thread",
  "delete_discussion_thread",
  "add_discussion_post",
  "moderate_discussion_post",
  "upsert_announcement_meta",
  "create_notification",
  "mark_notification_read",
  "update_account_prefs",
]);

export function assertInstructorMutationScope(
  mutation: WorkspaceMutationPayload,
  scope: InstructorScope,
  workspace: OwnerWorkspaceState,
  isMock = false,
): void {
  if (!ALLOWED_INSTRUCTOR_MUTATION_TYPES.has(mutation.type)) {
    throw new Error("Forbidden: this operation requires Academy Owner or Admin authority.");
  }

  const ensureCourse = (courseId: string | null | undefined, label = "course") => {
    if (!courseId) throw new Error(`A valid ${label} is required.`);
    if (!isMock && !scope.assignedCourseIds.has(courseId)) {
      throw new Error(`Forbidden: you are not assigned to this ${label}.`);
    }
  };

  const ensureStudent = (studentId: string | null | undefined) => {
    if (!studentId) throw new Error("Student selection is required.");
    if (!isMock && !scope.assignedStudentIds.has(studentId)) {
      throw new Error("Forbidden: student is not enrolled in your assigned courses or classes.");
    }
  };

  switch (mutation.type) {
    case "upsert_course_meta":
      ensureCourse(mutation.payload.courseId);
      break;
    case "upsert_course_material":
      ensureCourse(mutation.payload.courseId);
      break;
    case "delete_course_material": {
      const mat = workspace.courseMaterials.find((m) => m.id === mutation.id);
      if (mat && !isMock && !scope.assignedCourseIds.has(mat.courseId)) {
        throw new Error("Forbidden: cannot delete materials from another instructor's course.");
      }
      break;
    }
    case "upsert_resource":
      if (mutation.payload.courseId) ensureCourse(mutation.payload.courseId);
      break;
    case "delete_resource": {
      const res = workspace.resources.find((r) => r.id === mutation.id);
      if (res?.courseId && !isMock && !scope.assignedCourseIds.has(res.courseId)) {
        throw new Error("Forbidden: cannot delete resources belonging to another course.");
      }
      break;
    }
    case "upsert_live_class":
      ensureCourse(mutation.payload.courseId);
      if (mutation.payload.instructorId !== scope.instructorId) {
        throw new Error("Forbidden: cannot schedule live classes under another instructor.");
      }
      break;
    case "delete_live_class": {
      const lc = workspace.liveClasses.find((x) => x.id === mutation.id);
      if (
        lc &&
        lc.instructorId !== scope.instructorId &&
        !scope.assignedCourseIds.has(lc.courseId)
      ) {
        throw new Error("Forbidden: cannot delete another instructor's live class.");
      }
      break;
    }
    case "upsert_timetable":
      if (mutation.payload.instructorId && mutation.payload.instructorId !== scope.instructorId) {
        throw new Error("Forbidden: cannot assign timetable slots to another instructor.");
      }
      if (mutation.payload.courseId) ensureCourse(mutation.payload.courseId);
      if (
        mutation.payload.classSectionId &&
        !isMock &&
        !scope.assignedClassIds.has(mutation.payload.classSectionId)
      ) {
        throw new Error("Forbidden: class section is not assigned to you.");
      }
      break;
    case "delete_timetable": {
      const slot = workspace.timetables.find((t) => t.id === mutation.id);
      if (slot && slot.instructorId !== scope.instructorId) {
        throw new Error("Forbidden: cannot delete another instructor's timetable slot.");
      }
      break;
    }
    case "upsert_attendance_batch":
      for (const rec of mutation.records) {
        if (rec.personType !== "student") {
          throw new Error("Forbidden: instructors can only record student attendance.");
        }
        ensureStudent(rec.personId);
        if (rec.courseId) ensureCourse(rec.courseId);
      }
      break;
    case "upsert_student_meta":
      ensureStudent(mutation.payload.userId);
      break;
    case "upsert_instructor_meta":
      if (mutation.payload.userId !== scope.instructorId) {
        throw new Error("Forbidden: cannot modify another instructor's profile.");
      }
      // Preserve hourlyRate set by Owner/Admin
      if (workspace.instructorMeta[scope.instructorId]) {
        mutation.payload.hourlyRate = workspace.instructorMeta[scope.instructorId]!.hourlyRate;
        mutation.payload.weeklyHoursLimit =
          workspace.instructorMeta[scope.instructorId]!.weeklyHoursLimit;
      }
      break;
    case "upsert_assignment":
      ensureCourse(mutation.payload.courseId);
      if (mutation.payload.instructorId !== scope.instructorId) {
        throw new Error("Forbidden: cannot create assignments as another instructor.");
      }
      break;
    case "delete_assignment": {
      const a = workspace.assignments.find((x) => x.id === mutation.id);
      if (a && a.instructorId !== scope.instructorId && !scope.assignedCourseIds.has(a.courseId)) {
        throw new Error("Forbidden: cannot delete another instructor's assignment.");
      }
      break;
    }
    case "upsert_assignment_submission":
    case "grade_assignment_submission":
      ensureCourse(mutation.payload.courseId);
      ensureStudent(mutation.payload.studentId);
      break;
    case "upsert_exam":
      ensureCourse(mutation.payload.courseId);
      break;
    case "delete_exam": {
      const ex = workspace.exams.find((x) => x.id === mutation.id);
      if (
        ex &&
        ex.instructorId !== scope.instructorId &&
        !scope.assignedCourseIds.has(ex.courseId)
      ) {
        throw new Error("Forbidden: cannot delete another instructor's exam.");
      }
      break;
    }
    case "upsert_exam_submission": {
      const ex = workspace.exams.find((x) => x.id === mutation.payload.examId);
      if (ex) ensureCourse(ex.courseId);
      ensureStudent(mutation.payload.studentId);
      break;
    }
    case "upsert_question_bank_item":
      ensureCourse(mutation.payload.courseId);
      break;
    case "delete_question_bank_item": {
      const q = workspace.questionBank.find((x) => x.id === mutation.id);
      if (q && q.instructorId !== scope.instructorId && !scope.assignedCourseIds.has(q.courseId)) {
        throw new Error("Forbidden: cannot delete another instructor's question.");
      }
      break;
    }
    case "upsert_grade":
      ensureCourse(mutation.payload.courseId);
      ensureStudent(mutation.payload.studentId);
      break;
    case "delete_grade": {
      const g = workspace.grades.find((x) => x.id === mutation.id);
      if (g && !isMock && !scope.assignedCourseIds.has(g.courseId)) {
        throw new Error("Forbidden: cannot delete grades from another instructor's course.");
      }
      break;
    }
    case "upsert_course_completion":
      ensureCourse(mutation.payload.courseId);
      ensureStudent(mutation.payload.studentId);
      break;
    case "send_parent_message":
      if (mutation.payload.senderId !== scope.instructorId) {
        throw new Error("Forbidden: sender must match signed-in instructor.");
      }
      if (!isMock && !scope.linkedParentIds.has(mutation.payload.parentId)) {
        throw new Error("Forbidden: parent is not linked to any of your assigned students.");
      }
      if (mutation.payload.studentId) ensureStudent(mutation.payload.studentId);
      break;
    case "mark_parent_message_read": {
      const pm = workspace.parentMessages.find((m) => m.id === mutation.id);
      if (pm && !isMock && !scope.linkedParentIds.has(pm.parentId)) {
        throw new Error("Forbidden: parent message belongs outside your assigned roster.");
      }
      break;
    }
    case "send_internal_message":
      if (mutation.payload.senderId !== scope.instructorId) {
        throw new Error("Forbidden: sender must match signed-in instructor.");
      }
      if (!isMock && !scope.assignedStudentIds.has(mutation.payload.recipientId)) {
        throw new Error("Forbidden: recipient must be an enrolled student in your courses.");
      }
      break;
    case "update_internal_message": {
      const im = workspace.internalMessages.find((m) => m.id === mutation.id);
      if (
        im &&
        im.senderId !== scope.instructorId &&
        im.recipientId !== scope.instructorId
      ) {
        throw new Error("Forbidden: message does not belong to you.");
      }
      break;
    }
    case "upsert_discussion_thread":
      ensureCourse(mutation.payload.courseId);
      break;
    case "delete_discussion_thread": {
      const t = workspace.discussionThreads.find((x) => x.id === mutation.id);
      if (t && !isMock && !scope.assignedCourseIds.has(t.courseId)) {
        throw new Error("Forbidden: cannot delete discussion thread outside your courses.");
      }
      break;
    }
    case "add_discussion_post":
      ensureCourse(mutation.payload.courseId);
      if (mutation.payload.authorId !== scope.instructorId) {
        throw new Error("Forbidden: author must match signed-in instructor.");
      }
      break;
    case "moderate_discussion_post": {
      const post = workspace.discussionPosts.find((p) => p.id === mutation.id);
      if (post && !isMock && !scope.assignedCourseIds.has(post.courseId)) {
        throw new Error("Forbidden: cannot moderate posts outside your courses.");
      }
      break;
    }
    case "upsert_announcement_meta":
      if (mutation.payload.targetCourseId) ensureCourse(mutation.payload.targetCourseId);
      if (
        mutation.payload.targetClassId &&
        !isMock &&
        !scope.assignedClassIds.has(mutation.payload.targetClassId)
      ) {
        throw new Error("Forbidden: class section is not assigned to you.");
      }
      break;
    case "create_notification":
      if (
        mutation.payload.targetRole !== "student" &&
        mutation.payload.targetRole !== "parent"
      ) {
        throw new Error("Forbidden: instructors can only notify assigned students or parents.");
      }
      if (mutation.payload.targetCourseId) ensureCourse(mutation.payload.targetCourseId);
      if (
        mutation.payload.targetClassId &&
        !isMock &&
        !scope.assignedClassIds.has(mutation.payload.targetClassId)
      ) {
        throw new Error("Forbidden: class section is not assigned to you.");
      }
      break;
    case "mark_notification_read":
    case "update_account_prefs":
      break;
  }
}

export function resolveInstructorMutationPermission(mutation: WorkspaceMutationPayload): {
  module: PermissionModule;
  action: PermissionAction;
} {
  // Instructors creating new messages/discussions/announcements only need communication.create
  if (
    mutation.type === "send_parent_message" ||
    mutation.type === "send_internal_message" ||
    mutation.type === "add_discussion_post" ||
    mutation.type === "upsert_discussion_thread" ||
    mutation.type === "create_notification" ||
    mutation.type === "upsert_announcement_meta"
  ) {
    return { module: "communication", action: "create" };
  }
  if (mutation.type === "upsert_instructor_meta") {
    return { module: "overview", action: "view" };
  }
  return resolvePermissionForMutation(mutation);
}

export async function applyScopedInstructorMutation(
  supabase: ReturnType<typeof createAuthedSupabase>,
  instructorId: string,
  roles: AppRole[],
  mutation: WorkspaceMutationPayload,
  isMock = false,
): Promise<{
  scopedState: ScopedInstructorWorkspace;
  auditAction: string;
  entity: string;
  entityId: string | null;
}> {
  const workspace = getOwnerWorkspaceState();
  const scope = await resolveInstructorScope(supabase, instructorId, workspace, isMock);
  assertInstructorMutationScope(mutation, scope, workspace, isMock);

  const { state, auditAction, entity, entityId } = applyWorkspaceMutation(
    mutation,
    instructorId,
    roles,
  );
  const refreshedScope = await resolveInstructorScope(supabase, instructorId, state, isMock);
  return {
    scopedState: scopeWorkspaceForInstructor(state, refreshedScope),
    auditAction,
    entity,
    entityId,
  };
}
