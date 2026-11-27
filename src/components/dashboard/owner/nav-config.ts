import type { LucideIcon } from "lucide-react";
import {
  Activity,
  AlertCircle,
  Award,
  BarChart3,
  Bell,
  BookOpen,
  Building2,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ClipboardCheck,
  ClipboardList,
  CreditCard,
  FileSpreadsheet,
  FolderKanban,
  FolderTree,
  GraduationCap,
  Inbox,
  KeyRound,
  Layers,
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
  UserPlus,
  UserRound,
  Users,
  Wallet,
} from "lucide-react";
import type { AppRole } from "@/lib/auth";
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
          "Academic, student, financial, attendance, enrollment, and operational reports with Excel & PDF export.",
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
        description: "Create, edit, delete users, assign roles, and control account status.",
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
        id: "course-enrollment",
        label: "Enrollment Management",
        icon: UserPlus,
        module: "enrollments",
        description:
          "Enroll students into courses, register learners, review enrollment requests, and assign classes.",
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
        id: "exams",
        label: "Examinations & Assessments",
        icon: ClipboardList,
        module: "exams",
        description: "Create exams & quizzes, build question banks, grade submissions, and monitor scores.",
      },
      {
        id: "resources",
        label: "E-Learning Resources",
        icon: FolderKanban,
        module: "resources",
        description: "Manage videos, PDFs, docs, presentations, and role-based access rules.",
      },
      {
        id: "certificates",
        label: "Certificates",
        icon: Award,
        module: "certificates",
        description: "Issue completion certificates, manage templates, verify codes, and print PDFs.",
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
        id: "outstanding-balances",
        label: "Outstanding Balances",
        icon: AlertCircle,
        module: "finance",
        description: "Track unpaid and overdue balances, record settlements, and send reminders.",
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
        description: "Configure module and action access permissions across all academy roles.",
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

export const ADMIN_NAV_GROUPS: NavGroup[] = [
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
          "Daily operations overview across students, instructors, classes, enrollments, payments, and recent updates.",
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
          "Generate, filter, visualize, and export academic, student, enrollment, attendance, and financial reports.",
      },
    ],
  },
  {
    id: "users",
    label: "User Management",
    icon: Users,
    items: [
      {
        id: "users",
        label: "All Users",
        icon: Users,
        module: "users",
        description: "View, create, edit, search, filter, and activate or suspend academy accounts.",
      },
      {
        id: "students",
        label: "Student Management",
        icon: GraduationCap,
        module: "students",
        description: "Register and manage student accounts, profiles, status, and academic history.",
      },
      {
        id: "instructors",
        label: "Instructor Management",
        icon: UserCheck,
        module: "instructors",
        description: "Manage instructor qualifications, expertise, schedules, and assigned courses.",
      },
      {
        id: "parents",
        label: "Parent Management",
        icon: Users,
        module: "parents",
        description: "Create parent accounts, record contact info, and link children.",
      },
      {
        id: "user-roles",
        label: "User Roles",
        icon: UserCog,
        module: "users",
        description: "Inspect role access levels and assign permitted roles to users.",
      },
      {
        id: "user-permissions",
        label: "User Permissions",
        icon: ShieldCheck,
        module: "platform",
        description: "Review and manage role permissions according to Owner-granted authority.",
      },
    ],
  },
  {
    id: "academics",
    label: "Academic Management",
    icon: GraduationCap,
    items: [
      {
        id: "student-records",
        label: "Student Records",
        icon: GraduationCap,
        module: "students",
        description: "Manage student records, academic details, progress, and exports.",
      },
      {
        id: "courses",
        label: "Course Management",
        icon: BookOpen,
        module: "courses",
        description: "Create, edit, publish, archive courses, objectives, instructors, and lessons.",
      },
      {
        id: "subjects",
        label: "Subjects & Categories",
        icon: Tags,
        module: "subjects",
        description: "Create, edit, delete subjects, categories, and course mappings.",
      },
      {
        id: "classes-sections",
        label: "Classes & Sections",
        icon: FolderTree,
        module: "academics",
        description: "Create classes and sections, set capacity, and assign instructors and learners.",
      },
      {
        id: "academic-years",
        label: "Academic Years",
        icon: CalendarRange,
        module: "academics",
        description: "Create, activate, or close academic years and connect semesters.",
      },
      {
        id: "semesters-terms",
        label: "Semesters & Terms",
        icon: Layers,
        module: "academics",
        description: "Manage semesters and academic terms with active period dates.",
      },
      {
        id: "timetables",
        label: "Timetables & Scheduling",
        icon: CalendarClock,
        module: "timetables",
        description: "Schedule lessons, exams, and live classes with conflict detection.",
      },
      {
        id: "attendance",
        label: "Attendance Tracking",
        icon: ClipboardCheck,
        module: "attendance",
        description: "Record and filter student and instructor attendance percentages.",
      },
      {
        id: "grades",
        label: "Grades & Report Cards",
        icon: Award,
        module: "grades",
        description: "Record marks, manage grading scales, and generate printable report cards.",
      },
      {
        id: "exams",
        label: "Examinations & Assessments",
        icon: ClipboardList,
        module: "exams",
        description: "Create exams and quizzes, manage questions, grade submissions, and track completion.",
      },
      {
        id: "resources",
        label: "E-Learning Resources",
        icon: FolderKanban,
        module: "resources",
        description: "Upload and organize videos, PDFs, docs, and access controls.",
      },
      {
        id: "certificates",
        label: "Certificates",
        icon: Award,
        module: "certificates",
        description: "Manage templates, check eligibility, issue certificates, and print PDFs.",
      },
    ],
  },
  {
    id: "enrollments",
    label: "Enrollment Management",
    icon: CalendarDays,
    items: [
      {
        id: "course-enrollment",
        label: "Course Enrollment",
        icon: BookOpen,
        module: "enrollments",
        description: "Enroll students in courses, manage active/completed statuses, and view history.",
      },
      {
        id: "student-registration",
        label: "Student Registration",
        icon: UserPlus,
        module: "enrollments",
        description: "Complete student admissions with class and course placement.",
      },
      {
        id: "enrollment-requests",
        label: "Enrollment Requests",
        icon: Inbox,
        module: "enrollments",
        description: "Review, approve, or reject incoming enrollment requests and notify learners.",
      },
      {
        id: "class-assignments",
        label: "Class Assignments",
        icon: FolderTree,
        module: "enrollments",
        description: "Assign and transfer students across classes and cohort sections.",
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
        description: "Manage student fee plans, discounts, payment receipts, and verification.",
      },
      {
        id: "invoices",
        label: "Invoices & Receipts",
        icon: Receipt,
        module: "finance",
        description: "Generate, search, print, and download invoices and payment receipts.",
      },
      {
        id: "transactions",
        label: "Payment History",
        icon: CreditCard,
        module: "finance",
        description: "Track complete payment history across approved, pending, and refunded items.",
      },
      {
        id: "outstanding-balances",
        label: "Outstanding Balances",
        icon: AlertCircle,
        module: "finance",
        description: "Monitor unpaid and overdue student balances and send payment reminders.",
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
        description: "Message parents directly with attendance and progress snapshots.",
      },
      {
        id: "messages",
        label: "Messages",
        icon: Mail,
        module: "communication",
        description: "Internal messaging inbox across instructors, admins, parents, and students.",
      },
      {
        id: "announcements",
        label: "Announcements",
        icon: Megaphone,
        module: "communication",
        description: "Publish and manage academy-wide or class-targeted announcements.",
      },
      {
        id: "notifications",
        label: "Notifications",
        icon: Bell,
        module: "communication",
        description: "Send system alerts and manage notification read status.",
      },
      {
        id: "support",
        label: "Support & Feedback",
        icon: LifeBuoy,
        module: "communication",
        description: "Manage support inquiries, assign handlers, and respond to feedback.",
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
        description: "Manage your personal profile, photo, phone, and biography.",
      },
      {
        id: "account-settings",
        label: "Account Settings",
        icon: Settings,
        module: "overview",
        description: "Configure your language, timezone, and notification preferences.",
      },
      {
        id: "change-password",
        label: "Change Password",
        icon: KeyRound,
        module: "overview",
        description: "Update your sign-in password securely.",
      },
    ],
  },
];

export const ALL_SUBMENU_ITEMS: Array<NavSubItem & { groupId: MenuGroupId; groupLabel: string }> =
  OWNER_NAV_GROUPS.flatMap((group) =>
    group.items.map((item) => ({ ...item, groupId: group.id, groupLabel: group.label })),
  );

export const ALL_ADMIN_SUBMENU_ITEMS: Array<
  NavSubItem & { groupId: MenuGroupId; groupLabel: string }
> = ADMIN_NAV_GROUPS.flatMap((group) =>
  group.items.map((item) => ({ ...item, groupId: group.id, groupLabel: group.label })),
);

export const COMBINED_SUBMENU_ITEMS = [...ALL_SUBMENU_ITEMS, ...ALL_ADMIN_SUBMENU_ITEMS];

export function getNavGroupsForRole(role: AppRole): NavGroup[] {
  return role === "admin" ? ADMIN_NAV_GROUPS : OWNER_NAV_GROUPS;
}

export function findNavMeta(id: OwnerSubmenuId, role: AppRole = "owner") {
  const list = role === "admin" ? ALL_ADMIN_SUBMENU_ITEMS : ALL_SUBMENU_ITEMS;
  return (
    list.find((item) => item.id === id) ??
    COMBINED_SUBMENU_ITEMS.find((item) => item.id === id) ??
    list[0]!
  );
}

export { Lock };
