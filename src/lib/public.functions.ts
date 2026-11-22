import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { createMockSupabaseClient, warnMockOnce } from "@/integrations/supabase/mock";

function publicClient() {
  const url = process.env["SUPABASE_URL"];
  const key = process.env["SUPABASE_PUBLISHABLE_KEY"];
  if (!url || !key) {
    warnMockOnce("public.functions");
    return createMockSupabaseClient();
  }
  const isOpaque = key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
  const shim: typeof fetch = (input, init) => {
    const headers = new Headers(init?.headers);
    if (isOpaque && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
    headers.set("apikey", key);
    return fetch(input, { ...init, headers });
  };
  return createClient<Database>(url, key, {
    global: { fetch: shim },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export type PublicCourse = {
  id: string;
  title: string;
  slug: string;
  short_description: string;
  description: string;
  image_url: string | null;
  level: string;
  duration_hours: number;
  objectives: string[];
  category: { name: string; slug: string } | null;
  lesson_count: number;
};

export const listPublicCourses = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data, error } = await sb
    .from("courses")
    .select(
      "id,title,slug,short_description,description,image_url,level,duration_hours,objectives,created_at,categories(name,slug),lessons(count)",
    )
    .eq("status", "published")
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []).map((c) => ({
    id: c.id,
    title: c.title,
    slug: c.slug,
    short_description: c.short_description,
    description: c.description,
    image_url: c.image_url,
    level: c.level,
    duration_hours: c.duration_hours,
    objectives: c.objectives,
    category: c.categories ? { name: c.categories.name, slug: c.categories.slug } : null,
    lesson_count: (c.lessons as unknown as { count: number }[])?.[0]?.count ?? 0,
  })) as PublicCourse[];
});

export const getPublicCourse = createServerFn({ method: "GET" })
  .inputValidator((d: { slug: string }) => z.object({ slug: z.string().min(1).max(200) }).parse(d))
  .handler(async ({ data }) => {
    const sb = publicClient();
    const { data: c, error } = await sb
      .from("courses")
      .select(
        "id,title,slug,short_description,description,image_url,level,duration_hours,objectives,categories(name,slug)",
      )
      .eq("slug", data.slug)
      .eq("status", "published")
      .maybeSingle();
    if (error) throw new Error(error.message);
    if (!c) return null;
    const { data: lessons } = await sb
      .from("lessons")
      .select("id,title,position,duration_minutes")
      .eq("course_id", c.id)
      .order("position")
      .order("id");
    return {
      course: {
        ...c,
        category: c.categories ? { name: c.categories.name, slug: c.categories.slug } : null,
      },
      lessons: lessons ?? [],
    };
  });

export const listPublicCategories = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data, error } = await sb.from("categories").select("id,name,slug,description").order("name");
  if (error) throw new Error(error.message);
  return data ?? [];
});

export const getAcademySettings = createServerFn({ method: "GET" }).handler(async () => {
  const sb = publicClient();
  const { data } = await sb.from("academy_settings").select("*").eq("id", 1).maybeSingle();
  return data;
});
