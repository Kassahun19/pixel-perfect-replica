import { describe, expect, it } from "vitest";
import { ALL_PARENT_SUBMENU_ITEMS, PARENT_NAV_GROUPS } from "@/components/dashboard/parent/nav-config";
import { createDefaultRolePermissions, hasModulePermission } from "@/lib/owner/logic";
import {
  sanitizeAndAssertParentMutation,
  scopeWorkspaceForParent,
  type ParentScope,
} from "@/lib/parent/store.server";
import type { OwnerWorkspaceState } from "@/lib/owner/types";

function makeWorkspace(): OwnerWorkspaceState {
  return {
    academicYears: [
      {
        id: "yr-1",
        name: "2026–2027",
        startDate: "2026-09-01",
        endDate: "2027-06-30",
        isCurrent: true,
        status: "active",
      },
    ],
    terms: [],
    departments: [],
    classes: [
      {
        id: "cls-a",
        name: "Grade 10 Science",
        sectionCode: "G10-A",
        academicYearId: "yr-1",
        departmentId: null,
        instructorId: "inst-1",
        studentIds: ["child-1", "unrelated-peer"],
        capacity: 30,
        room: "Room 101",
      },
    ],
    calendarEvents: [],
    studentMeta: {
      "child-1": {
        userId: "child-1",
        studentCode: "STU-1001",
        classSectionId: "cls-a",
        academicYearId: "yr-1",
        guardianName: "Parent One",
        guardianPhone: "+251911000001",
        address: "Addis Ababa",
        dateOfBirth: "2010-01-01",
        notes: "",
      },
      "unrelated-peer": {
        userId: "unrelated-peer",
        studentCode: "STU-9999",
        classSectionId: "cls-a",
        academicYearId: "yr-1",
        guardianName: "Other Parent",
        guardianPhone: "+251922000002",
        address: "Private",
        dateOfBirth: "2010-05-05",
        notes: "Secret note",
      },
    },
    instructorMeta: {},
    subjects: [],
    courseMeta: {
      "course-1": {
        courseId: "course-1",
        priceEtb: 218,
        enrollmentMode: "open",
        maxCapacity: 50,
        classSectionId: "cls-a",
        academicTermId: null,
        youtubeApiKey: "SECRET_YT_API_KEY",
        youtubeChannelId: "UCSECRET",
        youtubePlaylistId: "PLSECRET",
      },
    },
    timetables: [],
    attendance: [
      {
        id: "att-child",
        personId: "child-1",
        personType: "student",
        courseId: "course-1",
        classSectionId: "cls-a",
        date: "2026-11-25",
        status: "absent",
        notes: "",
        markedBy: "inst-1",
      },
      {
        id: "att-peer",
        personId: "unrelated-peer",
        personType: "student",
        courseId: "course-1",
        classSectionId: "cls-a",
        date: "2026-11-25",
        status: "present",
        notes: "",
        markedBy: "inst-1",
      },
    ],
    attendanceDisputes: [],
    gradingScales: [],
    grades: [
      {
        id: "g-child",
        studentId: "child-1",
        courseId: "course-1",
        termId: null,
        assessmentTitle: "Quiz 1",
        assessmentType: "quiz",
        score: 18,
        maxScore: 20,
        weight: 20,
        remarks: "Great",
        gradedAt: "2026-11-24T10:00:00Z",
      },
      {
        id: "g-peer",
        studentId: "unrelated-peer",
        courseId: "course-1",
        termId: null,
        assessmentTitle: "Quiz 1",
        assessmentType: "quiz",
        score: 10,
        maxScore: 20,
        weight: 20,
        remarks: "Hidden",
        gradedAt: "2026-11-24T10:00:00Z",
      },
    ],
    resources: [
      {
        id: "res-public",
        title: "Public Guide",
        type: "pdf",
        courseId: null,
        subjectId: null,
        categoryId: null,
        url: "https://example.com/public.pdf",
        storagePath: null,
        fileSizeLabel: "1 MB",
        accessLevel: "public",
        description: "",
        createdAt: "2026-11-20T00:00:00Z",
      },
      {
        id: "res-staff",
        title: "Staff Answer Sheet",
        type: "pdf",
        courseId: "course-1",
        subjectId: null,
        categoryId: null,
        url: "https://example.com/staff.pdf",
        storagePath: null,
        fileSizeLabel: "1 MB",
        accessLevel: "staff_only",
        description: "",
        createdAt: "2026-11-20T00:00:00Z",
      },
      {
        id: "res-pro",
        title: "Unpaid Pro Pack",
        type: "pdf",
        courseId: "course-unpaid",
        subjectId: null,
        categoryId: null,
        url: "https://example.com/pro.pdf",
        storagePath: null,
        fileSizeLabel: "2 MB",
        accessLevel: "pro_paid",
        description: "",
        createdAt: "2026-11-20T00:00:00Z",
      },
    ],
    feePlans: [
      {
        id: "fee-child",
        studentId: "child-1",
        courseId: "course-1",
        title: "Term 1 Tuition",
        amount: 218,
        discount: 0,
        paidAmount: 0,
        dueDate: "2026-12-10",
        status: "unpaid",
        paymentMethod: "Telebirr",
        notes: "",
        createdAt: "2026-11-20T00:00:00Z",
      },
      {
        id: "fee-peer",
        studentId: "unrelated-peer",
        courseId: "course-1",
        title: "Peer Fee",
        amount: 500,
        discount: 0,
        paidAmount: 0,
        dueDate: "2026-12-10",
        status: "unpaid",
        paymentMethod: "CBE",
        notes: "",
        createdAt: "2026-11-20T00:00:00Z",
      },
    ],
    invoices: [],
    transactionAdjustments: {},
    parentMessages: [
      {
        id: "pm-mine",
        parentId: "parent-1",
        studentId: "child-1",
        senderId: "inst-1",
        senderRole: "instructor",
        subject: "Attendance Check",
        body: "Please check Tuesday session.",
        includeSnapshot: false,
        snapshotSummary: null,
        read: false,
        createdAt: "2026-11-25T10:00:00Z",
      },
      {
        id: "pm-other",
        parentId: "other-parent",
        studentId: "unrelated-peer",
        senderId: "inst-1",
        senderRole: "instructor",
        subject: "Private Peer Note",
        body: "Should never leak.",
        includeSnapshot: false,
        snapshotSummary: null,
        read: false,
        createdAt: "2026-11-25T10:00:00Z",
      },
    ],
    internalMessages: [],
    notifications: [],
    announcementMeta: {},
    supportMeta: {},
    rolePermissions: createDefaultRolePermissions(),
    systemSettings: {
      platformName: "Ezana Academy",
      maintenanceMode: false,
      allowPublicRegistration: true,
      defaultAcademicYearId: "yr-1",
      defaultTermId: null,
      currency: "ETB",
      timezone: "Africa/Addis_Ababa",
      language: "en",
      sessionTimeoutMinutes: 60,
      minPasswordLength: 8,
      requireMfaForStaff: false,
      emailSenderName: "Ezana",
      emailSenderAddress: "hello@ezanaacademy.et",
      enablePaymentAlerts: true,
      enableAttendanceAlerts: true,
      updatedAt: "2026-11-20T00:00:00Z",
    },
    academyExt: { logoUrl: "", smsSenderId: "EZANA", supportHours: "8am-5pm" },
    integrations: [],
    accountPrefsByUser: {},
    enrollmentRequests: [],
    enrollmentMeta: {},
    exams: [
      {
        id: "exam-active",
        title: "Midterm Exam",
        courseId: "course-1",
        termId: null,
        classSectionId: "cls-a",
        instructorId: "inst-1",
        examType: "midterm",
        scheduledDate: "2026-12-01",
        startTime: "09:00",
        durationMinutes: 60,
        maxScore: 20,
        passingScore: 10,
        instructions: "",
        questions: [
          {
            id: "q-1",
            prompt: "2+2?",
            questionType: "multiple_choice",
            options: ["3", "4"],
            correctAnswer: "4",
            points: 20,
          },
        ],
        status: "active",
        createdAt: "2026-11-20T00:00:00Z",
      },
    ],
    examSubmissions: [],
    certificateTemplates: [],
    issuedCertificates: [],
    paymentReminders: [],
    courseMaterials: [],
    liveClasses: [],
    assignments: [],
    assignmentSubmissions: [],
    questionBank: [],
    discussionThreads: [],
    discussionPosts: [],
    instructorPayouts: [],
    courseCompletions: [],
    profileCorrectionRequests: [],
    childLinkRequests: [],
  };
}

function makeScope(): ParentScope {
  return {
    parentId: "parent-1",
    linkedChildIds: ["child-1"],
    linkedChildSet: new Set(["child-1"]),
    relationshipsByChild: { "child-1": "Mother" },
    enrolledCourseByChild: { "child-1": ["course-1"] },
    assignedClassByChild: { "child-1": ["cls-a"] },
    paidCourseByChild: { "child-1": ["course-1"] },
    allEnrolledCourseIds: new Set(["course-1"]),
    allAssignedClassIds: new Set(["cls-a"]),
    allPaidCourseIds: new Set(["course-1"]),
    authorizedInstructorIds: new Set(["inst-1"]),
    authorizedAdminIds: new Set(["admin-1"]),
    authorizedRecipientIds: new Set(["inst-1", "admin-1"]),
  };
}

describe("Parent Dashboard navigation and isolation", () => {
  it("defines 6 navigation groups and 29 submenus with zero digits in labels", () => {
    expect(PARENT_NAV_GROUPS).toHaveLength(6);
    expect(ALL_PARENT_SUBMENU_ITEMS).toHaveLength(29);
    for (const group of PARENT_NAV_GROUPS) {
      expect(group.label).not.toMatch(/\d/);
      for (const item of group.items) {
        expect(item.label).not.toMatch(/\d/);
      }
    }
  });

  it("grants scoped parent permissions for monitoring, certificates export, and payments", () => {
    const matrix = createDefaultRolePermissions();
    expect(hasModulePermission(matrix, ["parent"], "courses", "view")).toBe(true);
    expect(hasModulePermission(matrix, ["parent"], "grades", "export")).toBe(true);
    expect(hasModulePermission(matrix, ["parent"], "grades", "edit")).toBe(false);
    expect(hasModulePermission(matrix, ["parent"], "finance", "create")).toBe(true);
    expect(hasModulePermission(matrix, ["parent"], "finance", "approve")).toBe(false);
    expect(hasModulePermission(matrix, ["parent"], "communication", "create")).toBe(true);
    expect(hasModulePermission(matrix, ["parent"], "platform", "view")).toBe(false);
  });

  it("scopes workspace strictly to linked children and strips secrets, peers, and exam answers", () => {
    const ws = makeWorkspace();
    const scoped = scopeWorkspaceForParent(ws, makeScope());

    expect(scoped.studentMetaByChild["child-1"]?.studentCode).toBe("STU-1001");
    expect(scoped.studentMetaByChild["unrelated-peer"]).toBeUndefined();
    expect(scoped.classes[0]?.studentIds).toEqual(["child-1"]);
    expect("youtubeApiKey" in (scoped.courseMeta["course-1"] ?? {})).toBe(false);
    expect(scoped.attendance.map((a) => a.id)).toEqual(["att-child"]);
    expect(scoped.grades.map((g) => g.id)).toEqual(["g-child"]);
    expect(scoped.feePlans.map((f) => f.id)).toEqual(["fee-child"]);
    expect(scoped.parentMessages.map((pm) => pm.id)).toEqual(["pm-mine"]);
    expect(scoped.resources.map((r) => r.id)).toEqual(["res-public"]);
    expect(scoped.exams[0]?.questions[0]?.correctAnswer).toBe("");
  });

  it("blocks cross-child mutations and official record edits while allowing child-scoped requests", () => {
    const ws = makeWorkspace();
    const scope = makeScope();

    expect(() =>
      sanitizeAndAssertParentMutation(
        {
          type: "report_attendance_discrepancy",
          payload: {
            attendanceId: "att-peer",
            studentId: "unrelated-peer",
            courseId: "course-1",
            date: "2026-11-25",
            reason: "Check",
          },
        },
        scope,
        ws,
      ),
    ).toThrow(/Forbidden/i);

    expect(() =>
      sanitizeAndAssertParentMutation(
        {
          type: "upsert_grade",
          payload: {
            id: "g-child",
            studentId: "child-1",
            courseId: "course-1",
            termId: null,
            assessmentTitle: "Quiz 1",
            assessmentType: "quiz",
            score: 20,
            maxScore: 20,
            weight: 20,
            remarks: "Tamper",
            gradedAt: "2026-11-25",
          },
        },
        scope,
        ws,
      ),
    ).toThrow(/Forbidden/i);

    const safeDispute = sanitizeAndAssertParentMutation(
      {
        type: "report_attendance_discrepancy",
        payload: {
          attendanceId: "att-child",
          studentId: "child-1",
          courseId: "course-1",
          date: "2026-11-25",
          reason: "Child joined live session online.",
        },
      },
      scope,
      ws,
    );
    expect(safeDispute.type).toBe("report_attendance_discrepancy");

    const safeLink = sanitizeAndAssertParentMutation(
      {
        type: "request_child_link",
        payload: {
          parentId: "spoofed-parent",
          studentIdentifier: "STU-1002",
          studentName: "Second Child",
          relationship: "Mother",
          requestType: "link",
          targetStudentId: null,
          notes: "Sibling registration",
        },
      },
      scope,
      ws,
    );
    expect(safeLink.type).toBe("request_child_link");
    if (safeLink.type === "request_child_link") {
      expect(safeLink.payload.parentId).toBe("parent-1");
    }
  });
});
