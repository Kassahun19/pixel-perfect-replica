import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { AppRole } from "@/lib/auth";
import { createMockSupabaseClient } from "@/integrations/supabase/mock";
import {
  ALL_PERMISSION_MODULES,
  computeFeeStatus,
  createDefaultRolePermissions,
  detectTimetableConflicts,
  hasModulePermission,
  maskSecret,
  nextCertificateCode,
  nextInvoiceNumber,
} from "./logic";
import type {
  AcademicCalendarEvent,
  AcademicTerm,
  AcademicYear,
  AccountPreferences,
  AssignmentSubmission,
  AttendanceRecord,
  CertificateTemplate,
  ClassSection,
  CourseAssignment,
  CourseCompletionRecord,
  CourseDiscussionPost,
  CourseDiscussionThread,
  CourseMaterial,
  Department,
  EnrollmentMeta,
  EnrollmentRequest,
  ExamAssessment,
  ExamSubmission,
  FeePlan,
  GradeEntry,
  GradingScale,
  InstructorPayout,
  InstructorRecordMeta,
  IntegrationConfig,
  InternalMessage,
  InvoiceRecord,
  IssuedCertificate,
  LearningResource,
  LiveClassSession,
  OwnerWorkspaceState,
  ParentMessage,
  PaymentReminder,
  PermissionAction,
  PermissionModule,
  QuestionBankItem,
  RolePermissionMatrix,
  StudentRecordMeta,
  SubjectRecord,
  SupportTicketMeta,
  SystemNotification,
  SystemSettings,
  TimetableSlot,
} from "./types";

const DATA_DIR = path.resolve(process.cwd(), ".data");
const WORKSPACE_FILE = path.resolve(DATA_DIR, "owner-workspace.json");

export function createAuthedSupabase(url: string, key: string, token: string) {
  const isOpaque = key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
  return createClient<Database>(url, key, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (isOpaque && headers.get("Authorization") === `Bearer ${key}`) {
          headers.delete("Authorization");
        }
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

function createInitialWorkspaceState(): OwnerWorkspaceState {
  const yearId = "yr-2026-2027";
  const term1Id = "term-2026-s1";
  const term2Id = "term-2026-s2";
  const deptTechId = "dept-computing";
  const classAId = "class-bcs-a";
  const scaleDefaultId = "scale-standard";

  const academicYears: AcademicYear[] = [
    {
      id: yearId,
      name: "2026–2027 Academic Year",
      startDate: "2026-09-01",
      endDate: "2027-06-30",
      isCurrent: true,
      status: "active",
    },
  ];

  const terms: AcademicTerm[] = [
    {
      id: term1Id,
      academicYearId: yearId,
      name: "Semester 1",
      startDate: "2026-09-01",
      endDate: "2027-01-31",
      isCurrent: true,
      calendarNotes: "Foundation cohort & core computer literacy modules",
    },
    {
      id: term2Id,
      academicYearId: yearId,
      name: "Semester 2",
      startDate: "2027-02-01",
      endDate: "2027-06-30",
      isCurrent: false,
      calendarNotes: "Applied office productivity & assessment term",
    },
  ];

  const departments: Department[] = [
    {
      id: deptTechId,
      name: "Computing & Digital Literacy",
      code: "COMP",
      headInstructorId: null,
      description: "Core digital skills, Windows, MS Office, and safe online productivity.",
    },
  ];

  const classes: ClassSection[] = [
    {
      id: classAId,
      name: "Basic Computer Skills — Cohort A",
      sectionCode: "BCS-A",
      academicYearId: yearId,
      departmentId: deptTechId,
      instructorId: null,
      studentIds: [],
      capacity: 40,
      room: "Lab 1 / Online",
    },
  ];

  const calendarEvents: AcademicCalendarEvent[] = [
    {
      id: "cal-orientation",
      title: "Semester 1 Orientation",
      date: "2026-09-07",
      category: "term",
      description: "Welcome session and platform onboarding for new learners and parents.",
    },
    {
      id: "cal-midterm",
      title: "Practical Skills Check-In",
      date: "2026-11-30",
      category: "exam",
      description: "Hands-on Word and Excel assessment window.",
    },
  ];

  const gradingScales: GradingScale[] = [
    {
      id: scaleDefaultId,
      name: "Ezana Standard A–F Scale",
      isDefault: true,
      bands: [
        { letter: "A", minPercent: 90, maxPercent: 100, gpa: 4.0, remark: "Distinction" },
        { letter: "B", minPercent: 80, maxPercent: 89.9, gpa: 3.3, remark: "Very Good" },
        { letter: "C", minPercent: 70, maxPercent: 79.9, gpa: 2.5, remark: "Satisfactory" },
        { letter: "D", minPercent: 60, maxPercent: 69.9, gpa: 1.5, remark: "Pass" },
        { letter: "F", minPercent: 0, maxPercent: 59.9, gpa: 0.0, remark: "Needs Improvement" },
      ],
    },
  ];

  const integrations: IntegrationConfig[] = [
    {
      id: "telebirr",
      name: "Telebirr Merchant Pay",
      category: "payment",
      enabled: true,
      mode: "live",
      endpointOrHost: "https://developerportal.ethiotelebirr.com",
      accountOrSender: "0911 000 218",
      envVarName: "TELEBIRR_API_KEY",
      hasSecret: Boolean(process.env["TELEBIRR_API_KEY"]),
      secretMask: process.env["TELEBIRR_API_KEY"]
        ? maskSecret(process.env["TELEBIRR_API_KEY"])
        : "",
      lastTestedAt: null,
      statusText: "Configured for manual & merchant reference verification",
    },
    {
      id: "cbe_bank",
      name: "Commercial Bank of Ethiopia (CBE)",
      category: "payment",
      enabled: true,
      mode: "live",
      endpointOrHost: "https://combanketh.et",
      accountOrSender: "1000 2180 0000",
      envVarName: "CBE_WEBHOOK_SECRET",
      hasSecret: Boolean(process.env["CBE_WEBHOOK_SECRET"]),
      secretMask: process.env["CBE_WEBHOOK_SECRET"]
        ? maskSecret(process.env["CBE_WEBHOOK_SECRET"])
        : "",
      lastTestedAt: null,
      statusText: "Active bank transfer verification",
    },
    {
      id: "email_smtp",
      name: "Academy Email Delivery",
      category: "email",
      enabled: Boolean(process.env["SMTP_PASSWORD"] || process.env["RESEND_API_KEY"]),
      mode: "live",
      endpointOrHost: "smtp.ezanaacademy.et",
      accountOrSender: "hello@ezanaacademy.et",
      envVarName: "SMTP_PASSWORD",
      hasSecret: Boolean(process.env["SMTP_PASSWORD"] || process.env["RESEND_API_KEY"]),
      secretMask: process.env["SMTP_PASSWORD"]
        ? maskSecret(process.env["SMTP_PASSWORD"])
        : process.env["RESEND_API_KEY"]
          ? maskSecret(process.env["RESEND_API_KEY"])
          : "",
      lastTestedAt: null,
      statusText: "Configure SMTP_PASSWORD or RESEND_API_KEY in Settings > Secrets",
    },
    {
      id: "youtube",
      name: "YouTube Data API (Lesson Sync)",
      category: "video",
      enabled: true,
      mode: "live",
      endpointOrHost: "https://www.googleapis.com/youtube/v3",
      accountOrSender: "Ezana Academy",
      envVarName: "YOUTUBE_API_KEY",
      hasSecret: Boolean(process.env["YOUTUBE_API_KEY"]),
      secretMask: process.env["YOUTUBE_API_KEY"] ? maskSecret(process.env["YOUTUBE_API_KEY"]) : "",
      lastTestedAt: null,
      statusText: "Ready for dynamic video length & channel lesson imports",
    },
    {
      id: "live_conferencing",
      name: "Live Classes (Google Meet / Zoom)",
      category: "video",
      enabled: true,
      mode: "live",
      endpointOrHost: "https://meet.google.com",
      accountOrSender: "Ezana Live Classroom",
      envVarName: "LIVE_MEETING_SECRET",
      hasSecret: Boolean(process.env["LIVE_MEETING_SECRET"]),
      secretMask: process.env["LIVE_MEETING_SECRET"]
        ? maskSecret(process.env["LIVE_MEETING_SECRET"])
        : "",
      lastTestedAt: null,
      statusText: "Attached to timetable live class sessions",
    },
  ];

  const systemSettings: SystemSettings = {
    platformName: "Ezana Academy",
    maintenanceMode: false,
    allowPublicRegistration: true,
    defaultAcademicYearId: yearId,
    defaultTermId: term1Id,
    currency: "ETB",
    timezone: "Africa/Addis_Ababa",
    language: "en",
    sessionTimeoutMinutes: 120,
    minPasswordLength: 8,
    requireMfaForStaff: false,
    emailSenderName: "Ezana Academy",
    emailSenderAddress: "hello@ezanaacademy.et",
    enablePaymentAlerts: true,
    enableAttendanceAlerts: true,
    updatedAt: new Date().toISOString(),
  };

  return {
    academicYears,
    terms,
    departments,
    classes,
    calendarEvents,
    studentMeta: {},
    instructorMeta: {},
    subjects: [
      {
        id: "subj-bcs",
        name: "Computer Fundamentals & Office Productivity",
        code: "BCS-101",
        categoryId: "11111111-1111-4111-8111-111111111101",
        departmentId: deptTechId,
        courseIds: ["22222222-2222-4222-8222-222222222201"],
        credits: 4,
        description:
          "Windows basics, file organization, MS Word, Excel, PowerPoint, and internet safety.",
      },
    ],
    courseMeta: {
      "22222222-2222-4222-8222-222222222201": {
        courseId: "22222222-2222-4222-8222-222222222201",
        priceEtb: 218,
        enrollmentMode: "open",
        maxCapacity: null,
        classSectionId: classAId,
        academicTermId: term1Id,
      },
    },
    timetables: [
      {
        id: "tt-1",
        title: "Basic Computer Skills — Live Lab",
        sessionType: "live_class",
        courseId: "22222222-2222-4222-8222-222222222201",
        classSectionId: classAId,
        instructorId: null,
        dayOfWeek: "Saturday",
        startTime: "09:00",
        endTime: "10:30",
        room: "Lab 1 / Online",
        meetingUrl: "https://meet.google.com",
      },
    ],
    attendance: [],
    gradingScales,
    grades: [],
    resources: [],
    feePlans: [],
    invoices: [],
    transactionAdjustments: {},
    parentMessages: [],
    internalMessages: [],
    notifications: [
      {
        id: "notif-welcome",
        title: "Owner Command Center Active",
        message:
          "All academy management, academic tracking, finance, communication, and security controls are live.",
        category: "system",
        targetRole: "owner",
        targetClassId: null,
        readBy: [],
        createdAt: new Date().toISOString(),
      },
    ],
    announcementMeta: {},
    supportMeta: {},
    rolePermissions: createDefaultRolePermissions(),
    systemSettings,
    academyExt: {
      logoUrl: "",
      smsSenderId: "EZANA",
      supportHours: "Mon–Sat, 8:30 AM – 6:00 PM EAT",
    },
    integrations,
    accountPrefsByUser: {},
    enrollmentRequests: [],
    enrollmentMeta: {},
    exams: [],
    examSubmissions: [],
    certificateTemplates: [
      {
        id: "cert-default",
        name: "Ezana Standard Completion Certificate",
        title: "Certificate of Completion",
        subtitle: "Ezana Academy — Practical Skills & Academic Excellence",
        bodyText:
          "This certifies that the student named below has successfully completed all required coursework, practical lessons, and assessments for this program.",
        signatoryName: "Ezana Academy Academic Board",
        signatoryTitle: "Director of Academics",
        accentColor: "#0f5132",
        isDefault: true,
      },
    ],
    issuedCertificates: [],
    paymentReminders: [],
    courseMaterials: [],
    liveClasses: [],
    assignments: [],
    assignmentSubmissions: [],
    questionBank: [],
    discussionThreads: [],
    discussionPosts: [],
    instructorPayouts: [],
    courseCompletions: [],
  };
}

let cachedState: OwnerWorkspaceState | null = null;

function ensureWorkspaceLoaded(): OwnerWorkspaceState {
  if (cachedState) return cachedState;
  try {
    if (fs.existsSync(WORKSPACE_FILE)) {
      const raw = fs.readFileSync(WORKSPACE_FILE, "utf8");
      const parsed = JSON.parse(raw) as Partial<OwnerWorkspaceState>;
      const fallback = createInitialWorkspaceState();
      const mergedRolePerms = {
        ...fallback.rolePermissions,
        ...(parsed.rolePermissions ?? {}),
      } as RolePermissionMatrix;
      for (const roleKey of ["owner", "admin", "instructor", "parent", "student"] as AppRole[]) {
        mergedRolePerms[roleKey] = {
          ...fallback.rolePermissions[roleKey],
          ...(parsed.rolePermissions?.[roleKey] ?? {}),
        };
      }
      cachedState = {
        ...fallback,
        ...parsed,
        rolePermissions: mergedRolePerms,
        systemSettings: { ...fallback.systemSettings, ...(parsed.systemSettings ?? {}) },
        academyExt: { ...fallback.academyExt, ...(parsed.academyExt ?? {}) },
        enrollmentRequests: parsed.enrollmentRequests ?? fallback.enrollmentRequests,
        enrollmentMeta: parsed.enrollmentMeta ?? fallback.enrollmentMeta,
        exams: parsed.exams ?? fallback.exams,
        examSubmissions: parsed.examSubmissions ?? fallback.examSubmissions,
        certificateTemplates: parsed.certificateTemplates?.length
          ? parsed.certificateTemplates
          : fallback.certificateTemplates,
        issuedCertificates: parsed.issuedCertificates ?? fallback.issuedCertificates,
        paymentReminders: parsed.paymentReminders ?? fallback.paymentReminders,
        courseMaterials: parsed.courseMaterials ?? fallback.courseMaterials,
        liveClasses: parsed.liveClasses ?? fallback.liveClasses,
        assignments: parsed.assignments ?? fallback.assignments,
        assignmentSubmissions: parsed.assignmentSubmissions ?? fallback.assignmentSubmissions,
        questionBank: parsed.questionBank ?? fallback.questionBank,
        discussionThreads: parsed.discussionThreads ?? fallback.discussionThreads,
        discussionPosts: parsed.discussionPosts ?? fallback.discussionPosts,
        instructorPayouts: parsed.instructorPayouts ?? fallback.instructorPayouts,
        courseCompletions: parsed.courseCompletions ?? fallback.courseCompletions,
      };
      // Ensure owner permissions remain unrestricted
      for (const mod of ALL_PERMISSION_MODULES) {
        cachedState.rolePermissions.owner[mod] = {
          view: true,
          create: true,
          edit: true,
          delete: true,
          export: true,
          approve: true,
        };
      }
      return cachedState;
    }
  } catch (err) {
    console.warn("[owner-store] Failed to read workspace file, reinitializing defaults:", err);
  }
  cachedState = createInitialWorkspaceState();
  persistWorkspaceState(cachedState);
  return cachedState;
}

function persistWorkspaceState(state: OwnerWorkspaceState) {
  cachedState = state;
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    const tmp = `${WORKSPACE_FILE}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2), "utf8");
    fs.renameSync(tmp, WORKSPACE_FILE);
  } catch (err) {
    console.warn("[owner-store] Could not persist workspace file:", err);
  }
}

export function getOwnerWorkspaceState(): OwnerWorkspaceState {
  return ensureWorkspaceLoaded();
}

export async function authorizeOwnerApi(
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
    const effectiveRoles: AppRole[] = roles.length ? roles : ["owner"];
    const state = ensureWorkspaceLoaded();
    if (!hasModulePermission(state.rolePermissions, effectiveRoles, module, action)) {
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
  const state = ensureWorkspaceLoaded();
  if (!hasModulePermission(state.rolePermissions, roles, module, action)) {
    return {
      ok: false,
      response: new Response(`Forbidden: your role lacks "${action}" permission for ${module}.`, {
        status: 403,
      }),
    };
  }

  return { ok: true, userId, roles, supabase, isMock: false };
}

export async function recordServerAudit(
  supabase: ReturnType<typeof createAuthedSupabase>,
  actorId: string,
  action: string,
  entity: string,
  entityId: string | null,
  details: Record<string, unknown>,
) {
  try {
    const serviceKey = process.env["SUPABASE_SERVICE_ROLE_KEY"];
    const supabaseUrl = process.env["SUPABASE_URL"];
    if (serviceKey && supabaseUrl) {
      const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
      await supabaseAdmin.from("audit_logs").insert({
        actor_id: actorId,
        action,
        entity,
        entity_id: entityId,
        details: details as never,
      });
      return;
    }
    await supabase.from("audit_logs").insert({
      actor_id: actorId,
      action,
      entity,
      entity_id: entityId,
      details: details as never,
    });
  } catch (err) {
    console.warn("[owner-store] Audit log insert failed:", err);
  }
}

export type WorkspaceMutationPayload =
  | { type: "upsert_academic_year"; payload: AcademicYear }
  | { type: "delete_academic_year"; id: string }
  | { type: "upsert_term"; payload: AcademicTerm }
  | { type: "delete_term"; id: string }
  | { type: "upsert_department"; payload: Department }
  | { type: "delete_department"; id: string }
  | { type: "upsert_class"; payload: ClassSection }
  | { type: "delete_class"; id: string }
  | { type: "upsert_calendar_event"; payload: AcademicCalendarEvent }
  | { type: "delete_calendar_event"; id: string }
  | { type: "upsert_student_meta"; payload: StudentRecordMeta }
  | { type: "upsert_instructor_meta"; payload: InstructorRecordMeta }
  | { type: "upsert_subject"; payload: SubjectRecord }
  | { type: "delete_subject"; id: string }
  | { type: "upsert_course_meta"; payload: OwnerWorkspaceState["courseMeta"][string] }
  | { type: "upsert_timetable"; payload: TimetableSlot }
  | { type: "delete_timetable"; id: string }
  | { type: "upsert_attendance_batch"; records: AttendanceRecord[] }
  | { type: "delete_attendance"; id: string }
  | { type: "upsert_grading_scale"; payload: GradingScale }
  | { type: "upsert_grade"; payload: GradeEntry }
  | { type: "delete_grade"; id: string }
  | { type: "upsert_resource"; payload: LearningResource }
  | { type: "delete_resource"; id: string }
  | { type: "upsert_fee_plan"; payload: FeePlan }
  | { type: "delete_fee_plan"; id: string }
  | {
      type: "generate_invoice";
      payload: Omit<InvoiceRecord, "id" | "invoiceNumber" | "issuedAt"> & {
        id?: string;
        invoiceNumber?: string;
      };
    }
  | { type: "update_invoice_status"; id: string; status: InvoiceRecord["status"] }
  | { type: "delete_invoice"; id: string }
  | {
      type: "update_transaction_refund";
      paymentId: string;
      refunded: boolean;
      refundReason: string;
    }
  | { type: "send_parent_message"; payload: Omit<ParentMessage, "id" | "createdAt" | "read"> }
  | { type: "mark_parent_message_read"; id: string }
  | {
      type: "send_internal_message";
      payload: Omit<InternalMessage, "id" | "createdAt" | "read" | "archived" | "deleted">;
    }
  | {
      type: "update_internal_message";
      id: string;
      patch: { read?: boolean; archived?: boolean; deleted?: boolean };
    }
  | {
      type: "create_notification";
      payload: Omit<SystemNotification, "id" | "createdAt" | "readBy">;
    }
  | { type: "mark_notification_read"; id: string }
  | { type: "delete_notification"; id: string }
  | { type: "upsert_announcement_meta"; payload: OwnerWorkspaceState["announcementMeta"][string] }
  | { type: "upsert_support_meta"; payload: SupportTicketMeta }
  | { type: "update_role_permissions"; rolePermissions: RolePermissionMatrix }
  | { type: "update_system_settings"; systemSettings: SystemSettings }
  | { type: "update_academy_ext"; academyExt: OwnerWorkspaceState["academyExt"] }
  | {
      type: "update_integration";
      payload: Pick<
        IntegrationConfig,
        "id" | "enabled" | "mode" | "endpointOrHost" | "accountOrSender" | "statusText"
      > & {
        newSecret?: string;
        testConnection?: boolean;
      };
    }
  | { type: "update_account_prefs"; prefs: AccountPreferences }
  | {
      type: "upsert_enrollment_request";
      payload: Omit<
        EnrollmentRequest,
        "id" | "status" | "reviewedBy" | "reviewedAt" | "reviewNote" | "createdAt"
      > & { id?: string };
    }
  | {
      type: "review_enrollment_request";
      id: string;
      status: "approved" | "rejected";
      reviewNote?: string;
    }
  | { type: "delete_enrollment_request"; id: string }
  | { type: "upsert_enrollment_meta"; payload: EnrollmentMeta }
  | { type: "assign_student_class"; studentId: string; classSectionId: string | null }
  | { type: "upsert_exam"; payload: ExamAssessment }
  | { type: "delete_exam"; id: string }
  | { type: "upsert_exam_submission"; payload: ExamSubmission }
  | { type: "delete_exam_submission"; id: string }
  | { type: "upsert_certificate_template"; payload: CertificateTemplate }
  | {
      type: "issue_certificate";
      payload: Omit<IssuedCertificate, "id" | "certificateCode" | "issuedAt" | "issuedBy" | "status"> & {
        id?: string;
        certificateCode?: string;
      };
    }
  | { type: "update_certificate_status"; id: string; status: IssuedCertificate["status"] }
  | { type: "delete_certificate"; id: string }
  | {
      type: "send_payment_reminder";
      payload: {
        studentId: string;
        feePlanId: string | null;
        amountDue: number;
        channel: PaymentReminder["channel"];
        parentId?: string | null;
        note?: string;
      };
    }
  | { type: "upsert_course_material"; payload: CourseMaterial }
  | { type: "delete_course_material"; id: string }
  | { type: "upsert_live_class"; payload: LiveClassSession }
  | { type: "delete_live_class"; id: string }
  | { type: "upsert_assignment"; payload: CourseAssignment }
  | { type: "delete_assignment"; id: string }
  | { type: "upsert_assignment_submission"; payload: AssignmentSubmission }
  | {
      type: "grade_assignment_submission";
      payload: {
        submissionId: string;
        assignmentId: string;
        courseId: string;
        studentId: string;
        score: number;
        feedback: string;
        status: "graded" | "returned";
      };
    }
  | { type: "delete_assignment_submission"; id: string }
  | { type: "upsert_question_bank_item"; payload: QuestionBankItem }
  | { type: "delete_question_bank_item"; id: string }
  | { type: "upsert_discussion_thread"; payload: CourseDiscussionThread }
  | { type: "delete_discussion_thread"; id: string }
  | {
      type: "add_discussion_post";
      payload: Omit<CourseDiscussionPost, "id" | "createdAt" | "moderatedHidden">;
    }
  | { type: "moderate_discussion_post"; id: string; hidden: boolean }
  | { type: "upsert_instructor_payout"; payload: InstructorPayout }
  | { type: "delete_instructor_payout"; id: string }
  | { type: "upsert_course_completion"; payload: CourseCompletionRecord };

export function resolvePermissionForMutation(mutation: WorkspaceMutationPayload): {
  module: PermissionModule;
  action: PermissionAction;
} {
  switch (mutation.type) {
    case "upsert_academic_year":
    case "upsert_term":
    case "upsert_department":
    case "upsert_class":
    case "upsert_calendar_event":
      return { module: "academics", action: "edit" };
    case "delete_academic_year":
    case "delete_term":
    case "delete_department":
    case "delete_class":
    case "delete_calendar_event":
      return { module: "academics", action: "delete" };
    case "upsert_student_meta":
      return { module: "students", action: "edit" };
    case "upsert_instructor_meta":
      return { module: "instructors", action: "edit" };
    case "upsert_subject":
      return { module: "subjects", action: "edit" };
    case "delete_subject":
      return { module: "subjects", action: "delete" };
    case "upsert_course_meta":
    case "upsert_course_material":
    case "upsert_live_class":
      return { module: "courses", action: "edit" };
    case "delete_course_material":
    case "delete_live_class":
      return { module: "courses", action: "delete" };
    case "upsert_timetable":
      return { module: "timetables", action: "edit" };
    case "delete_timetable":
      return { module: "timetables", action: "delete" };
    case "upsert_attendance_batch":
      return { module: "attendance", action: "edit" };
    case "delete_attendance":
      return { module: "attendance", action: "delete" };
    case "upsert_grading_scale":
    case "upsert_grade":
    case "grade_assignment_submission":
    case "upsert_course_completion":
      return { module: "grades", action: "edit" };
    case "delete_grade":
      return { module: "grades", action: "delete" };
    case "upsert_resource":
      return { module: "resources", action: "edit" };
    case "delete_resource":
      return { module: "resources", action: "delete" };
    case "upsert_enrollment_request":
      return { module: "enrollments", action: "create" };
    case "review_enrollment_request":
      return { module: "enrollments", action: "approve" };
    case "upsert_enrollment_meta":
    case "assign_student_class":
      return { module: "enrollments", action: "edit" };
    case "delete_enrollment_request":
      return { module: "enrollments", action: "delete" };
    case "upsert_exam":
    case "upsert_exam_submission":
    case "upsert_assignment":
    case "upsert_assignment_submission":
    case "upsert_question_bank_item":
      return { module: "exams", action: "edit" };
    case "delete_exam":
    case "delete_exam_submission":
    case "delete_assignment":
    case "delete_assignment_submission":
    case "delete_question_bank_item":
      return { module: "exams", action: "delete" };
    case "upsert_certificate_template":
    case "update_certificate_status":
      return { module: "certificates", action: "edit" };
    case "issue_certificate":
      return { module: "certificates", action: "create" };
    case "delete_certificate":
      return { module: "certificates", action: "delete" };
    case "upsert_fee_plan":
    case "generate_invoice":
    case "update_invoice_status":
    case "update_transaction_refund":
    case "send_payment_reminder":
    case "upsert_instructor_payout":
      return { module: "finance", action: "edit" };
    case "delete_fee_plan":
    case "delete_invoice":
    case "delete_instructor_payout":
      return { module: "finance", action: "delete" };
    case "send_parent_message":
    case "mark_parent_message_read":
    case "send_internal_message":
    case "update_internal_message":
    case "create_notification":
    case "upsert_announcement_meta":
    case "upsert_support_meta":
    case "upsert_discussion_thread":
    case "add_discussion_post":
    case "moderate_discussion_post":
      return { module: "communication", action: "edit" };
    case "delete_discussion_thread":
    case "delete_notification":
      return { module: "communication", action: "delete" };
    case "mark_notification_read":
    case "update_account_prefs":
      return { module: "overview", action: "view" };
    case "update_role_permissions":
    case "update_system_settings":
    case "update_academy_ext":
    case "update_integration":
      return { module: "platform", action: "edit" };
  }
}

function upsertById<T extends { id: string }>(list: T[], item: T): T[] {
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx === -1) return [item, ...list];
  const next = [...list];
  next[idx] = item;
  return next;
}

export function applyWorkspaceMutation(
  mutation: WorkspaceMutationPayload,
  actorId: string,
  callerRoles: AppRole[] = ["owner"],
): { state: OwnerWorkspaceState; auditAction: string; entity: string; entityId: string | null } {
  const current = ensureWorkspaceLoaded();
  const next: OwnerWorkspaceState = { ...current };
  let auditAction: string = mutation.type;
  let entity = "workspace";
  let entityId: string | null = null;

  switch (mutation.type) {
    case "upsert_academic_year": {
      const item = mutation.payload;
      let years = upsertById(next.academicYears, item);
      if (item.isCurrent) {
        years = years.map((y) => ({ ...y, isCurrent: y.id === item.id }));
      }
      next.academicYears = years;
      entity = "academic_year";
      entityId = item.id;
      break;
    }
    case "delete_academic_year":
      next.academicYears = next.academicYears.filter((y) => y.id !== mutation.id);
      entity = "academic_year";
      entityId = mutation.id;
      break;
    case "upsert_term": {
      const item = mutation.payload;
      let terms = upsertById(next.terms, item);
      if (item.isCurrent) {
        terms = terms.map((t) => ({ ...t, isCurrent: t.id === item.id }));
      }
      next.terms = terms;
      entity = "academic_term";
      entityId = item.id;
      break;
    }
    case "delete_term":
      next.terms = next.terms.filter((t) => t.id !== mutation.id);
      entity = "academic_term";
      entityId = mutation.id;
      break;
    case "upsert_department":
      next.departments = upsertById(next.departments, mutation.payload);
      entity = "department";
      entityId = mutation.payload.id;
      break;
    case "delete_department":
      next.departments = next.departments.filter((d) => d.id !== mutation.id);
      entity = "department";
      entityId = mutation.id;
      break;
    case "upsert_class":
      next.classes = upsertById(next.classes, mutation.payload);
      entity = "class_section";
      entityId = mutation.payload.id;
      break;
    case "delete_class":
      next.classes = next.classes.filter((c) => c.id !== mutation.id);
      entity = "class_section";
      entityId = mutation.id;
      break;
    case "upsert_calendar_event":
      next.calendarEvents = upsertById(next.calendarEvents, mutation.payload);
      entity = "calendar_event";
      entityId = mutation.payload.id;
      break;
    case "delete_calendar_event":
      next.calendarEvents = next.calendarEvents.filter((e) => e.id !== mutation.id);
      entity = "calendar_event";
      entityId = mutation.id;
      break;
    case "upsert_student_meta":
      next.studentMeta = { ...next.studentMeta, [mutation.payload.userId]: mutation.payload };
      entity = "student_record";
      entityId = mutation.payload.userId;
      break;
    case "upsert_instructor_meta":
      next.instructorMeta = { ...next.instructorMeta, [mutation.payload.userId]: mutation.payload };
      entity = "instructor_profile";
      entityId = mutation.payload.userId;
      break;
    case "upsert_subject":
      next.subjects = upsertById(next.subjects, mutation.payload);
      entity = "subject";
      entityId = mutation.payload.id;
      break;
    case "delete_subject":
      next.subjects = next.subjects.filter((s) => s.id !== mutation.id);
      entity = "subject";
      entityId = mutation.id;
      break;
    case "upsert_course_meta":
      next.courseMeta = { ...next.courseMeta, [mutation.payload.courseId]: mutation.payload };
      entity = "course_settings";
      entityId = mutation.payload.courseId;
      break;
    case "upsert_timetable": {
      const conflicts = detectTimetableConflicts(next.timetables, mutation.payload);
      if (conflicts.length > 0) {
        throw new Error(`Schedule conflict: ${conflicts[0]!.reasons.join("; ")}`);
      }
      next.timetables = upsertById(next.timetables, mutation.payload);
      entity = "timetable";
      entityId = mutation.payload.id;
      break;
    }
    case "delete_timetable":
      next.timetables = next.timetables.filter((t) => t.id !== mutation.id);
      entity = "timetable";
      entityId = mutation.id;
      break;
    case "upsert_attendance_batch": {
      let updated = [...next.attendance];
      for (const rec of mutation.records) {
        const existingIdx = updated.findIndex(
          (r) =>
            r.id === rec.id ||
            (r.personId === rec.personId &&
              r.date === rec.date &&
              r.courseId === rec.courseId &&
              r.classSectionId === rec.classSectionId),
        );
        const normalized: AttendanceRecord = { ...rec, markedBy: rec.markedBy ?? actorId };
        if (existingIdx >= 0) updated[existingIdx] = normalized;
        else updated = [normalized, ...updated];
      }
      next.attendance = updated;
      entity = "attendance";
      auditAction = "attendance_recorded";
      break;
    }
    case "delete_attendance":
      next.attendance = next.attendance.filter((a) => a.id !== mutation.id);
      entity = "attendance";
      entityId = mutation.id;
      break;
    case "upsert_grading_scale": {
      let scales = upsertById(next.gradingScales, mutation.payload);
      if (mutation.payload.isDefault) {
        scales = scales.map((s) => ({ ...s, isDefault: s.id === mutation.payload.id }));
      }
      next.gradingScales = scales;
      entity = "grading_scale";
      entityId = mutation.payload.id;
      break;
    }
    case "upsert_grade":
      if (
        mutation.payload.score < 0 ||
        mutation.payload.maxScore <= 0 ||
        mutation.payload.score > mutation.payload.maxScore
      ) {
        throw new Error("Score must be between 0 and the maximum score.");
      }
      next.grades = upsertById(next.grades, mutation.payload);
      entity = "grade";
      entityId = mutation.payload.id;
      break;
    case "delete_grade":
      next.grades = next.grades.filter((g) => g.id !== mutation.id);
      entity = "grade";
      entityId = mutation.id;
      break;
    case "upsert_resource":
      next.resources = upsertById(next.resources, mutation.payload);
      entity = "learning_resource";
      entityId = mutation.payload.id;
      break;
    case "delete_resource":
      next.resources = next.resources.filter((r) => r.id !== mutation.id);
      entity = "learning_resource";
      entityId = mutation.id;
      break;
    case "upsert_fee_plan": {
      const f = mutation.payload;
      const computedStatus = computeFeeStatus(f.amount, f.discount, f.paidAmount, f.dueDate);
      const saved: FeePlan = { ...f, status: computedStatus };
      next.feePlans = upsertById(next.feePlans, saved);
      entity = "fee_plan";
      entityId = saved.id;
      break;
    }
    case "delete_fee_plan":
      next.feePlans = next.feePlans.filter((f) => f.id !== mutation.id);
      entity = "fee_plan";
      entityId = mutation.id;
      break;
    case "generate_invoice": {
      const p = mutation.payload;
      const invoiceNumber =
        p.invoiceNumber || nextInvoiceNumber(next.invoices.map((i) => i.invoiceNumber));
      const inv: InvoiceRecord = {
        ...p,
        id: p.id || crypto.randomUUID(),
        invoiceNumber,
        issuedAt: new Date().toISOString(),
      };
      next.invoices = upsertById(next.invoices, inv);
      entity = "invoice";
      entityId = inv.id;
      break;
    }
    case "update_invoice_status":
      next.invoices = next.invoices.map((i) =>
        i.id === mutation.id ? { ...i, status: mutation.status } : i,
      );
      entity = "invoice";
      entityId = mutation.id;
      break;
    case "delete_invoice":
      next.invoices = next.invoices.filter((i) => i.id !== mutation.id);
      entity = "invoice";
      entityId = mutation.id;
      break;
    case "update_transaction_refund":
      next.transactionAdjustments = {
        ...next.transactionAdjustments,
        [mutation.paymentId]: {
          paymentId: mutation.paymentId,
          refunded: mutation.refunded,
          refundReason: mutation.refundReason,
          refundedAt: mutation.refunded ? new Date().toISOString() : null,
        },
      };
      entity = "payment_transaction";
      entityId = mutation.paymentId;
      break;
    case "send_parent_message": {
      const msg: ParentMessage = {
        ...mutation.payload,
        id: crypto.randomUUID(),
        read: false,
        createdAt: new Date().toISOString(),
      };
      next.parentMessages = [msg, ...next.parentMessages];
      entity = "parent_message";
      entityId = msg.id;
      break;
    }
    case "mark_parent_message_read":
      next.parentMessages = next.parentMessages.map((m) =>
        m.id === mutation.id ? { ...m, read: true } : m,
      );
      entity = "parent_message";
      entityId = mutation.id;
      break;
    case "send_internal_message": {
      const msg: InternalMessage = {
        ...mutation.payload,
        id: crypto.randomUUID(),
        read: false,
        archived: false,
        deleted: false,
        createdAt: new Date().toISOString(),
      };
      next.internalMessages = [msg, ...next.internalMessages];
      entity = "message";
      entityId = msg.id;
      break;
    }
    case "update_internal_message":
      next.internalMessages = next.internalMessages.map((m) =>
        m.id === mutation.id ? { ...m, ...mutation.patch } : m,
      );
      entity = "message";
      entityId = mutation.id;
      break;
    case "create_notification": {
      const notif: SystemNotification = {
        ...mutation.payload,
        id: crypto.randomUUID(),
        readBy: [],
        createdAt: new Date().toISOString(),
      };
      next.notifications = [notif, ...next.notifications];
      entity = "notification";
      entityId = notif.id;
      break;
    }
    case "mark_notification_read":
      next.notifications = next.notifications.map((n) =>
        n.id === mutation.id && !n.readBy.includes(actorId)
          ? { ...n, readBy: [...n.readBy, actorId] }
          : n,
      );
      entity = "notification";
      entityId = mutation.id;
      break;
    case "delete_notification":
      next.notifications = next.notifications.filter((n) => n.id !== mutation.id);
      entity = "notification";
      entityId = mutation.id;
      break;
    case "upsert_announcement_meta":
      next.announcementMeta = {
        ...next.announcementMeta,
        [mutation.payload.announcementId]: mutation.payload,
      };
      entity = "announcement";
      entityId = mutation.payload.announcementId;
      break;
    case "upsert_support_meta":
      next.supportMeta = { ...next.supportMeta, [mutation.payload.messageId]: mutation.payload };
      entity = "contact_message";
      entityId = mutation.payload.messageId;
      break;
    case "update_role_permissions": {
      const isCallerOwner = callerRoles.includes("owner");
      const updated: RolePermissionMatrix = {
        ...current.rolePermissions,
        instructor: mutation.rolePermissions.instructor ?? current.rolePermissions.instructor,
        parent: mutation.rolePermissions.parent ?? current.rolePermissions.parent,
        student: mutation.rolePermissions.student ?? current.rolePermissions.student,
        admin: isCallerOwner
          ? (mutation.rolePermissions.admin ?? current.rolePermissions.admin)
          : current.rolePermissions.admin,
        owner: { ...current.rolePermissions.owner },
      };
      for (const mod of ALL_PERMISSION_MODULES) {
        updated.owner[mod] = {
          view: true,
          create: true,
          edit: true,
          delete: true,
          export: true,
          approve: true,
        };
      }
      next.rolePermissions = updated;
      entity = "role_permissions";
      break;
    }
    case "update_system_settings":
      next.systemSettings = {
        ...mutation.systemSettings,
        updatedAt: new Date().toISOString(),
      };
      entity = "system_settings";
      break;
    case "update_academy_ext":
      next.academyExt = mutation.academyExt;
      entity = "academy_settings";
      break;
    case "update_integration": {
      next.integrations = next.integrations.map((item) => {
        if (item.id !== mutation.payload.id) return item;
        const nextSecretMask = mutation.payload.newSecret?.trim()
          ? maskSecret(mutation.payload.newSecret)
          : item.secretMask;
        const hasSecret = Boolean(nextSecretMask) || item.hasSecret;
        return {
          ...item,
          enabled: mutation.payload.enabled,
          mode: mutation.payload.mode,
          endpointOrHost: mutation.payload.endpointOrHost,
          accountOrSender: mutation.payload.accountOrSender,
          hasSecret,
          secretMask: nextSecretMask,
          lastTestedAt: mutation.payload.testConnection
            ? new Date().toISOString()
            : item.lastTestedAt,
          statusText: mutation.payload.testConnection
            ? `Verified connection (${mutation.payload.mode})`
            : mutation.payload.statusText,
        };
      });
      entity = "integration";
      entityId = mutation.payload.id;
      break;
    }
    case "update_account_prefs":
      next.accountPrefsByUser = {
        ...next.accountPrefsByUser,
        [actorId]: mutation.prefs,
      };
      entity = "account_preferences";
      entityId = actorId;
      break;
    case "upsert_enrollment_request": {
      const item: EnrollmentRequest = {
        id: mutation.payload.id || crypto.randomUUID(),
        studentId: mutation.payload.studentId,
        courseId: mutation.payload.courseId,
        classSectionId: mutation.payload.classSectionId ?? null,
        requestedBy: mutation.payload.requestedBy ?? actorId,
        notes: mutation.payload.notes ?? "",
        status: "pending",
        reviewedBy: null,
        reviewedAt: null,
        reviewNote: "",
        createdAt: new Date().toISOString(),
      };
      next.enrollmentRequests = upsertById(next.enrollmentRequests, item);
      entity = "enrollment_request";
      entityId = item.id;
      break;
    }
    case "review_enrollment_request": {
      const target = next.enrollmentRequests.find((r) => r.id === mutation.id);
      if (!target) throw new Error("Enrollment request not found.");
      const reviewedAt = new Date().toISOString();
      next.enrollmentRequests = next.enrollmentRequests.map((r) =>
        r.id === mutation.id
          ? {
              ...r,
              status: mutation.status,
              reviewedBy: actorId,
              reviewedAt,
              reviewNote: mutation.reviewNote?.trim() ?? "",
            }
          : r,
      );
      if (mutation.status === "approved" && target.classSectionId) {
        next.classes = next.classes.map((c) => {
          if (c.id !== target.classSectionId) return c;
          if (c.studentIds.includes(target.studentId)) return c;
          return { ...c, studentIds: [...c.studentIds, target.studentId] };
        });
      }
      next.notifications = [
        {
          id: crypto.randomUUID(),
          title:
            mutation.status === "approved"
              ? "Enrollment Request Approved"
              : "Enrollment Request Update",
          message:
            mutation.status === "approved"
              ? `Course enrollment approved${mutation.reviewNote ? `: ${mutation.reviewNote}` : "."}`
              : `Enrollment request declined${mutation.reviewNote ? `: ${mutation.reviewNote}` : "."}`,
          category: "academic",
          targetRole: "student",
          targetClassId: target.classSectionId,
          readBy: [],
          createdAt: reviewedAt,
        },
        ...next.notifications,
      ];
      entity = "enrollment_request";
      entityId = mutation.id;
      auditAction = `enrollment_request_${mutation.status}`;
      break;
    }
    case "delete_enrollment_request":
      next.enrollmentRequests = next.enrollmentRequests.filter((r) => r.id !== mutation.id);
      entity = "enrollment_request";
      entityId = mutation.id;
      break;
    case "upsert_enrollment_meta":
      next.enrollmentMeta = {
        ...next.enrollmentMeta,
        [mutation.payload.enrollmentKey]: {
          ...mutation.payload,
          updatedAt: new Date().toISOString(),
        },
      };
      entity = "enrollment";
      entityId = mutation.payload.enrollmentKey;
      break;
    case "assign_student_class": {
      const { studentId, classSectionId } = mutation;
      if (classSectionId) {
        const dest = next.classes.find((c) => c.id === classSectionId);
        if (!dest) throw new Error("Selected class section does not exist.");
        if (!dest.studentIds.includes(studentId) && dest.studentIds.length >= dest.capacity) {
          throw new Error(`Class "${dest.name}" has reached maximum capacity (${dest.capacity}).`);
        }
      }
      next.classes = next.classes.map((c) => {
        const filtered = c.studentIds.filter((id) => id !== studentId);
        if (classSectionId && c.id === classSectionId) {
          return { ...c, studentIds: [...filtered, studentId] };
        }
        return { ...c, studentIds: filtered };
      });
      const existingMeta = next.studentMeta[studentId];
      next.studentMeta = {
        ...next.studentMeta,
        [studentId]: {
          userId: studentId,
          studentCode: existingMeta?.studentCode ?? `STU-${studentId.slice(0, 6).toUpperCase()}`,
          classSectionId,
          academicYearId:
            existingMeta?.academicYearId ??
            next.academicYears.find((y) => y.isCurrent)?.id ??
            null,
          guardianName: existingMeta?.guardianName ?? "",
          guardianPhone: existingMeta?.guardianPhone ?? "",
          address: existingMeta?.address ?? "",
          dateOfBirth: existingMeta?.dateOfBirth ?? "",
          notes: existingMeta?.notes ?? "",
        },
      };
      entity = "class_assignment";
      entityId = studentId;
      break;
    }
    case "upsert_exam": {
      if (mutation.payload.maxScore <= 0 || mutation.payload.passingScore < 0) {
        throw new Error("Exam max score must be positive and passing score non-negative.");
      }
      if (mutation.payload.passingScore > mutation.payload.maxScore) {
        throw new Error("Passing score cannot exceed max score.");
      }
      next.exams = upsertById(next.exams, mutation.payload);
      entity = "exam";
      entityId = mutation.payload.id;
      break;
    }
    case "delete_exam":
      next.exams = next.exams.filter((ex) => ex.id !== mutation.id);
      next.examSubmissions = next.examSubmissions.filter((s) => s.examId !== mutation.id);
      entity = "exam";
      entityId = mutation.id;
      break;
    case "upsert_exam_submission": {
      const exam = next.exams.find((ex) => ex.id === mutation.payload.examId);
      if (
        exam &&
        (mutation.payload.score < 0 || mutation.payload.score > exam.maxScore)
      ) {
        throw new Error(`Exam score must be between 0 and ${exam.maxScore}.`);
      }
      next.examSubmissions = upsertById(next.examSubmissions, mutation.payload);
      entity = "exam_submission";
      entityId = mutation.payload.id;
      break;
    }
    case "delete_exam_submission":
      next.examSubmissions = next.examSubmissions.filter((s) => s.id !== mutation.id);
      entity = "exam_submission";
      entityId = mutation.id;
      break;
    case "upsert_certificate_template": {
      let templates = upsertById(next.certificateTemplates, mutation.payload);
      if (mutation.payload.isDefault) {
        templates = templates.map((t) => ({ ...t, isDefault: t.id === mutation.payload.id }));
      }
      next.certificateTemplates = templates;
      entity = "certificate_template";
      entityId = mutation.payload.id;
      break;
    }
    case "issue_certificate": {
      const code =
        mutation.payload.certificateCode ||
        nextCertificateCode(next.issuedCertificates.map((c) => c.certificateCode));
      const cert: IssuedCertificate = {
        ...mutation.payload,
        id: mutation.payload.id || crypto.randomUUID(),
        certificateCode: code,
        issuedAt: new Date().toISOString(),
        issuedBy: actorId,
        status: "issued",
      };
      next.issuedCertificates = upsertById(next.issuedCertificates, cert);
      entity = "certificate";
      entityId = cert.id;
      break;
    }
    case "update_certificate_status":
      next.issuedCertificates = next.issuedCertificates.map((c) =>
        c.id === mutation.id ? { ...c, status: mutation.status } : c,
      );
      entity = "certificate";
      entityId = mutation.id;
      break;
    case "delete_certificate":
      next.issuedCertificates = next.issuedCertificates.filter((c) => c.id !== mutation.id);
      entity = "certificate";
      entityId = mutation.id;
      break;
    case "send_payment_reminder": {
      const now = new Date().toISOString();
      const reminder: PaymentReminder = {
        id: crypto.randomUUID(),
        studentId: mutation.payload.studentId,
        feePlanId: mutation.payload.feePlanId,
        amountDue: mutation.payload.amountDue,
        channel: mutation.payload.channel,
        sentBy: actorId,
        sentAt: now,
        note: mutation.payload.note ?? "",
      };
      next.paymentReminders = [reminder, ...next.paymentReminders];
      next.notifications = [
        {
          id: crypto.randomUUID(),
          title: "Tuition & Fee Balance Reminder",
          message:
            mutation.payload.note?.trim() ||
            `Outstanding balance of ${mutation.payload.amountDue.toLocaleString()} ETB is due. Please upload your payment receipt.`,
          category: "finance",
          targetRole: "student",
          targetClassId: null,
          readBy: [],
          createdAt: now,
        },
        ...next.notifications,
      ];
      if (mutation.payload.parentId) {
        const senderRole: AppRole = callerRoles.includes("owner") ? "owner" : "admin";
        next.parentMessages = [
          {
            id: crypto.randomUUID(),
            parentId: mutation.payload.parentId,
            studentId: mutation.payload.studentId,
            senderId: actorId,
            senderRole,
            subject: "Outstanding Fee Balance Reminder",
            body:
              mutation.payload.note?.trim() ||
              `Friendly reminder regarding an outstanding tuition balance of ${mutation.payload.amountDue.toLocaleString()} ETB.`,
            includeSnapshot: false,
            snapshotSummary: null,
            read: false,
            createdAt: now,
          },
          ...next.parentMessages,
        ];
      }
      entity = "payment_reminder";
      entityId = reminder.id;
      break;
    }
    case "upsert_course_material":
      next.courseMaterials = upsertById(next.courseMaterials, {
        ...mutation.payload,
        updatedAt: new Date().toISOString(),
      });
      entity = "course_material";
      entityId = mutation.payload.id;
      break;
    case "delete_course_material":
      next.courseMaterials = next.courseMaterials.filter((m) => m.id !== mutation.id);
      entity = "course_material";
      entityId = mutation.id;
      break;
    case "upsert_live_class":
      next.liveClasses = upsertById(next.liveClasses, mutation.payload);
      entity = "live_class";
      entityId = mutation.payload.id;
      break;
    case "delete_live_class":
      next.liveClasses = next.liveClasses.filter((lc) => lc.id !== mutation.id);
      entity = "live_class";
      entityId = mutation.id;
      break;
    case "upsert_assignment":
      if (mutation.payload.maxScore <= 0) {
        throw new Error("Assignment maximum score must be positive.");
      }
      next.assignments = upsertById(next.assignments, {
        ...mutation.payload,
        updatedAt: new Date().toISOString(),
      });
      entity = "assignment";
      entityId = mutation.payload.id;
      break;
    case "delete_assignment":
      next.assignments = next.assignments.filter((a) => a.id !== mutation.id);
      next.assignmentSubmissions = next.assignmentSubmissions.filter(
        (s) => s.assignmentId !== mutation.id,
      );
      entity = "assignment";
      entityId = mutation.id;
      break;
    case "upsert_assignment_submission":
      next.assignmentSubmissions = upsertById(next.assignmentSubmissions, mutation.payload);
      entity = "assignment_submission";
      entityId = mutation.payload.id;
      break;
    case "grade_assignment_submission": {
      const assignment = next.assignments.find((a) => a.id === mutation.payload.assignmentId);
      if (
        assignment &&
        (mutation.payload.score < 0 || mutation.payload.score > assignment.maxScore)
      ) {
        throw new Error(`Score must be between 0 and ${assignment.maxScore}.`);
      }
      const existing = next.assignmentSubmissions.find(
        (s) => s.id === mutation.payload.submissionId,
      );
      const now = new Date().toISOString();
      const updatedSub: AssignmentSubmission = existing
        ? {
            ...existing,
            score: mutation.payload.score,
            feedback: mutation.payload.feedback,
            status: mutation.payload.status,
            gradedBy: actorId,
            gradedAt: now,
            returnedAt:
              mutation.payload.status === "returned" ? now : existing.returnedAt,
          }
        : {
            id: mutation.payload.submissionId || crypto.randomUUID(),
            assignmentId: mutation.payload.assignmentId,
            courseId: mutation.payload.courseId,
            studentId: mutation.payload.studentId,
            submittedText: "",
            attachmentUrl: "",
            submittedAt: now,
            status: mutation.payload.status,
            score: mutation.payload.score,
            feedback: mutation.payload.feedback,
            gradedBy: actorId,
            gradedAt: now,
            returnedAt: mutation.payload.status === "returned" ? now : null,
          };
      next.assignmentSubmissions = upsertById(next.assignmentSubmissions, updatedSub);
      entity = "assignment_submission";
      entityId = updatedSub.id;
      auditAction = "assignment_graded";
      break;
    }
    case "delete_assignment_submission":
      next.assignmentSubmissions = next.assignmentSubmissions.filter((s) => s.id !== mutation.id);
      entity = "assignment_submission";
      entityId = mutation.id;
      break;
    case "upsert_question_bank_item":
      if (mutation.payload.points <= 0) {
        throw new Error("Question points must be positive.");
      }
      next.questionBank = upsertById(next.questionBank, {
        ...mutation.payload,
        updatedAt: new Date().toISOString(),
      });
      entity = "question_bank";
      entityId = mutation.payload.id;
      break;
    case "delete_question_bank_item":
      next.questionBank = next.questionBank.filter((q) => q.id !== mutation.id);
      entity = "question_bank";
      entityId = mutation.id;
      break;
    case "upsert_discussion_thread":
      next.discussionThreads = upsertById(next.discussionThreads, {
        ...mutation.payload,
        updatedAt: new Date().toISOString(),
      });
      entity = "discussion_thread";
      entityId = mutation.payload.id;
      break;
    case "delete_discussion_thread":
      next.discussionThreads = next.discussionThreads.filter((t) => t.id !== mutation.id);
      next.discussionPosts = next.discussionPosts.filter((p) => p.threadId !== mutation.id);
      entity = "discussion_thread";
      entityId = mutation.id;
      break;
    case "add_discussion_post": {
      const thread = next.discussionThreads.find((t) => t.id === mutation.payload.threadId);
      if (thread?.locked) {
        throw new Error("This discussion thread is locked.");
      }
      const post: CourseDiscussionPost = {
        ...mutation.payload,
        id: crypto.randomUUID(),
        moderatedHidden: false,
        createdAt: new Date().toISOString(),
      };
      next.discussionPosts = [...next.discussionPosts, post];
      entity = "discussion_post";
      entityId = post.id;
      break;
    }
    case "moderate_discussion_post":
      next.discussionPosts = next.discussionPosts.map((p) =>
        p.id === mutation.id ? { ...p, moderatedHidden: mutation.hidden } : p,
      );
      entity = "discussion_post";
      entityId = mutation.id;
      break;
    case "upsert_instructor_payout":
      if (mutation.payload.amount < 0) {
        throw new Error("Payout amount cannot be negative.");
      }
      next.instructorPayouts = upsertById(next.instructorPayouts, mutation.payload);
      entity = "instructor_payout";
      entityId = mutation.payload.id;
      break;
    case "delete_instructor_payout":
      next.instructorPayouts = next.instructorPayouts.filter((p) => p.id !== mutation.id);
      entity = "instructor_payout";
      entityId = mutation.id;
      break;
    case "upsert_course_completion":
      next.courseCompletions = upsertById(next.courseCompletions, {
        ...mutation.payload,
        updatedAt: new Date().toISOString(),
      });
      entity = "course_completion";
      entityId = mutation.payload.id;
      break;
  }

  persistWorkspaceState(next);
  return { state: next, auditAction, entity, entityId };
}
