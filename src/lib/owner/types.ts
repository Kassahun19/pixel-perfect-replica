import type { AppRole } from "@/lib/auth";
import type { Tables } from "@/integrations/supabase/types";

export type OwnerSubmenuId =
  | "overview"
  | "reports"
  | "users"
  | "students"
  | "student-records"
  | "instructors"
  | "parents"
  | "user-roles"
  | "user-permissions"
  | "academics"
  | "classes-sections"
  | "academic-years"
  | "semesters-terms"
  | "courses"
  | "subjects"
  | "timetables"
  | "attendance"
  | "grades"
  | "exams"
  | "resources"
  | "certificates"
  | "course-enrollment"
  | "student-registration"
  | "enrollment-requests"
  | "class-assignments"
  | "fees-payments"
  | "invoices"
  | "transactions"
  | "outstanding-balances"
  | "financial-reports"
  | "parent-comm"
  | "messages"
  | "announcements"
  | "notifications"
  | "support"
  | "roles-permissions"
  | "system-settings"
  | "academy-profile"
  | "integrations"
  | "audit-logs"
  | "my-profile"
  | "account-settings"
  | "change-password";

export type MenuGroupId =
  | "dashboard"
  | "reports"
  | "users"
  | "academics"
  | "enrollments"
  | "academy"
  | "finance"
  | "communication"
  | "platform"
  | "account";

export type PermissionModule =
  | "overview"
  | "reports"
  | "users"
  | "students"
  | "instructors"
  | "parents"
  | "academics"
  | "courses"
  | "subjects"
  | "timetables"
  | "attendance"
  | "grades"
  | "exams"
  | "resources"
  | "certificates"
  | "enrollments"
  | "finance"
  | "communication"
  | "platform"
  | "audit";

export type PermissionAction = "view" | "create" | "edit" | "delete" | "export" | "approve";

export type ModulePermissions = Record<PermissionAction, boolean>;
export type RolePermissionMatrix = Record<AppRole, Record<PermissionModule, ModulePermissions>>;

export interface AcademicYear {
  id: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  status: "planned" | "active" | "completed";
}

export interface AcademicTerm {
  id: string;
  academicYearId: string;
  name: string;
  startDate: string;
  endDate: string;
  isCurrent: boolean;
  calendarNotes: string;
}

export interface Department {
  id: string;
  name: string;
  code: string;
  headInstructorId: string | null;
  description: string;
}

export interface ClassSection {
  id: string;
  name: string;
  sectionCode: string;
  academicYearId: string;
  departmentId: string | null;
  instructorId: string | null;
  studentIds: string[];
  capacity: number;
  room: string;
}

export interface AcademicCalendarEvent {
  id: string;
  title: string;
  date: string;
  endDate?: string;
  category: "term" | "exam" | "holiday" | "event";
  description: string;
}

export interface StudentRecordMeta {
  userId: string;
  studentCode: string;
  classSectionId: string | null;
  academicYearId: string | null;
  guardianName: string;
  guardianPhone: string;
  address: string;
  dateOfBirth: string;
  notes: string;
}

export interface InstructorRecordMeta {
  userId: string;
  qualifications: string;
  experienceYears: number;
  expertise: string[];
  departmentId: string | null;
  weeklyHoursLimit: number;
  scheduleSummary: string;
  hourlyRate: number;
}

export interface SubjectRecord {
  id: string;
  name: string;
  code: string;
  categoryId: string | null;
  departmentId: string | null;
  courseIds: string[];
  credits: number;
  description: string;
}

export interface CourseExtensionMeta {
  courseId: string;
  priceEtb: number;
  enrollmentMode: "open" | "approval" | "closed";
  maxCapacity: number | null;
  classSectionId: string | null;
  academicTermId: string | null;
  youtubeApiKey?: string | null;
  youtubeChannelId?: string | null;
  youtubePlaylistId?: string | null;
}

export type TimetableSessionType = "lesson" | "exam" | "live_class";

export interface TimetableSlot {
  id: string;
  title: string;
  sessionType: TimetableSessionType;
  courseId: string | null;
  classSectionId: string | null;
  instructorId: string | null;
  dayOfWeek: "Monday" | "Tuesday" | "Wednesday" | "Thursday" | "Friday" | "Saturday" | "Sunday";
  startTime: string; // HH:mm
  endTime: string; // HH:mm
  room: string;
  meetingUrl: string;
}

export type AttendanceStatus = "present" | "absent" | "late" | "excused";

export interface AttendanceRecord {
  id: string;
  personId: string;
  personType: "student" | "instructor";
  courseId: string | null;
  classSectionId: string | null;
  date: string; // YYYY-MM-DD
  status: AttendanceStatus;
  notes: string;
  markedBy: string | null;
}

export interface GradingBand {
  letter: string;
  minPercent: number;
  maxPercent: number;
  gpa: number;
  remark: string;
}

export interface GradingScale {
  id: string;
  name: string;
  isDefault: boolean;
  bands: GradingBand[];
}

export type GradeAssessmentType = "assignment" | "quiz" | "exam" | "project";

export interface GradeEntry {
  id: string;
  studentId: string;
  courseId: string;
  termId: string | null;
  assessmentTitle: string;
  assessmentType: GradeAssessmentType;
  score: number;
  maxScore: number;
  weight: number;
  remarks: string;
  gradedAt: string;
}

export type ResourceType = "video" | "pdf" | "document" | "presentation" | "link";
export type ResourceAccess = "public" | "enrolled" | "pro_paid" | "staff_only";

export interface LearningResource {
  id: string;
  title: string;
  type: ResourceType;
  courseId: string | null;
  subjectId: string | null;
  categoryId: string | null;
  url: string;
  storagePath: string | null;
  fileSizeLabel: string;
  accessLevel: ResourceAccess;
  description: string;
  createdAt: string;
}

export type FeeStatus = "paid" | "unpaid" | "overdue" | "partial";

export interface FeePlan {
  id: string;
  studentId: string;
  courseId: string | null;
  title: string;
  amount: number;
  discount: number;
  paidAmount: number;
  dueDate: string;
  status: FeeStatus;
  paymentMethod: string;
  notes: string;
  createdAt: string;
}

export type InvoiceStatus = "paid" | "issued" | "overdue" | "void";

export interface InvoiceRecord {
  id: string;
  invoiceNumber: string;
  studentId: string;
  courseId: string | null;
  feePlanId: string | null;
  paymentId: string | null;
  subtotal: number;
  discount: number;
  total: number;
  paidAmount: number;
  status: InvoiceStatus;
  issuedAt: string;
  dueDate: string;
  paymentMethod: string;
  notes: string;
}

export interface TransactionAdjustment {
  paymentId: string;
  refunded: boolean;
  refundReason: string;
  refundedAt: string | null;
}

export interface ParentMessage {
  id: string;
  parentId: string;
  studentId: string | null;
  senderId: string;
  senderRole: AppRole;
  subject: string;
  body: string;
  includeSnapshot: boolean;
  snapshotSummary: string | null;
  read: boolean;
  createdAt: string;
}

export interface InternalMessage {
  id: string;
  senderId: string;
  recipientId: string;
  subject: string;
  body: string;
  read: boolean;
  archived: boolean;
  deleted: boolean;
  createdAt: string;
}

export interface SystemNotification {
  id: string;
  title: string;
  message: string;
  category: "system" | "academic" | "finance" | "communication";
  targetRole: AppRole | "all";
  targetClassId: string | null;
  targetCourseId?: string | null;
  targetUserId?: string | null;
  readBy: string[];
  createdAt: string;
}

export interface AnnouncementMeta {
  announcementId: string;
  targetClassId: string | null;
  targetCourseId: string | null;
}

export interface SupportTicketMeta {
  messageId: string;
  assignedTo: string | null;
  priority: "low" | "normal" | "high" | "urgent";
  workflowStatus: "open" | "in_progress" | "resolved";
  internalNote: string;
  updatedAt: string;
}

export interface SystemSettings {
  platformName: string;
  maintenanceMode: boolean;
  allowPublicRegistration: boolean;
  defaultAcademicYearId: string | null;
  defaultTermId: string | null;
  currency: "ETB" | "USD";
  timezone: string;
  language: "en" | "am";
  sessionTimeoutMinutes: number;
  minPasswordLength: number;
  requireMfaForStaff: boolean;
  emailSenderName: string;
  emailSenderAddress: string;
  enablePaymentAlerts: boolean;
  enableAttendanceAlerts: boolean;
  updatedAt: string;
}

export interface AcademyProfileExt {
  logoUrl: string;
  smsSenderId: string;
  supportHours: string;
}

export interface IntegrationConfig {
  id: "telebirr" | "cbe_bank" | "email_smtp" | "youtube" | "live_conferencing";
  name: string;
  category: "payment" | "email" | "video";
  enabled: boolean;
  mode: "live" | "sandbox";
  endpointOrHost: string;
  accountOrSender: string;
  envVarName: string;
  hasSecret: boolean;
  secretMask: string;
  lastTestedAt: string | null;
  statusText: string;
}

export interface AccountPreferences {
  language: "en" | "am";
  timezone: string;
  emailNotifications: boolean;
  inAppNotifications: boolean;
  paymentReviewDigest: boolean;
  weeklyExecutiveSummary: boolean;
}

export type EnrollmentRequestStatus = "pending" | "approved" | "rejected";

export interface EnrollmentRequest {
  id: string;
  studentId: string;
  courseId: string;
  classSectionId: string | null;
  requestedBy: string | null;
  notes: string;
  status: EnrollmentRequestStatus;
  reviewedBy: string | null;
  reviewedAt: string | null;
  reviewNote: string;
  createdAt: string;
}

export interface EnrollmentMeta {
  enrollmentKey: string;
  status: "active" | "completed" | "suspended";
  updatedAt: string;
  notes: string;
}

export interface ExamQuestion {
  id: string;
  prompt: string;
  questionType: "multiple_choice" | "true_false" | "short_answer" | "practical";
  options: string[];
  correctAnswer: string;
  points: number;
}

export interface ExamAssessment {
  id: string;
  title: string;
  courseId: string;
  termId: string | null;
  classSectionId?: string | null;
  instructorId?: string | null;
  examType: "quiz" | "midterm" | "final" | "practical" | "assignment";
  scheduledDate: string;
  dueDate?: string | null;
  startTime: string;
  durationMinutes: number;
  maxScore: number;
  passingScore: number;
  instructions: string;
  questions: ExamQuestion[];
  status: "draft" | "scheduled" | "active" | "completed";
  createdAt: string;
}

export interface ExamSubmission {
  id: string;
  examId: string;
  studentId: string;
  score: number;
  status: "pending" | "submitted" | "graded";
  submittedAt: string | null;
  gradedAt: string | null;
  feedback: string;
}

export interface CertificateTemplate {
  id: string;
  name: string;
  title: string;
  subtitle: string;
  bodyText: string;
  signatoryName: string;
  signatoryTitle: string;
  accentColor: string;
  isDefault: boolean;
}

export interface IssuedCertificate {
  id: string;
  certificateCode: string;
  studentId: string;
  courseId: string;
  templateId: string;
  completionPercent: number;
  finalGrade: string;
  issuedAt: string;
  issuedBy: string | null;
  status: "issued" | "revoked";
  notes: string;
}

export interface PaymentReminder {
  id: string;
  studentId: string;
  feePlanId: string | null;
  amountDue: number;
  channel: "notification" | "parent_message";
  sentBy: string;
  sentAt: string;
  note: string;
}

export interface CourseMaterial {
  id: string;
  courseId: string;
  lessonId: string | null;
  topic: string;
  title: string;
  type: ResourceType;
  url: string;
  storagePath: string | null;
  fileSizeLabel: string;
  description: string;
  visibleToEnrolled: boolean;
  uploadedBy: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface LiveClassSession {
  id: string;
  courseId: string;
  classSectionId: string | null;
  instructorId: string;
  title: string;
  scheduledDate: string;
  startTime: string;
  endTime: string;
  meetingUrl: string;
  status: "scheduled" | "live" | "ended" | "cancelled";
  participantIds: string[];
  attachedMaterialIds: string[];
  notes: string;
  createdAt: string;
}

export interface CourseAssignment {
  id: string;
  courseId: string;
  classSectionId: string | null;
  instructorId: string;
  title: string;
  description: string;
  instructions: string;
  dueDate: string;
  maxScore: number;
  attachmentUrl: string;
  attachmentName: string;
  status: "draft" | "published" | "closed" | "archived";
  createdAt: string;
  updatedAt: string;
}

export interface AssignmentSubmission {
  id: string;
  assignmentId: string;
  courseId: string;
  studentId: string;
  submittedText: string;
  attachmentUrl: string;
  submittedAt: string | null;
  status: "pending" | "submitted" | "late" | "graded" | "returned";
  score: number | null;
  feedback: string;
  gradedBy: string | null;
  gradedAt: string | null;
  returnedAt: string | null;
}

export interface QuestionBankItem {
  id: string;
  courseId: string;
  subjectId: string | null;
  instructorId: string;
  topic: string;
  prompt: string;
  questionType: "multiple_choice" | "true_false" | "short_answer" | "practical";
  options: string[];
  correctAnswer: string;
  points: number;
  difficulty: "easy" | "medium" | "hard";
  createdAt: string;
  updatedAt: string;
}

export interface CourseDiscussionThread {
  id: string;
  courseId: string;
  authorId: string;
  authorRole: AppRole;
  title: string;
  body: string;
  pinned: boolean;
  locked: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CourseDiscussionPost {
  id: string;
  threadId: string;
  courseId: string;
  authorId: string;
  authorRole: AppRole;
  body: string;
  moderatedHidden: boolean;
  createdAt: string;
}

export interface InstructorPayout {
  id: string;
  instructorId: string;
  periodLabel: string;
  courseId: string | null;
  amount: number;
  teachingHours: number;
  ratePerHour: number;
  status: "pending" | "completed" | "failed";
  referenceCode: string;
  paidAt: string | null;
  notes: string;
  createdAt: string;
}

export interface CourseCompletionRecord {
  id: string;
  studentId: string;
  courseId: string;
  completionPercent: number;
  status: "in_progress" | "completed" | "confirmed";
  confirmedBy: string | null;
  confirmedAt: string | null;
  notes: string;
  updatedAt: string;
}

export interface OwnerWorkspaceState {
  academicYears: AcademicYear[];
  terms: AcademicTerm[];
  departments: Department[];
  classes: ClassSection[];
  calendarEvents: AcademicCalendarEvent[];
  studentMeta: Record<string, StudentRecordMeta>;
  instructorMeta: Record<string, InstructorRecordMeta>;
  subjects: SubjectRecord[];
  courseMeta: Record<string, CourseExtensionMeta>;
  timetables: TimetableSlot[];
  attendance: AttendanceRecord[];
  gradingScales: GradingScale[];
  grades: GradeEntry[];
  resources: LearningResource[];
  feePlans: FeePlan[];
  invoices: InvoiceRecord[];
  transactionAdjustments: Record<string, TransactionAdjustment>;
  parentMessages: ParentMessage[];
  internalMessages: InternalMessage[];
  notifications: SystemNotification[];
  announcementMeta: Record<string, AnnouncementMeta>;
  supportMeta: Record<string, SupportTicketMeta>;
  rolePermissions: RolePermissionMatrix;
  systemSettings: SystemSettings;
  academyExt: AcademyProfileExt;
  integrations: IntegrationConfig[];
  accountPrefsByUser: Record<string, AccountPreferences>;
  enrollmentRequests: EnrollmentRequest[];
  enrollmentMeta: Record<string, EnrollmentMeta>;
  exams: ExamAssessment[];
  examSubmissions: ExamSubmission[];
  certificateTemplates: CertificateTemplate[];
  issuedCertificates: IssuedCertificate[];
  paymentReminders: PaymentReminder[];
  courseMaterials: CourseMaterial[];
  liveClasses: LiveClassSession[];
  assignments: CourseAssignment[];
  assignmentSubmissions: AssignmentSubmission[];
  questionBank: QuestionBankItem[];
  discussionThreads: CourseDiscussionThread[];
  discussionPosts: CourseDiscussionPost[];
  instructorPayouts: InstructorPayout[];
  courseCompletions: CourseCompletionRecord[];
}

export type ProfileRow = Tables<"profiles">;
export type UserRoleRow = Tables<"user_roles">;
export type CourseRow = Tables<"courses">;
export type CategoryRow = Tables<"categories">;
export type LessonRow = Tables<"lessons">;
export type EnrollmentRow = Tables<"enrollments">;
export type ProgressRow = Tables<"lesson_progress">;
export type PaymentRow = Tables<"payments">;
export type ParentLinkRow = Tables<"parent_links">;
export type AnnouncementRow = Tables<"announcements">;
export type ContactMessageRow = Tables<"contact_messages">;
export type AuditLogRow = Tables<"audit_logs">;
export type AcademySettingsRow = Tables<"academy_settings">;
