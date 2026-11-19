import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

export type AppRole = Database["public"]["Enums"]["app_role"];
export type Profile = Database["public"]["Tables"]["profiles"]["Row"];

export const ROLE_ORDER: AppRole[] = ["owner", "admin", "instructor", "parent", "student"];
export const ROLE_LABEL: Record<AppRole, string> = {
  owner: "Owner",
  admin: "Admin",
  instructor: "Instructor",
  student: "Student",
  parent: "Parent",
};

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  roles: AppRole[];
  primaryRole: AppRole | null;
  isStaff: boolean;
  loading: boolean;
  hasRole: (role: AppRole) => boolean;
  hasAnyRole: (roles: AppRole[]) => boolean;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [loading, setLoading] = useState(true);

  const loadUserData = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      setRoles([]);
      return;
    }
    const [{ data: p }, { data: r }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", userId),
    ]);
    setProfile(p ?? null);
    setRoles((r ?? []).map((x) => x.role));
  }, []);

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      if (!active) return;
      setSession(s);
      if (event === "SIGNED_IN" || event === "USER_UPDATED" || event === "SIGNED_OUT") {
        // Defer to avoid running Supabase calls inside the auth callback.
        setTimeout(() => {
          void loadUserData(s?.user?.id);
        }, 0);
      }
    });
    supabase.auth.getSession().then(async ({ data }) => {
      if (!active) return;
      setSession(data.session);
      await loadUserData(data.session?.user?.id);
      if (active) setLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, [loadUserData]);

  const value = useMemo<AuthContextValue>(() => {
    const sorted = ROLE_ORDER.filter((r) => roles.includes(r));
    return {
      session,
      user: session?.user ?? null,
      profile,
      roles: sorted,
      primaryRole: sorted[0] ?? null,
      isStaff: roles.includes("owner") || roles.includes("admin"),
      loading,
      hasRole: (r) => roles.includes(r),
      hasAnyRole: (rs) => rs.some((r) => roles.includes(r)),
      refresh: () => loadUserData(session?.user?.id),
    };
  }, [session, profile, roles, loading, loadUserData]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}

export function displayName(p: Pick<Profile, "first_name" | "last_name" | "email"> | null | undefined) {
  if (!p) return "";
  const n = `${p.first_name ?? ""} ${p.last_name ?? ""}`.trim();
  return n || p.email;
}

export function initials(p: Pick<Profile, "first_name" | "last_name" | "email"> | null | undefined) {
  if (!p) return "?";
  const a = (p.first_name?.[0] ?? "") + (p.last_name?.[0] ?? "");
  return (a || p.email?.[0] || "?").toUpperCase();
}
