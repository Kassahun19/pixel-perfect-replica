import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import { buildCourseThumbnailPrompt, generateImage, imageSettings } from "@/lib/image-gateway.server";

const requestSchema = z.object({
  title: z.string().trim().min(1).max(200),
  shortDescription: z.string().max(400).optional(),
  description: z.string().max(4000).optional(),
  level: z.string().max(60).optional(),
  category: z.string().max(120).optional(),
  stream: z.boolean().optional(),
});

function createAuthedSupabase(url: string, key: string, token: string) {
  const isOpaque = key.startsWith("sb_publishable_") || key.startsWith("sb_secret_");
  return createClient<Database>(url, key, {
    global: {
      fetch: (input, init) => {
        const headers = new Headers(init?.headers);
        if (isOpaque && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

export const Route = createFileRoute("/api/generate-course-thumbnail")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Unauthorized: sign in to generate course thumbnails.", { status: 401 });
        }
        const token = authHeader.slice(7).trim();
        const supabaseUrl = process.env["SUPABASE_URL"];
        const supabaseKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
        if (!supabaseUrl || !supabaseKey) {
          return new Response("Server configuration error", { status: 500 });
        }

        const supabase = createAuthedSupabase(supabaseUrl, supabaseKey, token);
        const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
        const userId = claimsData?.claims?.sub;
        if (claimsError || !userId) {
          return new Response("Unauthorized: invalid session.", { status: 401 });
        }

        const [{ data: isStaff }, { data: isInstructor }] = await Promise.all([
          supabase.rpc("is_staff", { _user_id: userId }),
          supabase.rpc("has_role", { _user_id: userId, _role: "instructor" }),
        ]);
        if (!isStaff && !isInstructor) {
          return new Response("Forbidden: only Owners, Admins, and Instructors can generate course thumbnails.", { status: 403 });
        }

        const parsed = requestSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return new Response("Invalid course thumbnail request.", { status: 400 });
        }

        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return new Response("Missing LOVABLE_API_KEY", { status: 500 });
        }

        const prompt = buildCourseThumbnailPrompt(parsed.data);
        const upstream = await generateImage(
          { ...imageSettings, apiKey },
          prompt,
          parsed.data.stream ?? true,
        );
        return new Response(upstream.body, {
          status: upstream.status,
          headers: {
            "Content-Type": upstream.headers.get("Content-Type") ?? "application/json",
            "Cache-Control": "no-cache",
          },
        });
      },
    },
  },
});