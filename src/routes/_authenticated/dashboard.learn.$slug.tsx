import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Check, Crown, Film, Lock, PlayCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { courseQuery } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { isFreeLesson, isLessonLocked } from "@/lib/access";
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
  return isFreeLesson(lessonIndex) ? `/videos/lesson-${lessonIndex + 1}.mp4` : "/videos/lesson-pro.mp4";
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
  const { data: completedLessons = [] } = useQuery({
    queryKey: ["lesson-progress", courseId, user?.id],
    enabled: !!courseId && !!user,
    queryFn: async () => {
      const { data: progress, error } = await supabase.from("lesson_progress").select("lesson_id").eq("course_id", courseId!).eq("user_id", user!.id);
      if (error) throw error;
      return progress ?? [];
    },
  });
  const isCurrentComplete = !!current && completedLessons.some((p) => p.lesson_id === current.id);

  async function markCurrentComplete() {
    if (!current || !courseId || !user || isCurrentComplete) return;
    const { error } = await supabase.from("lesson_progress").insert({ user_id: user.id, lesson_id: current.id, course_id: courseId });
    if (error && error.code !== "23505") { toast.error(error.message); return; }
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
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
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
            <div className="flex aspect-video items-center justify-center text-deep-muted">Loading video…</div>
          ) : video && current ? (
            <VideoPlayer
              key={`${current.id}-${video}`}
              url={video}
              title={current.title}
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
        <h1 className="mt-6 text-3xl font-semibold">{current?.title}</h1>
        <p className="text-muted-foreground">{data.course.title}</p>
        {user && current && !currentLocked && <Button className="mt-4" variant={isCurrentComplete ? "outline" : "emerald"} disabled={isCurrentComplete} onClick={() => void markCurrentComplete()}>{isCurrentComplete ? <><Check /> Completed</> : "Mark lesson complete"}</Button>}
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
              ) : completedLessons.some((p) => p.lesson_id === l.id) ? (
                <Check className="h-4 w-4 text-primary" />
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
