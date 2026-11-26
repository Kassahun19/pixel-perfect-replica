import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/integrations/supabase/types";
import {
  buildCourseThumbnailPrompt,
  formatImageSsePayload,
  generateCourseThumbnailImage,
} from "@/lib/image-gateway.server";

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
        if (isOpaque && headers.get("Authorization") === `Bearer ${key}`)
          headers.delete("Authorization");
        headers.set("apikey", key);
        return fetch(input, { ...init, headers });
      },
      headers: { Authorization: `Bearer ${token}` },
    },
    auth: { storage: undefined, persistSession: false, autoRefreshToken: false },
  });
}

function mapGeminiError(error: unknown): { status: number; message: string } {
  const rawMessage =
    error instanceof Error ? error.message : String(error ?? "Image generation failed");
  const statusMatch = rawMessage.match(/\b(400|401|403|404|429|500|503)\b/);
  const extractedStatus = statusMatch ? Number(statusMatch[1]) : undefined;
  const statusFromErr =
    typeof error === "object" &&
    error !== null &&
    "status" in error &&
    typeof (error as { status?: unknown }).status === "number"
      ? (error as { status: number }).status
      : extractedStatus;

  if (statusFromErr === 429 || rawMessage.includes("RESOURCE_EXHAUSTED")) {
    return {
      status: 429,
      message:
        "Gemini API quota exceeded for image generation. Check your GEMINI_API_KEY billing/quota in Settings > Secrets.",
    };
  }
  if (statusFromErr === 403 || rawMessage.includes("PERMISSION_DENIED")) {
    return {
      status: 403,
      message: "Gemini API permission denied. Verify GEMINI_API_KEY in Settings > Secrets.",
    };
  }
  if (statusFromErr === 400 || rawMessage.includes("API_KEY_INVALID")) {
    return {
      status: 400,
      message: "Invalid Gemini API request or key. Verify GEMINI_API_KEY in Settings > Secrets.",
    };
  }
  return {
    status: statusFromErr && statusFromErr >= 400 && statusFromErr < 600 ? statusFromErr : 502,
    message: rawMessage || "Gemini image generation failed.",
  };
}

export const Route = createFileRoute("/api/generate-course-thumbnail")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader?.startsWith("Bearer ")) {
          return new Response("Unauthorized: sign in to generate course thumbnails.", {
            status: 401,
          });
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
          return new Response(
            "Forbidden: only Owners, Admins, and Instructors can generate course thumbnails.",
            {
              status: 403,
            },
          );
        }

        const parsed = requestSchema.safeParse(await request.json().catch(() => null));
        if (!parsed.success) {
          return new Response("Invalid course thumbnail request.", { status: 400 });
        }

        const apiKey = process.env["GEMINI_API_KEY"];
        if (!apiKey) {
          return new Response("Missing GEMINI_API_KEY", { status: 500 });
        }

        try {
          const prompt = buildCourseThumbnailPrompt(parsed.data);
          const result = await generateCourseThumbnailImage(apiKey, prompt, request.signal);

          if (parsed.data.stream ?? true) {
            return new Response(formatImageSsePayload(result), {
              status: 200,
              headers: {
                "Content-Type": "text/event-stream; charset=utf-8",
                "Cache-Control": "no-cache",
              },
            });
          }

          return Response.json(
            { data: [{ b64_json: result.b64Json, mime_type: result.mimeType }] },
            {
              status: 200,
              headers: { "Cache-Control": "no-cache" },
            },
          );
        } catch (error) {
          const mapped = mapGeminiError(error);
          return new Response(mapped.message, { status: mapped.status });
        }
      },
    },
  },
});
