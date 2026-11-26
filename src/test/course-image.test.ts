import { describe, expect, it } from "vitest";
import { courseCoverUrl, courseImageUrl, fallbackCourseImage, fallbackCourseToken } from "@/lib/course-image";
import { buildCourseThumbnailPrompt } from "@/lib/image-gateway.server";

describe("course thumbnail resolution and fallback", () => {
  it("preserves custom uploaded cover URLs and external HTTPS URLs", () => {
    const uploaded = courseCoverUrl("user-123/cover.png");
    expect(uploaded).toBe("/api/course-covers/user-123/cover.png");
    expect(courseImageUrl(uploaded)).toBe("/api/course-covers/user-123/cover.png");
    expect(courseImageUrl("https://cdn.example.com/thumb.webp")).toBe("https://cdn.example.com/thumb.webp");
  });

  it("maps fallback tokens and subject keywords to relevant bundled artwork", () => {
    expect(fallbackCourseToken({ title: "Python & Machine Learning Fundamentals" })).toBe("fallback:data");
    expect(fallbackCourseToken({ title: "UI/UX Product Design with Figma" })).toBe("fallback:design");
    expect(fallbackCourseToken({ title: "Applied Calculus and Linear Algebra" })).toBe("fallback:math");
    expect(fallbackCourseToken({ title: "Entrepreneurship & Small Business Finance" })).toBe("fallback:business");
    expect(fallbackCourseToken({ title: "Academic English Writing" })).toBe("fallback:english");
    expect(fallbackCourseToken({ title: "Modern React & TypeScript Web Apps" })).toBe("fallback:web");
    expect(courseImageUrl("fallback:data")).toBe(fallbackCourseImage({ title: "Python Data Science" }));
  });

  it("returns a deterministic non-empty fallback even for unrecognized titles", () => {
    const first = fallbackCourseImage({ title: "Aksumite Heritage Studies" });
    const second = fallbackCourseImage({ title: "Aksumite Heritage Studies" });
    expect(first).toBeTruthy();
    expect(first).toBe(second);
  });

  it("builds a styled, text-free AI thumbnail prompt tailored to the course", () => {
    const prompt = buildCourseThumbnailPrompt({
      title: "Data Structures & Algorithms",
      shortDescription: "Master trees, graphs, and dynamic programming.",
      level: "Intermediate",
    });
    expect(prompt).toContain("Data Structures & Algorithms");
    expect(prompt).toContain("Master trees, graphs, and dynamic programming.");
    expect(prompt).toContain("Intermediate");
    expect(prompt).toMatch(/no text/i);
  });
});