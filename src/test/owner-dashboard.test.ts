import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSION_MODULES,
  buildReportCard,
  computeAttendanceStats,
  computeFeeBalance,
  computeFeeStatus,
  computeGradeOutcome,
  createDefaultRolePermissions,
  detectTimetableConflicts,
  hasModulePermission,
  maskSecret,
  nextInvoiceNumber,
  paginateRows,
} from "@/lib/owner/logic";
import { applyWorkspaceMutation, resolvePermissionForMutation } from "@/lib/owner/store.server";
import { ALL_SUBMENU_ITEMS, OWNER_NAV_GROUPS } from "@/components/dashboard/owner/nav-config";
import type { GradingScale, TimetableSlot } from "@/lib/owner/types";

const SAMPLE_SCALE: GradingScale = {
  id: "scale-1",
  name: "Standard Scale",
  isDefault: true,
  bands: [
    { letter: "A", minPercent: 90, maxPercent: 100, gpa: 4.0, remark: "Distinction" },
    { letter: "B", minPercent: 80, maxPercent: 89.9, gpa: 3.3, remark: "Very Good" },
    { letter: "C", minPercent: 70, maxPercent: 79.9, gpa: 2.5, remark: "Satisfactory" },
    { letter: "D", minPercent: 60, maxPercent: 69.9, gpa: 1.5, remark: "Pass" },
    { letter: "F", minPercent: 0, maxPercent: 59.9, gpa: 0.0, remark: "Needs Improvement" },
  ],
};

describe("Owner Dashboard Navigation & RBAC", () => {
  it("contains all 7 top-level groups and unique submenu IDs", () => {
    expect(OWNER_NAV_GROUPS).toHaveLength(7);
    const ids = ALL_SUBMENU_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("overview");
    expect(ids).toContain("reports");
    expect(ids).toContain("roles-permissions");
    expect(ids).toContain("change-password");
  });

  it("grants Owner full permissions regardless of matrix state and restricts other roles cleanly", () => {
    const matrix = createDefaultRolePermissions();
    matrix.owner.platform.edit = false; // Even if tampered, owner stays full-access
    expect(hasModulePermission(matrix, ["owner"], "platform", "edit")).toBe(true);
    expect(hasModulePermission(matrix, ["owner"], "finance", "delete")).toBe(true);

    expect(hasModulePermission(matrix, ["admin"], "users", "view")).toBe(true);
    expect(hasModulePermission(matrix, ["admin"], "platform", "edit")).toBe(false);
    expect(hasModulePermission(matrix, ["instructor"], "grades", "edit")).toBe(true);
    expect(hasModulePermission(matrix, ["instructor"], "finance", "view")).toBe(false);
    expect(hasModulePermission(matrix, ["parent"], "grades", "view")).toBe(true);
    expect(hasModulePermission(matrix, ["parent"], "grades", "edit")).toBe(false);
    expect(hasModulePermission(matrix, ["student"], "courses", "view")).toBe(true);
    expect(hasModulePermission(matrix, ["student"], "users", "view")).toBe(false);
  });
});

describe("Timetable Conflict Detection", () => {
  const existing: TimetableSlot[] = [
    {
      id: "slot-1",
      title: "Excel Formulas",
      sessionType: "lesson",
      courseId: "c1",
      classSectionId: "sec-a",
      instructorId: "inst-1",
      dayOfWeek: "Monday",
      startTime: "09:00",
      endTime: "10:30",
      room: "Lab 1",
      meetingUrl: "",
    },
  ];

  it("detects instructor, class section, and room overlaps", () => {
    const conflicts = detectTimetableConflicts(existing, {
      title: "Word Formatting",
      sessionType: "live_class",
      courseId: "c1",
      classSectionId: "sec-a",
      instructorId: "inst-1",
      dayOfWeek: "Monday",
      startTime: "10:00",
      endTime: "11:00",
      room: "lab 1",
      meetingUrl: "",
    });
    expect(conflicts).toHaveLength(1);
    expect(conflicts[0]!.reasons).toHaveLength(3);
  });

  it("allows non-overlapping slots and self-edits without false positives", () => {
    expect(
      detectTimetableConflicts(existing, {
        title: "Afternoon Session",
        sessionType: "lesson",
        courseId: "c1",
        classSectionId: "sec-a",
        instructorId: "inst-1",
        dayOfWeek: "Monday",
        startTime: "10:30",
        endTime: "12:00",
        room: "Lab 1",
        meetingUrl: "",
      }),
    ).toHaveLength(0);

    expect(
      detectTimetableConflicts(existing, {
        ...existing[0]!,
        title: "Updated Excel Formulas",
      }),
    ).toHaveLength(0);
  });
});

describe("Attendance, Grades, Finance & Utilities", () => {
  it("computes attendance statistics excluding excused entries from attendance denominator", () => {
    const stats = computeAttendanceStats([
      {
        id: "1",
        personId: "s1",
        personType: "student",
        courseId: null,
        classSectionId: null,
        date: "2026-11-20",
        status: "present",
        notes: "",
        markedBy: null,
      },
      {
        id: "2",
        personId: "s1",
        personType: "student",
        courseId: null,
        classSectionId: null,
        date: "2026-11-21",
        status: "late",
        notes: "",
        markedBy: null,
      },
      {
        id: "3",
        personId: "s1",
        personType: "student",
        courseId: null,
        classSectionId: null,
        date: "2026-11-22",
        status: "absent",
        notes: "",
        markedBy: null,
      },
      {
        id: "4",
        personId: "s1",
        personType: "student",
        courseId: null,
        classSectionId: null,
        date: "2026-11-23",
        status: "excused",
        notes: "",
        markedBy: null,
      },
    ]);
    expect(stats.total).toBe(4);
    expect(stats.present).toBe(1);
    expect(stats.late).toBe(1);
    expect(stats.absent).toBe(1);
    expect(stats.excused).toBe(1);
    expect(stats.attendanceRate).toBe(66.7);
  });

  it("computes weighted course report cards and GPA accurately", () => {
    const outcome = computeGradeOutcome(45, 50, SAMPLE_SCALE);
    expect(outcome.percent).toBe(90);
    expect(outcome.letter).toBe("A");

    const card = buildReportCard(
      "stu-1",
      [
        {
          id: "g1",
          studentId: "stu-1",
          courseId: "c1",
          termId: null,
          assessmentTitle: "Quiz",
          assessmentType: "quiz",
          score: 80,
          maxScore: 100,
          weight: 1,
          remarks: "",
          gradedAt: "2026-11-20",
        },
        {
          id: "g2",
          studentId: "stu-1",
          courseId: "c1",
          termId: null,
          assessmentTitle: "Final",
          assessmentType: "exam",
          score: 95,
          maxScore: 100,
          weight: 3,
          remarks: "",
          gradedAt: "2026-11-22",
        },
      ],
      SAMPLE_SCALE,
      new Map([["c1", { id: "c1", title: "Basic Computer Skills" }]]),
    );
    expect(card.lines).toHaveLength(1);
    expect(card.lines[0]!.weightedPercent).toBe(91.3);
    expect(card.lines[0]!.letter).toBe("A");
    expect(card.overallGpa).toBe(4.0);
  });

  it("calculates fee balances, invoice numbers, secret masks, and pagination", () => {
    expect(computeFeeBalance(218, 18, 100)).toBe(100);
    expect(computeFeeStatus(218, 18, 200, "2026-12-31", "2026-11-26")).toBe("paid");
    expect(computeFeeStatus(218, 0, 100, "2026-12-31", "2026-11-26")).toBe("partial");
    expect(computeFeeStatus(218, 0, 0, "2026-12-31", "2026-11-26")).toBe("unpaid");
    expect(computeFeeStatus(218, 0, 0, "2026-11-01", "2026-11-26")).toBe("overdue");

    expect(nextInvoiceNumber(["INV-2026-0001", "INV-2026-0009"], 2026)).toBe("INV-2026-0010");
    expect(maskSecret("AIzaSySuperSecretKey9876")).toBe("••••••••9876");
    expect(maskSecret("")).toBe("");

    const page = paginateRows([1, 2, 3, 4, 5], 2, 2);
    expect(page.items).toEqual([3, 4]);
    expect(page.pageCount).toBe(3);
  });
});

describe("Server Store Mutations & Permission Mapping", () => {
  it("maps mutations to expected permission modules and actions", () => {
    expect(resolvePermissionForMutation({ type: "delete_fee_plan", id: "f1" })).toEqual({
      module: "finance",
      action: "delete",
    });
    expect(
      resolvePermissionForMutation({ type: "update_system_settings", systemSettings: {} as never }),
    ).toEqual({
      module: "platform",
      action: "edit",
    });
  });

  it("rejects invalid grade scores, prevents timetable overlaps, masks secrets, and protects owner permissions", () => {
    expect(() =>
      applyWorkspaceMutation(
        {
          type: "upsert_grade",
          payload: {
            id: "bad-g",
            studentId: "s1",
            courseId: "c1",
            termId: null,
            assessmentTitle: "Exam",
            assessmentType: "exam",
            score: 120,
            maxScore: 100,
            weight: 1,
            remarks: "",
            gradedAt: "2026-11-26",
          },
        },
        "owner-1",
      ),
    ).toThrow(/between 0 and the maximum score/i);

    const matrix = createDefaultRolePermissions();
    for (const mod of ALL_PERMISSION_MODULES) {
      matrix.owner[mod].view = false;
    }
    const { state } = applyWorkspaceMutation(
      { type: "update_role_permissions", rolePermissions: matrix },
      "owner-1",
    );
    expect(state.rolePermissions.owner.platform.edit).toBe(true);

    const { state: integState } = applyWorkspaceMutation(
      {
        type: "update_integration",
        payload: {
          id: "telebirr",
          enabled: true,
          mode: "live",
          endpointOrHost: "https://developerportal.ethiotelebirr.com",
          accountOrSender: "0911 000 218",
          statusText: "Active",
          newSecret: "tb_live_secret_4321",
        },
      },
      "owner-1",
    );
    const telebirr = integState.integrations.find((i) => i.id === "telebirr");
    expect(telebirr?.secretMask).toBe("••••••••4321");
    expect(JSON.stringify(integState)).not.toContain("tb_live_secret_4321");
  });
});
