import type { AppRole } from "@/lib/auth";
import type {
  AcademicTerm,
  AcademicYear,
  AccountPreferences,
  AnnouncementMeta,
  AssignmentSubmission,
  AttendanceRecord,
  ClassSection,
  CourseAssignment,
  CourseCompletionRecord,
  CourseDiscussionPost,
  CourseDiscussionThread,
  CourseExtensionMeta,
  CourseMaterial,
  Department,
  EnrollmentMeta,
  ExamAssessment,
  ExamSubmission,
  GradeEntry,
  GradingScale,
  InstructorPayout,
  InstructorRecordMeta,
  InternalMessage,
  IssuedCertificate,
  LearningResource,
  LiveClassSession,
  ModulePermissions,
  ParentMessage,
  PermissionModule,
  QuestionBankItem,
  StudentRecordMeta,
  SubjectRecord,
  SystemNotification,
  TimetableSlot,
} from "@/lib/owner/types";

export type InstructorSubmenuId =
  | "overview"
  | "my-courses"
  | "create-course"
  | "course-materials"
  | "elearning-resources"
  | "course-announcements"
  | "my-classes"
  | "my-students"
  | "student-records"
  | "timetables"
  | "attendance"
  | "live-classes"
  | "create-assignments"
  | "manage-assignments"
  | "quizzes-exams"
  | "question-bank"
  | "submissions"
  | "grading-evaluation"
  | "grades-report-cards"
  | "student-progress"
  | "performance-reports"
  | "learning-activities"
  | "course-completion"
  | "parent-communication"
  | "student-messages"
  | "discussion-forums"
  | "class-announcements"
  | "notifications"
  | "my-earnings"
  | "payment-history"
  | "my-profile"
  | "account-settings"
  | "change-password";

export type InstructorGroupId =
  | "dashboard"
  | "courses"
  | "classes"
  | "assessments"
  | "performance"
  | "communication"
  | "earnings"
  | "account";

export interface ScopedInstructorWorkspace {
  instructorId: string;
  assignedCourseIds: string[];
  assignedClassIds: string[];
  assignedStudentIds: string[];
  linkedParentIds: string[];
  academicYears: AcademicYear[];
  terms: AcademicTerm[];
  departments: Department[];
  classes: ClassSection[];
  subjects: SubjectRecord[];
  courseMeta: Record<string, CourseExtensionMeta>;
  studentMeta: Record<string, StudentRecordMeta>;
  myInstructorMeta: InstructorRecordMeta;
  enrollmentMeta: Record<string, EnrollmentMeta>;
  timetables: TimetableSlot[];
  attendance: AttendanceRecord[];
  gradingScales: GradingScale[];
  grades: GradeEntry[];
  courseMaterials: CourseMaterial[];
  resources: LearningResource[];
  liveClasses: LiveClassSession[];
  assignments: CourseAssignment[];
  assignmentSubmissions: AssignmentSubmission[];
  exams: ExamAssessment[];
  examSubmissions: ExamSubmission[];
  questionBank: QuestionBankItem[];
  discussionThreads: CourseDiscussionThread[];
  discussionPosts: CourseDiscussionPost[];
  courseCompletions: CourseCompletionRecord[];
  issuedCertificates: IssuedCertificate[];
  parentMessages: ParentMessage[];
  internalMessages: InternalMessage[];
  notifications: SystemNotification[];
  announcementMeta: Record<string, AnnouncementMeta>;
  payouts: InstructorPayout[];
  myAccountPrefs: AccountPreferences;
  myPermissions: Record<PermissionModule, ModulePermissions>;
  currency: "ETB" | "USD";
  defaultRoleNote?: AppRole;
}
