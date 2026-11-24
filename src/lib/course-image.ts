import businessImage from "@/assets/ezana-business.jpg";
import dataImage from "@/assets/ezana-data.jpg";
import designImage from "@/assets/ezana-design.jpg";
import englishImage from "@/assets/ezana-english.jpg";
import mathImage from "@/assets/ezana-math.jpg";
import webImage from "@/assets/ezana-web.jpg";

const LOCAL_COURSE_ARTWORK: Record<string, string> = {
  "2e71e2fe-b00b-498a-a344-0d3e02eb7786": webImage,
  "b2d7a1ae-5c2d-4496-bb1c-9d458c5e6f47": dataImage,
  "854f79e5-1311-4cac-b83c-8a161c3b1a7a": designImage,
  "d9840e76-0438-419a-8d3b-4ab42fd4d447": mathImage,
  "81a067f9-5b6b-49ce-97e1-1633f9cfeace": businessImage,
  "410eb273-3422-4cee-9b5b-9ec31110a94e": englishImage,
};

/** Uses repository-bundled artwork when a course row contains a Lovable-only asset path. */
export function courseImageUrl(imageUrl: string | null | undefined): string | undefined {
  if (!imageUrl) return undefined;
  const assetId = imageUrl.match(/\/__l5e\/assets-v1\/([^/]+)\//)?.[1];
  return assetId ? LOCAL_COURSE_ARTWORK[assetId] ?? imageUrl : imageUrl;
}
