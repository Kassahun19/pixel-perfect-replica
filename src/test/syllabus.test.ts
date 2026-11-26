import { describe, expect, it } from "vitest";
import {
  filterAndSortLessons,
  formatMinutesSummary,
  getPageNumbers,
  type SyllabusLesson,
} from "@/lib/syllabus";

const SAMPLE_LESSONS: SyllabusLesson[] = Array.from({ length: 12 }, (_, idx) => ({
  id: `lesson-${idx + 1}`,
  title:
    idx === 11
      ? "Hidden Features 99% of Users Don&#39;t Know! | Adnakot Tube"
      : `Lesson ${idx + 1}: Excel &amp; VBA`,
  position: idx + 1,
  duration_minutes: idx === 0 ? 4 : idx === 11 ? 25 : 10 + idx,
}));

describe("CourseSyllabus filtering, sorting, and pagination", () => {
  it("filters by search query, access tier, decodes HTML entities, and replaces channel names", () => {
    const all = filterAndSortLessons(SAMPLE_LESSONS, {
      query: "",
      accessFilter: "all",
      sortBy: "order-asc",
    });
    expect(all).toHaveLength(12);
    expect(all[11]?.title).toBe("Hidden Features 99% of Users Don't Know! | Ezana Academy");
    expect(all[0]?.isFree).toBe(true);
    expect(all[5]?.isFree).toBe(false);

    const freeOnly = filterAndSortLessons(SAMPLE_LESSONS, {
      query: "",
      accessFilter: "free",
      sortBy: "order-asc",
    });
    expect(freeOnly).toHaveLength(5);

    const proSearch = filterAndSortLessons(SAMPLE_LESSONS, {
      query: "Don't Know",
      accessFilter: "pro",
      sortBy: "order-asc",
    });
    expect(proSearch).toHaveLength(1);
    expect(proSearch[0]?.originalIndex).toBe(11);
  });

  it("sorts by reverse order and duration while preserving original index", () => {
    const longestFirst = filterAndSortLessons(SAMPLE_LESSONS, {
      query: "",
      accessFilter: "all",
      sortBy: "duration-desc",
    });
    expect(longestFirst[0]?.duration_minutes).toBe(25);
    expect(longestFirst[0]?.originalIndex).toBe(11);

    const shortestFirst = filterAndSortLessons(SAMPLE_LESSONS, {
      query: "",
      accessFilter: "all",
      sortBy: "duration-asc",
    });
    expect(shortestFirst[0]?.duration_minutes).toBe(4);
    expect(shortestFirst[0]?.originalIndex).toBe(0);
  });

  it("computes compact page number ranges with ellipses and total duration formatting", () => {
    expect(getPageNumbers(1, 5)).toEqual([1, 2, 3, 4, 5]);
    expect(getPageNumbers(5, 10)).toEqual([1, "ellipsis", 4, 5, 6, "ellipsis", 10]);
    expect(formatMinutesSummary(45)).toBe("45 min");
    expect(formatMinutesSummary(125)).toBe("2h 5m");
  });
});
