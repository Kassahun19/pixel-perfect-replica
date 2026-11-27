import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth";
import type { ScopedInstructorWorkspace } from "@/lib/instructor/types";
import { createDefaultRolePermissions, hasModulePermission } from "@/lib/owner/logic";
import type {
  AnnouncementRow,
  AuditLogRow,
  CategoryRow,
  ClassSection,
  CourseRow,
  EnrollmentRow,
  LessonRow,
  ParentLinkRow,
  PermissionAction,
  PermissionModule,
  ProfileRow,
  ProgressRow,
} from "@/lib/owner/types";
import type { PrintableReportPayload } from "@/components/dashboard/owner/useOwnerData";

export interface InstructorSupabaseData {
  courses: CourseRow[];
  categories: CategoryRow[];
  lessons: LessonRow[];
  enrollments: EnrollmentRow[];
  progress: ProgressRow[];
  profiles: ProfileRow[];
  parentLinks: ParentLinkRow[];
  announcements: AnnouncementRow[];
  audit: AuditLogRow[];
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
    token = userId ? `mock.${btoa(userId)}.token` : "mock.cmVzdHdhcmU=.token";
  }
  return token;
}

export function useInstructorWorkspace(activeRoles: AppRole[]) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [mutating, setMutating] = useState(false);
  const [printable, setPrintable] = useState<PrintableReportPayload | null>(null);

  const workspaceQuery = useQuery<ScopedInstructorWorkspace>({
    queryKey: ["instructor-workspace", user?.id],
    enabled: !!user,
    staleTime: 25_000,
    queryFn: async () => {
      const token = await getBearerToken();
      const res = await fetch("/api/instructor/workspace", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Could not load Instructor workspace.");
      }
      return (await res.json()) as ScopedInstructorWorkspace;
    },
  });

  const dbQuery = useQuery<InstructorSupabaseData>({
    queryKey: ["instructor-db", user?.id, workspaceQuery.data?.assignedClassIds.join(",") ?? ""],
    enabled: !!user,
    staleTime: 25_000,
    queryFn: async () => {
      const uid = user!.id;
      const [coursesRes, categoriesRes, announcementsRes, auditRes] = await Promise.all([
        supabase
          .from("courses")
          .select("*")
          .eq("instructor_id", uid)
          .order("created_at", { ascending: false }),
        supabase.from("categories").select("*").order("name"),
        supabase
          .from("announcements")
          .select("*")
          .order("publish_at", { ascending: false })
          .limit(200),
        supabase
          .from("audit_logs")
          .select("*")
          .eq("actor_id", uid)
          .order("created_at", { ascending: false })
          .limit(100),
      ]);

      const courses = unwrap(coursesRes);
      const courseIds = courses.map((c) => c.id);

      const [lessonsRes, enrollmentsRes, progressRes] = courseIds.length
        ? await Promise.all([
            supabase.from("lessons").select("*").in("course_id", courseIds).order("position"),
            supabase
              .from("enrollments")
              .select("*")
              .in("course_id", courseIds)
              .order("created_at", { ascending: false }),
            supabase.from("lesson_progress").select("*").in("course_id", courseIds),
          ])
        : [
            { data: [] as LessonRow[], error: null },
            { data: [] as EnrollmentRow[], error: null },
            { data: [] as ProgressRow[], error: null },
          ];

      const lessons = unwrap(lessonsRes);
      const enrollments = unwrap(enrollmentsRes);
      const progress = unwrap(progressRes);

      const classStudentIds = workspaceQuery.data?.assignedStudentIds ?? [];
      const studentIds = [...new Set([...enrollments.map((e) => e.user_id), ...classStudentIds])];

      const parentLinksRes = studentIds.length
        ? await supabase.from("parent_links").select("*").in("student_id", studentIds)
        : { data: [] as ParentLinkRow[], error: null };
      const parentLinks = unwrap(parentLinksRes);
      const parentIds = parentLinks.map((l) => l.parent_id);

      const profileIdsToLoad = [...new Set([uid, ...studentIds, ...parentIds])];
      const profilesRes = profileIdsToLoad.length
        ? await supabase.from("profiles").select("*").in("id", profileIdsToLoad)
        : { data: [] as ProfileRow[], error: null };

      return {
        courses,
        categories: unwrap(categoriesRes),
        lessons,
        enrollments,
        progress,
        profiles: unwrap(profilesRes),
        parentLinks,
        announcements: unwrap(announcementsRes),
        audit: unwrap(auditRes),
      };
    },
  });

  const refreshAll = useCallback(
    async (successMsg?: string) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["instructor-workspace"] }),
        qc.invalidateQueries({ queryKey: ["instructor-db"] }),
        qc.invalidateQueries({ queryKey: ["role-dashboard"] }),
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
        const res = await fetch("/api/instructor/workspace", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        const body = (await res.json().catch(() => null)) as {
          ok?: boolean;
          state?: ScopedInstructorWorkspace;
          error?: string;
        } | null;
        if (!res.ok || !body?.ok) {
          throw new Error(body?.error ?? "Operation failed.");
        }
        if (body.state) {
          qc.setQueryData(["instructor-workspace", user?.id], body.state);
        }
        await qc.invalidateQueries({ queryKey: ["instructor-db"] });
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

  const db = useMemo<InstructorSupabaseData>(
    () =>
      dbQuery.data ?? {
        courses: [],
        categories: [],
        lessons: [],
        enrollments: [],
        progress: [],
        profiles: [],
        parentLinks: [],
        announcements: [],
        audit: [],
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
    const studentIdSet = new Set<string>([
      ...db.enrollments.map((e) => e.user_id),
      ...(workspace?.assignedStudentIds ?? []),
    ]);
    const parentIdSet = new Set<string>([
      ...db.parentLinks.map((l) => l.parent_id),
      ...(workspace?.linkedParentIds ?? []),
    ]);
    const students = db.profiles.filter((p) => studentIdSet.has(p.id));
    const parents = db.profiles.filter((p) => parentIdSet.has(p.id));
    const linkedParentsByStudent = new Map<string, ProfileRow[]>();
    for (const l of db.parentLinks) {
      const parent = profilesById.get(l.parent_id);
      if (parent) {
        linkedParentsByStudent.set(l.student_id, [
          ...(linkedParentsByStudent.get(l.student_id) ?? []),
          parent,
        ]);
      }
    }
    return {
      profilesById,
      coursesById,
      categoriesById,
      lessonsByCourse,
      classesById,
      studentIdSet,
      parentIdSet,
      students,
      parents,
      linkedParentsByStudent,
    };
  }, [db, workspace]);

  const can = useCallback(
    (module: PermissionModule, action: PermissionAction) => {
      if (activeRoles.includes("owner")) return true;
      const myPerms = workspace?.myPermissions ?? createDefaultRolePermissions().instructor;
      const matrix = { ...createDefaultRolePermissions(), instructor: myPerms };
      return hasModulePermission(matrix, ["instructor"], module, action);
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
    refreshAll,
    can,
    printable,
    setPrintable,
  };
}

export type InstructorDataHandle = ReturnType<typeof useInstructorWorkspace>;
