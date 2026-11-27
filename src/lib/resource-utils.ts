import type { ResourceType } from "@/lib/owner/types";

/**
 * Automatically detects resource type from filename extension or URL string.
 */
export function detectResourceType(input: string): ResourceType {
  const clean = input.trim().toLowerCase().split("?")[0]!;
  if (/\.pdf$/i.test(clean)) return "pdf";
  if (/\.(ppt|pptx|odp|key)$/i.test(clean)) return "presentation";
  if (
    /\.(mp4|webm|mov|avi|mkv|flv|wmv)$/i.test(clean) ||
    /youtube\.com|youtu\.be|vimeo\.com/i.test(clean)
  ) {
    return "video";
  }
  if (
    /\.(doc|docx|xls|xlsx|csv|tsv|txt|rtf|odt|ods|zip|rar|7z|tar|gz|png|jpg|jpeg|webp|gif|svg)$/i.test(
      clean,
    )
  ) {
    return "document";
  }
  if (/^https?:\/\//i.test(input.trim())) return "link";
  return "document";
}
