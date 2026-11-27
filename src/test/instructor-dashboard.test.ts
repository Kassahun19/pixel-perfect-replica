import { describe, expect, it } from "vitest";
import {
  ALL_INSTRUCTOR_SUBMENU_ITEMS,
  INSTRUCTOR_NAV_GROUPS,
} from "@/components/dashboard/instructor/nav-config";
import {
  assertInstructorMutationScope,
  resolveInstructorMutationPermission,
  scopeWorkspaceForInstructor,
  type InstructorScope,
} from "@/lib/instructor/store.server";
import {
  computeAssignmentStats,
  computeInstructorEarningsSummary,
  createDefaultRolePermissions,
} from "@/lib/owner/logic";
import { applyWorkspaceMutation, getOwnerWorkspaceState } from "@/lib/owner/store.server";
import type {
  AssignmentSubmission,
  CourseAssignment,
  InstructorPayout,
} from "@/lib/owner/types";

describe("Instructor Dashboard Navigation & Structure", () => {
  it("contains 8 clean top-level groups and all 33 unique submenus without numbers", () => {
    expect(INSTRUCTOR_NAV_GROUPS).toHaveLength(8);
    expect(ALL_INSTRUCTOR_SUBMENU_ITEMS).toHaveLength(33);

    const ids = ALL_INSTRUCTOR_SUBMENU_ITEMS.map((item) => item.id);
    expect(new Set(ids).size).toBe(33);

    expect(ids).toContain("overview");
    expect(ids).toContain("my-courses");
    expect(ids).toContain("create-course");
    expect(ids).toContain("course-materials");
    expect(ids).toContain("elearning-resources");
    expect(ids).toContain("course-announcements");
    expect(ids).toContain("my-classes");
    expect(ids).toContain("my-students");
    expect(ids).toContain("student-records");
    expect(ids).toContain("timetables");
    expect(ids).toContain("attendance");
    expect(ids).toContain("live-classes");
    expect(ids).toContain("create-assignments");
    expect(ids).toContain("manage-assignments");
    expect(ids).toContain("quizzes-exams");
    expect(ids).toContain("question-bank");
    expect(ids).toContain("submissions");
    expect(ids).toContain("grading-evaluation");
    expect(ids).toContain("grades-report-cards");
    expect(ids).toContain("student-progress");
    expect(ids).toContain("performance-reports");
    expect(ids).toContain("learning-activities");
    expect(ids).toContain("course-completion");
    expect(ids).toContain("parent-communication");
    expect(ids).toContain("student-messages");
    expect(ids).toContain("discussion-forums");
    expect(ids).toContain("class-announcements");
    expect(ids).toContain("notifications");
    expect(ids).toContain("my-earnings");
    expect(ids).toContain("payment-history");
    expect(ids).toContain("my-profile");
    expect(ids).toContain("account-settings");
    expect(ids).toContain("change-password");

    for (const group of INSTRUCTOR_NAV_GROUPS) {
      expect(group.label).not.toMatch(/\d/);
      for (const item of group.items) {
        expect(item.label).not.toMatch(/\d/);
      }
    }
  });
});

describe("Assignment & Earnings Calculations", () => {
  it("computes assignment submission counts, missing learners, and averages", () => {
    const assignment: CourseAssignment = {
      id: "asg-1",
      courseId: "course-1",
      classSectionId: null,
      instructorId: "inst-1",
      title: "Excel Pivot Tables",
      description: "Analyze quarterly budget.",
      instructions: "Upload finished workbook.",
      dueDate: "2026-12-01",
      maxScore: 100,
      attachmentUrl: "",
      attachmentName: "",
      status: "published",
      createdAt: "2026-11-20T00:00:00.000Z",
      updatedAt: "2026-11-20T00:00:00.000Z",
    };

    const submissions: AssignmentSubmission[] = [
      {
        id: "sub-1",
        assignmentId: "asg-1",
        courseId: "course-1",
        studentId: "stu-1",
        submittedText: "Submitted report",
        attachmentUrl: "",
        submittedAt: "2026-11-21T10:00:00.000Z",
        status: "graded",
        score: 92,
        feedback: "Great work",
        gradedBy: "inst-1",
        gradedAt: "2026-11-22T10:00:00.000Z",
        returnedAt: null,
      },
      {
        id: "sub-2",
        assignmentId: "asg-1",
        courseId: "course-1",
        studentId: "stu-2",
        submittedText: "Late submission",
        attachmentUrl: "",
        submittedAt: "2026-12-02T10:00:00.000Z",
        status: "late",
        score: null,
        feedback: "",
        gradedBy: null,
        gradedAt: null,
        returnedAt: null,
      },
    ];

    const stats = computeAssignmentStats(assignment, submissions, 4);
    expect(stats.submittedCount).toBe(2);
    expect(stats.pendingEvaluationCount).toBe(1);
    expect(stats.gradedCount).toBe(1);
    expect(stats.missingCount).toBe(2);
    expect(stats.averageScore).toBe(92);
  });

  it("computes instructor earnings totals, pending amounts, and unbilled hours estimate", () => {
    const payouts: InstructorPayout[] = [
      {
        id: "pay-1",
        instructorId: "inst-1",
        periodLabel: "November 2026",
        courseId: "c1",
        amount: 4500,
        teachingHours: 10,
        ratePerHour: 450,
        status: "completed",
        referenceCode: "TRX-001",
        paidAt: "2026-11-15T00:00:00.000Z",
        notes: "",
        createdAt: "2026-11-15T00:00:00.000Z",
      },
      {
        id: "pay-2",
        instructorId: "inst-1",
        periodLabel: "December 2026",
        courseId: "c1",
        amount: 2250,
        teachingHours: 5,
        ratePerHour: 450,
        status: "pending",
        referenceCode: "TRX-002",
        paidAt: null,
        notes: "",
        createdAt: "2026-11-25T00:00:00.000Z",
      },
      {
        id: "pay-3",
        instructorId: "inst-1",
        periodLabel: "October 2026",
        courseId: "c1",
        amount: 900,
        teachingHours: 2,
        ratePerHour: 450,
        status: "failed",
        referenceCode: "TRX-000",
        paidAt: null,
        notes: "Retry",
        createdAt: "2026-10-15T00:00:00.000Z",
      },
    ];

    const summary = computeInstructorEarningsSummary(payouts, 500, 21);
    expect(summary.totalPaid).toBe(4500);
    expect(summary.totalPending).toBe(2250);
    expect(summary.totalFailed).toBe(900);
    expect(summary.totalEarnings).toBe(6750);
    expect(summary.loggedHours).toBe(17);
    expect(summary.estimatedActiveEarnings).toBe(2000);
  });
});

describe("Instructor Data Isolation & Scoped Mutations", () => {
  it("strips unauthorized courses, students, other instructors, and finance records", () => {
    const base = getOwnerWorkspaceState();
    const state = structuredClone(base);
    state.instructorMeta["inst-1"] = {
      userId: "inst-1",
      qualifications: "MSc CS",
      experienceYears: 5,
      expertise: ["Databases"],
      departmentId: null,
      hourlyRate: 450,
      weeklyHoursLimit: 20,
      scheduleSummary: "Mon-Fri",
    };
    state.instructorMeta["inst-2"] = {
      userId: "inst-2",
      qualifications: "PhD Math",
      experienceYears: 9,
      expertise: ["Calculus"],
      departmentId: null,
      hourlyRate: 700,
      weeklyHoursLimit: 25,
      scheduleSummary: "Tue-Thu",
    };
    state.courseMeta["course-mine"] = {
      courseId: "course-mine",
      priceEtb: 1200,
      enrollmentMode: "open",
      maxCapacity: 30,
      classSectionId: "class-mine",
      academicTermId: null,
    };
    state.courseMeta["course-other"] = {
      courseId: "course-other",
      priceEtb: 1500,
      enrollmentMode: "open",
      maxCapacity: 30,
      classSectionId: "class-other",
      academicTermId: null,
    };
    state.instructorPayouts.push(
      {
        id: "p-mine",
        instructorId: "inst-1",
        periodLabel: "Nov 2026",
        courseId: "course-mine",
        amount: 3000,
        teachingHours: 8,
        ratePerHour: 375,
        status: "completed",
        referenceCode: "R1",
        paidAt: "2026-11-20",
        notes: "",
        createdAt: "2026-11-20",
      },
      {
        id: "p-other",
        instructorId: "inst-2",
        periodLabel: "Nov 2026",
        courseId: "course-other",
        amount: 9900,
        teachingHours: 15,
        ratePerHour: 660,
        status: "completed",
        referenceCode: "R2",
        paidAt: "2026-11-20",
        notes: "",
        createdAt: "2026-11-20",
      },
    );

    const scope: InstructorScope = {
      instructorId: "inst-1",
      assignedCourseIds: new Set(["course-mine"]),
      assignedClassIds: new Set(["class-mine"]),
      assignedStudentIds: new Set(["stu-1"]),
      linkedParentIds: new Set(["parent-1"]),
    };

    const scoped = scopeWorkspaceForInstructor(state, scope);
    const raw = scoped as unknown as Record<string, unknown>;
    expect(Object.keys(scoped.courseMeta)).toEqual(["course-mine"]);
    expect(scoped.payouts.map((p) => p.id)).toEqual(["p-mine"]);
    expect(scoped.myInstructorMeta?.userId).toBe("inst-1");
    expect(raw["feePlans"]).toBeUndefined();
    expect(raw["invoices"]).toBeUndefined();
    expect(raw["integrations"]).toBeUndefined();
    expect(raw["instructorMeta"]).toBeUndefined();
  });

  it("blocks cross-course mutations, payout self-modification, and rate tampering", () => {
    const base = getOwnerWorkspaceState();
    const state = structuredClone(base);
    state.instructorMeta["inst-1"] = {
      userId: "inst-1",
      qualifications: "BSc",
      experienceYears: 4,
      expertise: ["Excel"],
      departmentId: null,
      hourlyRate: 400,
      weeklyHoursLimit: 18,
      scheduleSummary: "",
    };

    const scope: InstructorScope = {
      instructorId: "inst-1",
      assignedCourseIds: new Set(["course-mine"]),
      assignedClassIds: new Set(["class-mine"]),
      assignedStudentIds: new Set(["stu-1"]),
      linkedParentIds: new Set(["parent-1"]),
    };

    expect(() =>
      assertInstructorMutationScope(
        {
          type: "upsert_assignment",
          payload: {
            id: "asg-bad",
            courseId: "course-other",
            classSectionId: null,
            instructorId: "inst-1",
            title: "Unauthorized",
            description: "",
            instructions: "",
            dueDate: "2026-12-01",
            maxScore: 100,
            attachmentUrl: "",
            attachmentName: "",
            status: "published",
            createdAt: "2026-11-26T00:00:00.000Z",
            updatedAt: "2026-11-26T00:00:00.000Z",
          },
        },
        scope,
        state,
        false,
      ),
    ).toThrow(/Forbidden/i);

    expect(() =>
      assertInstructorMutationScope(
        {
          type: "upsert_instructor_payout",
          payload: {
            id: "p-hack",
            instructorId: "inst-1",
            periodLabel: "Nov",
            courseId: null,
            amount: 99999,
            teachingHours: 1,
            ratePerHour: 99999,
            status: "completed",
            referenceCode: "HACK",
            paidAt: null,
            notes: "",
            createdAt: "2026-11-26",
          },
        },
        scope,
        state,
        false,
      ),
    ).toThrow(/Owner or Admin/i);

    const profileUpdatePayload = {
      type: "upsert_instructor_meta" as const,
      payload: {
        userId: "inst-1",
        qualifications: "MSc",
        experienceYears: 5,
        expertise: ["Excel & BI"],
        departmentId: null,
        hourlyRate: 9999,
        weeklyHoursLimit: 99,
        scheduleSummary: "Mon-Wed",
      },
    };
    assertInstructorMutationScope(profileUpdatePayload, scope, state, false);
    expect(profileUpdatePayload.payload.hourlyRate).toBe(400);
    expect(profileUpdatePayload.payload.weeklyHoursLimit).toBe(18);
  });

  it("maps instructor communication actions accurately and applies assignment, grading, forum, and completion mutations", () => {
    expect(
      resolveInstructorMutationPermission({
        type: "upsert_discussion_thread",
        payload: {
          id: "dt-1",
          courseId: "c1",
          title: "Q&A",
          body: "Ask here",
          authorId: "inst-1",
          authorRole: "instructor",
          pinned: false,
          locked: false,
          createdAt: "2026-11-26",
          updatedAt: "2026-11-26",
        },
      }),
    ).toEqual({ module: "communication", action: "create" });

    const { state: matState } = applyWorkspaceMutation(
      {
        type: "upsert_course_material",
        payload: {
          id: "mat-1",
          courseId: "c1",
          lessonId: null,
          topic: "Module 1",
          title: "Workbook PDF",
          type: "pdf",
          url: "https://example.com/workbook.pdf",
          storagePath: null,
          fileSizeLabel: "1.2 MB",
          description: "Practice sheet",
          visibleToEnrolled: true,
          uploadedBy: "inst-1",
          createdAt: "2026-11-26T00:00:00.000Z",
          updatedAt: "2026-11-26T00:00:00.000Z",
        },
      },
      "inst-1",
      ["instructor"],
    );
    expect(matState.courseMaterials.some((m) => m.id === "mat-1")).toBe(true);

    applyWorkspaceMutation(
      {
        type: "upsert_assignment",
        payload: {
          id: "asg-sync",
          courseId: "c1",
          classSectionId: null,
          instructorId: "inst-1",
          title: "Week 1 Homework",
          description: "Complete exercises",
          instructions: "Submit spreadsheet",
          dueDate: "2026-12-10",
          maxScore: 50,
          attachmentUrl: "",
          attachmentName: "",
          status: "published",
          createdAt: "2026-11-26T00:00:00.000Z",
          updatedAt: "2026-11-26T00:00:00.000Z",
        },
      },
      "inst-1",
      ["instructor"],
    );

    const { state: gradedState } = applyWorkspaceMutation(
      {
        type: "grade_assignment_submission",
        payload: {
          submissionId: "sub-sync-1",
          assignmentId: "asg-sync",
          courseId: "c1",
          studentId: "stu-1",
          score: 46,
          feedback: "Well structured",
          status: "graded",
        },
      },
      "inst-1",
      ["instructor"],
    );
    expect(
      gradedState.assignmentSubmissions.find((s) => s.id === "sub-sync-1")?.score,
    ).toBe(46);

    const { state: postAddedState } = applyWorkspaceMutation(
      {
        type: "add_discussion_post",
        payload: {
          threadId: "dt-1",
          courseId: "c1",
          authorId: "inst-1",
          authorRole: "instructor",
          body: "Welcome to Week 1 discussion!",
        },
      },
      "inst-1",
      ["instructor"],
    );
    const createdPost = postAddedState.discussionPosts.find(
      (p) => p.threadId === "dt-1" && p.authorId === "inst-1",
    );
    expect(createdPost).toBeDefined();

    const { state: modState } = applyWorkspaceMutation(
      { type: "moderate_discussion_post", id: createdPost!.id, hidden: true },
      "inst-1",
      ["instructor"],
    );
    expect(modState.discussionPosts.find((p) => p.id === createdPost!.id)?.moderatedHidden).toBe(
      true,
    );

    const { state: compState } = applyWorkspaceMutation(
      {
        type: "upsert_course_completion",
        payload: {
          id: "stu-1::c1",
          studentId: "stu-1",
          courseId: "c1",
          completionPercent: 100,
          status: "completed",
          notes: "All lessons and final project completed",
          confirmedBy: "inst-1",
          confirmedAt: "2026-11-26T00:00:00.000Z",
          updatedAt: "2026-11-26T00:00:00.000Z",
        },
      },
      "inst-1",
      ["instructor"],
    );
    expect(compState.courseCompletions.find((c) => c.id === "stu-1::c1")?.status).toBe(
      "completed",
    );
    expect(createDefaultRolePermissions().instructor.communication.edit).toBe(true);
  });
});
