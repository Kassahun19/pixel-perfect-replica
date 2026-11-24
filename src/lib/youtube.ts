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
  const valid = (id: string | null | undefined) => (id && /^[A-Za-z0-9_-]{11}$/.test(id) ? id : null);
  if (host === "youtu.be") return valid(u.pathname.split("/")[1]);
  if (host === "youtube.com" || host === "youtube-nocookie.com" || host === "music.youtube.com") {
    if (u.pathname === "/watch") return valid(u.searchParams.get("v"));
    const [, kind, id] = u.pathname.split("/");
    if (kind === "embed" || kind === "shorts" || kind === "live" || kind === "v") return valid(id);
  }
  return null;
}

export function youTubeEmbedUrl(id: string): string {
  const params = "controls=1&rel=0&modestbranding=1&playsinline=1&iv_load_policy=3&fs=1&disablekb=0";
  return `https://www.youtube-nocookie.com/embed/${id}?${params}`;
}
