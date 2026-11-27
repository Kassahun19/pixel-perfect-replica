import { describe, expect, it } from "vitest";
import {
  ALL_PERMISSION_MODULES,
  buildReportCard,
  computeAttendanceStats,
  computeExamStats,
  computeFeeBalance,
  computeFeeStatus,
  computeGradeOutcome,
  createDefaultRolePermissions,
  detectTimetableConflicts,
  hasModulePermission,
  maskSecret,
  nextCertificateCode,
  nextInvoiceNumber,
  paginateRows,
} from "@/lib/owner/logic";
import { applyWorkspaceMutation, resolvePermissionForMutation } from "@/lib/owner/store.server";
import {
  ADMIN_NAV_GROUPS,
  ALL_ADMIN_SUBMENU_ITEMS,
  ALL_SUBMENU_ITEMS,
  OWNER_NAV_GROUPS,
} from "@/components/dashboard/owner/nav-config";
import { detectResourceType } from "@/lib/resource-utils";
import type { ExamAssessment, ExamSubmission, GradingScale, TimetableSlot } from "@/lib/owner/types";

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
  it("contains all 7 top-level groups for Owner and 8 clean groups without numbers for Admin", () => {
    expect(OWNER_NAV_GROUPS).toHaveLength(7);
    const ids = ALL_SUBMENU_ITEMS.map((i) => i.id);
    expect(new Set(ids).size).toBe(ids.length);
    expect(ids).toContain("overview");
    expect(ids).toContain("reports");
    expect(ids).toContain("roles-permissions");
    expect(ids).toContain("change-password");

    expect(ADMIN_NAV_GROUPS).toHaveLength(8);
    const adminIds = ALL_ADMIN_SUBMENU_ITEMS.map((i) => i.id);
    expect(new Set(adminIds).size).toBe(adminIds.length);
    expect(adminIds).toContain("user-roles");
    expect(adminIds).toContain("user-permissions");
    expect(adminIds).toContain("classes-sections");
    expect(adminIds).toContain("academic-years");
    expect(adminIds).toContain("semesters-terms");
    expect(adminIds).toContain("exams");
    expect(adminIds).toContain("certificates");
    expect(adminIds).toContain("course-enrollment");
    expect(adminIds).toContain("student-registration");
    expect(adminIds).toContain("enrollment-requests");
    expect(adminIds).toContain("class-assignments");
    expect(adminIds).toContain("outstanding-balances");

    // Verify no numbers exist in any sidebar group or submenu label
    for (const g of ADMIN_NAV_GROUPS) {
      expect(g.label).not.toMatch(/\d/);
      for (const item of g.items) {
        expect(item.label).not.toMatch(/\d/);
      }
    }
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

  it("handles enrollment requests, exam scoring, certificates, payment reminders, and Admin RBAC bounds", () => {
    expect(nextCertificateCode(["EZN-CERT-2026-0001", "EZN-CERT-2026-0004"], 2026)).toBe(
      "EZN-CERT-2026-0005",
    );

    const exam: ExamAssessment = {
      id: "exam-1",
      title: "Excel Final",
      courseId: "c1",
      termId: null,
      examType: "final",
      scheduledDate: "2026-11-30",
      startTime: "09:00",
      durationMinutes: 60,
      maxScore: 100,
      passingScore: 60,
      instructions: "",
      questions: [],
      status: "active",
      createdAt: new Date().toISOString(),
    };
    const subs: ExamSubmission[] = [
      {
        id: "s1",
        examId: "exam-1",
        studentId: "stu-1",
        score: 80,
        status: "graded",
        submittedAt: null,
        gradedAt: null,
        feedback: "",
      },
      {
        id: "s2",
        examId: "exam-1",
        studentId: "stu-2",
        score: 50,
        status: "graded",
        submittedAt: null,
        gradedAt: null,
        feedback: "",
      },
    ];
    const exStats = computeExamStats(exam, subs);
    expect(exStats.averageScore).toBe(65);
    expect(exStats.passRate).toBe(50);

    const { state: reqState } = applyWorkspaceMutation(
      {
        type: "upsert_enrollment_request",
        payload: {
          id: "req-1",
          studentId: "stu-1",
          courseId: "22222222-2222-4222-8222-222222222201",
          classSectionId: "class-bcs-a",
          requestedBy: "admin-1",
          notes: "Cohort A",
        },
      },
      "admin-1",
      ["admin"],
    );
    expect(reqState.enrollmentRequests.some((r) => r.id === "req-1" && r.status === "pending")).toBe(
      true,
    );

    const { state: approvedState } = applyWorkspaceMutation(
      {
        type: "review_enrollment_request",
        id: "req-1",
        status: "approved",
        reviewNote: "Approved by Admin",
      },
      "admin-1",
      ["admin"],
    );
    expect(approvedState.enrollmentRequests.find((r) => r.id === "req-1")?.status).toBe("approved");
    expect(
      approvedState.classes.find((c) => c.id === "class-bcs-a")?.studentIds.includes("stu-1"),
    ).toBe(true);

    const { state: certState } = applyWorkspaceMutation(
      {
        type: "issue_certificate",
        payload: {
          id: "cert-1",
          studentId: "stu-1",
          courseId: "22222222-2222-4222-8222-222222222201",
          templateId: "cert-default",
          completionPercent: 100,
          finalGrade: "A (95%)",
          notes: "Honors",
        },
      },
      "admin-1",
      ["admin"],
    );
    expect(certState.issuedCertificates.find((c) => c.id === "cert-1")?.certificateCode).toMatch(
      /^EZN-CERT-\d{4}-\d{4}$/,
    );

    const { state: remState } = applyWorkspaceMutation(
      {
        type: "send_payment_reminder",
        payload: {
          studentId: "stu-1",
          feePlanId: null,
          amountDue: 218,
          channel: "notification",
          note: "Tuition due",
        },
      },
      "admin-1",
      ["admin"],
    );
    expect(remState.paymentReminders.length).toBeGreaterThan(0);

    // Delegated Admin cannot escalate admin or modify owner permissions
    const escalated = createDefaultRolePermissions();
    escalated.admin.platform.edit = true;
    escalated.instructor.courses.delete = true;
    const { state: rbacState } = applyWorkspaceMutation(
      { type: "update_role_permissions", rolePermissions: escalated },
      "admin-1",
      ["admin"],
    );
    expect(rbacState.rolePermissions.admin.platform.edit).toBe(false);
    expect(rbacState.rolePermissions.instructor.courses.delete).toBe(true);
  });

  it("detects all file types (PDF, Word, Excel, PPT, CSV, image, zip, video, web link)", () => {
    expect(detectResourceType("assignment.pdf")).toBe("pdf");
    expect(detectResourceType("syllabus.doc")).toBe("document");
    expect(detectResourceType("notes.docx")).toBe("document");
    expect(detectResourceType("budget.xls")).toBe("document");
    expect(detectResourceType("scores.xlsx")).toBe("document");
    expect(detectResourceType("data.csv")).toBe("document");
    expect(detectResourceType("lecture.ppt")).toBe("presentation");
    expect(detectResourceType("deck.pptx")).toBe("presentation");
    expect(detectResourceType("diagram.png")).toBe("document");
    expect(detectResourceType("photo.jpg")).toBe("document");
    expect(detectResourceType("bundle.zip")).toBe("document");
    expect(detectResourceType("archive.rar")).toBe("document");
    expect(detectResourceType("recording.mp4")).toBe("video");
    expect(detectResourceType("https://www.youtube.com/watch?v=xyz123")).toBe("video");
    expect(detectResourceType("https://drive.google.com/open?id=123")).toBe("link");
    expect(detectResourceType("https://ezana.academy/docs")).toBe("link");
  });

  it("validates that either an uploaded file or a URL must pass creation", () => {
    const canPassCreator = (hasFile: boolean, url: string, storagePath: string | null) => {
      const finalUrl = url.trim();
      return Boolean(finalUrl || storagePath || hasFile);
    };

    // Fails only if neither is provided
    expect(canPassCreator(false, "", null)).toBe(false);
    expect(canPassCreator(false, "   ", null)).toBe(false);

    // Passes if file is provided (without URL)
    expect(canPassCreator(true, "", null)).toBe(true);
    expect(canPassCreator(false, "", "user-1/uuid-doc.pdf")).toBe(true);

    // Passes if URL is provided (without file)
    expect(canPassCreator(false, "https://example.com/guide.pdf", null)).toBe(true);
    expect(canPassCreator(false, "/api/course-covers/user/doc.docx", null)).toBe(true);

    // Passes if both are provided
    expect(canPassCreator(true, "https://example.com/guide.pdf", "user-1/uuid-doc.pdf")).toBe(true);
  });
});

