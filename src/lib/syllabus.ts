import { isFreeLesson } from "@/lib/access";
import { replaceChannelBranding } from "@/lib/youtube";

export type SyllabusLesson = {
  id: string;
  title: string;
  position: number;
  duration_minutes: number;
};

export type LessonAccessFilter = "all" | "free" | "pro";
export type LessonSortOption = "order-asc" | "order-desc" | "duration-asc" | "duration-desc";

export type IndexedSyllabusLesson = SyllabusLesson & {
  originalIndex: number;
  isFree: boolean;
};

export function filterAndSortLessons(
  lessons: SyllabusLesson[],
  options: {
    query: string;
    accessFilter: LessonAccessFilter;
    sortBy: LessonSortOption;
  },
): IndexedSyllabusLesson[] {
  const normalizedQuery = options.query.trim().toLowerCase();

  const indexed: IndexedSyllabusLesson[] = lessons.map((lesson, idx) => ({
    ...lesson,
    title: replaceChannelBranding(lesson.title),
    originalIndex: idx,
    isFree: isFreeLesson(idx),
  }));

  const filtered = indexed.filter((lesson) => {
    if (options.accessFilter === "free" && !lesson.isFree) return false;
    if (options.accessFilter === "pro" && lesson.isFree) return false;
    if (normalizedQuery && !lesson.title.toLowerCase().includes(normalizedQuery)) return false;
    return true;
  });

  const sorted = [...filtered];
  sorted.sort((a, b) => {
    switch (options.sortBy) {
      case "order-desc":
        return b.originalIndex - a.originalIndex;
      case "duration-asc":
        return a.duration_minutes - b.duration_minutes || a.originalIndex - b.originalIndex;
      case "duration-desc":
        return b.duration_minutes - a.duration_minutes || a.originalIndex - b.originalIndex;
      case "order-asc":
      default:
        return a.originalIndex - b.originalIndex;
    }
  });

  return sorted;
}

export function getPageNumbers(
  currentPage: number,
  totalPages: number,
): Array<number | "ellipsis"> {
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const pages: Array<number | "ellipsis"> = [1];
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  if (start > 2) pages.push("ellipsis");
  for (let p = start; p <= end; p += 1) pages.push(p);
  if (end < totalPages - 1) pages.push("ellipsis");

  pages.push(totalPages);
  return pages;
}

export function formatMinutesSummary(totalMinutes: number): string {
  if (totalMinutes <= 0) return "0 min";
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}
