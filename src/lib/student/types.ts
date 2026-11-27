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
  ClassSection,
  CourseAssignment,
  CourseCompletionRecord,
  CourseDiscussionPost,
  CourseDiscussionThread,
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

export type StudentSubmenuId =
  | "overview"
  | "my-courses"
  | "explore-courses"
  | "continue-learning"
  | "course-materials"
  | "elearning-resources"
  | "live-classes"
  | "learning-schedule"
  | "my-timetable"
  | "my-attendance"
  | "my-assignments"
  | "quizzes-exams"
  | "exam-results"
  | "grades-report-cards"
  | "learning-progress"
  | "my-certificates"
  | "messages"
  | "parent-communication"
  | "discussion-forums"
  | "announcements"
  | "notifications"
  | "my-fees"
  | "make-payment"
  | "payment-history"
  | "invoices-receipts"
  | "my-profile"
  | "account-settings"
  | "change-password";

export type StudentGroupId =
  | "dashboard"
  | "learning"
  | "academics"
  | "communication"
  | "finance"
  | "account";

export type StudentCoursePublicMeta = Omit<
  CourseExtensionMeta,
  "youtubeApiKey" | "youtubeChannelId" | "youtubePlaylistId"
>;

export interface ScopedStudentWorkspace {
  studentId: string;
  enrolledCourseIds: string[];
  assignedClassIds: string[];
  paidCourseIds: string[];
  linkedParentIds: string[];
  authorizedRecipientIds: string[];
  courseEnrollmentCounts: Record<string, number>;
  academicYears: AcademicYear[];
  terms: AcademicTerm[];
  departments: Department[];
  calendarEvents: AcademicCalendarEvent[];
  classes: ClassSection[];
  subjects: SubjectRecord[];
  courseMeta: Record<string, StudentCoursePublicMeta>;
  myStudentMeta: StudentRecordMeta;
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
  discussionThreads: CourseDiscussionThread[];
  discussionPosts: CourseDiscussionPost[];
  notifications: SystemNotification[];
  announcementMeta: Record<string, AnnouncementMeta>;
  profileCorrectionRequests: ProfileCorrectionRequest[];
  myAccountPrefs: AccountPreferences;
  myPermissions: Record<PermissionModule, ModulePermissions>;
  currency: "ETB" | "USD";
  platformName: string;
  minPasswordLength: number;
  defaultRoleNote?: AppRole;
}
