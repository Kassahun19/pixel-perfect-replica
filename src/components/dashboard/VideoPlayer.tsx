import { useEffect, useRef, useState } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getYouTubeId, youTubeEmbedUrl } from "@/lib/youtube";

type Props = {
  url: string;
  title: string;
  /** Start playing as soon as the video is ready (used right after a lesson is clicked). */
  autoPlay?: boolean;
  /** Used automatically if the main video file can't be loaded. */
  fallbackUrl?: string | null | undefined;
};

/** Plays a direct video file or a YouTube link inside the site. */
export function VideoPlayer({ url, title, autoPlay = false, fallbackUrl }: Props) {
  const youTubeId = getYouTubeId(url);
  if (youTubeId) return <YouTubePlayer id={youTubeId} title={title} autoPlay={autoPlay} />;
  return <FilePlayer key={url} url={url} title={title} autoPlay={autoPlay} fallbackUrl={fallbackUrl} />;
}

function FilePlayer({ url, title, autoPlay, fallbackUrl }: Required<Pick<Props, "url" | "title">> & { autoPlay: boolean; fallbackUrl?: string | null | undefined }) {
  const [src, setSrc] = useState(url);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const ref = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const v = ref.current;
    if (!autoPlay || !v || failed) return;
    v.play().catch(() => {
      // Browser blocked sound autoplay: start muted, the learner can unmute.
      v.muted = true;
      v.play().catch(() => {});
    });
  }, [autoPlay, src, attempt, failed]);

  if (failed) {
    return (
      <div className="flex aspect-video w-full flex-col items-center justify-center gap-3 bg-deep p-6 text-center text-deep-foreground">
        <AlertTriangle className="h-10 w-10 text-gold" />
        <p className="font-semibold">This video couldn't be loaded</p>
        <p className="text-sm text-deep-muted">Check your internet connection and try again.</p>
        <Button
          type="button"
          variant="hero"
          onClick={() => {
            setSrc(url);
            setFailed(false);
            setAttempt((a) => a + 1);
          }}
        >
          <RotateCcw /> Retry
        </Button>
      </div>
    );
  }

  return (
    <video
      ref={ref}
      key={`${src}-${attempt}`}
      src={src}
      title={title}
      controls
      playsInline
      preload="metadata"
      autoPlay={autoPlay}
      controlsList="nodownload noremoteplayback"
      disablePictureInPicture
      onContextMenu={(e) => e.preventDefault()}
      onError={() => {
        if (fallbackUrl && src !== fallbackUrl) setSrc(fallbackUrl);
        else setFailed(true);
      }}
      className="aspect-video w-full bg-deep"
    />
  );
}

function YouTubePlayer({ id, title, autoPlay }: { id: string; title: string; autoPlay: boolean }) {
  const src = `${youTubeEmbedUrl(id)}${autoPlay ? "&autoplay=1" : ""}`;
  return (
    <div className="relative aspect-video w-full bg-deep">
      <iframe
        key={id}
        src={src}
        title={title}
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; autoplay; encrypted-media; gyroscope; fullscreen"
        allowFullScreen
        referrerPolicy="strict-origin-when-cross-origin"
        loading="lazy"
      />
      {/* Covers YouTube's title / share links at the top; the bottom control bar stays usable. */}
      <div aria-hidden className="pointer-events-auto absolute inset-x-0 top-0 h-16" onContextMenu={(e) => e.preventDefault()} />
    </div>
  );
}
