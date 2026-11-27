import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  CalendarClock,
  CheckCircle2,
  ClipboardCheck,
  ClipboardList,
  FileCheck2,
  FilePlus2,
  FileText,
  FolderKanban,
  FolderTree,
  GraduationCap,
  HelpCircle,
  KeyRound,
  LayoutDashboard,
  Mail,
  Megaphone,
  MessageSquare,
  MessageSquareHeart,
  PlusCircle,
  Receipt,
  Settings,
  TrendingUp,
  UserRound,
  Users,
  Video,
  Wallet,
} from "lucide-react";
import type { InstructorGroupId, InstructorSubmenuId } from "@/lib/instructor/types";
import type { PermissionModule } from "@/lib/owner/types";

export interface InstructorNavItem {
  id: InstructorSubmenuId;
  label: string;
  icon: LucideIcon;
  module: PermissionModule;
  description: string;
}

export interface InstructorNavGroup {
  id: InstructorGroupId;
  label: string;
  icon: LucideIcon;
  items: InstructorNavItem[];
}

export const INSTRUCTOR_NAV_GROUPS: InstructorNavGroup[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    items: [
      {
        id: "overview",
        label: "Dashboard",
        icon: LayoutDashboard,
        module: "overview",
        description:
          "Teaching overview with assigned courses, classes, students, upcoming sessions, pending grading, and activity.",
      },
    ],
  },
  {
    id: "courses",
    label: "Course Management",
    icon: BookOpen,
    items: [
      {
        id: "my-courses",
        label: "My Courses",
        icon: BookOpen,
        module: "courses",
        description:
          "View assigned courses, manage lessons, monitor enrolled students, and update content.",
      },
      {
        id: "create-course",
        label: "Create New Course",
        icon: PlusCircle,
        module: "courses",
        description:
          "Create courses with objectives, topics, cover images, YouTube channel/playlist sync, and approval submission.",
      },
      {
        id: "course-materials",
        label: "Course Materials",
        icon: FileText,
        module: "courses",
        description:
          "Upload, organize, preview, replace, and manage videos, PDFs, docs, and slides by course and lesson.",
      },
      {
        id: "elearning-resources",
        label: "E-Learning Resources",
        icon: FolderKanban,
        module: "resources",
        description:
          "Manage digital learning resources by subject and category with enrolled-student visibility controls.",
      },
      {
        id: "course-announcements",
        label: "Course Announcements",
        icon: Megaphone,
        module: "communication",
        description:
          "Publish, schedule, edit, and delete announcements for your assigned courses.",
      },
    ],
  },
  {
    id: "classes",
    label: "Class Management",
    icon: FolderTree,
    items: [
      {
        id: "my-classes",
        label: "My Classes",
        icon: FolderTree,
        module: "academics",
        description:
          "View assigned classes and sections, schedules, rosters, attendance rates, and class performance.",
      },
      {
        id: "my-students",
        label: "My Students",
        icon: Users,
        module: "students",
        description:
          "Search and filter students enrolled in your courses and monitor participation and progress.",
      },
      {
        id: "student-records",
        label: "Student Records",
        icon: GraduationCap,
        module: "students",
        description:
          "Review enrollment history, attendance, grades, and update authorized student academic notes.",
      },
      {
        id: "timetables",
        label: "Timetables & Scheduling",
        icon: CalendarClock,
        module: "timetables",
        description:
          "View teaching timetables, exam schedules, conflict alerts, and manage permitted lesson slots.",
      },
      {
        id: "attendance",
        label: "Attendance Tracking",
        icon: ClipboardCheck,
        module: "attendance",
        description:
          "Record present, absent, and late attendance for assigned classes and export summaries.",
      },
      {
        id: "live-classes",
        label: "Live Classes",
        icon: Video,
        module: "courses",
        description:
          "Schedule online live classes, start or end sessions, share links, and record participant attendance.",
      },
    ],
  },
  {
    id: "assessments",
    label: "Assignments & Assessments",
    icon: ClipboardList,
    items: [
      {
        id: "create-assignments",
        label: "Create Assignments",
        icon: FilePlus2,
        module: "exams",
        description:
          "Build assignments with instructions, deadlines, max scores, and supporting materials.",
      },
      {
        id: "manage-assignments",
        label: "Manage Assignments",
        icon: ClipboardList,
        module: "exams",
        description:
          "Edit deadlines, monitor submission counts, close, reopen, or archive course assignments.",
      },
      {
        id: "quizzes-exams",
        label: "Quizzes & Exams",
        icon: FileCheck2,
        module: "exams",
        description:
          "Create and schedule quizzes and examinations, configure questions, and track results.",
      },
      {
        id: "question-bank",
        label: "Question Bank",
        icon: HelpCircle,
        module: "exams",
        description:
          "Organize reusable multiple-choice, true/false, short-answer, and practical assessment questions.",
      },
      {
        id: "submissions",
        label: "Submissions",
        icon: Activity,
        module: "exams",
        description:
          "Inspect submitted, pending, late, and missing student work with attached files and feedback.",
      },
      {
        id: "grading-evaluation",
        label: "Grading & Evaluation",
        icon: CheckCircle2,
        module: "grades",
        description:
          "Evaluate submissions, enter rubric scores and feedback, return work, and sync to Gradebook.",
      },
      {
        id: "grades-report-cards",
        label: "Grades & Report Cards",
        icon: Award,
        module: "grades",
        description:
          "Manage gradebook marks for assigned students and generate printable academic report cards.",
      },
    ],
  },
  {
    id: "performance",
    label: "Student Performance",
    icon: TrendingUp,
    items: [
      {
        id: "student-progress",
        label: "Student Progress",
        icon: TrendingUp,
        module: "students",
        description:
          "Track lesson completion, assessment scores, and identify students needing academic support.",
      },
      {
        id: "performance-reports",
        label: "Performance Reports",
        icon: BarChart3,
        module: "reports",
        description:
          "Compare assessment performance, review strengths and gaps, and export Excel or PDF reports.",
      },
      {
        id: "learning-activities",
        label: "Learning Activities",
        icon: Activity,
        module: "students",
        description:
          "Monitor lesson access, assignment and quiz participation, forum engagement, and inactive learners.",
      },
      {
        id: "course-completion",
        label: "Course Completion",
        icon: Award,
        module: "grades",
        description:
          "Track completed vs pending lessons and confirm student course completion status.",
      },
    ],
  },
  {
    id: "communication",
    label: "Communication",
    icon: Mail,
    items: [
      {
        id: "parent-communication",
        label: "Parent Communication",
        icon: MessageSquareHeart,
        module: "communication",
        description:
          "Send attendance and progress updates to linked parents of your assigned students.",
      },
      {
        id: "student-messages",
        label: "Student Messages",
        icon: Mail,
        module: "communication",
        description:
          "Send and receive private messages with students enrolled in your assigned courses.",
      },
      {
        id: "discussion-forums",
        label: "Discussion Forums",
        icon: MessageSquare,
        module: "communication",
        description:
          "Start course discussion threads, reply to student questions, pin topics, and moderate posts.",
      },
      {
        id: "class-announcements",
        label: "Class Announcements",
        icon: Megaphone,
        module: "communication",
        description:
          "Publish and schedule announcements targeted to your assigned classes and sections.",
      },
      {
        id: "notifications",
        label: "Notifications",
        icon: Bell,
        module: "communication",
        description:
          "Stay updated on new submissions, upcoming live classes, messages, and notification settings.",
      },
    ],
  },
  {
    id: "earnings",
    label: "Earnings & Payments",
    icon: Wallet,
    items: [
      {
        id: "my-earnings",
        label: "My Earnings",
        icon: Wallet,
        module: "overview",
        description:
          "View total, pending, and paid teaching earnings, hourly rate breakdowns, and statements.",
      },
      {
        id: "payment-history",
        label: "Payment History",
        icon: Receipt,
        module: "overview",
        description:
          "Search, filter, and download statements for completed, pending, and failed payouts.",
      },
    ],
  },
  {
    id: "account",
    label: "My Account",
    icon: Settings,
    items: [
      {
        id: "my-profile",
        label: "My Profile",
        icon: UserRound,
        module: "overview",
        description:
          "Update your contact details, photo, biography, qualifications, experience, and expertise.",
      },
      {
        id: "account-settings",
        label: "Account Settings",
        icon: Settings,
        module: "overview",
        description:
          "Configure personal language, timezone, and teaching notification preferences.",
      },
      {
        id: "change-password",
        label: "Change Password",
        icon: KeyRound,
        module: "overview",
        description:
          "Verify your current password and update your account credentials securely.",
      },
    ],
  },
];

export const ALL_INSTRUCTOR_SUBMENU_ITEMS: Array<
  InstructorNavItem & { groupId: InstructorGroupId; groupLabel: string }
> = INSTRUCTOR_NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => ({ ...item, groupId: group.id, groupLabel: group.label })),
);

export function findInstructorNavMeta(id: InstructorSubmenuId) {
  return (
    ALL_INSTRUCTOR_SUBMENU_ITEMS.find((item) => item.id === id) ?? ALL_INSTRUCTOR_SUBMENU_ITEMS[0]!
  );
}
