/** Extracts the 11-character YouTube video id from common YouTube URL shapes, or null. */
export function getYouTubeId(url: string | null | undefined): string | null {
  if (!url) return null;
  let u: URL;
  try {
    u = new URL(url.trim());
  } catch {
    return null;
  }
  const host = u.hostname.replace(/^www\./, "").replace(/^m\./, "");
  const valid = (id: string | null | undefined) =>
    id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null;
  if (host === "youtu.be") return valid(u.pathname.split("/")[1]);
  if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
    if (u.pathname === "/watch") return valid(u.searchParams.get("v"));
    const [, kind, id] = u.pathname.split("/");
    if (kind === "embed" || kind === "shorts" || kind === "live" || kind === "v") return valid(id);
  }
  return null;
}

export type YouTubeEmbedOptions = {
  controls?: boolean;
  enableJsApi?: boolean;
  origin?: string;
  autoPlay?: boolean;
};

export function youTubeEmbedUrl(id: string, options: YouTubeEmbedOptions = {}): string {
  const showControls = options.controls ?? true;
  const params = new URLSearchParams({
    controls: showControls ? "1" : "0",
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
    iv_load_policy: "3",
    fs: showControls ? "1" : "0",
    disablekb: showControls ? "0" : "1",
  });
  if (options.enableJsApi) params.set("enablejsapi", "1");
  if (options.origin) params.set("origin", options.origin);
  if (options.autoPlay) params.set("autoplay", "1");
  return `https://www.youtube-nocookie.com/embed/${id}?${params.toString()}`;
}

export type YouTubeChannelVideo = {
  id: string;
  title: string;
  description: string;
  durationSeconds: number;
  durationMinutes: number;
};

export const ACADEMY_BRAND_NAME = "Ezana Academy";

const KNOWN_CHANNEL_BRAND_PATTERNS: RegExp[] = [
  /@?adnakot[\s._-]*tube\b/gi,
  /\badnakot\s+channel\b/gi,
  /\badnakot\b/gi,
];

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Decodes HTML entities and replaces known or provided YouTube channel names
 * (e.g. "Adnakot Tube") with "Ezana Academy" across lesson titles and descriptions.
 */
export function replaceChannelBranding(text: string, channelTitle?: string | null): string {
  let result = decodeHtmlEntities(text);

  for (const pattern of KNOWN_CHANNEL_BRAND_PATTERNS) {
    result = result.replace(pattern, ACADEMY_BRAND_NAME);
  }

  const normalizedChannel = channelTitle ? decodeHtmlEntities(channelTitle).trim() : "";
  if (normalizedChannel && normalizedChannel.length >= 3) {
    const escapedExact = escapeRegExp(normalizedChannel).replace(/\s+/g, "[\\s._-]*");
    const compact = normalizedChannel.replace(/[\s._-]+/g, "");
    const patterns = [new RegExp(`@?\\b${escapedExact}\\b`, "gi")];
    if (compact.length >= 3 && compact.toLowerCase() !== normalizedChannel.toLowerCase()) {
      patterns.push(new RegExp(`@?\\b${escapeRegExp(compact)}\\b`, "gi"));
    }
    for (const pattern of patterns) {
      result = result.replace(pattern, ACADEMY_BRAND_NAME);
    }
  }

  return result;
}

const ISO_DURATION_RE = /^P(?:(\d+)D)?(?:T(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?)?$/;

/** Parses a YouTube Data API ISO 8601 duration (e.g. PT1H2M30S) into total seconds. */
export function parseYouTubeIsoDuration(iso: string | null | undefined): number {
  if (!iso) return 0;
  const match = ISO_DURATION_RE.exec(iso.trim());
  if (!match) return 0;
  const days = Number(match[1] ?? 0);
  const hours = Number(match[2] ?? 0);
  const minutes = Number(match[3] ?? 0);
  const seconds = Number(match[4] ?? 0);
  return days * 86_400 + hours * 3_600 + minutes * 60 + seconds;
}

/** Converts exact video seconds into integer minutes for `lessons.duration_minutes`. */
export function durationSecondsToMinutes(seconds: number): number {
  if (!Number.isFinite(seconds) || seconds <= 0) return 0;
  return Math.max(1, Math.round(seconds / 60));
}

/** Formats exact seconds as M:SS or H:MM:SS. */
export function formatVideoDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return "0:00";
  const whole = Math.floor(seconds);
  const h = Math.floor(whole / 3600);
  const m = Math.floor((whole % 3600) / 60);
  const s = whole % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
};

/** Decodes HTML entities occasionally returned in YouTube Data API search snippets. */
export function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (full, entity: string) => {
    if (entity.startsWith("#x") || entity.startsWith("#X")) {
      const code = Number.parseInt(entity.slice(2), 16);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    if (entity.startsWith("#")) {
      const code = Number.parseInt(entity.slice(1), 10);
      return Number.isFinite(code) ? String.fromCodePoint(code) : full;
    }
    return NAMED_ENTITIES[entity] ?? full;
  });
}

type YouTubeVideosResponse = {
  items?: Array<{
    id?: string;
    snippet?: { title?: string; description?: string; channelTitle?: string };
    contentDetails?: { duration?: string };
  }>;
  error?: { message?: string };
};

/** Fetches exact video metadata & ISO durations from `/youtube/v3/videos` in batches of 50. */
export async function fetchYouTubeVideoDetails(
  apiKey: string,
  videoIds: string[],
  fallbackChannelTitle?: string,
): Promise<Map<string, YouTubeChannelVideo>> {
  const key = apiKey.trim();
  const uniqueIds = [...new Set(videoIds.map((id) => id.trim()).filter(Boolean))];
  const result = new Map<string, YouTubeChannelVideo>();

  for (let i = 0; i < uniqueIds.length; i += 50) {
    const batch = uniqueIds.slice(i, i + 50);
    const params = new URLSearchParams({
      part: "contentDetails,snippet",
      id: batch.join(","),
      key,
    });
    const response = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`);
    const payload = (await response.json()) as YouTubeVideosResponse;
    if (!response.ok) {
      throw new Error(payload.error?.message ?? "YouTube could not load video durations");
    }
    for (const item of payload.items ?? []) {
      if (!item.id) continue;
      const durationSeconds = parseYouTubeIsoDuration(item.contentDetails?.duration);
      const channelName = item.snippet?.channelTitle ?? fallbackChannelTitle;
      result.set(item.id, {
        id: item.id,
        title: replaceChannelBranding(item.snippet?.title ?? "Ezana Academy lesson", channelName),
        description: replaceChannelBranding(item.snippet?.description ?? "", channelName),
        durationSeconds,
        durationMinutes: durationSecondsToMinutes(durationSeconds),
      });
    }
  }

  return result;
}

type YouTubeChannelResponse = {
  items?: Array<{
    snippet?: { title?: string };
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }>;
  error?: { message?: string };
};

type YouTubePlaylistItemsResponse = {
  nextPageToken?: string;
  items?: Array<{
    contentDetails?: { videoId?: string };
    snippet?: {
      resourceId?: { videoId?: string };
      title?: string;
      description?: string;
      channelTitle?: string;
    };
  }>;
  error?: { message?: string };
};

type YouTubeSearchResponse = {
  items?: Array<{
    id?: { videoId?: string };
    snippet?: { title?: string; description?: string; channelTitle?: string };
  }>;
  error?: { message?: string };
};

/**
 * Fetches videos for a YouTube channel along with each video's exact duration
 * from YouTube Data API v3 (`contentDetails.duration`), replacing channel
 * branding in titles and descriptions with "Ezana Academy".
 */
export async function fetchYouTubeChannelVideos(
  apiKey: string,
  channelId: string,
): Promise<YouTubeChannelVideo[]> {
  const key = apiKey.trim();
  const channel = channelId.trim();

  const channelParams = new URLSearchParams({
    part: "snippet,contentDetails",
    id: channel,
    key,
  });
  const channelRes = await fetch(`https://www.googleapis.com/youtube/v3/channels?${channelParams}`);
  const channelPayload = (await channelRes.json()) as YouTubeChannelResponse;
  if (!channelRes.ok) {
    throw new Error(channelPayload.error?.message ?? "YouTube could not load this channel");
  }

  let channelTitle = channelPayload.items?.[0]?.snippet?.title;
  const uploadsPlaylistId = channelPayload.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
  const fallbackMeta = new Map<string, { title: string; description: string }>();
  const orderedIds: string[] = [];

  if (uploadsPlaylistId) {
    let pageToken: string | undefined;
    for (let page = 0; page < 4; page += 1) {
      const playlistParams = new URLSearchParams({
        part: "contentDetails,snippet",
        playlistId: uploadsPlaylistId,
        maxResults: "50",
        key,
      });
      if (pageToken) playlistParams.set("pageToken", pageToken);

      const playlistRes = await fetch(
        `https://www.googleapis.com/youtube/v3/playlistItems?${playlistParams}`,
      );
      const playlistPayload = (await playlistRes.json()) as YouTubePlaylistItemsResponse;
      if (!playlistRes.ok) {
        throw new Error(
          playlistPayload.error?.message ?? "YouTube could not load channel playlist",
        );
      }

      for (const item of playlistPayload.items ?? []) {
        const videoId = item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId;
        if (!videoId) continue;
        if (!channelTitle && item.snippet?.channelTitle) {
          channelTitle = item.snippet.channelTitle;
        }
        const resolvedChannel = item.snippet?.channelTitle ?? channelTitle;
        orderedIds.push(videoId);
        fallbackMeta.set(videoId, {
          title: replaceChannelBranding(
            item.snippet?.title ?? "Ezana Academy lesson",
            resolvedChannel,
          ),
          description: replaceChannelBranding(item.snippet?.description ?? "", resolvedChannel),
        });
      }

      if (!playlistPayload.nextPageToken) break;
      pageToken = playlistPayload.nextPageToken;
    }
  } else {
    const searchParams = new URLSearchParams({
      part: "snippet",
      channelId: channel,
      type: "video",
      maxResults: "50",
      key,
    });
    const searchRes = await fetch(`https://www.googleapis.com/youtube/v3/search?${searchParams}`);
    const searchPayload = (await searchRes.json()) as YouTubeSearchResponse;
    if (!searchRes.ok) {
      throw new Error(searchPayload.error?.message ?? "YouTube could not load this channel");
    }

    for (const item of searchPayload.items ?? []) {
      const videoId = item.id?.videoId;
      if (!videoId) continue;
      if (!channelTitle && item.snippet?.channelTitle) {
        channelTitle = item.snippet.channelTitle;
      }
      const resolvedChannel = item.snippet?.channelTitle ?? channelTitle;
      orderedIds.push(videoId);
      fallbackMeta.set(videoId, {
        title: replaceChannelBranding(
          item.snippet?.title ?? "Ezana Academy lesson",
          resolvedChannel,
        ),
        description: replaceChannelBranding(item.snippet?.description ?? "", resolvedChannel),
      });
    }
  }

  if (!orderedIds.length) return [];

  const detailsById = await fetchYouTubeVideoDetails(key, orderedIds, channelTitle);
  const videos: YouTubeChannelVideo[] = [];
  for (const id of orderedIds) {
    const detail = detailsById.get(id);
    if (detail) {
      videos.push(detail);
    } else {
      const meta = fallbackMeta.get(id);
      if (meta) {
        videos.push({
          id,
          title: meta.title,
          description: meta.description,
          durationSeconds: 0,
          durationMinutes: 0,
        });
      }
    }
  }
  return videos;
}
