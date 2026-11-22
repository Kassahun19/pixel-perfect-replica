import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { Crown, Lock, PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { courseQuery } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { isFreeLesson, isLessonLocked } from "@/lib/access";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/dashboard/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/learn/$slug")({
  validateSearch: (s: Record<string, unknown>): { lesson?: string | undefined } => ({
    lesson: typeof s["lesson"] === "string" ? s["lesson"] : undefined,
  }),
  component: Player,
});

function resolvePlayableVideoUrl(rawUrl: string | null | undefined, lessonIndex: number): string | null {
  if (!rawUrl) return null;
  if (rawUrl.startsWith("https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/")) {
    return isFreeLesson(lessonIndex) ? `/videos/lesson-${lessonIndex + 1}.mp4` : "/videos/lesson-pro.mp4";
  }
  return rawUrl;
}

function Player() {
  const { slug } = Route.useParams();
  const { lesson: initialLessonId } = Route.useSearch();
  const { user } = useAuth();
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
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (initialLessonId) {
      setActiveId(initialLessonId);
      setAutoPlay(true);
    }
  }, [initialLessonId]);

  const lessons = data?.lessons ?? [];
  const activeIndex = Math.max(
    0,
    lessons.findIndex((l) => l.id === activeId),
  );
  const current = lessons[activeIndex] ?? lessons[0];
  const currentLocked = current ? isLessonLocked(activeIndex, { unlocked, signedIn: !!user }) : true;

  const { data: rawVideo, isLoading: videoLoading } = useQuery({
    queryKey: ["video", current?.id],
    enabled: !!current && !currentLocked,
    queryFn: async () => {
      const { data: m } = await supabase
        .from("lesson_media")
        .select("video_url")
        .eq("lesson_id", current!.id)
        .maybeSingle();
      return m?.video_url ?? (isFreeLesson(activeIndex) ? `/videos/lesson-${activeIndex + 1}.mp4` : unlocked ? "/videos/lesson-pro.mp4" : null);
    },
  });

  const video = currentLocked ? null : resolvePlayableVideoUrl(rawVideo, activeIndex);

  useEffect(() => {
    if (autoPlay && video && videoRef.current) {
      videoRef.current.play().catch(() => {});
    }
  }, [autoPlay, video]);

  if (isLoading) return <LoadingBlock />;
  if (!data) return <p>Course not found.</p>;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="overflow-hidden rounded-2xl bg-deep">
          {!currentLocked && videoLoading ? (
            <div className="flex aspect-video items-center justify-center text-deep-muted">Loading video…</div>
          ) : video ? (
            <video
              ref={videoRef}
              key={video}
              src={video}
              controls
              playsInline
              autoPlay={autoPlay}
              preload="auto"
              onLoadedMetadata={(e) => {
                e.currentTarget.muted = false;
                e.currentTarget.volume = 1;
              }}
              onCanPlay={(e) => {
                e.currentTarget.muted = false;
                e.currentTarget.volume = 1;
                if (autoPlay) e.currentTarget.play().catch(() => {});
              }}
              className="aspect-video w-full"
            />
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center gap-3 text-deep-foreground">
              <Lock className="h-10 w-10 text-gold" />
              <p>Upgrade to Ezana Pro to watch this video.</p>
              <Button asChild variant="hero">
                <Link to="/pro" search={{ course: slug }}>
                  <Crown /> Upgrade
                </Link>
              </Button>
            </div>
          )}
        </div>
        <h1 className="mt-6 text-3xl font-semibold">{current?.title}</h1>
        <p className="text-muted-foreground">{data.course.title}</p>
      </div>
      <ol className="divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
        {lessons.map((l, i) => {
          const locked = isLessonLocked(i, { unlocked, signedIn: !!user });
          const inner = (
            <>
              <span className="w-6 text-sm font-bold text-primary">{i + 1}</span>
              <span className="flex-1 text-sm font-medium">{l.title}</span>
              {locked ? (
                <Lock className="h-4 w-4 text-muted-foreground" />
              ) : (
                <PlayCircle className="h-4 w-4 text-primary" />
              )}
            </>
          );
          return (
            <li key={l.id}>
              {locked ? (
                <Link to="/pro" search={{ course: slug }} className="flex items-center gap-3 px-4 py-3 opacity-70 hover:bg-secondary/40">
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
        })}
      </ol>
    </div>
  );
}
