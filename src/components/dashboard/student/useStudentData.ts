import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth";
import { RECEIPT_BUCKET } from "@/lib/payment-info";
import { createDefaultRolePermissions, hasModulePermission } from "@/lib/owner/logic";
import type {
  AnnouncementRow,
  CategoryRow,
  ClassSection,
  CourseRow,
  EnrollmentRow,
  LessonRow,
  ParentLinkRow,
  PaymentRow,
  PermissionAction,
  PermissionModule,
  ProfileRow,
  ProgressRow,
} from "@/lib/owner/types";
import type { ScopedStudentWorkspace } from "@/lib/student/types";
import type { PrintableReportPayload } from "@/components/dashboard/owner/useOwnerData";

export interface StudentSupabaseData {
  courses: CourseRow[];
  categories: CategoryRow[];
  lessons: LessonRow[];
  enrollments: EnrollmentRow[];
  progress: ProgressRow[];
  payments: PaymentRow[];
  parentLinks: ParentLinkRow[];
  profiles: ProfileRow[];
  announcements: AnnouncementRow[];
}

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data ?? ([] as unknown as T);
}

async function getBearerToken(): Promise<string> {
  const { data } = await supabase.auth.getSession();
  let token = data.session?.access_token;
  if (!token) {
    const userRes = await supabase.auth.getUser().catch(() => ({ data: { user: null } }));
    const userId = userRes.data.user?.id;
    token = userId ? `mock.${btoa(userId)}.token` : "mock.c3R1ZGVudA==.token";
  }
  return token;
}

export function useStudentWorkspace(activeRoles: AppRole[]) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [mutating, setMutating] = useState(false);
  const [printable, setPrintable] = useState<PrintableReportPayload | null>(null);

  const workspaceQuery = useQuery<ScopedStudentWorkspace>({
    queryKey: ["student-workspace", user?.id],
    enabled: !!user,
    staleTime: 25_000,
    queryFn: async () => {
      const token = await getBearerToken();
      const res = await fetch("/api/student/workspace", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Could not load Student workspace.");
      }
      return (await res.json()) as ScopedStudentWorkspace;
    },
  });

  const wsSnapshotKey = useMemo(() => {
    const ws = workspaceQuery.data;
    if (!ws) return "";
    return [
      ws.authorizedRecipientIds.join(","),
      ws.linkedParentIds.join(","),
      ws.classes.map((c) => c.instructorId ?? "").join(","),
    ].join("|");
  }, [workspaceQuery.data]);

  const dbQuery = useQuery<StudentSupabaseData>({
    queryKey: ["student-db", user?.id, wsSnapshotKey],
    enabled: !!user,
    staleTime: 25_000,
    queryFn: async () => {
      const uid = user!.id;
      const [
        coursesRes,
        categoriesRes,
        enrollmentsRes,
        progressRes,
        paymentsRes,
        parentLinksRes,
        announcementsRes,
      ] = await Promise.all([
        supabase
          .from("courses")
          .select("*")
          .eq("status", "published")
          .order("created_at", { ascending: false }),
        supabase.from("categories").select("*").order("name"),
        supabase
          .from("enrollments")
          .select("*")
          .eq("user_id", uid)
          .order("created_at", { ascending: false }),
        supabase
          .from("lesson_progress")
          .select("*")
          .eq("user_id", uid)
          .order("completed_at", { ascending: false }),
        supabase
          .from("payments")
          .select("*")
          .eq("user_id", uid)
          .order("created_at", { ascending: false }),
        supabase
          .from("parent_links")
          .select("*")
          .eq("student_id", uid)
          .order("created_at", { ascending: false }),
        supabase
          .from("announcements")
          .select("*")
          .eq("published", true)
          .order("publish_at", { ascending: false })
          .limit(100),
      ]);

      const publishedCourses = unwrap(coursesRes);
      const enrollments = unwrap(enrollmentsRes);
      const enrolledCourseIds = [...new Set(enrollments.map((e) => e.course_id))];
      const missingEnrolledIds = enrolledCourseIds.filter(
        (id) => !publishedCourses.some((c) => c.id === id),
      );
      let courses = publishedCourses;
      if (missingEnrolledIds.length > 0) {
        const extraCourses = await supabase
          .from("courses")
          .select("*")
          .in("id", missingEnrolledIds);
        if (!extraCourses.error && extraCourses.data?.length) {
          courses = [...publishedCourses, ...extraCourses.data];
        }
      }

      const courseIdsToLoadLessons = [...new Set(courses.map((c) => c.id))];
      const lessonsRes = courseIdsToLoadLessons.length
        ? await supabase
            .from("lessons")
            .select("*")
            .in("course_id", courseIdsToLoadLessons)
            .order("position")
        : { data: [] as LessonRow[], error: null };

      const parentLinks = unwrap(parentLinksRes);
      const instructorIds = courses
        .map((c) => c.instructor_id)
        .filter((id): id is string => Boolean(id));
      const classInstructorIds = (workspaceQuery.data?.classes ?? [])
        .map((c) => c.instructorId)
        .filter((id): id is string => Boolean(id));
      const recipientIds = workspaceQuery.data?.authorizedRecipientIds ?? [];
      const discussionAuthors = [
        ...(workspaceQuery.data?.discussionThreads ?? []).map((t) => t.authorId),
        ...(workspaceQuery.data?.discussionPosts ?? []).map((p) => p.authorId),
      ];
      const msgParticipants = (workspaceQuery.data?.internalMessages ?? []).flatMap((m) => [
        m.senderId,
        m.recipientId,
      ]);
      const parentMsgSenders = (workspaceQuery.data?.parentMessages ?? []).map((m) => m.senderId);

      const profileIds = [
        ...new Set([
          uid,
          ...instructorIds,
          ...classInstructorIds,
          ...parentLinks.map((l) => l.parent_id),
          ...recipientIds,
          ...discussionAuthors,
          ...msgParticipants,
          ...parentMsgSenders,
        ]),
      ];

      const profilesRes = profileIds.length
        ? await supabase.from("profiles").select("*").in("id", profileIds)
        : { data: [] as ProfileRow[], error: null };

      const rawAnnouncements = unwrap(announcementsRes);
      const announcements = rawAnnouncements.filter(
        (a) => a.audience === null || a.audience === "student",
      );

      return {
        courses,
        categories: unwrap(categoriesRes),
        lessons: unwrap(lessonsRes),
        enrollments,
        progress: unwrap(progressRes),
        payments: unwrap(paymentsRes),
        parentLinks,
        profiles: unwrap(profilesRes),
        announcements,
      };
    },
  });

  const refreshAll = useCallback(
    async (successMsg?: string) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["student-workspace"] }),
        qc.invalidateQueries({ queryKey: ["student-db"] }),
        qc.invalidateQueries({ queryKey: ["role-dashboard"] }),
        qc.invalidateQueries({ queryKey: ["payments"] }),
        qc.invalidateQueries({ queryKey: ["lesson-progress"] }),
        qc.invalidateQueries({ queryKey: ["public"] }),
      ]);
      if (successMsg) toast.success(successMsg);
    },
    [qc],
  );

  const mutateWorkspace = useCallback(
    async (payload: Record<string, unknown>, successMsg?: string) => {
      setMutating(true);
      try {
        const token = await getBearerToken();
        const res = await fetch("/api/student/workspace", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        const body = (await res.json().catch(() => null)) as {
          ok?: boolean;
          state?: ScopedStudentWorkspace;
          error?: string;
        } | null;
        if (!res.ok || !body?.ok) {
          throw new Error(body?.error ?? "Operation failed.");
        }
        if (body.state) {
          qc.setQueryData(["student-workspace", user?.id], body.state);
        }
        await qc.invalidateQueries({ queryKey: ["student-db"] });
        if (successMsg) toast.success(successMsg);
        return body.state;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not save changes.");
        throw err;
      } finally {
        setMutating(false);
      }
    },
    [qc, user?.id],
  );

  const enrollDirectly = useCallback(
    async (course: CourseRow) => {
      if (!user) return;
      setMutating(true);
      try {
        const { error } = await supabase
          .from("enrollments")
          .insert({ user_id: user.id, course_id: course.id });
        if (error && error.code !== "23505") {
          throw new Error(error.message);
        }
        await refreshAll(`Enrolled in ${course.title}`);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not complete enrollment.");
        throw err;
      } finally {
        setMutating(false);
      }
    },
    [refreshAll, user],
  );

  const markLessonComplete = useCallback(
    async (courseId: string, lessonId: string) => {
      if (!user) return;
      setMutating(true);
      try {
        const { error } = await supabase
          .from("lesson_progress")
          .insert({ user_id: user.id, course_id: courseId, lesson_id: lessonId });
        if (error && error.code !== "23505") {
          throw new Error(error.message);
        }
        await refreshAll("Lesson marked complete");
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Could not record progress.");
        throw err;
      } finally {
        setMutating(false);
      }
    },
    [refreshAll, user],
  );

  const getSignedReceiptUrl = useCallback(async (receiptPath: string | null) => {
    if (!receiptPath) return null;
    const { data, error } = await supabase.storage
      .from(RECEIPT_BUCKET)
      .createSignedUrl(receiptPath, 600);
    if (error || !data?.signedUrl) {
      toast.error(error?.message ?? "Could not generate a secure receipt link.");
      return null;
    }
    return data.signedUrl;
  }, []);

  const db = useMemo<StudentSupabaseData>(
    () =>
      dbQuery.data ?? {
        courses: [],
        categories: [],
        lessons: [],
        enrollments: [],
        progress: [],
        payments: [],
        parentLinks: [],
        profiles: [],
        announcements: [],
      },
    [dbQuery.data],
  );

  const workspace = workspaceQuery.data;

  const maps = useMemo(() => {
    const profilesById = new Map(db.profiles.map((p) => [p.id, p]));
    const coursesById = new Map(db.courses.map((c) => [c.id, c]));
    const categoriesById = new Map(db.categories.map((c) => [c.id, c]));
    const lessonsByCourse = new Map<string, LessonRow[]>();
    for (const l of db.lessons) {
      lessonsByCourse.set(l.course_id, [...(lessonsByCourse.get(l.course_id) ?? []), l]);
    }
    const classesById = new Map<string, ClassSection>(
      (workspace?.classes ?? []).map((c) => [c.id, c]),
    );
    const enrolledCourseIdSet = new Set<string>([
      ...db.enrollments.map((e) => e.course_id),
      ...(workspace?.enrolledCourseIds ?? []),
    ]);
    const paidCourseIdSet = new Set<string>([
      ...db.payments.filter((p) => p.status === "approved").map((p) => p.course_id),
      ...(workspace?.paidCourseIds ?? []),
    ]);
    const completedLessonIdSet = new Set<string>(db.progress.map((p) => p.lesson_id));
    const myCourses = db.courses.filter((c) => enrolledCourseIdSet.has(c.id));
    const parents = db.parentLinks
      .map((l) => profilesById.get(l.parent_id))
      .filter((p): p is ProfileRow => Boolean(p));

    const recipients = (workspace?.authorizedRecipientIds ?? [])
      .filter((id) => id !== user?.id)
      .map((id) => profilesById.get(id))
      .filter((p): p is ProfileRow => Boolean(p));

    return {
      profilesById,
      coursesById,
      categoriesById,
      lessonsByCourse,
      classesById,
      enrolledCourseIdSet,
      paidCourseIdSet,
      completedLessonIdSet,
      myCourses,
      parents,
      recipients,
    };
  }, [db, user?.id, workspace]);

  const can = useCallback(
    (module: PermissionModule, action: PermissionAction) => {
      if (activeRoles.includes("owner")) return true;
      const myPerms = workspace?.myPermissions ?? createDefaultRolePermissions().student;
      const matrix = { ...createDefaultRolePermissions(), student: myPerms };
      return hasModulePermission(matrix, ["student"], module, action);
    },
    [workspace?.myPermissions, activeRoles],
  );

  return {
    db,
    workspace,
    maps,
    isLoading: workspaceQuery.isLoading || dbQuery.isLoading,
    error: workspaceQuery.error || dbQuery.error,
    mutating,
    mutateWorkspace,
    enrollDirectly,
    markLessonComplete,
    getSignedReceiptUrl,
    refreshAll,
    can,
    printable,
    setPrintable,
  };
}

export type StudentDataHandle = ReturnType<typeof useStudentWorkspace>;
