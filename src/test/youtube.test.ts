import { afterEach, describe, expect, it, vi } from "vitest";
import {
  decodeHtmlEntities,
  durationSecondsToMinutes,
  fetchYouTubeChannelVideos,
  fetchYouTubePlaylistVideos,
  formatVideoDuration,
  getYouTubeId,
  parseYouTubeIsoDuration,
  replaceChannelBranding,
  youTubeEmbedUrl,
} from "@/lib/youtube";

describe("getYouTubeId", () => {
  it("extracts ids from watch, short, embed, and shorts URLs", () => {
    expect(getYouTubeId("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
    expect(getYouTubeId("https://youtube.com/watch?feature=share&v=dQw4w9WgXcQ&t=42s")).toBe(
      "dQw4w9WgXcQ",
    );
    expect(getYouTubeId("https://youtu.be/dQw4w9WgXcQ?si=abc")).toBe("dQw4w9WgXcQ");
    expect(getYouTubeId("https://www.youtube.com/embed/dQw4w9WgXcQ?start=10")).toBe("dQw4w9WgXcQ");
    expect(getYouTubeId("https://www.youtube.com/shorts/dQw4w9WgXcQ")).toBe("dQw4w9WgXcQ");
  });

  it("returns null for non-YouTube links", () => {
    expect(getYouTubeId("https://www.w3schools.com/html/mov_bbb.mp4")).toBeNull();
    expect(getYouTubeId("/videos/lesson-1.mp4")).toBeNull();
    expect(getYouTubeId("")).toBeNull();
  });

  it("builds privacy-enhanced embed URLs with optional custom-player flags", () => {
    expect(youTubeEmbedUrl("dQw4w9WgXcQ")).toContain(
      "https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ",
    );
    const custom = youTubeEmbedUrl("dQw4w9WgXcQ", {
      controls: false,
      enableJsApi: true,
      origin: "https://ezana.example",
    });
    expect(custom).toContain("controls=0");
    expect(custom).toContain("fs=0");
    expect(custom).toContain("enablejsapi=1");
  });
});

describe("YouTube duration parsing, branding replacement, and channel fetching", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("parses ISO 8601 durations into exact seconds and rounded minutes", () => {
    expect(parseYouTubeIsoDuration("PT45S")).toBe(45);
    expect(parseYouTubeIsoDuration("PT12M30S")).toBe(750);
    expect(parseYouTubeIsoDuration("PT1H5M9S")).toBe(3909);
    expect(parseYouTubeIsoDuration("P0D")).toBe(0);
    expect(parseYouTubeIsoDuration(null)).toBe(0);

    expect(durationSecondsToMinutes(0)).toBe(0);
    expect(durationSecondsToMinutes(35)).toBe(1);
    expect(durationSecondsToMinutes(125)).toBe(2);
    expect(durationSecondsToMinutes(890)).toBe(15);

    expect(formatVideoDuration(45)).toBe("0:45");
    expect(formatVideoDuration(728)).toBe("12:08");
    expect(formatVideoDuration(3909)).toBe("1:05:09");
  });

  it("decodes HTML entities and replaces channel names with Ezana Academy", () => {
    expect(decodeHtmlEntities("Hidden Features 99% of Users Don&#39;t Know &amp; More")).toBe(
      "Hidden Features 99% of Users Don't Know & More",
    );
    expect(replaceChannelBranding("Excel Table Guide | Adnakot Tube")).toBe(
      "Excel Table Guide | Ezana Academy",
    );
    expect(replaceChannelBranding("Follow @AdnakotTube for tips")).toBe(
      "Follow Ezana Academy for tips",
    );
    expect(replaceChannelBranding("Intro to Python | Addis Coding Lab", "Addis Coding Lab")).toBe(
      "Intro to Python | Ezana Academy",
    );
  });

  it("fetches channel videos with dynamic durations and replaces channel name with Ezana Academy", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/youtube/v3/channels")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                snippet: { title: "Adnakot Tube" },
                contentDetails: { relatedPlaylists: { uploads: "UU123" } },
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes("/youtube/v3/playlistItems")) {
        return new Response(
          JSON.stringify({
            items: [
              { contentDetails: { videoId: "vidShort0001" } },
              { contentDetails: { videoId: "vidLong00002" } },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes("/youtube/v3/videos")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: "vidShort0001",
                snippet: {
                  title: "Quick Excel Tip | Adnakot Tube #Shorts",
                  description: "Short tip from Adnakot Tube",
                  channelTitle: "Adnakot Tube",
                },
                contentDetails: { duration: "PT42S" },
              },
              {
                id: "vidLong00002",
                snippet: {
                  title: "Full VBA Tutorial | AdnakotTube",
                  description: "Deep dive on Adnakot",
                  channelTitle: "Adnakot Tube",
                },
                contentDetails: { duration: "PT24M18S" },
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response("Not found", { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const videos = await fetchYouTubeChannelVideos("fake-api-key", "UC_channel_123");
    expect(videos).toEqual([
      {
        id: "vidShort0001",
        title: "Quick Excel Tip | Ezana Academy #Shorts",
        description: "Short tip from Ezana Academy",
        durationSeconds: 42,
        durationMinutes: 1,
      },
      {
        id: "vidLong00002",
        title: "Full VBA Tutorial | Ezana Academy",
        description: "Deep dive on Ezana Academy",
        durationSeconds: 1458,
        durationMinutes: 24,
      },
    ]);
  });

  it("fetches playlist videos (including unlisted videos) with dynamic durations and branding", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/youtube/v3/playlistItems")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                contentDetails: { videoId: "unlistedV01" },
                snippet: { title: "Unlisted Lecture | Adnakot Tube", description: "Unlisted video" },
              },
            ],
          }),
          { status: 200 },
        );
      }
      if (url.includes("/youtube/v3/videos")) {
        return new Response(
          JSON.stringify({
            items: [
              {
                id: "unlistedV01",
                snippet: {
                  title: "Unlisted Lecture | Adnakot Tube",
                  description: "Unlisted video",
                  channelTitle: "Adnakot Tube",
                },
                contentDetails: { duration: "PT15M" },
              },
            ],
          }),
          { status: 200 },
        );
      }
      return new Response("Not found", { status: 404 });
    });

    vi.stubGlobal("fetch", fetchMock);

    const videos = await fetchYouTubePlaylistVideos("fake-key", "PL_unlisted_123");
    expect(videos).toEqual([
      {
        id: "unlistedV01",
        title: "Unlisted Lecture | Ezana Academy",
        description: "Unlisted video",
        durationSeconds: 900,
        durationMinutes: 15,
      },
    ]);
  });
});

