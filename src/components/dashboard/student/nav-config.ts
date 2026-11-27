import type { LucideIcon } from "lucide-react";
import {
  Award,
  BarChart3,
  Bell,
  BookOpen,
  BookOpenCheck,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  Compass,
  CreditCard,
  FileCheck2,
  FileSpreadsheet,
  FolderOpen,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  Library,
  Mail,
  Megaphone,
  MessageSquare,
  MessageSquareHeart,
  PlayCircle,
  Receipt,
  Settings,
  UserRound,
  Video,
  Wallet,
} from "lucide-react";
import type { PermissionModule } from "@/lib/owner/types";
import type { StudentGroupId, StudentSubmenuId } from "@/lib/student/types";

export interface StudentSubmenuItem {
  id: StudentSubmenuId;
  label: string;
  icon: LucideIcon;
  module: PermissionModule;
  description: string;
}

export interface StudentNavGroup {
  id: StudentGroupId;
  label: string;
  icon: LucideIcon;
  items: StudentSubmenuItem[];
}

export const STUDENT_NAV_GROUPS: StudentNavGroup[] = [
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
          "Personalized summary of courses, upcoming classes, attendance, grades, fees, and announcements.",
      },
    ],
  },
  {
    id: "learning",
    label: "My Learning",
    icon: BookOpenCheck,
    items: [
      {
        id: "my-courses",
        label: "My Courses",
        icon: BookOpen,
        module: "courses",
        description:
          "Enrolled courses, subjects, instructors, learning objectives, lessons, and completion status.",
      },
      {
        id: "explore-courses",
        label: "Explore Courses",
        icon: Compass,
        module: "enrollments",
        description:
          "Search catalog courses by subject, level, or instructor and submit enrollment requests.",
      },
      {
        id: "continue-learning",
        label: "Continue Learning",
        icon: PlayCircle,
        module: "courses",
        description:
          "Resume from your last accessed or next unfinished lesson with automatic progress updates.",
      },
      {
        id: "course-materials",
        label: "Course Materials",
        icon: FolderOpen,
        module: "courses",
        description:
          "Download or preview instructor-shared videos, PDFs, slides, and notes by topic.",
      },
      {
        id: "elearning-resources",
        label: "E-Learning Resources",
        icon: Library,
        module: "resources",
        description:
          "Browse authorized digital guides, references, and supplementary study materials.",
      },
      {
        id: "live-classes",
        label: "Live Classes",
        icon: Video,
        module: "courses",
        description:
          "Join live sessions for your enrolled courses and revisit shared session recordings.",
      },
      {
        id: "learning-schedule",
        label: "My Learning Schedule",
        icon: CalendarRange,
        module: "academics",
        description:
          "Combined daily, weekly, and monthly agenda for lessons, classes, assignments, and exams.",
      },
    ],
  },
  {
    id: "academics",
    label: "Academic Activities",
    icon: GraduationCap,
    items: [
      {
        id: "my-timetable",
        label: "My Timetable",
        icon: CalendarClock,
        module: "timetables",
        description:
          "Daily and weekly class schedule with times, rooms, live links, and assigned instructors.",
      },
      {
        id: "my-attendance",
        label: "My Attendance",
        icon: CalendarDays,
        module: "attendance",
        description:
          "Personal attendance log, rates by course, and attendance discrepancy reporting.",
      },
      {
        id: "my-assignments",
        label: "My Assignments",
        icon: ClipboardList,
        module: "exams",
        description:
          "Assignment briefs, due dates, online submissions, and instructor grading feedback.",
      },
      {
        id: "quizzes-exams",
        label: "Quizzes & Exams",
        icon: ClipboardCheck,
        module: "exams",
        description:
          "Active and upcoming online assessments with instructions, timers, and submissions.",
      },
      {
        id: "exam-results",
        label: "Exam Results",
        icon: FileCheck2,
        module: "grades",
        description:
          "Released quiz and examination scores, pass or review status, and instructor remarks.",
      },
      {
        id: "grades-report-cards",
        label: "My Grades & Report Cards",
        icon: FileSpreadsheet,
        module: "grades",
        description:
          "Course grade breakdowns by term and downloadable or printable academic report cards.",
      },
      {
        id: "learning-progress",
        label: "Learning Progress",
        icon: BarChart3,
        module: "courses",
        description:
          "Lesson completion milestones, assessment progress, and study pace across courses.",
      },
      {
        id: "my-certificates",
        label: "My Certificates",
        icon: Award,
        module: "certificates",
        description:
          "Official earned completion certificates with verification codes and printable copies.",
      },
    ],
  },
  {
    id: "communication",
    label: "Communication",
    icon: MessageSquare,
    items: [
      {
        id: "messages",
        label: "Messages",
        icon: Mail,
        module: "communication",
        description:
          "Private inbox and sent messages with your course instructors and academy staff.",
      },
      {
        id: "parent-communication",
        label: "Parent Communication",
        icon: MessageSquareHeart,
        module: "communication",
        description:
          "View messages shared with your linked parent or guardian and send direct replies.",
      },
      {
        id: "discussion-forums",
        label: "Discussion Forums",
        icon: MessageSquare,
        module: "communication",
        description:
          "Course topic discussions, questions, and peer learning threads in enrolled courses.",
      },
      {
        id: "announcements",
        label: "Announcements",
        icon: Megaphone,
        module: "communication",
        description:
          "Important course, class, and academy-wide announcements with publication dates.",
      },
      {
        id: "notifications",
        label: "Notifications",
        icon: Bell,
        module: "overview",
        description:
          "Real-time alerts for deadlines, released grades, enrollment decisions, and fee updates.",
      },
    ],
  },
  {
    id: "finance",
    label: "Fees & Payments",
    icon: Wallet,
    items: [
      {
        id: "my-fees",
        label: "My Fees",
        icon: Wallet,
        module: "finance",
        description:
          "Tuition plans, discounts, paid totals, and pending or overdue student balances.",
      },
      {
        id: "make-payment",
        label: "Make a Payment",
        icon: CreditCard,
        module: "finance",
        description:
          "Pay tuition online or via bank transfer and upload your payment receipt for review.",
      },
      {
        id: "payment-history",
        label: "Payment History",
        icon: Receipt,
        module: "finance",
        description:
          "Chronological log of all submitted and verified fee or course transactions.",
      },
      {
        id: "invoices-receipts",
        label: "Invoices & Receipts",
        icon: FileCheck2,
        module: "finance",
        description:
          "View and print itemized tuition invoices and verified receipt confirmations.",
      },
    ],
  },
  {
    id: "account",
    label: "My Account",
    icon: UserRound,
    items: [
      {
        id: "my-profile",
        label: "My Profile",
        icon: UserRound,
        module: "overview",
        description:
          "Personal student ID, class assignment, editable contact details, and correction requests.",
      },
      {
        id: "account-settings",
        label: "Account Settings",
        icon: Settings,
        module: "overview",
        description:
          "Language, timezone, and email or in-app learning notification preferences.",
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

export const ALL_STUDENT_SUBMENU_ITEMS: (StudentSubmenuItem & {
  groupId: StudentGroupId;
  groupLabel: string;
})[] = STUDENT_NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => ({
    ...item,
    groupId: group.id,
    groupLabel: group.label,
  })),
);

export function findStudentNavMeta(id: StudentSubmenuId) {
  return (
    ALL_STUDENT_SUBMENU_ITEMS.find((item) => item.id === id) ?? ALL_STUDENT_SUBMENU_ITEMS[0]!
  );
}
