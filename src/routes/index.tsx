import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { ArrowRight, Award, BookOpenCheck, Crown, GraduationCap, PlayCircle, ShieldCheck, Sparkles, Users } from "lucide-react";
import { PublicLayout } from "@/components/site/PublicLayout";
import { CourseCard } from "@/components/site/CourseCard";
import { Button } from "@/components/ui/button";
import { coursesQuery } from "@/lib/queries";
import { FREE_LESSON_LIMIT, formatETB } from "@/lib/access";
import hero from "@/assets/ezana-hero.jpg.asset.json";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Ezana Academy — Premium online learning in Ethiopia" },
      {
        name: "description",
        content: "Learn web development, data science, design, maths, business and English online. Watch 5 videos free in every course.",
      },
      { property: "og:title", content: "Ezana Academy — Premium online learning in Ethiopia" },
      { property: "og:description", content: "Practical online courses taught by experienced instructors. 5 free videos in every course." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: ({ context }) => context.queryClient.ensureQueryData(coursesQuery),
  component: Home,
});

const FEATURES = [
  { icon: PlayCircle, title: "Learn by watching", text: "Short, focused video lessons you can watch anytime, on any device." },
  { icon: GraduationCap, title: "Expert instructors", text: "Learn from practitioners who teach real skills used in Ethiopian workplaces." },
  { icon: ShieldCheck, title: "Track your progress", text: "Mark lessons complete, see your progress and keep parents in the loop." },
  { icon: Award, title: "Career-ready skills", text: "Project-based courses designed to help you get hired or grow your business." },
];

const TESTIMONIALS = [
  { name: "Hanna T.", role: "Web developer, Addis Ababa", text: "The web course got me my first freelance client in two months." },
  { name: "Dawit M.", role: "Grade 12 student", text: "Maths finally makes sense. The lessons are clear and short." },
  { name: "Selam G.", role: "Startup founder", text: "Practical, local and affordable. Exactly what I needed." },
  { name: "Yonas K.", role: "Data analyst", text: "The data science course is world-class, at a price I could afford." },
  { name: "Meron A.", role: "Parent", text: "I can see my daughter's progress from my own dashboard." },
];

function Home() {
  const { data: courses } = useSuspenseQuery(coursesQuery);
  return (
    <PublicLayout>
      {/* Hero */}
      <section className="relative -mt-18 overflow-hidden bg-hero pt-18 text-deep-foreground">
        <div className="pattern-dots absolute inset-0 opacity-40" />
        <div className="absolute -left-32 top-20 h-96 w-96 rounded-full bg-primary-glow/30 blur-3xl" />
        <div className="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-gold/20 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-14 px-4 py-20 sm:px-6 lg:grid-cols-2 lg:py-28">
          <div>
            <span className="inline-flex animate-fade-up items-center gap-2 rounded-full border border-gold/40 bg-gold/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-gold">
              <Sparkles className="h-3.5 w-3.5" /> Ethiopia's premium academy
            </span>
            <h1 className="mt-6 animate-fade-up text-5xl font-semibold leading-[1.05] [animation-delay:100ms] md:text-7xl">
              Learn without limits. <span className="text-gold-gradient italic">Rise like Aksum.</span>
            </h1>
            <p className="mt-6 max-w-xl animate-fade-up text-lg text-deep-muted [animation-delay:200ms]">
              Build real skills in technology, data, design, maths, business and English, with lessons from
              instructors who know what works here.
            </p>
            <div className="mt-9 flex animate-fade-up flex-wrap gap-3 [animation-delay:300ms]">
              <Button asChild variant="hero" size="xl" className="rounded-full">
                <Link to="/register">
                  Start learning free <ArrowRight />
                </Link>
              </Button>
              <Button asChild variant="outlineLight" size="xl" className="rounded-full">
                <Link to="/courses">Browse courses</Link>
              </Button>
            </div>
            <div className="mt-12 grid max-w-md animate-fade-up grid-cols-3 gap-6 [animation-delay:400ms]">
              {[
                ["12k+", "Learners"],
                [`${courses.length}+`, "Courses"],
                ["4.9★", "Rating"],
              ].map(([n, l]) => (
                <div key={l}>
                  <p className="font-display text-3xl font-semibold text-gold">{n}</p>
                  <p className="text-xs uppercase tracking-widest text-deep-muted">{l}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="relative animate-fade-up [animation-delay:250ms]">
            <div className="absolute -inset-4 rounded-[2rem] bg-gold-gradient opacity-30 blur-2xl" />
            <div className="relative overflow-hidden rounded-[2rem] border border-gold/30 shadow-elegant">
              <img src={hero.url} alt="Ethiopian students learning online at Ezana Academy" className="aspect-[4/3] w-full object-cover" />
            </div>
            <div className="absolute -bottom-6 -left-6 hidden animate-float rounded-2xl border border-border bg-card p-4 text-card-foreground shadow-elegant sm:block">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-gold-soft text-gold-foreground">
                  <PlayCircle className="h-6 w-6" />
                </span>
                <div>
                  <p className="text-sm font-bold">{FREE_LESSON_LIMIT} free videos</p>
                  <p className="text-xs text-muted-foreground">in every course</p>
                </div>
              </div>
            </div>
            <div className="absolute -right-4 -top-6 hidden animate-swing rounded-2xl bg-gold px-5 py-3 text-gold-foreground shadow-gold sm:block">
              <p className="text-xs font-bold uppercase tracking-wider">Ezana Pro</p>
              <p className="font-display text-2xl font-semibold">{formatETB()}</p>
            </div>
          </div>
        </div>
        <div className="pattern-tibeb h-1.5 w-full opacity-70" />
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">Why Ezana</p>
          <h2 className="mt-3 text-4xl font-semibold md:text-5xl">A better way to learn, built for Ethiopia</h2>
        </div>
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f, i) => (
            <div
              key={f.title}
              className="lift animate-fade-up rounded-2xl border border-border bg-card p-7"
              style={{ animationDelay: `${i * 90}ms` }}
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-gradient text-primary-foreground">
                <f.icon className="h-6 w-6" />
              </span>
              <h3 className="mt-5 text-xl font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Courses */}
      <section className="bg-secondary/60 py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">Popular courses</p>
              <h2 className="mt-3 text-4xl font-semibold md:text-5xl">Start with a free lesson today</h2>
            </div>
            <Button asChild variant="outline" className="rounded-full">
              <Link to="/courses">
                View all courses <ArrowRight />
              </Link>
            </Button>
          </div>
          <div className="mt-12 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {courses.slice(0, 6).map((c, i) => (
              <CourseCard key={c.id} course={c} index={i} />
            ))}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-7xl px-4 py-24 sm:px-6">
        <div className="grid items-center gap-14 lg:grid-cols-2">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">How it works</p>
            <h2 className="mt-3 text-4xl font-semibold md:text-5xl">Try first. Upgrade when you love it.</h2>
            <p className="mt-5 text-lg text-muted-foreground">
              Every course opens with {FREE_LESSON_LIMIT} free tutorial videos. Unlock the whole course with Ezana Pro for a
              single payment of {formatETB()}.
            </p>
          </div>
          <ol className="space-y-4">
            {[
              { icon: Users, t: "Create your free account", d: "Sign up in under a minute with your email." },
              { icon: BookOpenCheck, t: `Watch ${FREE_LESSON_LIMIT} free videos`, d: "Open any course from your dashboard and start learning." },
              { icon: Crown, t: `Unlock with Ezana Pro, ${formatETB()}`, d: "Pay by Telebirr or bank and get the full course once your payment is confirmed." },
            ].map((s, i) => (
              <li key={s.t} className="lift flex gap-5 rounded-2xl border border-border bg-card p-6">
                <span className="font-display text-4xl font-semibold text-gold">0{i + 1}</span>
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-semibold">
                    <s.icon className="h-5 w-5 text-primary" /> {s.t}
                  </h3>
                  <p className="mt-1 text-sm text-muted-foreground">{s.d}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* Testimonials marquee */}
      <section className="overflow-hidden bg-deep py-20 text-deep-foreground">
        <h2 className="text-center text-3xl font-semibold md:text-4xl">
          Loved by learners <span className="text-gold-gradient italic">across Ethiopia</span>
        </h2>
        <div className="relative mt-12">
          <div className="flex w-max animate-marquee gap-6 hover:[animation-play-state:paused]">
            {[...TESTIMONIALS, ...TESTIMONIALS].map((t, i) => (
              <figure key={i} className="w-80 shrink-0 rounded-2xl border border-deep-foreground/10 bg-deep-foreground/5 p-6">
                <blockquote className="text-sm leading-relaxed">"{t.text}"</blockquote>
                <figcaption className="mt-4">
                  <p className="font-semibold text-gold">{t.name}</p>
                  <p className="text-xs text-deep-muted">{t.role}</p>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-7xl px-4 pt-24 sm:px-6">
        <div className="relative overflow-hidden rounded-[2rem] bg-emerald-gradient p-10 text-primary-foreground shadow-elegant md:p-16">
          <div className="pattern-dots absolute inset-0 opacity-30" />
          <div className="relative flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
            <div>
              <h2 className="text-3xl font-semibold md:text-5xl">Your next chapter starts today.</h2>
              <p className="mt-3 max-w-xl text-primary-foreground/80">Join Ezana Academy free and watch your first lessons in minutes.</p>
            </div>
            <Button asChild variant="hero" size="xl" className="rounded-full">
              <Link to="/register">
                Get started <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>
    </PublicLayout>
  );
}
