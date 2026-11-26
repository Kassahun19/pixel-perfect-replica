import { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  GraduationCap,
  Maximize2,
  Minimize2,
  Pause,
  Play,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ACADEMY_BRAND_NAME,
  formatVideoDuration,
  getYouTubeId,
  replaceChannelBranding,
  youTubeEmbedUrl,
} from "@/lib/youtube";
import { cn } from "@/lib/utils";

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
  const safeTitle = replaceChannelBranding(title);
  const youTubeId = getYouTubeId(url);
  if (youTubeId) {
    return <YouTubePlayer key={youTubeId} id={youTubeId} title={safeTitle} autoPlay={autoPlay} />;
  }
  return (
    <FilePlayer
      key={url}
      url={url}
      title={safeTitle}
      autoPlay={autoPlay}
      fallbackUrl={fallbackUrl}
    />
  );
}

function FilePlayer({
  url,
  title,
  autoPlay,
  fallbackUrl,
}: Required<Pick<Props, "url" | "title">> & {
  autoPlay: boolean;
  fallbackUrl?: string | null | undefined;
}) {
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

type YTPlayerInstance = {
  playVideo: () => void;
  pauseVideo: () => void;
  seekTo: (seconds: number, allowSeekAhead?: boolean) => void;
  mute: () => void;
  unMute: () => void;
  isMuted: () => boolean;
  setVolume: (volume: number) => void;
  getVolume: () => number;
  getCurrentTime: () => number;
  getDuration: () => number;
  setPlaybackRate: (rate: number) => void;
  getPlaybackRate: () => number;
  getPlayerState: () => number;
  destroy: () => void;
};

type YTNamespace = {
  Player: new (
    element: HTMLElement,
    options: {
      host?: string;
      videoId: string;
      width?: string | number;
      height?: string | number;
      playerVars?: Record<string, string | number>;
      events?: {
        onReady?: (event: { target: YTPlayerInstance }) => void;
        onStateChange?: (event: { data: number; target: YTPlayerInstance }) => void;
        onError?: () => void;
      };
    },
  ) => YTPlayerInstance;
  PlayerState?: {
    UNSTARTED: number;
    ENDED: number;
    PLAYING: number;
    PAUSED: number;
    BUFFERING: number;
    CUED: number;
  };
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let ytApiPromise: Promise<YTNamespace> | null = null;

function loadYouTubeIframeApi(): Promise<YTNamespace> {
  if (typeof window === "undefined") {
    return Promise.reject(new Error("Browser required"));
  }
  if (window.YT?.Player) {
    return Promise.resolve(window.YT);
  }
  if (ytApiPromise) return ytApiPromise;

  ytApiPromise = new Promise<YTNamespace>((resolve, reject) => {
    const timeout = window.setTimeout(() => {
      ytApiPromise = null;
      reject(new Error("YouTube player API timed out"));
    }, 6000);

    const prevReady = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => {
      prevReady?.();
      window.clearTimeout(timeout);
      if (window.YT?.Player) {
        resolve(window.YT);
      } else {
        ytApiPromise = null;
        reject(new Error("YouTube player API unavailable"));
      }
    };

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://www.youtube.com/iframe_api"]',
    );
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => {
        window.clearTimeout(timeout);
        ytApiPromise = null;
        reject(new Error("Could not load YouTube player API"));
      };
      document.head.appendChild(script);
    }
  });

  return ytApiPromise;
}

type PlayerStatus = "unstarted" | "playing" | "paused" | "buffering" | "ended";
const PLAYBACK_RATES = [0.75, 1, 1.25, 1.5, 2] as const;

function mapYouTubeState(state: number): PlayerStatus {
  switch (state) {
    case 0:
      return "ended";
    case 1:
      return "playing";
    case 2:
      return "paused";
    case 3:
      return "buffering";
    default:
      return "unstarted";
  }
}

function YouTubePlayer({ id, title, autoPlay }: { id: string; title: string; autoPlay: boolean }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mountRef = useRef<HTMLDivElement | null>(null);
  const playerRef = useRef<YTPlayerInstance | null>(null);
  const hideTimerRef = useRef<number | null>(null);
  const pendingPlayRef = useRef(autoPlay);

  const [apiFailed, setApiFailed] = useState(false);
  const [ready, setReady] = useState(false);
  const [status, setStatus] = useState<PlayerStatus>("unstarted");
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [seeking, setSeeking] = useState(false);
  const [seekValue, setSeekValue] = useState(0);
  const [muted, setMuted] = useState(false);
  const [volume, setVolume] = useState(100);
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [controlsActive, setControlsActive] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const bumpControls = useCallback(() => {
    setControlsActive(true);
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = window.setTimeout(() => {
      setControlsActive(false);
    }, 3500);
  }, []);

  useEffect(() => {
    const onFullscreenChange = () => {
      setIsFullscreen(document.fullscreenElement === containerRef.current);
    };
    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const host = mountRef.current;
    if (!host) return undefined;

    loadYouTubeIframeApi()
      .then((YT) => {
        if (cancelled || !mountRef.current) return;
        mountRef.current.innerHTML = "";
        const target = document.createElement("div");
        target.className = "h-full w-full";
        mountRef.current.appendChild(target);

        const player = new YT.Player(target, {
          host: "https://www.youtube-nocookie.com",
          videoId: id,
          width: "100%",
          height: "100%",
          playerVars: {
            controls: 0,
            rel: 0,
            modestbranding: 1,
            playsinline: 1,
            iv_load_policy: 3,
            fs: 0,
            disablekb: 1,
            enablejsapi: 1,
            origin: window.location.origin,
            autoplay: autoPlay ? 1 : 0,
          },
          events: {
            onReady: ({ target: yt }) => {
              if (cancelled) return;
              playerRef.current = yt;
              const iframe = mountRef.current?.querySelector("iframe");
              if (iframe) {
                iframe.className = "pointer-events-none h-full w-full border-0";
                iframe.setAttribute("tabindex", "-1");
                iframe.setAttribute("title", title);
                iframe.setAttribute("allow", "accelerometer; autoplay; encrypted-media; gyroscope");
              }
              const total = yt.getDuration();
              if (Number.isFinite(total) && total > 0) setDuration(total);
              setMuted(yt.isMuted());
              setVolume(yt.getVolume());
              setReady(true);

              if (pendingPlayRef.current) {
                yt.playVideo();
                window.setTimeout(() => {
                  if (cancelled) return;
                  const state = yt.getPlayerState();
                  if (state !== 1 && state !== 3) {
                    yt.mute();
                    setMuted(true);
                    yt.playVideo();
                  }
                }, 400);
              }
            },
            onStateChange: ({ data, target: yt }) => {
              if (cancelled) return;
              const nextStatus = mapYouTubeState(data);
              setStatus(nextStatus);
              const total = yt.getDuration();
              if (Number.isFinite(total) && total > 0) setDuration(total);
              setMuted(yt.isMuted());
              bumpControls();
            },
            onError: () => {
              if (!cancelled) setApiFailed(true);
            },
          },
        });
        playerRef.current = player;
      })
      .catch(() => {
        if (!cancelled) setApiFailed(true);
      });

    return () => {
      cancelled = true;
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
      try {
        playerRef.current?.destroy();
      } catch {
        // Ignore teardown issues on fast navigation.
      }
      playerRef.current = null;
      if (host) host.innerHTML = "";
    };
  }, [autoPlay, bumpControls, id, title]);

  useEffect(() => {
    if (!ready || (status !== "playing" && status !== "buffering")) return undefined;
    const interval = window.setInterval(() => {
      const yt = playerRef.current;
      if (!yt || seeking) return;
      const now = yt.getCurrentTime();
      const total = yt.getDuration();
      if (Number.isFinite(now)) setCurrentTime(now);
      if (Number.isFinite(total) && total > 0) setDuration(total);
    }, 250);
    return () => window.clearInterval(interval);
  }, [ready, seeking, status]);

  const togglePlay = useCallback(() => {
    bumpControls();
    const yt = playerRef.current;
    if (!yt || !ready) {
      pendingPlayRef.current = true;
      return;
    }
    if (status === "playing") {
      yt.pauseVideo();
    } else {
      if (status === "ended") {
        yt.seekTo(0, true);
        setCurrentTime(0);
      }
      yt.playVideo();
    }
  }, [bumpControls, ready, status]);

  const skipBy = useCallback(
    (deltaSeconds: number) => {
      bumpControls();
      const yt = playerRef.current;
      if (!yt || !ready) return;
      const max = duration > 0 ? duration : yt.getDuration();
      const next = Math.max(0, Math.min(max || Infinity, yt.getCurrentTime() + deltaSeconds));
      yt.seekTo(next, true);
      setCurrentTime(next);
    },
    [bumpControls, duration, ready],
  );

  const toggleMute = useCallback(() => {
    bumpControls();
    const yt = playerRef.current;
    if (!yt || !ready) return;
    if (yt.isMuted() || muted) {
      yt.unMute();
      if (volume === 0) {
        yt.setVolume(80);
        setVolume(80);
      }
      setMuted(false);
    } else {
      yt.mute();
      setMuted(true);
    }
  }, [bumpControls, muted, ready, volume]);

  const handleVolumeChange = useCallback(
    (nextVolume: number) => {
      bumpControls();
      setVolume(nextVolume);
      const yt = playerRef.current;
      if (!yt || !ready) return;
      yt.setVolume(nextVolume);
      if (nextVolume === 0) {
        yt.mute();
        setMuted(true);
      } else {
        yt.unMute();
        setMuted(false);
      }
    },
    [bumpControls, ready],
  );

  const cyclePlaybackRate = useCallback(() => {
    bumpControls();
    const currentIndex = PLAYBACK_RATES.indexOf(playbackRate as (typeof PLAYBACK_RATES)[number]);
    const nextRate = PLAYBACK_RATES[(currentIndex + 1) % PLAYBACK_RATES.length] ?? 1;
    setPlaybackRate(nextRate);
    const yt = playerRef.current;
    if (yt && ready) yt.setPlaybackRate(nextRate);
  }, [bumpControls, playbackRate, ready]);

  const toggleFullscreen = useCallback(() => {
    bumpControls();
    const el = containerRef.current;
    if (!el) return;
    if (document.fullscreenElement === el) {
      document.exitFullscreen().catch(() => {});
    } else {
      el.requestFullscreen?.().catch(() => {});
    }
  }, [bumpControls]);

  if (apiFailed) {
    const src = youTubeEmbedUrl(id, { controls: true, autoPlay });
    return (
      <div
        className="relative aspect-video w-full overflow-hidden bg-deep select-none"
        onContextMenu={(e) => e.preventDefault()}
      >
        <iframe
          key={id}
          src={src}
          title={title}
          className="absolute inset-0 h-full w-full border-0"
          allow="accelerometer; autoplay; encrypted-media; gyroscope; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          loading="lazy"
        />
        {/* Solid Ezana Academy header masks YouTube's channel title & link bar. */}
        <div
          aria-hidden="true"
          className="pointer-events-auto absolute inset-x-0 top-0 flex h-16 items-start gap-2.5 bg-gradient-to-b from-[#091c15] from-65% via-[#091c15]/95 to-transparent px-4 pt-2.5 text-deep-foreground"
        >
          <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gold text-gold-foreground">
            <GraduationCap className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white">{title}</p>
            <p className="text-[11px] font-medium text-gold">{ACADEMY_BRAND_NAME}</p>
          </div>
        </div>
        {/* Blocks clicks on YouTube's bottom-right "Watch on YouTube" badge while keeping fullscreen usable. */}
        <div
          aria-hidden="true"
          className="pointer-events-auto absolute bottom-0 right-11 h-12 w-24"
          onContextMenu={(e) => e.preventDefault()}
        />
      </div>
    );
  }

  const displayTime = seeking ? seekValue : currentTime;
  const progressPct = duration > 0 ? Math.min(100, Math.max(0, (displayTime / duration) * 100)) : 0;
  const showChrome = status !== "playing" || controlsActive;

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      aria-label={`${title} video player`}
      onMouseMove={bumpControls}
      onMouseLeave={() => {
        if (status === "playing") setControlsActive(false);
      }}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={(e) => {
        if (e.key === " " || e.key.toLowerCase() === "k") {
          e.preventDefault();
          togglePlay();
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          skipBy(-10);
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          skipBy(10);
        } else if (e.key.toLowerCase() === "m") {
          e.preventDefault();
          toggleMute();
        } else if (e.key.toLowerCase() === "f") {
          e.preventDefault();
          toggleFullscreen();
        }
      }}
      className="group relative aspect-video w-full overflow-hidden bg-deep text-white select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Non-interactive iframe mount: YouTube channel links and "Watch on YouTube" can never be clicked. */}
      <div ref={mountRef} className="pointer-events-none absolute inset-0 h-full w-full" />

      {/* Main clickable play/pause surface */}
      <button
        type="button"
        aria-label={status === "playing" ? "Pause video" : "Play video"}
        onClick={togglePlay}
        className="absolute inset-0 z-10 h-full w-full cursor-pointer bg-transparent focus-visible:outline-none"
      />

      {/* Initial poster state before playback starts: hides YouTube's red play button & channel header */}
      {status === "unstarted" && (
        <div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center bg-[#091c15]/80 px-6 text-center backdrop-blur-[1px]">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/15 px-3 py-1 text-xs font-semibold text-gold">
            <GraduationCap className="h-3.5 w-3.5" />
            {ACADEMY_BRAND_NAME}
          </span>
          <p className="mt-3 line-clamp-2 max-w-xl font-display text-lg font-semibold text-white sm:text-xl">
            {title}
          </p>
          <span className="mt-5 flex h-16 w-16 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg ring-4 ring-gold/40 transition-transform group-hover:scale-105">
            <Play className="ml-1 h-7 w-7 fill-current" />
          </span>
          <span className="mt-3 text-xs font-medium text-white/75">Click to watch lesson</span>
        </div>
      )}

      {/* Ended cover: blocks YouTube's external "More videos" / channel recommendations */}
      {status === "ended" && (
        <div className="absolute inset-0 z-30 flex flex-col items-center justify-center bg-[#091c15]/95 px-6 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-gold/40 bg-gold/15 px-3 py-1 text-xs font-semibold text-gold">
            <GraduationCap className="h-3.5 w-3.5" />
            {ACADEMY_BRAND_NAME}
          </span>
          <p className="mt-3 line-clamp-2 max-w-xl font-display text-xl font-semibold text-white">
            {title}
          </p>
          <p className="mt-1 text-sm text-white/70">Lesson playback finished</p>
          <Button type="button" variant="hero" className="mt-5" onClick={togglePlay}>
            <RotateCcw className="h-4 w-4" /> Replay lesson
          </Button>
        </div>
      )}

      {/* Centered pause/play badge when paused */}
      {status === "paused" && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center">
          <span className="flex h-16 w-16 items-center justify-center rounded-full bg-black/60 text-white ring-2 ring-white/30 backdrop-blur-sm">
            <Play className="ml-1 h-7 w-7 fill-current" />
          </span>
        </div>
      )}

      {/* Ezana Academy top header bar: covers YouTube's channel avatar, channel name & share links */}
      <div
        className={cn(
          "pointer-events-none absolute inset-x-0 top-0 z-20 flex h-20 items-start justify-between gap-3 bg-gradient-to-b from-[#091c15] from-58% via-[#091c15]/92 via-80% to-transparent px-4 pt-3 transition-opacity duration-200",
          showChrome ? "opacity-100" : "opacity-0",
        )}
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gold text-gold-foreground shadow-sm">
            <GraduationCap className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-white sm:text-sm">{title}</p>
            <p className="text-[11px] font-semibold tracking-wide text-gold">
              {ACADEMY_BRAND_NAME}
            </p>
          </div>
        </div>
        {muted && status === "playing" && (
          <button
            type="button"
            onClick={toggleMute}
            className="pointer-events-auto inline-flex shrink-0 items-center gap-1.5 rounded-full bg-gold px-3 py-1 text-xs font-semibold text-gold-foreground shadow-sm hover:bg-gold/90"
          >
            <VolumeX className="h-3.5 w-3.5" /> Unmute
          </button>
        )}
      </div>

      {/* Custom Ezana Academy bottom control bar: replaces YouTube controls & hides YouTube watermark */}
      <div
        onClick={(e) => e.stopPropagation()}
        className={cn(
          "absolute inset-x-0 bottom-0 z-20 bg-gradient-to-t from-[#091c15] from-65% via-[#091c15]/95 via-85% to-transparent px-3 pb-2.5 pt-6 transition-opacity duration-200 sm:px-4",
          showChrome ? "opacity-100" : "pointer-events-none opacity-0",
        )}
      >
        {/* Scrub bar */}
        <div className="relative flex h-4 items-center">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/25">
            <div
              className="h-full rounded-full bg-gold transition-[width] duration-100"
              style={{ width: `${progressPct}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={duration > 0 ? duration : 100}
            step={0.5}
            value={displayTime}
            disabled={!ready || duration <= 0}
            aria-label="Seek video timeline"
            onMouseDown={() => setSeeking(true)}
            onTouchStart={() => setSeeking(true)}
            onChange={(e) => {
              const val = Number(e.target.value);
              setSeeking(true);
              setSeekValue(val);
              bumpControls();
            }}
            onMouseUp={(e) => {
              const val = Number((e.target as HTMLInputElement).value);
              setSeeking(false);
              setCurrentTime(val);
              playerRef.current?.seekTo(val, true);
            }}
            onTouchEnd={(e) => {
              const val = Number((e.target as HTMLInputElement).value);
              setSeeking(false);
              setCurrentTime(val);
              playerRef.current?.seekTo(val, true);
            }}
            onKeyUp={(e) => {
              const val = Number((e.target as HTMLInputElement).value);
              setSeeking(false);
              setCurrentTime(val);
              playerRef.current?.seekTo(val, true);
            }}
            onBlur={() => setSeeking(false)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </div>

        {/* Control buttons */}
        <div className="mt-1 flex items-center justify-between gap-2 text-xs">
          <div className="flex items-center gap-1 sm:gap-1.5">
            <button
              type="button"
              onClick={togglePlay}
              aria-label={status === "playing" ? "Pause" : "Play"}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white transition-colors hover:bg-white/15"
            >
              {status === "playing" ? (
                <Pause className="h-4 w-4 fill-current" />
              ) : (
                <Play className="h-4 w-4 fill-current" />
              )}
            </button>
            <button
              type="button"
              onClick={() => skipBy(-10)}
              aria-label="Rewind 10 seconds"
              title="Rewind 10s"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/85 transition-colors hover:bg-white/15 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={() => skipBy(10)}
              aria-label="Forward 10 seconds"
              title="Forward 10s"
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/85 transition-colors hover:bg-white/15 hover:text-white"
            >
              <RotateCw className="h-3.5 w-3.5" />
            </button>

            <span className="ml-1 rounded-md bg-white/10 px-2 py-1 text-[11px] font-semibold tabular-nums text-white">
              {formatVideoDuration(displayTime)} / {formatVideoDuration(duration)}
            </span>
          </div>

          <div className="flex items-center gap-1 sm:gap-1.5">
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={toggleMute}
                aria-label={muted ? "Unmute" : "Mute"}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/90 transition-colors hover:bg-white/15 hover:text-white"
              >
                {muted || volume === 0 ? (
                  <VolumeX className="h-4 w-4" />
                ) : (
                  <Volume2 className="h-4 w-4" />
                )}
              </button>
              <input
                type="range"
                min={0}
                max={100}
                value={muted ? 0 : volume}
                aria-label="Volume"
                onChange={(e) => handleVolumeChange(Number(e.target.value))}
                className="hidden h-1 w-16 cursor-pointer accent-gold sm:block"
              />
            </div>

            <button
              type="button"
              onClick={cyclePlaybackRate}
              aria-label={`Playback speed ${playbackRate}x`}
              title="Playback speed"
              className="inline-flex h-8 min-w-10 items-center justify-center rounded-lg px-2 text-[11px] font-bold tabular-nums text-white/90 transition-colors hover:bg-white/15 hover:text-white"
            >
              {playbackRate}×
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              aria-label={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
              className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/90 transition-colors hover:bg-white/15 hover:text-white"
            >
              {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
