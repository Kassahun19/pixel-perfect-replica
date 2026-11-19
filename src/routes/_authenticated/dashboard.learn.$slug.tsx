import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Crown, Lock, PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { courseQuery } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { isLessonLocked } from "@/lib/access";
import { Button } from "@/components/ui/button";
import { LoadingBlock } from "@/components/dashboard/ui";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/dashboard/learn/$slug")({
  component: Player,
});

function Player() {
  const { slug } = Route.useParams();
  const { user } = useAuth();
  const { data, isLoading } = useQuery(courseQuery(slug));
  const courseId = data?.course.id;
  const { data: unlocked = false } = useQuery({
    queryKey: ["unlocked", courseId, user?.id],
    enabled: !!courseId && !!user,
    queryFn: async () => {
      const { data: p } = await supabase.from("payments").select("id").eq("course_id", courseId!).eq("user_id", user!.id).eq("status", "approved").limit(1);
      return (p ?? []).length > 0;
    },
  });
  const [activeId, setActiveId] = useState<string | null>(null);
  const lessons = data?.lessons ?? [];
  const current = lessons.find((l) => l.id === activeId) ?? lessons[0];
  const { data: video } = useQuery({
    queryKey: ["video", current?.id],
    enabled: !!current,
    queryFn: async () => {
      const { data: m } = await supabase.from("lesson_media").select("video_url").eq("lesson_id", current!.id).maybeSingle();
      return m?.video_url ?? null;
    },
  });

  if (isLoading) return <LoadingBlock />;
  if (!data) return <p>Course not found.</p>;

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_360px]">
      <div>
        <div className="overflow-hidden rounded-2xl bg-deep">
          {video ? (
            <video key={video} src={video} controls className="aspect-video w-full" />
          ) : (
            <div className="flex aspect-video flex-col items-center justify-center gap-3 text-deep-foreground">
              <Lock className="h-10 w-10 text-gold" />
              <p>Upgrade to Ezana Pro to watch this video.</p>
              <Button asChild variant="hero"><Link to="/pro" search={{ course: slug }}><Crown /> Upgrade</Link></Button>
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
              {locked ? <Lock className="h-4 w-4 text-muted-foreground" /> : <PlayCircle className="h-4 w-4 text-primary" />}
            </>
          );
          return (
            <li key={l.id}>
              {locked ? (
                <Link to="/pro" search={{ course: slug }} className="flex items-center gap-3 px-4 py-3 opacity-70">{inner}</Link>
              ) : (
                <button onClick={() => setActiveId(l.id)} className={cn("flex w-full items-center gap-3 px-4 py-3 text-left", current?.id === l.id && "bg-secondary")}>
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
