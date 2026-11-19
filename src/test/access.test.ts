import { describe, expect, it } from "vitest";
import { FREE_LESSON_LIMIT, PRO_PRICE_ETB, formatETB, isLessonLocked } from "@/lib/access";

describe("course access rules", () => {
  it("allows exactly five free videos per course", () => {
    expect(FREE_LESSON_LIMIT).toBe(5);
    expect(isLessonLocked(4, { unlocked: false, signedIn: true })).toBe(false);
    expect(isLessonLocked(5, { unlocked: false, signedIn: true })).toBe(true);
  });

  it("unlocks every video once the course is paid for", () => {
    expect(isLessonLocked(9, { unlocked: true, signedIn: true })).toBe(false);
  });

  it("locks all videos for visitors who are not logged in", () => {
    expect(isLessonLocked(0, { unlocked: false, signedIn: false })).toBe(true);
  });

  it("prices Ezana Pro at ETB 218 per course", () => {
    expect(PRO_PRICE_ETB).toBe(218);
    expect(formatETB()).toBe("ETB 218");
  });
});
