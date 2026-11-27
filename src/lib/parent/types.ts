import type { AppRole } from "@/lib/auth";
import type {
  AcademicCalendarEvent,
  AcademicTerm,
  AcademicYear,
  AccountPreferences,
  AnnouncementMeta,
  AssignmentSubmission,
  AttendanceDispute,
  AttendanceRecord,
  CertificateTemplate,
  ChildLinkRequest,
  ClassSection,
  CourseAssignment,
  CourseCompletionRecord,
  CourseExtensionMeta,
  CourseMaterial,
  Department,
  EnrollmentMeta,
  EnrollmentRequest,
  ExamAssessment,
  ExamSubmission,
  FeePlan,
  GradeEntry,
  GradingScale,
  InternalMessage,
  InvoiceRecord,
  IssuedCertificate,
  LearningResource,
  LiveClassSession,
  ModulePermissions,
  ParentMessage,
  PaymentReminder,
  PermissionModule,
  ProfileCorrectionRequest,
  StudentRecordMeta,
  SubjectRecord,
  SystemNotification,
  TimetableSlot,
} from "@/lib/owner/types";

export type ParentSubmenuId =
  | "overview"
  | "all-children"
  | "child-profiles"
  | "academic-info"
  | "switch-child"
  | "enrolled-courses"
  | "course-progress"
  | "timetables"
  | "attendance-tracking"
  | "grades-report-cards"
  | "assignments-exams"
  | "exam-results"
  | "learning-progress"
  | "certificates"
  | "elearning-resources"
  | "child-fees"
  | "make-payment"
  | "payment-history"
  | "outstanding-balances"
  | "invoices-receipts"
  | "messages-instructors"
  | "messages-admin"
  | "teacher-communication"
  | "academy-announcements"
  | "notifications"
  | "my-profile"
  | "linked-children"
  | "account-settings"
  | "change-password";

export type ParentGroupId =
  | "dashboard"
  | "children"
  | "academic-monitoring"
  | "finance"
  | "communication"
  | "account";

export type ParentCoursePublicMeta = Omit<
  CourseExtensionMeta,
  "youtubeApiKey" | "youtubeChannelId" | "youtubePlaylistId"
>;

export interface ScopedParentWorkspace {
  parentId: string;
  linkedChildIds: string[];
  relationshipsByChild: Record<string, string>;
  enrolledCourseByChild: Record<string, string[]>;
  assignedClassByChild: Record<string, string[]>;
  paidCourseByChild: Record<string, string[]>;
  authorizedInstructorIds: string[];
  authorizedAdminIds: string[];
  authorizedRecipientIds: string[];
  academicYears: AcademicYear[];
  terms: AcademicTerm[];
  departments: Department[];
  calendarEvents: AcademicCalendarEvent[];
  classes: ClassSection[];
  subjects: SubjectRecord[];
  courseMeta: Record<string, ParentCoursePublicMeta>;
  studentMetaByChild: Record<string, StudentRecordMeta>;
  enrollmentRequests: EnrollmentRequest[];
  enrollmentMeta: Record<string, EnrollmentMeta>;
  timetables: TimetableSlot[];
  attendance: AttendanceRecord[];
  attendanceDisputes: AttendanceDispute[];
  gradingScales: GradingScale[];
  grades: GradeEntry[];
  courseMaterials: CourseMaterial[];
  resources: LearningResource[];
  liveClasses: LiveClassSession[];
  assignments: CourseAssignment[];
  assignmentSubmissions: AssignmentSubmission[];
  exams: ExamAssessment[];
  examSubmissions: ExamSubmission[];
  courseCompletions: CourseCompletionRecord[];
  certificateTemplates: CertificateTemplate[];
  issuedCertificates: IssuedCertificate[];
  feePlans: FeePlan[];
  invoices: InvoiceRecord[];
  paymentReminders: PaymentReminder[];
  parentMessages: ParentMessage[];
  internalMessages: InternalMessage[];
  notifications: SystemNotification[];
  announcementMeta: Record<string, AnnouncementMeta>;
  profileCorrectionRequests: ProfileCorrectionRequest[];
  childLinkRequests: ChildLinkRequest[];
  myAccountPrefs: AccountPreferences;
  myPermissions: Record<PermissionModule, ModulePermissions>;
  currency: "ETB" | "USD";
  platformName: string;
  minPasswordLength: number;
  defaultRoleNote?: AppRole;
}
