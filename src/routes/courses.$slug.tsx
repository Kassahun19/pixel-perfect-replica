import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { CheckCircle2, Clock, Crown, Lock, PlayCircle, Signal } from "lucide-react";
import { PublicLayout } from "@/components/site/PublicLayout";
import { Button } from "@/components/ui/button";
import { courseQuery } from "@/lib/queries";
import { FREE_LESSON_LIMIT, formatETB, isFreeLesson } from "@/lib/access";
import { useAuth } from "@/lib/auth";

export const Route = createFileRoute("/courses/$slug")({
  loader: async ({ context, params }) => {
    const data = await context.queryClient.ensureQueryData(courseQuery(params.slug));
    if (!data) throw notFound();
    return { title: data.course.title, description: data.course.short_description };
  },
  head: ({ loaderData }) => ({
    meta: [
      { title: loaderData ? `${loaderData.title} — Ezana Academy` : "Course — Ezana Academy" },
      { name: "description", content: loaderData?.description ?? "An Ezana Academy course." },
      { property: "og:title", content: loaderData ? `${loaderData.title} — Ezana Academy` : "Course — Ezana Academy" },
      { property: "og:description", content: loaderData?.description ?? "An Ezana Academy course." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  notFoundComponent: () => (
    <PublicLayout>
      <div className="mx-auto max-w-xl px-4 py-32 text-center">
        <h1 className="text-4xl font-semibold">Course not found</h1>
        <Button asChild variant="emerald" className="mt-6"><Link to="/courses">Back to courses</Link></Button>
      </div>
    </PublicLayout>
  ),
  component: CourseDetail,
});

function CourseDetail() {
  const { slug } = Route.useParams();
  const { data } = useSuspenseQuery(courseQuery(slug));
  const { user } = useAuth();
  if (!data) return null;
  const { course, lessons } = data;
  const totalMin = lessons.reduce((a, l) => a + l.duration_minutes, 0);

  return (
    <PublicLayout>
      <section className="relative overflow-hidden bg-hero text-deep-foreground">
        <div className="pattern-dots absolute inset-0 opacity-40" />
        <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.4fr_1fr] lg:py-24">
          <div className="animate-fade-up">
            {course.category && (
              <span className="rounded-full border border-gold/40 bg-gold/10 px-3 py-1 text-xs font-bold uppercase tracking-widest text-gold">
                {course.category.name}
              </span>
            )}
            <h1 className="mt-5 text-4xl font-semibold leading-tight md:text-6xl">{course.title}</h1>
            <p className="mt-5 max-w-2xl text-lg text-deep-muted">{course.description}</p>
            <div className="mt-8 flex flex-wrap gap-6 text-sm">
              <span className="flex items-center gap-2"><PlayCircle className="h-4 w-4 text-gold" />{lessons.length} videos</span>
              <span className="flex items-center gap-2"><Clock className="h-4 w-4 text-gold" />{Math.round(totalMin / 60 * 10) / 10}h of video</span>
              <span className="flex items-center gap-2"><Signal className="h-4 w-4 text-gold" />{course.level}</span>
            </div>
          </div>
          <div className="animate-fade-up rounded-3xl border border-gold/30 bg-card p-3 text-card-foreground shadow-elegant [animation-delay:150ms]">
            {course.image_url && <img src={course.image_url} alt={course.title} className="aspect-video w-full rounded-2xl object-cover" />}
            <div className="p-5">
              <p className="text-sm text-muted-foreground">First {FREE_LESSON_LIMIT} videos free · Full course</p>
              <p className="font-display text-4xl font-semibold text-primary">{formatETB()}</p>
              <div className="mt-5 grid gap-2">
                {user ? (
                  <Button asChild variant="emerald" size="lg">
                    <Link to="/dashboard/learn/$slug" params={{ slug: course.slug }}>
                      <PlayCircle /> Start watching
                    </Link>
                  </Button>
                ) : (
                  <Button asChild variant="emerald" size="lg">
                    <Link to="/register">Sign up to watch free</Link>
                  </Button>
                )}
                <Button asChild variant="hero" size="lg">
                  <Link to="/pro" search={{ course: course.slug }}>
                    <Crown /> Unlock with Ezana Pro
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        </div>
        <div className="pattern-tibeb h-1.5 w-full opacity-70" />
      </section>

      <section className="mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 lg:grid-cols-[1.4fr_1fr]">
        <div>
          <h2 className="text-3xl font-semibold">Course content</h2>
          <ol className="mt-6 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-card">
            {lessons.map((l, i) => {
              const free = isFreeLesson(i);
              const content = (
                <>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-primary">
                    {i + 1}
                  </span>
                  <span className="flex-1 font-medium">{l.title}</span>
                  <span className="text-xs text-muted-foreground">{l.duration_minutes} min</span>
                  {free ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-success/15 px-2.5 py-1 text-xs font-bold text-success">
                      <PlayCircle className="h-3.5 w-3.5" /> Free
                    </span>
                  ) : (
                    <Lock className="h-4 w-4 text-muted-foreground" aria-label="Locked" />
                  )}
                </>
              );
              return (
                <li key={l.id}>
                  {free ? (
                    user ? (
                      <Link
                        to="/dashboard/learn/$slug"
                        params={{ slug: course.slug }}
                        search={{ lesson: l.id }}
                        className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/50"
                      >
                        {content}
                      </Link>
                    ) : (
                      <Link
                        to="/register"
                        className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/50"
                      >
                        {content}
                      </Link>
                    )
                  ) : (
                    <Link
                      to="/pro"
                      search={{ course: course.slug }}
                      className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-secondary/30"
                    >
                      {content}
                    </Link>
                  )}
                </li>
              );
            })}
          </ol>
        </div>
        <aside>
          <h2 className="text-3xl font-semibold">What you'll learn</h2>
          <ul className="mt-6 space-y-3">
            {course.objectives.map((o) => (
              <li key={o} className="flex gap-3 rounded-xl bg-secondary/60 p-4">
                <CheckCircle2 className="h-5 w-5 shrink-0 text-primary" />
                <span className="text-sm">{o}</span>
              </li>
            ))}
          </ul>
        </aside>
      </section>
    </PublicLayout>
  );
}
