import { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth, type AppRole } from "@/lib/auth";
import { createDefaultRolePermissions, hasModulePermission } from "@/lib/owner/logic";
import type {
  AcademySettingsRow,
  AnnouncementRow,
  AuditLogRow,
  CategoryRow,
  ClassSection,
  ContactMessageRow,
  CourseRow,
  EnrollmentRow,
  LessonRow,
  OwnerWorkspaceState,
  ParentLinkRow,
  PaymentRow,
  PermissionAction,
  PermissionModule,
  ProfileRow,
  ProgressRow,
  UserRoleRow,
} from "@/lib/owner/types";

export interface SupabaseAcademyData {
  profiles: ProfileRow[];
  roles: UserRoleRow[];
  courses: CourseRow[];
  categories: CategoryRow[];
  lessons: LessonRow[];
  enrollments: EnrollmentRow[];
  progress: ProgressRow[];
  payments: PaymentRow[];
  parentLinks: ParentLinkRow[];
  announcements: AnnouncementRow[];
  messages: ContactMessageRow[];
  audit: AuditLogRow[];
  settings: AcademySettingsRow | null;
}

export interface PrintableReportPayload {
  title: string;
  subtitle: string;
  meta?: Array<{ label: string; value: string }>;
  columns: string[];
  rows: Array<Array<string | number>>;
  footerNote?: string;
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
    if (userId) {
      token = `mock.${btoa(userId)}.token`;
    } else {
      token = "mock.cmVzdHdhcmU=.token";
    }
  }
  return token;
}

export function useOwnerWorkspace(activeRoles: AppRole[]) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [mutating, setMutating] = useState(false);
  const [printable, setPrintable] = useState<PrintableReportPayload | null>(null);

  const dbQuery = useQuery<SupabaseAcademyData>({
    queryKey: ["owner-db", user?.id],
    enabled: !!user,
    staleTime: 25_000,
    queryFn: async () => {
      const [
        profiles,
        roles,
        courses,
        categories,
        lessons,
        enrollments,
        progress,
        payments,
        parentLinks,
        announcements,
        messages,
        audit,
        settings,
      ] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }).limit(2000),
        supabase.from("user_roles").select("*"),
        supabase.from("courses").select("*").order("created_at", { ascending: false }),
        supabase.from("categories").select("*").order("name"),
        supabase.from("lessons").select("*").order("position"),
        supabase
          .from("enrollments")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(3000),
        supabase.from("lesson_progress").select("*").limit(8000),
        supabase.from("payments").select("*").order("created_at", { ascending: false }).limit(2000),
        supabase.from("parent_links").select("*").order("created_at", { ascending: false }),
        supabase.from("announcements").select("*").order("publish_at", { ascending: false }),
        supabase
          .from("contact_messages")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("audit_logs")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(500),
        supabase.from("academy_settings").select("*").eq("id", 1).maybeSingle(),
      ]);

      return {
        profiles: unwrap(profiles),
        roles: unwrap(roles),
        courses: unwrap(courses),
        categories: unwrap(categories),
        lessons: unwrap(lessons),
        enrollments: unwrap(enrollments),
        progress: unwrap(progress),
        payments: unwrap(payments),
        parentLinks: unwrap(parentLinks),
        announcements: unwrap(announcements),
        messages: unwrap(messages),
        audit: unwrap(audit),
        settings: settings.error ? null : settings.data,
      };
    },
  });

  const workspaceQuery = useQuery<OwnerWorkspaceState>({
    queryKey: ["owner-workspace", user?.id],
    enabled: !!user,
    staleTime: 25_000,
    queryFn: async () => {
      const token = await getBearerToken();
      const res = await fetch("/api/owner/workspace", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) {
        const msg = await res.text();
        throw new Error(msg || "Could not load Owner workspace.");
      }
      return (await res.json()) as OwnerWorkspaceState;
    },
  });

  const refreshAll = useCallback(
    async (successMsg?: string) => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["owner-db"] }),
        qc.invalidateQueries({ queryKey: ["owner-workspace"] }),
        qc.invalidateQueries({ queryKey: ["role-dashboard"] }),
        qc.invalidateQueries({ queryKey: ["public"] }),
        qc.invalidateQueries({ queryKey: ["payments"] }),
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
        const res = await fetch("/api/owner/workspace", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        const body = (await res.json().catch(() => null)) as {
          ok?: boolean;
          state?: OwnerWorkspaceState;
          error?: string;
        } | null;
        if (!res.ok || !body?.ok) {
          throw new Error(body?.error ?? "Operation failed.");
        }
        if (body.state) {
          qc.setQueryData(["owner-workspace", user?.id], body.state);
        }
        await qc.invalidateQueries({ queryKey: ["owner-db"] });
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

  const callUserApi = useCallback(
    async (payload: Record<string, unknown>, successMsg?: string) => {
      setMutating(true);
      try {
        const token = await getBearerToken();
        const res = await fetch("/api/owner/users", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(payload),
        });
        const body = (await res.json().catch(() => null)) as {
          ok?: boolean;
          userId?: string;
          error?: string;
        } | null;
        if (!res.ok || !body?.ok) {
          throw new Error(body?.error ?? "User update failed.");
        }

        // In local preview mock mode (no Supabase env configured), mirror user CRUD into the browser mock store
        if (!import.meta.env["VITE_SUPABASE_URL"]) {
          const act = payload["action"];
          if (act === "create" && body.userId) {
            await supabase.from("profiles").insert({
              id: body.userId,
              email: String(payload["email"] ?? "").toLowerCase(),
              first_name: String(payload["first_name"] ?? ""),
              last_name: String(payload["last_name"] ?? ""),
              phone: (payload["phone"] as string | null) ?? null,
              status: (payload["status"] as ProfileRow["status"]) ?? "active",
            });
            await supabase.from("user_roles").insert({
              user_id: body.userId,
              role: (payload["role"] as AppRole) ?? "student",
            });
          } else if (act === "update" && typeof payload["user_id"] === "string") {
            const uid = payload["user_id"];
            await supabase
              .from("profiles")
              .update({
                first_name: String(payload["first_name"] ?? ""),
                last_name: String(payload["last_name"] ?? ""),
                phone: (payload["phone"] as string | null) ?? null,
                bio: (payload["bio"] as string | null) ?? null,
                status: (payload["status"] as ProfileRow["status"]) ?? "active",
              })
              .eq("id", uid);
            const nextRoles = Array.isArray(payload["roles"])
              ? (payload["roles"] as AppRole[])
              : [];
            if (nextRoles.length > 0) {
              await supabase.from("user_roles").delete().eq("user_id", uid);
              await supabase
                .from("user_roles")
                .insert(nextRoles.map((r) => ({ user_id: uid, role: r })));
            }
          } else if (act === "delete" && typeof payload["user_id"] === "string") {
            const uid = payload["user_id"];
            await supabase.from("user_roles").delete().eq("user_id", uid);
            await supabase.from("profiles").delete().eq("id", uid);
          }
        }

        await refreshAll(successMsg);
        return body;
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "User request failed.");
        throw err;
      } finally {
        setMutating(false);
      }
    },
    [refreshAll],
  );

  const db = dbQuery.data ?? {
    profiles: [],
    roles: [],
    courses: [],
    categories: [],
    lessons: [],
    enrollments: [],
    progress: [],
    payments: [],
    parentLinks: [],
    announcements: [],
    messages: [],
    audit: [],
    settings: null,
  };

  const workspace = workspaceQuery.data;

  const maps = useMemo(() => {
    const profilesById = new Map(db.profiles.map((p) => [p.id, p]));
    const rolesByUser = new Map<string, AppRole[]>();
    for (const r of db.roles) {
      rolesByUser.set(r.user_id, [...(rolesByUser.get(r.user_id) ?? []), r.role]);
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
    return { profilesById, rolesByUser, coursesById, categoriesById, lessonsByCourse, classesById };
  }, [db, workspace?.classes]);

  const can = useCallback(
    (module: PermissionModule, action: PermissionAction) =>
      hasModulePermission(
        workspace?.rolePermissions ?? createDefaultRolePermissions(),
        activeRoles,
        module,
        action,
      ),
    [workspace?.rolePermissions, activeRoles],
  );

  return {
    db,
    workspace,
    maps,
    isLoading: dbQuery.isLoading || workspaceQuery.isLoading,
    error: dbQuery.error || workspaceQuery.error,
    mutating,
    setMutating,
    mutateWorkspace,
    callUserApi,
    refreshAll,
    can,
    printable,
    setPrintable,
  };
}

export type OwnerDataHandle = ReturnType<typeof useOwnerWorkspace>;
