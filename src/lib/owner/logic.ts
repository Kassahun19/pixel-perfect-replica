import type { AppRole } from "@/lib/auth";
import type {
  AssignmentSubmission,
  AttendanceRecord,
  CourseAssignment,
  CourseRow,
  ExamAssessment,
  ExamSubmission,
  FeePlan,
  FeeStatus,
  GradeEntry,
  GradingBand,
  GradingScale,
  InstructorPayout,
  ModulePermissions,
  PermissionAction,
  PermissionModule,
  RolePermissionMatrix,
  TimetableSlot,
} from "./types";

export const ALL_PERMISSION_MODULES: PermissionModule[] = [
  "overview",
  "reports",
  "users",
  "students",
  "instructors",
  "parents",
  "academics",
  "courses",
  "subjects",
  "timetables",
  "attendance",
  "grades",
  "exams",
  "resources",
  "certificates",
  "enrollments",
  "finance",
  "communication",
  "platform",
  "audit",
];

export const ALL_PERMISSION_ACTIONS: PermissionAction[] = [
  "view",
  "create",
  "edit",
  "delete",
  "export",
  "approve",
];

const fullPerms = (): ModulePermissions => ({
  view: true,
  create: true,
  edit: true,
  delete: true,
  export: true,
  approve: true,
});

const readOnlyPerms = (allowExport = false): ModulePermissions => ({
  view: true,
  create: false,
  edit: false,
  delete: false,
  export: allowExport,
  approve: false,
});

const nonePerms = (): ModulePermissions => ({
  view: false,
  create: false,
  edit: false,
  delete: false,
  export: false,
  approve: false,
});

export function createDefaultRolePermissions(): RolePermissionMatrix {
  const ownerModules = Object.fromEntries(
    ALL_PERMISSION_MODULES.map((m) => [m, fullPerms()]),
  ) as Record<PermissionModule, ModulePermissions>;

  const adminModules = Object.fromEntries(
    ALL_PERMISSION_MODULES.map((m) => {
      if (m === "platform") {
        return [m, { ...readOnlyPerms(false), edit: false }];
      }
      return [m, fullPerms()];
    }),
  ) as Record<PermissionModule, ModulePermissions>;

  const instructorModules: Record<PermissionModule, ModulePermissions> = {
    overview: readOnlyPerms(false),
    reports: readOnlyPerms(true),
    users: nonePerms(),
    students: readOnlyPerms(true),
    instructors: readOnlyPerms(false),
    parents: nonePerms(),
    academics: readOnlyPerms(false),
    courses: { view: true, create: true, edit: true, delete: false, export: true, approve: false },
    subjects: readOnlyPerms(false),
    timetables: readOnlyPerms(false),
    attendance: {
      view: true,
      create: true,
      edit: true,
      delete: false,
      export: true,
      approve: false,
    },
    grades: { view: true, create: true, edit: true, delete: false, export: true, approve: false },
    exams: { view: true, create: true, edit: true, delete: false, export: true, approve: false },
    resources: {
      view: true,
      create: true,
      edit: true,
      delete: true,
      export: false,
      approve: false,
    },
    certificates: readOnlyPerms(false),
    enrollments: readOnlyPerms(false),
    finance: nonePerms(),
    communication: {
      view: true,
      create: true,
      edit: true,
      delete: false,
      export: false,
      approve: false,
    },
    platform: nonePerms(),
    audit: nonePerms(),
  };

  const parentModules: Record<PermissionModule, ModulePermissions> = {
    overview: readOnlyPerms(false),
    reports: nonePerms(),
    users: nonePerms(),
    students: readOnlyPerms(false),
    instructors: nonePerms(),
    parents: nonePerms(),
    academics: readOnlyPerms(false),
    courses: readOnlyPerms(false),
    subjects: readOnlyPerms(false),
    timetables: readOnlyPerms(false),
    attendance: readOnlyPerms(false),
    grades: readOnlyPerms(true),
    exams: readOnlyPerms(false),
    resources: readOnlyPerms(false),
    certificates: readOnlyPerms(true),
    enrollments: readOnlyPerms(false),
    finance: {
      view: true,
      create: true,
      edit: false,
      delete: false,
      export: true,
      approve: false,
    },
    communication: {
      view: true,
      create: true,
      edit: false,
      delete: false,
      export: false,
      approve: false,
    },
    platform: nonePerms(),
    audit: nonePerms(),
  };

  const studentModules: Record<PermissionModule, ModulePermissions> = {
    overview: readOnlyPerms(false),
    reports: nonePerms(),
    users: nonePerms(),
    students: nonePerms(),
    instructors: nonePerms(),
    parents: nonePerms(),
    academics: readOnlyPerms(false),
    courses: readOnlyPerms(false),
    subjects: readOnlyPerms(false),
    timetables: readOnlyPerms(false),
    attendance: readOnlyPerms(false),
    grades: readOnlyPerms(true),
    exams: { view: true, create: true, edit: true, delete: false, export: false, approve: false },
    resources: readOnlyPerms(false),
    certificates: readOnlyPerms(true),
    enrollments: {
      view: true,
      create: true,
      edit: false,
      delete: false,
      export: false,
      approve: false,
    },
    finance: {
      view: true,
      create: true,
      edit: false,
      delete: false,
      export: true,
      approve: false,
    },
    communication: {
      view: true,
      create: true,
      edit: false,
      delete: false,
      export: false,
      approve: false,
    },
    platform: nonePerms(),
    audit: nonePerms(),
  };

  return {
    owner: ownerModules,
    admin: adminModules,
    instructor: instructorModules,
    parent: parentModules,
    student: studentModules,
  };
}

export function hasModulePermission(
  matrix: RolePermissionMatrix | undefined,
  roles: AppRole[],
  module: PermissionModule,
  action: PermissionAction,
): boolean {
  if (roles.includes("owner")) return true;
  const resolved = matrix ?? createDefaultRolePermissions();
  return roles.some((role) => resolved[role]?.[module]?.[action] === true);
}

function parseMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map((v) => Number(v));
  if (h === undefined || m === undefined || !Number.isFinite(h) || !Number.isFinite(m)) {
    return -1;
  }
  return h * 60 + m;
}

export interface TimetableConflict {
  existingSlot: TimetableSlot;
  reasons: string[];
}

export function detectTimetableConflicts(
  slots: TimetableSlot[],
  candidate: Omit<TimetableSlot, "id"> & { id?: string },
): TimetableConflict[] {
  const cStart = parseMinutes(candidate.startTime);
  const cEnd = parseMinutes(candidate.endTime);
  if (cStart < 0 || cEnd <= cStart) return [];

  const conflicts: TimetableConflict[] = [];
  for (const slot of slots) {
    if (candidate.id && slot.id === candidate.id) continue;
    if (slot.dayOfWeek !== candidate.dayOfWeek) continue;

    const sStart = parseMinutes(slot.startTime);
    const sEnd = parseMinutes(slot.endTime);
    if (sStart < 0 || sEnd <= sStart) continue;

    const overlaps = cStart < sEnd && sStart < cEnd;
    if (!overlaps) continue;

    const reasons: string[] = [];
    if (candidate.instructorId && slot.instructorId === candidate.instructorId) {
      reasons.push("Instructor already scheduled at this time");
    }
    if (candidate.classSectionId && slot.classSectionId === candidate.classSectionId) {
      reasons.push("Class section already has a session at this time");
    }
    if (
      candidate.room.trim() &&
      slot.room.trim() &&
      candidate.room.trim().toLowerCase() === slot.room.trim().toLowerCase()
    ) {
      reasons.push(`Room "${slot.room}" is occupied`);
    }

    if (reasons.length > 0) {
      conflicts.push({ existingSlot: slot, reasons });
    }
  }
  return conflicts;
}

export interface AttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  attendanceRate: number;
}

export function computeAttendanceStats(records: AttendanceRecord[]): AttendanceSummary {
  const total = records.length;
  let present = 0;
  let absent = 0;
  let late = 0;
  let excused = 0;

  for (const r of records) {
    if (r.status === "present") present += 1;
    else if (r.status === "absent") absent += 1;
    else if (r.status === "late") late += 1;
    else if (r.status === "excused") excused += 1;
  }

  // Late counts as attended (0.75 weight) or full presence; excused counts neutrally
  const effectiveDenominator = Math.max(0, total - excused);
  const attendanceRate =
    effectiveDenominator > 0
      ? Math.round(((present + late) / effectiveDenominator) * 1000) / 10
      : 0;

  return { total, present, absent, late, excused, attendanceRate };
}

export function resolveGradeBand(percent: number, scale: GradingScale): GradingBand {
  const clamped = Math.max(0, Math.min(100, percent));
  const sorted = [...scale.bands].sort((a, b) => b.minPercent - a.minPercent);
  for (const band of sorted) {
    if (clamped >= band.minPercent && clamped <= band.maxPercent) {
      return band;
    }
  }
  return (
    sorted[sorted.length - 1] ?? {
      letter: "F",
      minPercent: 0,
      maxPercent: 49,
      gpa: 0,
      remark: "Needs improvement",
    }
  );
}

export function computeGradeOutcome(score: number, maxScore: number, scale: GradingScale) {
  const safeMax = maxScore > 0 ? maxScore : 100;
  const percent = Math.round((score / safeMax) * 1000) / 10;
  const band = resolveGradeBand(percent, scale);
  return { percent, ...band };
}

export interface CourseReportCardLine {
  courseId: string;
  courseTitle: string;
  entries: GradeEntry[];
  weightedPercent: number;
  letter: string;
  gpa: number;
  remark: string;
}

export function buildReportCard(
  studentId: string,
  allGrades: GradeEntry[],
  scale: GradingScale,
  coursesById: Map<string, Pick<CourseRow, "id" | "title">>,
): { lines: CourseReportCardLine[]; overallPercent: number; overallGpa: number } {
  const studentGrades = allGrades.filter((g) => g.studentId === studentId);
  const byCourse = new Map<string, GradeEntry[]>();
  for (const g of studentGrades) {
    byCourse.set(g.courseId, [...(byCourse.get(g.courseId) ?? []), g]);
  }

  const lines: CourseReportCardLine[] = [];
  for (const [courseId, entries] of byCourse.entries()) {
    let weightSum = 0;
    let weightedTotal = 0;
    for (const entry of entries) {
      const w = entry.weight > 0 ? entry.weight : 1;
      const pct = entry.maxScore > 0 ? (entry.score / entry.maxScore) * 100 : 0;
      weightedTotal += pct * w;
      weightSum += w;
    }
    const weightedPercent = weightSum > 0 ? Math.round((weightedTotal / weightSum) * 10) / 10 : 0;
    const band = resolveGradeBand(weightedPercent, scale);
    lines.push({
      courseId,
      courseTitle: coursesById.get(courseId)?.title ?? "Course",
      entries,
      weightedPercent,
      letter: band.letter,
      gpa: band.gpa,
      remark: band.remark,
    });
  }

  const overallPercent =
    lines.length > 0
      ? Math.round((lines.reduce((s, l) => s + l.weightedPercent, 0) / lines.length) * 10) / 10
      : 0;
  const overallGpa =
    lines.length > 0
      ? Math.round((lines.reduce((s, l) => s + l.gpa, 0) / lines.length) * 100) / 100
      : 0;

  return { lines, overallPercent, overallGpa };
}

export function computeFeeBalance(amount: number, discount: number, paidAmount: number): number {
  const net = Math.max(0, Number(amount || 0) - Number(discount || 0));
  return Math.max(0, net - Number(paidAmount || 0));
}

export function computeFeeStatus(
  amount: number,
  discount: number,
  paidAmount: number,
  dueDate: string,
  todayIso = new Date().toISOString().slice(0, 10),
): FeeStatus {
  const net = Math.max(0, Number(amount || 0) - Number(discount || 0));
  const paid = Math.max(0, Number(paidAmount || 0));
  if (paid >= net && net >= 0) return "paid";
  if (dueDate && dueDate < todayIso) return "overdue";
  if (paid > 0) return "partial";
  return "unpaid";
}

export function summarizeFees(feePlans: FeePlan[]) {
  let billed = 0;
  let collected = 0;
  let outstanding = 0;
  let overdueCount = 0;

  for (const fee of feePlans) {
    const net = Math.max(0, fee.amount - fee.discount);
    const bal = computeFeeBalance(fee.amount, fee.discount, fee.paidAmount);
    billed += net;
    collected += Math.min(net, fee.paidAmount);
    outstanding += bal;
    if (fee.status === "overdue") overdueCount += 1;
  }

  return { billed, collected, outstanding, overdueCount };
}

export function nextInvoiceNumber(
  existingNumbers: string[],
  year = new Date().getFullYear(),
): string {
  const prefix = `INV-${year}-`;
  let maxSeq = 0;
  for (const num of existingNumbers) {
    if (num.startsWith(prefix)) {
      const parsed = Number.parseInt(num.slice(prefix.length), 10);
      if (Number.isFinite(parsed) && parsed > maxSeq) maxSeq = parsed;
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
}

export function maskSecret(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";
  if (trimmed.length <= 4) return "••••";
  return `••••••••${trimmed.slice(-4)}`;
}

export function nextCertificateCode(
  existingCodes: string[],
  year = new Date().getFullYear(),
): string {
  const prefix = `EZN-CERT-${year}-`;
  let maxSeq = 0;
  for (const code of existingCodes) {
    if (code.startsWith(prefix)) {
      const parsed = Number.parseInt(code.slice(prefix.length), 10);
      if (Number.isFinite(parsed) && parsed > maxSeq) maxSeq = parsed;
    }
  }
  return `${prefix}${String(maxSeq + 1).padStart(4, "0")}`;
}

export function computeExamStats(exam: ExamAssessment, submissions: ExamSubmission[]) {
  const matching = submissions.filter((s) => s.examId === exam.id);
  const graded = matching.filter((s) => s.status === "graded");
  const passed = graded.filter((s) => s.score >= exam.passingScore).length;
  const averageScore =
    graded.length > 0
      ? Math.round((graded.reduce((sum, s) => sum + s.score, 0) / graded.length) * 10) / 10
      : 0;
  const passRate = graded.length > 0 ? Math.round((passed / graded.length) * 1000) / 10 : 0;
  return {
    totalSubmissions: matching.length,
    gradedCount: graded.length,
    passedCount: passed,
    averageScore,
    passRate,
  };
}

export function computeAssignmentStats(
  assignment: CourseAssignment,
  submissions: AssignmentSubmission[],
  enrolledCount: number,
) {
  const matching = submissions.filter((s) => s.assignmentId === assignment.id);
  const submitted = matching.filter((s) => s.status !== "pending").length;
  const graded = matching.filter((s) => s.status === "graded" || s.status === "returned");
  const pendingEval = matching.filter(
    (s) => s.status === "submitted" || s.status === "late",
  ).length;
  const averageScore =
    graded.length > 0
      ? Math.round(
          (graded.reduce((sum, s) => sum + Number(s.score ?? 0), 0) / graded.length) * 10,
        ) / 10
      : 0;
  return {
    submittedCount: submitted,
    pendingEvaluationCount: pendingEval,
    gradedCount: graded.length,
    missingCount: Math.max(0, enrolledCount - submitted),
    averageScore,
  };
}

export function computeInstructorEarningsSummary(
  payouts: InstructorPayout[],
  hourlyRate = 0,
  totalTeachingHours = 0,
) {
  let totalPaid = 0;
  let totalPending = 0;
  let totalFailed = 0;
  let loggedHours = 0;

  for (const p of payouts) {
    loggedHours += Number(p.teachingHours || 0);
    if (p.status === "completed") totalPaid += Number(p.amount || 0);
    else if (p.status === "pending") totalPending += Number(p.amount || 0);
    else if (p.status === "failed") totalFailed += Number(p.amount || 0);
  }

  const estimatedActiveEarnings =
    hourlyRate > 0 && totalTeachingHours > loggedHours
      ? Math.round((totalTeachingHours - loggedHours) * hourlyRate)
      : 0;

  return {
    totalPaid,
    totalPending,
    totalFailed,
    totalEarnings: totalPaid + totalPending,
    estimatedActiveEarnings,
    loggedHours,
  };
}

export function paginateRows<T>(rows: T[], page: number, pageSize: number) {
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const start = (safePage - 1) * pageSize;
  return {
    items: rows.slice(start, start + pageSize),
    page: safePage,
    pageCount: totalPages,
    total: rows.length,
  };
}

export function formatCompactDate(raw: string | null | undefined): string {
  if (!raw) return "—";
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return String(raw);
  return parsed.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
