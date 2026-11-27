import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { displayName, useAuth, type AppRole } from "@/lib/auth";
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
import type { ScopedParentWorkspace } from "@/lib/parent/types";
import type { PrintableReportPayload } from "@/components/dashboard/owner/useOwnerData";

export interface DirectoryPerson {
  id: string;
  fullName: string;
  avatarUrl: string | null;
  bio: string | null;
  email: string;
  phone: string | null;
}

export interface ParentSupabaseData {
  parentLinks: ParentLinkRow[];
  childProfiles: ProfileRow[];
  courses: CourseRow[];
  categories: CategoryRow[];
  lessons: LessonRow[];
  enrollments: EnrollmentRow[];
  progress: ProgressRow[];
  payments: PaymentRow[];
  announcements: AnnouncementRow[];
  directoryPeople: DirectoryPerson[];
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
    token = userId ? `mock.${btoa(userId)}.token` : "mock.cGFyZW50.token";
  }
  return token;
}

const SELECTED_CHILD_STORAGE_KEY = "ezana_parent_selected_child";

export function useParentWorkspace(activeRoles: AppRole[]) {
  const { user, profile } = useAuth();
  const qc = useQueryClient();
  const [mutating, setMutating] = useState(false);
  const [printable, setPrintable] = useState<PrintableReportPayload | null>(null);
  const [selectedChildState, setSelectedChildState] = useState<string>(() => {
    if (typeof window === "undefined") return "";
    try {
      return window.localStorage.getItem(SELECTED_CHILD_STORAGE_KEY) ?? "";
    } catch {
      return "";
    }
  });

  const workspaceQuery = useQuery<ScopedParentWorkspace>({
    queryKey: ["parent-workspace", user?.id],
    enabled: !!user,
    staleTime: 25_000,
    queryFn: async () => {
      const token = await getBearerToken();
      const res = await fetch("/api/parent/workspace", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Could not load Parent workspace.");
      }
      return (await res.json()) as ScopedParentWorkspace;
    },
  });

  const wsSnapshotKey = useMemo(() => {
    const ws = workspaceQuery.data;
    if (!ws) return "";
    return [
      ws.linkedChildIds.join(","),
      ws.authorizedInstructorIds.join(","),
      ws.authorizedAdminIds.join(","),
    ].join("|");
  }, [workspaceQuery.data]);

  const dbQuery = useQuery<ParentSupabaseData>({
    queryKey: ["parent-db", user?.id, wsSnapshotKey],
    enabled: !!user,
    staleTime: 25_000,
    queryFn: async () => {
      const uid = user!.id;
      const [parentLinksRes, coursesRes, categoriesRes, announcementsRes, dirRes] =
        await Promise.all([
          supabase
            .from("parent_links")
            .select("*")
            .eq("parent_id", uid)
            .order("created_at", { ascending: true }),
          supabase
            .from("courses")
            .select("*")
            .eq("status", "published")
            .order("created_at", { ascending: false }),
          supabase.from("categories").select("*").order("name"),
          supabase
            .from("announcements")
            .select("*")
            .eq("published", true)
            .order("publish_at", { ascending: false })
            .limit(100),
          supabase.rpc("instructor_directory"),
        ]);

      const parentLinks = unwrap(parentLinksRes);
      const childIds = [...new Set(parentLinks.map((l) => l.student_id))];
      const publishedCourses = unwrap(coursesRes);

      let childProfiles: ProfileRow[] = [];
      let enrollments: EnrollmentRow[] = [];
      let progress: ProgressRow[] = [];
      let payments: PaymentRow[] = [];

      if (childIds.length > 0) {
        const [profilesRes, enrollmentsRes, progressRes, paymentsRes] = await Promise.all([
          supabase.from("profiles").select("*").in("id", childIds),
          supabase
            .from("enrollments")
            .select("*")
            .in("user_id", childIds)
            .order("created_at", { ascending: false }),
          supabase
            .from("lesson_progress")
            .select("*")
            .in("user_id", childIds)
            .order("completed_at", { ascending: false }),
          supabase
            .from("payments")
            .select("*")
            .in("user_id", childIds)
            .order("created_at", { ascending: false }),
        ]);
        childProfiles = unwrap(profilesRes);
        enrollments = unwrap(enrollmentsRes);
        progress = unwrap(progressRes);
        payments = unwrap(paymentsRes);
      }

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

      const directoryPeople: DirectoryPerson[] = [];
      const seenDir = new Set<string>();
      for (const row of dirRes.data ?? []) {
        if (!row.id || seenDir.has(row.id)) continue;
        seenDir.add(row.id);
        directoryPeople.push({
          id: row.id,
          fullName: row.full_name?.trim() || "Academy Staff",
          avatarUrl: row.avatar_url ?? null,
          bio: row.bio ?? null,
          email: "",
          phone: null,
        });
      }

      // Also fallback-query authorized recipient profiles in mock/privileged contexts
      const recipientIds = (workspaceQuery.data?.authorizedRecipientIds ?? []).filter(
        (id) => !seenDir.has(id),
      );
      if (recipientIds.length > 0) {
        const extraProfiles = await supabase
          .from("profiles")
          .select("*")
          .in("id", recipientIds);
        if (!extraProfiles.error && extraProfiles.data) {
          for (const p of extraProfiles.data) {
            if (seenDir.has(p.id)) continue;
            seenDir.add(p.id);
            directoryPeople.push({
              id: p.id,
              fullName: displayName(p),
              avatarUrl: p.avatar_url ?? null,
              bio: p.bio ?? null,
              email: p.email,
              phone: p.phone,
            });
          }
        }
      }

      const rawAnnouncements = unwrap(announcementsRes);
      const announcements = rawAnnouncements.filter(
        (a) => a.audience === null || a.audience === "parent" || a.audience === "student",
      );

      return {
        parentLinks,
        childProfiles,
        courses,
        categories: unwrap(categoriesRes),
        lessons: unwrap(lessonsRes),
        enrollments,
        progress,
        payments,
        announcements,
        directoryPeople,
      };
    },
  });

  const db = useMemo<ParentSupabaseData>(
    () =>
      dbQuery.data ?? {
        parentLinks: [],
        childProfiles: [],
        courses: [],
        categories: [],
        lessons: [],
        enrollments: [],
        progress: [],
        payments: [],
        announcements: [],
        directoryPeople: [],
      },
    [dbQuery.data],
  );

  const workspace = workspaceQuery.data;

  const linkedChildIds = useMemo(() => {
    const set = new Set<string>();
    for (const l of db.parentLinks) set.add(l.student_id);
    for (const cid of workspace?.linkedChildIds ?? []) set.add(cid);
    return [...set];
  }, [db.parentLinks, workspace?.linkedChildIds]);

  const selectedChildId = useMemo(() => {
    if (selectedChildState && linkedChildIds.includes(selectedChildState)) {
      return selectedChildState;
    }
    return linkedChildIds[0] ?? "";
  }, [linkedChildIds, selectedChildState]);

  const setSelectedChildId = useCallback((childId: string) => {
    setSelectedChildState(childId);
    if (typeof window !== "undefined") {
      try {
        window.localStorage.setItem(SELECTED_CHILD_STORAGE_KEY, childId);
      } catch {
        // Ignore storage restrictions
      }
    }
  }, []);

  useEffect(() => {
    if (selectedChildId && selectedChildId !== selectedChildState) {
      setSelectedChildState(selectedChildId);
    }
  }, [selectedChildId, selectedChildState]);

  const refreshAll = useCallback(
    async (successMsg?: string) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["parent-workspace"] }),
        qc.invalidateQueries({ queryKey: ["parent-db"] }),
        qc.invalidateQueries({ queryKey: ["role-dashboard"] }),
        qc.invalidateQueries({ queryKey: ["payments"] }),
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
        const res = await fetch("/api/parent/workspace", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        const body = (await res.json().catch(() => null)) as {
          ok?: boolean;
          state?: ScopedParentWorkspace;
          error?: string;
        } | null;
        if (!res.ok || !body?.ok) {
          throw new Error(body?.error ?? "Operation failed.");
        }
        if (body.state) {
          qc.setQueryData(["parent-workspace", user?.id], body.state);
        }
        await qc.invalidateQueries({ queryKey: ["parent-db"] });
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

  const maps = useMemo(() => {
    const childProfilesById = new Map<string, ProfileRow>(
      db.childProfiles.map((p) => [p.id, p]),
    );
    const directoryById = new Map<string, DirectoryPerson>(
      db.directoryPeople.map((d) => [d.id, d]),
    );
    if (profile) {
      directoryById.set(profile.id, {
        id: profile.id,
        fullName: displayName(profile),
        avatarUrl: profile.avatar_url ?? null,
        bio: profile.bio ?? null,
        email: profile.email,
        phone: profile.phone,
      });
    }
    for (const cp of db.childProfiles) {
      directoryById.set(cp.id, {
        id: cp.id,
        fullName: displayName(cp),
        avatarUrl: cp.avatar_url ?? null,
        bio: cp.bio ?? null,
        email: cp.email,
        phone: cp.phone,
      });
    }

    const coursesById = new Map(db.courses.map((c) => [c.id, c]));
    const categoriesById = new Map(db.categories.map((c) => [c.id, c]));
    const lessonsByCourse = new Map<string, LessonRow[]>();
    for (const l of db.lessons) {
      lessonsByCourse.set(l.course_id, [...(lessonsByCourse.get(l.course_id) ?? []), l]);
    }
    const classesById = new Map<string, ClassSection>(
      (workspace?.classes ?? []).map((c) => [c.id, c]),
    );
    const linksByChildId = new Map(db.parentLinks.map((l) => [l.student_id, l]));

    const instructors = (workspace?.authorizedInstructorIds ?? [])
      .map((id) => directoryById.get(id))
      .filter((p): p is DirectoryPerson => Boolean(p));
    const admins = (workspace?.authorizedAdminIds ?? [])
      .map((id) => directoryById.get(id))
      .filter((p): p is DirectoryPerson => Boolean(p));

    const resolvePersonName = (id: string | null | undefined, fallback = "Academy Staff") => {
      if (!id) return fallback;
      const cp = childProfilesById.get(id);
      if (cp) return displayName(cp);
      const dir = directoryById.get(id);
      if (dir) return dir.fullName;
      return fallback;
    };

    return {
      childProfilesById,
      directoryById,
      coursesById,
      categoriesById,
      lessonsByCourse,
      classesById,
      linksByChildId,
      instructors,
      admins,
      resolvePersonName,
    };
  }, [db, profile, workspace]);

  const activeChild = useMemo(() => {
    const childId = selectedChildId;
    const childProfile = childId ? maps.childProfilesById.get(childId) ?? null : null;
    const childMeta = childId ? workspace?.studentMetaByChild[childId] ?? null : null;
    const relationship =
      (childId ? workspace?.relationshipsByChild[childId] : null) ??
      maps.linksByChildId.get(childId)?.relationship ??
      "Parent";
    const enrollments = db.enrollments.filter((e) => e.user_id === childId);
    const enrolledCourseIdSet = new Set<string>([
      ...enrollments.map((e) => e.course_id),
      ...(childId ? workspace?.enrolledCourseByChild[childId] ?? [] : []),
    ]);
    const assignedClassIdSet = new Set<string>(
      childId ? workspace?.assignedClassByChild[childId] ?? [] : [],
    );
    if (childMeta?.classSectionId) assignedClassIdSet.add(childMeta.classSectionId);
    const payments = db.payments.filter((p) => p.user_id === childId);
    const paidCourseIdSet = new Set<string>([
      ...payments.filter((p) => p.status === "approved").map((p) => p.course_id),
      ...(childId ? workspace?.paidCourseByChild[childId] ?? [] : []),
    ]);
    const progress = db.progress.filter((p) => p.user_id === childId);
    const completedLessonIdSet = new Set(progress.map((p) => p.lesson_id));
    const courses = db.courses.filter((c) => enrolledCourseIdSet.has(c.id));
    const attendance = (workspace?.attendance ?? []).filter((a) => a.personId === childId);
    const grades = (workspace?.grades ?? []).filter((g) => g.studentId === childId);
    const feePlans = (workspace?.feePlans ?? []).filter((f) => f.studentId === childId);
    const invoices = (workspace?.invoices ?? []).filter((inv) => inv.studentId === childId);
    const examSubmissions = (workspace?.examSubmissions ?? []).filter(
      (s) => s.studentId === childId,
    );
    const assignmentSubmissions = (workspace?.assignmentSubmissions ?? []).filter(
      (s) => s.studentId === childId,
    );
    const certificates = (workspace?.issuedCertificates ?? []).filter(
      (c) => c.studentId === childId,
    );
    const completions = (workspace?.courseCompletions ?? []).filter(
      (c) => c.studentId === childId,
    );
    const classSection = childMeta?.classSectionId
      ? maps.classesById.get(childMeta.classSectionId) ?? null
      : (workspace?.classes.find((c) => assignedClassIdSet.has(c.id)) ?? null);

    return {
      childId,
      profile: childProfile,
      meta: childMeta,
      relationship,
      classSection,
      enrollments,
      enrolledCourseIdSet,
      assignedClassIdSet,
      paidCourseIdSet,
      courses,
      progress,
      completedLessonIdSet,
      payments,
      attendance,
      grades,
      feePlans,
      invoices,
      examSubmissions,
      assignmentSubmissions,
      certificates,
      completions,
    };
  }, [db, maps, selectedChildId, workspace]);

  const can = useCallback(
    (module: PermissionModule, action: PermissionAction) => {
      if (activeRoles.includes("owner")) return true;
      const myPerms = workspace?.myPermissions ?? createDefaultRolePermissions().parent;
      const matrix = { ...createDefaultRolePermissions(), parent: myPerms };
      return hasModulePermission(matrix, ["parent"], module, action);
    },
    [workspace?.myPermissions, activeRoles],
  );

  return {
    db,
    workspace,
    maps,
    linkedChildIds,
    selectedChildId,
    setSelectedChildId,
    activeChild,
    isLoading: workspaceQuery.isLoading || dbQuery.isLoading,
    error: workspaceQuery.error || dbQuery.error,
    mutating,
    mutateWorkspace,
    getSignedReceiptUrl,
    refreshAll,
    can,
    printable,
    setPrintable,
  };
}

export type ParentDataHandle = ReturnType<typeof useParentWorkspace>;
