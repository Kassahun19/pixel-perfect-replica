import { describe, expect, it } from "vitest";
import { getYouTubeId } from "@/lib/youtube";

describe("getYouTubeId", () => {
  it("reads watch links, including extra query params", () => {
    expect(getYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(getYouTubeId("https://youtube.com/watch?feature=share&v=dQw4w9WgXcQ&t=42s")).toBe("dQw4w9WgXcQ");
  });
  it("reads youtu.be short links", () => {
    expect(getYouTubeId("https://youtu.be/dQw4w9WgXcQ?si=abc")).toBe("dQw4w9WgXcQ");
  });
  it("reads embed and shorts links", () => {
    expect(getYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ?start=10")).toBe("dQw4w9WgXcQ");
    expect(getYouTubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });
  it("returns null for non-YouTube links", () => {
    expect(getYouTubeId("https://www.w3schools.com/html/mov_bbb.mp4")).toBeNull();
    expect(getYouTubeId("/videos/lesson-1.mp4")).toBeNull();
    expect(getYouTubeId("")).toBeNull();
  });
});
