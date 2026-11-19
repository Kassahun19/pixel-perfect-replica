import { supabase } from "@/integrations/supabase/client";
import type { AppRole } from "./auth";

/** Reads the signed-in user's roles straight from the database (used by route guards). */
export async function fetchMyRoles(): Promise<AppRole[]> {
  const { data: u } = await supabase.auth.getUser();
  if (!u.user) return [];
  const { data } = await supabase.from("user_roles").select("role").eq("user_id", u.user.id);
  return (data ?? []).map((r) => r.role);
}
