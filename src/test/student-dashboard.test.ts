import { describe, expect, it } from "vitest";
import {
  ALL_STUDENT_SUBMENU_ITEMS,
  STUDENT_NAV_GROUPS,
} from "@/components/dashboard/student/nav-config";
import {
  resolveStudentMutationPermission,
  sanitizeAndAssertStudentMutation,
  scopeWorkspaceForStudent,
  type StudentScope,
} from "@/lib/student/store.server";
import { createDefaultRolePermissions } from "@/lib/owner/logic";
import { getOwnerWorkspaceState } from "@/lib/owner/store.server";

describe("Student Dashboard Navigation & Structure", () => {
  it("contains 6 clean top-level groups and all 28 unique submenus with zero digits in labels", () => {
    expect(STUDENT_NAV_GROUPS).toHaveLength(6);
    expect(ALL_STUDENT_SUBMENU_ITEMS).toHaveLength(28);

    const ids = ALL_STUDENT_SUBMENU_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(28);

    const expectedIds = [
      "overview",
      "my-courses",
      "explore-courses",
      "continue-learning",
      "course-materials",
      "elearning-resources",
      "live-classes",
      "learning-schedule",
      "my-timetable",
      "my-attendance",
      "my-assignments",
      "quizzes-exams",
      "exam-results",
      "grades-report-cards",
      "learning-progress",
      "my-certificates",
      "messages",
      "parent-communication",
      "discussion-forums",
      "announcements",
      "notifications",
      "my-fees",
      "make-payment",
      "payment-history",
      "invoices-receipts",
      "my-profile",
      "account-settings",
      "change-password",
    ];
    for (const expected of expectedIds) {
      expect(ids).toContain(expected);
    }

    for (const group of STUDENT_NAV_GROUPS) {
      expect(group.label).not.toMatch(/\d/);
      for (const item of group.items) {
        expect(item.label).not.toMatch(/\d/);
      }
    }
  });

  it("enforces read/write boundaries in default student role permissions", () => {
    const studentPerms = createDefaultRolePermissions().student;
    expect(studentPerms.overview.view).toBe(true);
    expect(studentPerms.courses.view).toBe(true);
    expect(studentPerms.grades.view).toBe(true);
    expect(studentPerms.grades.edit).toBe(false);
    expect(studentPerms.attendance.view).toBe(true);
    expect(studentPerms.attendance.edit).toBe(false);
    expect(studentPerms.exams.create).toBe(true);
    expect(studentPerms.finance.create).toBe(true);
    expect(studentPerms.users.view).toBe(false);
    expect(studentPerms.platform.view).toBe(false);
  });
});

describe("Student Data Isolation, Answer Hiding & Scoped Mutations", () => {
  function buildSampleState() {
    const base = getOwnerWorkspaceState();
    const state = structuredClone(base);

    state.courseMeta["course-mine"] = {
      courseId: "course-mine",
      priceEtb: 1200,
      enrollmentMode: "open",
      maxCapacity: 25,
      classSectionId: "class-mine",
      academicTermId: "term-1",
      youtubeApiKey: "AIzaSecretAdminKey123",
      youtubeChannelId: "UC_SECRET",
      youtubePlaylistId: "PL_SECRET",
    };
    state.courseMeta["course-other"] = {
      courseId: "course-other",
      priceEtb: 1500,
      enrollmentMode: "approval",
      maxCapacity: 2,
      classSectionId: "class-other",
      academicTermId: "term-1",
    };

    state.classes.push(
      {
        id: "class-mine",
        name: "Cohort Alpha",
        sectionCode: "A1",
        academicYearId: "ay-2026",
        departmentId: null,
        instructorId: "inst-1",
        room: "Room 101",
        capacity: 30,
        studentIds: ["stu-1", "stu-2"],
      },
      {
        id: "class-other",
        name: "Cohort Beta",
        sectionCode: "B1",
        academicYearId: "ay-2026",
        departmentId: null,
        instructorId: "inst-2",
        room: "Room 202",
        capacity: 30,
        studentIds: ["stu-2"],
      },
    );

    state.studentMeta["stu-1"] = {
      userId: "stu-1",
      studentCode: "EZ-STU-1001",
      classSectionId: "class-mine",
      academicYearId: null,
      guardianName: "Abebe",
      guardianPhone: "+251911000001",
      address: "Addis Ababa",
      dateOfBirth: "2004-05-10",
      notes: "Honors cohort",
    };
    state.studentMeta["stu-2"] = {
      userId: "stu-2",
      studentCode: "EZ-STU-1002",
      classSectionId: "class-other",
      academicYearId: null,
      guardianName: "Kebede",
      guardianPhone: "+251911000002",
      address: "Adama",
      dateOfBirth: "2003-01-01",
      notes: "Private note",
    };

    state.attendance.push(
      {
        id: "att-1",
        date: "2026-11-25",
        personId: "stu-1",
        personType: "student",
        courseId: "course-mine",
        classSectionId: "class-mine",
        status: "present",
        notes: "",
        markedBy: "inst-1",
      },
      {
        id: "att-2",
        date: "2026-11-25",
        personId: "stu-2",
        personType: "student",
        courseId: "course-mine",
        classSectionId: "class-mine",
        status: "absent",
        notes: "Private absence",
        markedBy: "inst-1",
      },
    );

    state.grades.push(
      {
        id: "g-1",
        studentId: "stu-1",
        courseId: "course-mine",
        termId: null,
        assessmentType: "quiz",
        assessmentTitle: "Quiz 1",
        score: 90,
        maxScore: 100,
        weight: 1,
        remarks: "Excellent",
        gradedAt: "2026-11-20T00:00:00.000Z",
      },
      {
        id: "g-2",
        studentId: "stu-2",
        courseId: "course-mine",
        termId: null,
        assessmentType: "quiz",
        assessmentTitle: "Quiz 1",
        score: 65,
        maxScore: 100,
        weight: 1,
        remarks: "Confidential peer grade",
        gradedAt: "2026-11-20T00:00:00.000Z",
      },
    );

    state.feePlans.push(
      {
        id: "fp-1",
        studentId: "stu-1",
        courseId: "course-mine",
        title: "Term Tuition",
        amount: 2000,
        discount: 200,
        paidAmount: 1000,
        dueDate: "2026-12-30",
        status: "partial",
        paymentMethod: "Telebirr",
        notes: "",
        createdAt: "2026-11-01",
      },
      {
        id: "fp-2",
        studentId: "stu-2",
        courseId: "course-mine",
        title: "Other Tuition",
        amount: 5000,
        discount: 0,
        paidAmount: 0,
        dueDate: "2026-12-30",
        status: "unpaid",
        paymentMethod: "CBE Bank",
        notes: "",
        createdAt: "2026-11-01",
      },
    );

    state.resources.push(
      {
        id: "res-public",
        title: "Public Study Guide",
        type: "pdf",
        subjectId: null,
        categoryId: null,
        courseId: null,
        accessLevel: "public",
        url: "https://example.com/public.pdf",
        storagePath: null,
        fileSizeLabel: "1 MB",
        description: "",
        createdAt: "2026-11-01",
      },
      {
        id: "res-staff",
        title: "Instructor Answer Key",
        type: "pdf",
        subjectId: null,
        categoryId: null,
        courseId: "course-mine",
        accessLevel: "staff_only",
        url: "https://example.com/staff.pdf",
        storagePath: null,
        fileSizeLabel: "1 MB",
        description: "",
        createdAt: "2026-11-01",
      },
      {
        id: "res-pro-unpaid",
        title: "Paid Workbook",
        type: "pdf",
        subjectId: null,
        categoryId: null,
        courseId: "course-mine",
        accessLevel: "pro_paid",
        url: "https://example.com/pro.pdf",
        storagePath: null,
        fileSizeLabel: "2 MB",
        description: "",
        createdAt: "2026-11-01",
      },
    );

    state.exams.push(
      {
        id: "exam-active",
        courseId: "course-mine",
        termId: null,
        classSectionId: null,
        instructorId: "inst-1",
        title: "Midterm Objective Quiz",
        examType: "quiz",
        scheduledDate: "2026-11-27",
        startTime: "09:00",
        durationMinutes: 30,
        maxScore: 100,
        passingScore: 60,
        instructions: "Answer carefully.",
        questions: [
          {
            id: "q1",
            prompt: "2 + 2 = ?",
            questionType: "multiple_choice",
            options: ["3", "4", "5"],
            correctAnswer: "4",
            points: 50,
          },
          {
            id: "q2",
            prompt: "The Earth orbits the Sun.",
            questionType: "true_false",
            options: ["True", "False"],
            correctAnswer: "True",
            points: 50,
          },
        ],
        status: "active",
        createdAt: "2026-11-20T00:00:00.000Z",
      },
      {
        id: "exam-scheduled",
        courseId: "course-mine",
        termId: null,
        classSectionId: null,
        instructorId: "inst-1",
        title: "Upcoming Final",
        examType: "final",
        scheduledDate: "2026-12-20",
        startTime: "09:00",
        durationMinutes: 60,
        maxScore: 100,
        passingScore: 60,
        instructions: "",
        questions: [
          {
            id: "q3",
            prompt: "Capital of Ethiopia?",
            questionType: "multiple_choice",
            options: ["Addis Ababa", "Hawassa"],
            correctAnswer: "Addis Ababa",
            points: 100,
          },
        ],
        status: "scheduled",
        createdAt: "2026-11-20T00:00:00.000Z",
      },
    );

    state.assignments.push({
      id: "asg-1",
      courseId: "course-mine",
      classSectionId: null,
      instructorId: "inst-1",
      title: "Essay 1",
      description: "Write summary",
      instructions: "Min 100 words",
      dueDate: "2099-12-31",
      maxScore: 100,
      attachmentUrl: "",
      attachmentName: "",
      status: "published",
      createdAt: "2026-11-20T00:00:00.000Z",
      updatedAt: "2026-11-20T00:00:00.000Z",
    });

    const scope: StudentScope = {
      studentId: "stu-1",
      enrolledCourseIds: new Set(["course-mine"]),
      assignedClassIds: new Set(["class-mine"]),
      paidCourseIds: new Set(),
      linkedParentIds: new Set(["parent-1"]),
      authorizedRecipientIds: new Set(["inst-1", "owner-1"]),
      courseEnrollmentCounts: { "course-mine": 2, "course-other": 2 },
    };

    return { state, scope };
  }

  it("isolates student records, strips peer PII, YouTube secrets, unpaid Pro items, and active exam answers", () => {
    const { state, scope } = buildSampleState();
    const scoped = scopeWorkspaceForStudent(state, scope);

    // Peer isolation
    expect(scoped.attendance.map((a) => a.id)).toEqual(["att-1"]);
    expect(scoped.grades.map((g) => g.id)).toEqual(["g-1"]);
    expect(scoped.feePlans.map((f) => f.id)).toEqual(["fp-1"]);
    expect(scoped.classes.map((c) => c.id)).toEqual(["class-mine"]);
    expect(scoped.classes[0]?.studentIds).toEqual(["stu-1"]);

    // Secret stripping
    const metaRaw = scoped.courseMeta["course-mine"] as unknown as Record<string, unknown>;
    expect(metaRaw["youtubeApiKey"]).toBeUndefined();
    expect(metaRaw["youtubeChannelId"]).toBeUndefined();
    expect(metaRaw["youtubePlaylistId"]).toBeUndefined();

    // Staff-only & unpaid pro_paid resources excluded
    expect(scoped.resources.map((r) => r.id)).toEqual(["res-public"]);

    // Correct answers stripped from active / scheduled ungraded exams
    const activeExam = scoped.exams.find((e) => e.id === "exam-active");
    expect(activeExam?.questions[0]?.correctAnswer).toBe("");
    expect(activeExam?.questions[1]?.correctAnswer).toBe("");
  });

  it("blocks forbidden staff mutations, cross-student actions, closed exams, and computes exam scores server-side", () => {
    const { state, scope } = buildSampleState();

    // Cannot create/edit official grades or fee plans
    expect(() =>
      sanitizeAndAssertStudentMutation(
        {
          type: "upsert_grade",
          payload: {
            id: "hack-grade",
            studentId: "stu-1",
            courseId: "course-mine",
            termId: null,
            assessmentType: "exam",
            assessmentTitle: "Fake",
            score: 100,
            maxScore: 100,
            weight: 1,
            remarks: "",
            gradedAt: "2026-11-27",
          },
        },
        scope,
        state,
        false,
      ),
    ).toThrow(/Forbidden/i);

    // Cannot submit to scheduled (not active) exam
    expect(() =>
      sanitizeAndAssertStudentMutation(
        {
          type: "upsert_exam_submission",
          payload: {
            id: "sub-closed",
            examId: "exam-scheduled",
            studentId: "stu-1",
            score: 100,
            status: "submitted",
            submittedAt: null,
            gradedAt: null,
            feedback: "",
            answers: { q3: "Addis Ababa" },
          },
        },
        scope,
        state,
        false,
      ),
    ).toThrow(/not currently open/i);

    // Ignores spoofed client score and computes real score on server (1 of 2 correct = 50/100)
    const examMutation = sanitizeAndAssertStudentMutation(
      {
        type: "upsert_exam_submission",
        payload: {
          id: "sub-real",
          examId: "exam-active",
          studentId: "stu-1",
          score: 100,
          status: "submitted",
          submittedAt: null,
          gradedAt: null,
          feedback: "Spoofed",
          answers: { q1: "4", q2: "False" },
        },
      },
      scope,
      state,
      false,
    );
    expect(examMutation.type).toBe("upsert_exam_submission");
    if (examMutation.type === "upsert_exam_submission") {
      expect(examMutation.payload.score).toBe(50);
      expect(examMutation.payload.status).toBe("graded");
    }

    // Cannot exceed course enrollment capacity
    expect(() =>
      sanitizeAndAssertStudentMutation(
        {
          type: "upsert_enrollment_request",
          payload: {
            studentId: "stu-1",
            courseId: "course-other",
            classSectionId: null,
            requestedBy: "stu-1",
            notes: "Please enroll me",
          },
        },
        scope,
        state,
        false,
      ),
    ).toThrow(/capacity/i);

    // Preserves studentCode & classSectionId on profile metadata edit
    const metaMutation = sanitizeAndAssertStudentMutation(
      {
        type: "upsert_student_meta",
        payload: {
          userId: "stu-1",
          studentCode: "HACKED-999",
          classSectionId: "class-other",
          academicYearId: null,
          dateOfBirth: "1990-01-01",
          notes: "Modified",
          guardianName: "Abebe Updated",
          guardianPhone: "+251911000099",
          address: "Bole, Addis Ababa",
        },
      },
      scope,
      state,
      false,
    );
    if (metaMutation.type === "upsert_student_meta") {
      expect(metaMutation.payload.studentCode).toBe("EZ-STU-1001");
      expect(metaMutation.payload.classSectionId).toBe("class-mine");
      expect(metaMutation.payload.address).toBe("Bole, Addis Ababa");
    }

    // Valid discrepancy report & permission resolution
    expect(
      resolveStudentMutationPermission({
        type: "report_attendance_discrepancy",
        payload: {
          attendanceId: "att-1",
          studentId: "stu-1",
          courseId: "course-mine",
          date: "2026-11-25",
          reason: "I joined live.",
        },
      }),
    ).toEqual({ module: "attendance", action: "view" });
  });
});
