import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  Crown,
  Film,
  Lock,
  PlayCircle,
  Search,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { courseQuery } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { isFreeLesson, isLessonLocked } from "@/lib/access";
import { replaceChannelBranding } from "@/lib/youtube";
import { filterAndSortLessons, type LessonAccessFilter } from "@/lib/syllabus";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/dashboard/ui";
import { VideoPlayer } from "@/components/dashboard/VideoPlayer";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/learn/$slug")({
  validateSearch: (s: Record<string, unknown>): { lesson?: string | undefined } => ({
    lesson: typeof s["lesson"] === "string" ? s["lesson"] : undefined,
  }),
  component: Player,
});

/** Bundled sample clip used if a lesson's own video can't be loaded. */
function localFallbackVideo(lessonIndex: number): string {
  return isFreeLesson(lessonIndex)
    ? `/videos/lesson-${lessonIndex + 1}.mp4`
    : "/videos/lesson-pro.mp4";
}

function Player() {
  const { slug } = Route.useParams();
  const { lesson: initialLessonId } = Route.useSearch();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { data, isLoading } = useQuery(courseQuery(slug));
  const courseId = data?.course.id;
  const { data: unlocked = false } = useQuery({
    queryKey: ["unlocked", courseId, user?.id],
    enabled: !!courseId && !!user,
    queryFn: async () => {
      const { data: p } = await supabase
        .from("payments")
        .select("id")
        .eq("course_id", courseId!)
        .eq("user_id", user!.id)
        .eq("status", "approved")
        .limit(1);
      return (p ?? []).length > 0;
    },
  });
  const [activeId, setActiveId] = useState<string | null>(initialLessonId ?? null);
  const [autoPlay, setAutoPlay] = useState(Boolean(initialLessonId));
  const [playlistQuery, setPlaylistQuery] = useState("");
  const [playlistFilter, setPlaylistFilter] = useState<LessonAccessFilter>("all");
  const [playlistPageSize, setPlaylistPageSize] = useState(10);
  const [playlistPage, setPlaylistPage] = useState(1);

  useEffect(() => {
    if (initialLessonId) {
      setActiveId(initialLessonId);
      setAutoPlay(true);
    }
  }, [initialLessonId]);

  const lessons = useMemo(() => data?.lessons ?? [], [data?.lessons]);
  const activeIndex = Math.max(
    0,
    lessons.findIndex((l) => l.id === activeId),
  );
  const current = lessons[activeIndex] ?? lessons[0];
  const currentId = current?.id;
  const currentLocked = current
    ? isLessonLocked(activeIndex, { unlocked, signedIn: !!user })
    : true;
  const { data: completedLessons = [] } = useQuery({
    queryKey: ["lesson-progress", courseId, user?.id],
    enabled: !!courseId && !!user,
    queryFn: async () => {
      const { data: progress, error } = await supabase
        .from("lesson_progress")
        .select("lesson_id")
        .eq("course_id", courseId!)
        .eq("user_id", user!.id);
      if (error) throw error;
      return progress ?? [];
    },
  });
  const isCurrentComplete = !!current && completedLessons.some((p) => p.lesson_id === current.id);

  const filteredPlaylist = useMemo(
    () =>
      filterAndSortLessons(lessons, {
        query: playlistQuery,
        accessFilter: playlistFilter,
        sortBy: "order-asc",
      }),
    [lessons, playlistQuery, playlistFilter],
  );

  const effectiveSize =
    playlistPageSize === 0 ? Math.max(1, filteredPlaylist.length) : playlistPageSize;
  const totalPlaylistPages = Math.max(1, Math.ceil(filteredPlaylist.length / effectiveSize));
  const safePlaylistPage = Math.min(playlistPage, totalPlaylistPages);

  useEffect(() => {
    setPlaylistPage(1);
  }, [playlistQuery, playlistFilter, playlistPageSize, slug]);

  useEffect(() => {
    if (!currentId || playlistQuery || playlistFilter !== "all" || playlistPageSize === 0) return;
    const idx = filteredPlaylist.findIndex((l) => l.id === currentId);
    if (idx >= 0) {
      setPlaylistPage(Math.floor(idx / effectiveSize) + 1);
    }
  }, [currentId, effectiveSize, filteredPlaylist, playlistFilter, playlistPageSize, playlistQuery]);

  const visiblePlaylist = filteredPlaylist.slice(
    (safePlaylistPage - 1) * effectiveSize,
    safePlaylistPage * effectiveSize,
  );

  async function markCurrentComplete() {
    if (!current || !courseId || !user || isCurrentComplete) return;
    const { error } = await supabase
      .from("lesson_progress")
      .insert({ user_id: user.id, lesson_id: current.id, course_id: courseId });
    if (error && error.code !== "23505") {
      toast.error(error.message);
      return;
    }
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["lesson-progress", courseId, user.id] }),
      queryClient.invalidateQueries({ queryKey: ["role-dashboard"] }),
    ]);
    toast.success("Lesson marked complete");
  }

  const { data: video, isLoading: videoLoading } = useQuery({
    queryKey: ["video", current?.id, unlocked],
    enabled: !!current && !currentLocked,
    queryFn: async () => {
      const { data: m } = await supabase
        .from("lesson_media")
        .select("video_url")
        .eq("lesson_id", current!.id)
        .maybeSingle();
      return m?.video_url?.trim() || null;
    },
  });

  if (isLoading) return <LoadingBlock />;
  if (!data) return <p>Course not found.</p>;

  return (
    <div className="grid items-start gap-8 lg:grid-cols-[1fr_380px]">
      <div>
        <div className="overflow-hidden rounded-2xl bg-deep">
          {currentLocked ? (
            <div className="flex aspect-video flex-col items-center justify-center gap-3 text-deep-foreground">
              <Lock className="h-10 w-10 text-gold" />
              <p>Upgrade to Ezana Pro to watch this video.</p>
              <Button asChild variant="hero">
                <Link to="/pro" search={{ course: slug }}>
                  <Crown /> Upgrade
                </Link>
              </Button>
            </div>
          ) : videoLoading ? (
            <div className="flex aspect-video items-center justify-center text-deep-muted">
              Loading video…
            </div>
          ) : video && current ? (
            <VideoPlayer
              key={`${current.id}-${video}`}
              url={video}
              title={replaceChannelBranding(current.title)}
              autoPlay={autoPlay}
              fallbackUrl={localFallbackVideo(activeIndex)}
            />
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center gap-3 text-deep-foreground">
              <Film className="h-10 w-10 text-gold" />
              <p>This lesson's video isn't available yet.</p>
            </div>
          )}
        </div>
        <h1 className="mt-6 text-3xl font-semibold">
          {current ? replaceChannelBranding(current.title) : ""}
        </h1>
        <p className="text-muted-foreground">{data.course.title}</p>
        {user && current && !currentLocked && (
          <Button
            className="mt-4"
            variant={isCurrentComplete ? "outline" : "emerald"}
            disabled={isCurrentComplete}
            onClick={() => void markCurrentComplete()}
          >
            {isCurrentComplete ? (
              <>
                <Check /> Completed
              </>
            ) : (
              "Mark lesson complete"
            )}
          </Button>
        )}
      </div>

      <aside className="overflow-hidden rounded-2xl border border-border bg-card shadow-soft">
        <div className="space-y-2.5 border-b border-border p-3.5">
          <div className="flex items-center justify-between gap-2">
            <h2 className="font-display text-base font-semibold">Course lessons</h2>
            <span className="text-xs font-medium tabular-nums text-muted-foreground">
              {filteredPlaylist.length}/{lessons.length}
            </span>
          </div>
          <div className="relative">
            <Search
              aria-hidden="true"
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground"
            />
            <input
              type="search"
              value={playlistQuery}
              onChange={(e) => setPlaylistQuery(e.target.value)}
              placeholder="Find a lesson…"
              aria-label="Find a lesson"
              className="h-9 w-full rounded-lg border border-input bg-background pl-8 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            {playlistQuery && (
              <button
                type="button"
                onClick={() => setPlaylistQuery("")}
                aria-label="Clear lesson search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center justify-between gap-2">
            <div className="inline-flex rounded-lg bg-secondary/80 p-0.5">
              {(
                [
                  { id: "all", label: "All" },
                  { id: "free", label: "Free" },
                  { id: "pro", label: "Pro" },
                ] as const
              ).map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setPlaylistFilter(tab.id)}
                  className={cn(
                    "rounded-md px-2.5 py-1 text-xs font-semibold transition-colors",
                    playlistFilter === tab.id
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              ))}
            </div>
            <select
              aria-label="Playlist rows per page"
              value={playlistPageSize}
              onChange={(e) => setPlaylistPageSize(Number(e.target.value))}
              className="h-8 rounded-lg border border-input bg-background px-2 text-xs font-semibold tabular-nums"
            >
              <option value={10}>10 / page</option>
              <option value={20}>20 / page</option>
              <option value={0}>All</option>
            </select>
          </div>
        </div>

        <ol className="divide-y divide-border">
          {visiblePlaylist.length > 0 ? (
            visiblePlaylist.map((l) => {
              const locked = isLessonLocked(l.originalIndex, { unlocked, signedIn: !!user });
              const inner = (
                <>
                  <span className="w-6 shrink-0 text-xs font-bold tabular-nums text-primary">
                    {String(l.originalIndex + 1).padStart(2, "0")}
                  </span>
                  <span className="line-clamp-2 flex-1 text-sm font-medium">{l.title}</span>
                  <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                    {l.duration_minutes > 0 ? `${l.duration_minutes} min` : "< 1 min"}
                  </span>
                  {locked ? (
                    <Lock className="h-4 w-4 shrink-0 text-muted-foreground" />
                  ) : completedLessons.some((p) => p.lesson_id === l.id) ? (
                    <Check className="h-4 w-4 shrink-0 text-primary" />
                  ) : (
                    <PlayCircle className="h-4 w-4 shrink-0 text-primary" />
                  )}
                </>
              );
              return (
                <li key={l.id}>
                  {locked ? (
                    <Link
                      to="/pro"
                      search={{ course: slug }}
                      className="flex items-center gap-3 px-4 py-3 opacity-75 transition-colors hover:bg-secondary/40"
                    >
                      {inner}
                    </Link>
                  ) : (
                    <button
                      type="button"
                      onClick={() => {
                        setActiveId(l.id);
                        setAutoPlay(true);
                      }}
                      className={cn(
                        "flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary/60",
                        current?.id === l.id && "bg-secondary",
                      )}
                    >
                      {inner}
                    </button>
                  )}
                </li>
              );
            })
          ) : (
            <li className="px-4 py-6 text-center text-xs text-muted-foreground">
              No lessons match your search.
            </li>
          )}
        </ol>

        {totalPlaylistPages > 1 && (
          <div className="flex items-center justify-between border-t border-border px-3.5 py-2.5 text-xs">
            <span className="tabular-nums text-muted-foreground">
              Page {safePlaylistPage} of {totalPlaylistPages}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setPlaylistPage((p) => Math.max(1, p - 1))}
                disabled={safePlaylistPage === 1}
                aria-label="Previous playlist page"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPlaylistPage((p) => Math.min(totalPlaylistPages, p + 1))}
                disabled={safePlaylistPage === totalPlaylistPages}
                aria-label="Next playlist page"
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background hover:bg-secondary disabled:pointer-events-none disabled:opacity-40"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </aside>
    </div>
  );
}
