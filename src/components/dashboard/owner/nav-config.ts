import type { LucideIcon } from "lucide-react";
import {
  Activity,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CalendarClock,
  CalendarRange,
  ClipboardCheck,
  CreditCard,
  FileSpreadsheet,
  FolderKanban,
  GraduationCap,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  Lock,
  Mail,
  Megaphone,
  MessageSquareHeart,
  Plug,
  Receipt,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Tags,
  UserCheck,
  UserCog,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import type { MenuGroupId, OwnerSubmenuId, PermissionModule } from "@/lib/owner/types";

export interface NavSubItem {
  id: OwnerSubmenuId;
  label: string;
  icon: LucideIcon;
  module: PermissionModule;
  description: string;
}

export interface NavGroup {
  id: MenuGroupId;
  label: string;
  icon: LucideIcon;
  items: NavSubItem[];
}

export const OWNER_NAV_GROUPS: NavGroup[] = [
  {
    id: "dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
    items: [
      {
        id: "overview",
        label: "Academy Overview",
        icon: LayoutDashboard,
        module: "overview",
        description: "Live KPIs, revenue, enrollments, attendance, grades, and system updates.",
      },
    ],
  },
  {
    id: "reports",
    label: "Reports & Analytics",
    icon: BarChart3,
    items: [
      {
        id: "reports",
        label: "Reports & Analytics",
        icon: BarChart3,
        module: "reports",
        description:
          "Academic, financial, attendance, enrollment, and operational reports with Excel & PDF export.",
      },
    ],
  },
  {
    id: "academy",
    label: "Academy Management",
    icon: GraduationCap,
    items: [
      {
        id: "users",
        label: "User Management",
        icon: Users,
        module: "users",
        description: "Create, edit, delete users, assign all 5 roles, and control account status.",
      },
      {
        id: "students",
        label: "Student Records",
        icon: GraduationCap,
        module: "students",
        description: "Student profiles, enrollment history, course progress, and record exports.",
      },
      {
        id: "instructors",
        label: "Instructor Management",
        icon: UserCheck,
        module: "instructors",
        description: "Instructor qualifications, course assignments, schedules, and performance.",
      },
      {
        id: "parents",
        label: "Parent Management",
        icon: Users,
        module: "parents",
        description: "Manage parent accounts, link children, and review child academic info.",
      },
      {
        id: "academics",
        label: "Academic Management",
        icon: CalendarRange,
        module: "academics",
        description: "Academic years, semesters, departments, classes, sections, and calendar.",
      },
      {
        id: "courses",
        label: "Course Management",
        icon: BookOpen,
        module: "courses",
        description: "Create, publish, archive, delete courses, pricing, objectives, and lessons.",
      },
      {
        id: "subjects",
        label: "Subjects & Categories",
        icon: Tags,
        module: "subjects",
        description: "Organize subjects, categories, subcategories, and course mappings.",
      },
      {
        id: "timetables",
        label: "Timetables & Scheduling",
        icon: CalendarClock,
        module: "timetables",
        description: "Class schedules, exams, and live classes with automatic conflict detection.",
      },
      {
        id: "attendance",
        label: "Attendance Tracking",
        icon: ClipboardCheck,
        module: "attendance",
        description:
          "Student & instructor attendance recording, percentages, and filtered reports.",
      },
      {
        id: "grades",
        label: "Grades & Report Cards",
        icon: Award,
        module: "grades",
        description: "Grading scales, assessments, weighted averages, and printable report cards.",
      },
      {
        id: "resources",
        label: "E-Learning Resources",
        icon: FolderKanban,
        module: "resources",
        description: "Manage videos, PDFs, docs, presentations, and role-based access rules.",
      },
    ],
  },
  {
    id: "finance",
    label: "Finance & Payments",
    icon: Wallet,
    items: [
      {
        id: "fees-payments",
        label: "Fees & Payments",
        icon: Wallet,
        module: "finance",
        description:
          "Fee plans, discounts, due dates, partial/overdue tracking, and receipt reviews.",
      },
      {
        id: "invoices",
        label: "Invoices & Receipts",
        icon: Receipt,
        module: "finance",
        description: "Generate, search, print, and download academy invoices and payment receipts.",
      },
      {
        id: "transactions",
        label: "Revenue & Transactions",
        icon: CreditCard,
        module: "finance",
        description:
          "Monitor income ledger across successful, pending, failed, and refunded items.",
      },
      {
        id: "financial-reports",
        label: "Financial Reports",
        icon: FileSpreadsheet,
        module: "finance",
        description: "Revenue, outstanding balances, and refund analytics with PDF & Excel export.",
      },
    ],
  },
  {
    id: "communication",
    label: "Communication",
    icon: Mail,
    items: [
      {
        id: "parent-comm",
        label: "Parent Communication",
        icon: MessageSquareHeart,
        module: "communication",
        description: "Direct parent messaging with student attendance and progress snapshots.",
      },
      {
        id: "messages",
        label: "Messages",
        icon: Mail,
        module: "communication",
        description: "Private academy inbox, conversation history, archive, and read tracking.",
      },
      {
        id: "announcements",
        label: "Announcements",
        icon: Megaphone,
        module: "communication",
        description: "Create, publish, or schedule announcements targeted to roles or classes.",
      },
      {
        id: "notifications",
        label: "Notifications",
        icon: Bell,
        module: "communication",
        description: "Broadcast system notifications to users or groups and manage read states.",
      },
      {
        id: "support",
        label: "Support & Feedback",
        icon: LifeBuoy,
        module: "communication",
        description: "Review inquiries, assign admins, update ticket statuses, and save replies.",
      },
    ],
  },
  {
    id: "platform",
    label: "Platform Management",
    icon: Settings,
    items: [
      {
        id: "roles-permissions",
        label: "Roles & Permissions",
        icon: ShieldCheck,
        module: "platform",
        description: "Configure module and action access permissions across all 5 academy roles.",
      },
      {
        id: "system-settings",
        label: "System Settings",
        icon: SlidersHorizontal,
        module: "platform",
        description: "Platform defaults, security & auth policy, currency, timezone, and alerts.",
      },
      {
        id: "academy-profile",
        label: "Academy Profile",
        icon: Building2,
        module: "platform",
        description:
          "Academy name, branding logo, contact channels, social links, and instructions.",
      },
      {
        id: "integrations",
        label: "Integrations",
        icon: Plug,
        module: "platform",
        description: "Payment gateways, email delivery, and live video service configurations.",
      },
      {
        id: "audit-logs",
        label: "Audit Logs",
        icon: Activity,
        module: "audit",
        description: "Searchable audit trail of administrative, financial, and security actions.",
      },
    ],
  },
  {
    id: "account",
    label: "My Account",
    icon: UserCog,
    items: [
      {
        id: "my-profile",
        label: "My Profile",
        icon: UserRound,
        module: "overview",
        description: "Manage your personal name, photo, phone, and biography.",
      },
      {
        id: "account-settings",
        label: "Account Settings",
        icon: Settings,
        module: "overview",
        description: "Personal language, timezone, and notification delivery preferences.",
      },
      {
        id: "change-password",
        label: "Change Password",
        icon: KeyRound,
        module: "overview",
        description: "Verify your current password and update sign-in credentials securely.",
      },
    ],
  },
];

export const ALL_SUBMENU_ITEMS: Array<NavSubItem & { groupId: MenuGroupId; groupLabel: string }> =
  OWNER_NAV_GROUPS.flatMap((group) =>
    group.items.map((item) => ({ ...item, groupId: group.id, groupLabel: group.label })),
  );

export function findNavMeta(id: OwnerSubmenuId) {
  return ALL_SUBMENU_ITEMS.find((item) => item.id === id) ?? ALL_SUBMENU_ITEMS[0]!;
}

export { Lock };
