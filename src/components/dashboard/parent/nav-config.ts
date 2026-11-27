import type { LucideIcon } from "lucide-react";
import {
  ArrowLeftRight,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  BookOpenCheck,
  CalendarClock,
  CalendarDays,
  ClipboardCheck,
  CreditCard,
  FileCheck2,
  FileSpreadsheet,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  Library,
  Link2,
  Mail,
  Megaphone,
  MessageSquare,
  Receipt,
  Settings,
  ShieldCheck,
  TrendingUp,
  UserCheck,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import type { PermissionModule } from "@/lib/owner/types";
import type { ParentGroupId, ParentSubmenuId } from "@/lib/parent/types";

export interface ParentSubmenuItem {
  id: ParentSubmenuId;
  label: string;
  icon: LucideIcon;
  module: PermissionModule;
  description: string;
}

export interface ParentNavGroup {
  id: ParentGroupId;
  label: string;
  icon: LucideIcon;
  items: ParentSubmenuItem[];
}

export const PARENT_NAV_GROUPS: ParentNavGroup[] = [
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
          "Family overview of linked children, learning progress, attendance, grades, fees, and updates.",
      },
    ],
  },
  {
    id: "children",
    label: "My Children",
    icon: Users,
    items: [
      {
        id: "all-children",
        label: "All My Children",
        icon: Users,
        module: "students",
        description:
          "Overview of all officially linked children, student IDs, classes, and enrollment status.",
      },
      {
        id: "child-profiles",
        label: "Child Profiles",
        icon: UserCheck,
        module: "students",
        description:
          "Personal student details, contact metadata, assigned instructors, and correction requests.",
      },
      {
        id: "academic-info",
        label: "Academic Information",
        icon: GraduationCap,
        module: "academics",
        description:
          "Active courses, subjects, academic year, semester, class section, and printable summary.",
      },
      {
        id: "switch-child",
        label: "Switch Child",
        icon: ArrowLeftRight,
        module: "overview",
        description:
          "Select which linked child to focus across academic monitoring, attendance, grades, and fees.",
      },
    ],
  },
  {
    id: "academic-monitoring",
    label: "Academic Monitoring",
    icon: BookOpenCheck,
    items: [
      {
        id: "enrolled-courses",
        label: "Enrolled Courses",
        icon: BookOpen,
        module: "courses",
        description:
          "Active courses for the selected child, instructors, objectives, and lesson breakdown.",
      },
      {
        id: "course-progress",
        label: "Course Progress",
        icon: TrendingUp,
        module: "courses",
        description:
          "Completion percentages, completed vs remaining lessons, and study activity timeline.",
      },
      {
        id: "timetables",
        label: "Timetables & Scheduling",
        icon: CalendarClock,
        module: "timetables",
        description:
          "Daily and weekly class schedule, upcoming live sessions, and scheduled examinations.",
      },
      {
        id: "attendance-tracking",
        label: "Attendance Tracking",
        icon: CalendarDays,
        module: "attendance",
        description:
          "Daily and monthly attendance logs, absence trends, and attendance discrepancy reports.",
      },
      {
        id: "grades-report-cards",
        label: "Grades & Report Cards",
        icon: FileSpreadsheet,
        module: "grades",
        description:
          "Term and course grade breakdowns with downloadable CSV and printable report cards.",
      },
      {
        id: "assignments-exams",
        label: "Assignments & Exams",
        icon: ClipboardCheck,
        module: "exams",
        description:
          "Upcoming deadlines, submission status, pending tasks, and instructor evaluation notes.",
      },
      {
        id: "exam-results",
        label: "Examination Results",
        icon: FileCheck2,
        module: "grades",
        description:
          "Released quiz and exam scores, pass or support status, and term comparison.",
      },
      {
        id: "learning-progress",
        label: "Learning Progress",
        icon: BarChart3,
        module: "courses",
        description:
          "Overall academic momentum, milestone completion, and subjects needing extra support.",
      },
      {
        id: "certificates",
        label: "Certificates & Achievements",
        icon: Award,
        module: "certificates",
        description:
          "Earned course completion certificates with verification codes and printable views.",
      },
      {
        id: "elearning-resources",
        label: "E-Learning Resources",
        icon: Library,
        module: "resources",
        description:
          "Approved study guides, videos, PDFs, and shared materials supporting your child's courses.",
      },
    ],
  },
  {
    id: "finance",
    label: "Fees & Payments",
    icon: Wallet,
    items: [
      {
        id: "child-fees",
        label: "Child's Fees",
        icon: Wallet,
        module: "finance",
        description:
          "Detailed tuition plans, discounts, due dates, paid amounts, and balances per child.",
      },
      {
        id: "make-payment",
        label: "Make a Payment",
        icon: CreditCard,
        module: "finance",
        description:
          "Pay tuition or course access for a linked child and upload payment proof for review.",
      },
      {
        id: "payment-history",
        label: "Payment History",
        icon: Receipt,
        module: "finance",
        description:
          "Complete chronological record of submitted and approved payments across linked children.",
      },
      {
        id: "outstanding-balances",
        label: "Outstanding Balances",
        icon: ShieldCheck,
        module: "finance",
        description:
          "Summary of pending or overdue balances per child with quick payment actions.",
      },
      {
        id: "invoices-receipts",
        label: "Invoices & Receipts",
        icon: FileCheck2,
        module: "finance",
        description:
          "View, verify, and print itemized tuition invoices and official payment receipts.",
      },
    ],
  },
  {
    id: "communication",
    label: "Parent Communication",
    icon: MessageSquare,
    items: [
      {
        id: "messages-instructors",
        label: "Messages to Instructors",
        icon: Mail,
        module: "communication",
        description:
          "Direct inbox and sent messages with instructors teaching your linked children.",
      },
      {
        id: "messages-admin",
        label: "Messages to Admin",
        icon: MessageSquare,
        module: "communication",
        description:
          "Communicate directly with academy administrators regarding records, fees, or support.",
      },
      {
        id: "teacher-communication",
        label: "Teacher Communication",
        icon: Users,
        module: "communication",
        description:
          "Child-specific teacher progress notes, behavioral updates, and guardian responses.",
      },
      {
        id: "academy-announcements",
        label: "Academy Announcements",
        icon: Megaphone,
        module: "communication",
        description:
          "Academy-wide, parent, and class announcements filtered for relevance and dates.",
      },
      {
        id: "notifications",
        label: "Notifications",
        icon: Bell,
        module: "overview",
        description:
          "Real-time alerts for attendance, grade releases, exam schedules, fees, and messages.",
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
          "Parent contact profile, avatar, relationship details, and correction requests.",
      },
      {
        id: "linked-children",
        label: "Linked Children",
        icon: Link2,
        module: "overview",
        description:
          "Official parent–child links and verified requests to add or correct a child link.",
      },
      {
        id: "account-settings",
        label: "Account Settings",
        icon: Settings,
        module: "overview",
        description:
          "Language, timezone, email alerts, and in-app notification preferences.",
      },
      {
        id: "change-password",
        label: "Change Password",
        icon: KeyRound,
        module: "overview",
        description:
          "Verify your current password and update your parent account password securely.",
      },
    ],
  },
];

export const ALL_PARENT_SUBMENU_ITEMS: (ParentSubmenuItem & {
  groupId: ParentGroupId;
  groupLabel: string;
})[] = PARENT_NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => ({
    ...item,
    groupId: group.id,
    groupLabel: group.label,
  })),
);

export function findParentNavMeta(id: ParentSubmenuId) {
  return ALL_PARENT_SUBMENU_ITEMS.find((item) => item.id === id) ?? ALL_PARENT_SUBMENU_ITEMS[0]!;
}
