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

const FALLBACK_ARTWORK_LIST = [webImage, dataImage, designImage, mathImage, businessImage, englishImage] as const;

const FALLBACK_BY_KEY: Record<string, string> = {
  web: webImage,
  data: dataImage,
  design: designImage,
  math: mathImage,
  business: businessImage,
  english: englishImage,
};

const FALLBACK_KEYS = ["web", "data", "design", "math", "business", "english"] as const;

const SUBJECT_RULES: readonly { pattern: RegExp; key: (typeof FALLBACK_KEYS)[number] }[] = [
  { pattern: /\b(web|html|css|javascript|typescript|react|node|frontend|backend|fullstack|coding|programming|software|app|mobile|devops|api|git)\b/i, key: "web" },
  { pattern: /\b(data|python|machine learning|deep learning|\bai\b|artificial intelligence|analytics|sql|database|statistics|cloud|cyber|security|network)\b/i, key: "data" },
  { pattern: /\b(design|ui|ux|figma|graphic|art|branding|illustration|photo|video|creative|animation|product design)\b/i, key: "design" },
  { pattern: /\b(math|mathematics|calculus|algebra|geometry|physics|chemistry|biology|science|engineering|stem|trigonometry)\b/i, key: "math" },
  { pattern: /\b(business|finance|accounting|marketing|entrepreneur|startup|management|economics|leadership|sales|commerce|project management)\b/i, key: "business" },
  { pattern: /\b(english|writing|grammar|ielts|toefl|speaking|communication|language|literature|reading|essay|amharic|history)\b/i, key: "english" },
];

export type CourseImageContext = {
  title?: string | null | undefined;
  short_description?: string | null | undefined;
  description?: string | null | undefined;
  category?: { name?: string | null | undefined; slug?: string | null | undefined } | null | undefined;
};

/** Builds the app route URL for a course cover stored in the private course-covers bucket. */
export function courseCoverUrl(storagePath: string): string {
  return `/api/course-covers/${storagePath.replace(/^\/+/, "")}`;
}

/** Uses repository-bundled artwork when a course row contains a Lovable-only asset path. */
export function courseImageUrl(imageUrl: string | null | undefined): string | undefined {
  const trimmed = imageUrl?.trim();
  if (!trimmed) return undefined;
  if (trimmed.startsWith("fallback:")) {
    return FALLBACK_BY_KEY[trimmed.slice("fallback:".length)] ?? webImage;
  }
  const assetId = trimmed.match(/\/__l5e\/assets-v1\/([^/]+)\//)?.[1];
  return assetId ? LOCAL_COURSE_ARTWORK[assetId] ?? trimmed : trimmed;
}

/** Returns a stable database-safe fallback token (e.g. "fallback:data") matched to the course subject. */
export function fallbackCourseToken(course?: CourseImageContext): string {
  const haystack = [course?.title, course?.category?.name, course?.category?.slug, course?.short_description, course?.description]
    .filter(Boolean)
    .join(" ");
  if (haystack) {
    for (const rule of SUBJECT_RULES) {
      if (rule.pattern.test(haystack)) return `fallback:${rule.key}`;
    }
    let hash = 0;
    for (let i = 0; i < haystack.length; i += 1) hash = (hash * 31 + haystack.charCodeAt(i)) >>> 0;
    const key = FALLBACK_KEYS[hash % FALLBACK_ARTWORK_LIST.length] ?? "web";
    return `fallback:${key}`;
  }
  return "fallback:web";
}

/** Picks a consistent, subject-matched bundled thumbnail when a course has no image or its URL fails. */
export function fallbackCourseImage(course?: CourseImageContext): string {
  const token = fallbackCourseToken(course);
  return FALLBACK_BY_KEY[token.slice("fallback:".length)] ?? webImage;
}
