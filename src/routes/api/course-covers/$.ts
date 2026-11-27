import { createFileRoute } from "@tanstack/react-router";

const VALID_COVER_PATH = /^[a-zA-Z0-9_-]{8,64}\/[a-zA-Z0-9._-]{1,180}$/;

function contentTypeFor(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith(".pdf")) return "application/pdf";
  if (lower.endsWith(".doc")) return "application/msword";
  if (lower.endsWith(".docx"))
    return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (lower.endsWith(".xls")) return "application/vnd.ms-excel";
  if (lower.endsWith(".xlsx"))
    return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  if (lower.endsWith(".csv")) return "text/csv; charset=utf-8";
  if (lower.endsWith(".ppt")) return "application/vnd.ms-powerpoint";
  if (lower.endsWith(".pptx"))
    return "application/vnd.openxmlformats-officedocument.presentationml.presentation";
  if (lower.endsWith(".txt")) return "text/plain; charset=utf-8";
  if (lower.endsWith(".zip")) return "application/zip";
  if (lower.endsWith(".rar")) return "application/vnd.rar";
  if (lower.endsWith(".7z")) return "application/x-7z-compressed";
  if (lower.endsWith(".tar")) return "application/x-tar";
  if (lower.endsWith(".gz")) return "application/gzip";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  if (lower.endsWith(".gif")) return "image/gif";
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".mp3")) return "audio/mpeg";
  if (lower.endsWith(".wav")) return "audio/wav";
  return "application/octet-stream";
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
        const resolvedType =
          data.type && data.type !== "application/octet-stream"
            ? data.type
            : contentTypeFor(coverPath);
        const filename = coverPath.split("/").pop() ?? "file";
        return new Response(data, {
          status: 200,
          headers: {
            "Content-Type": resolvedType,
            "Content-Disposition": `inline; filename="${encodeURIComponent(filename)}"`,
            "Cache-Control": "public, max-age=86400, immutable",
          },
        });
      },
    },
  },
});