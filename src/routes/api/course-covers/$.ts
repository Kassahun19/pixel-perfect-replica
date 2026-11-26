import { createFileRoute } from "@tanstack/react-router";

const VALID_COVER_PATH = /^[a-zA-Z0-9_-]{8,64}\/[a-zA-Z0-9._-]{1,180}$/;

function contentTypeFor(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/png";
}

export const Route = createFileRoute("/api/course-covers/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const coverPath = params._splat?.trim() ?? "";
        if (!coverPath || coverPath.includes("..") || !VALID_COVER_PATH.test(coverPath)) {
          return new Response("Not found", { status: 404 });
        }
        const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
        const { data, error } = await supabaseAdmin.storage.from("course-covers").download(coverPath);
        if (error || !data) {
          return new Response("Not found", { status: 404 });
        }
        return new Response(data, {
          status: 200,
          headers: {
            "Content-Type": data.type || contentTypeFor(coverPath),
            "Cache-Control": "public, max-age=86400, immutable",
          },
        });
      },
    },
  },
});