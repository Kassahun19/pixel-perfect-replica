import { createFileRoute, Link } from "@tanstack/react-router";
import { Compass, Eye, Heart, Lightbulb, Target, Users } from "lucide-react";
import { PageHero, PublicLayout } from "@/components/site/PublicLayout";
import { Button } from "@/components/ui/button";
import hero from "@/assets/ezana-hero.jpg.asset.json";

export const Route = createFileRoute("/about")({
  head: () => ({
    meta: [
      { title: "About Ezana Academy — Our story and mission" },
      { name: "description", content: "Ezana Academy is named after King Ezana of Aksum. Learn about our mission to make world-class learning accessible across Ethiopia." },
      { property: "og:title", content: "About Ezana Academy" },
      { property: "og:description", content: "Our mission: world-class, practical learning for every Ethiopian learner." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: About,
});

const VALUES = [
  { icon: Heart, t: "Learner first", d: "Every lesson is designed around what helps you learn and grow." },
  { icon: Lightbulb, t: "Practical", d: "We teach skills you can use at work, in school and in business tomorrow." },
  { icon: Users, t: "Community", d: "Students, parents and instructors learning and growing together." },
  { icon: Compass, t: "Rooted in Ethiopia", d: "Local examples, local context, global standards." },
];

function About() {
  return (
    <PublicLayout>
      <PageHero
        eyebrow="About us"
        title={<>Inspired by a king who opened Ethiopia <span className="text-gold-gradient italic">to the world.</span></>}
        subtitle="Ezana Academy is named after King Ezana of Aksum, a ruler remembered for knowledge, trade and openness. We carry that spirit into modern learning."
      />
      <section className="mx-auto grid max-w-7xl items-center gap-14 px-4 py-24 sm:px-6 lg:grid-cols-2">
        <div className="relative">
          <div className="absolute -inset-3 rotate-2 rounded-[2rem] bg-gold-gradient opacity-40" />
          <img src={hero.url} alt="Learners at Ezana Academy" className="relative aspect-[4/3] w-full rounded-[2rem] object-cover shadow-elegant" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.3em] text-primary">Our story</p>
          <h2 className="mt-3 text-4xl font-semibold">Quality education, within everyone's reach</h2>
          <p className="mt-5 leading-relaxed text-muted-foreground">
            Ezana Academy started with a simple belief: talent is everywhere in Ethiopia, but opportunity is not. We bring
            together experienced instructors and modern technology so any learner, in Addis Ababa, Bahir Dar, Mekelle or
            Hawassa, can build the skills they need.
          </p>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Students learn at their own pace, parents follow their children's progress, and instructors reach thousands of
            learners. All of it happens in one platform.
          </p>
        </div>
      </section>
      <section className="bg-secondary/60 py-24">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 sm:px-6 md:grid-cols-2">
          <div className="rounded-3xl bg-deep p-10 text-deep-foreground">
            <Target className="h-10 w-10 text-gold" />
            <h3 className="mt-5 text-3xl font-semibold">Our mission</h3>
            <p className="mt-3 text-deep-muted">To give every Ethiopian learner affordable access to practical, world-class education that changes lives.</p>
          </div>
          <div className="rounded-3xl bg-gold-gradient p-10 text-gold-foreground">
            <Eye className="h-10 w-10" />
            <h3 className="mt-5 text-3xl font-semibold">Our vision</h3>
            <p className="mt-3 opacity-80">To be Africa's most trusted online academy, producing a generation of skilled, confident creators and leaders.</p>
          </div>
        </div>
        <div className="mx-auto mt-16 max-w-7xl px-4 sm:px-6">
          <h2 className="text-center text-4xl font-semibold">What we stand for</h2>
          <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {VALUES.map((v) => (
              <div key={v.t} className="lift rounded-2xl border border-border bg-card p-7">
                <v.icon className="h-8 w-8 text-primary" />
                <h3 className="mt-4 text-xl font-semibold">{v.t}</h3>
                <p className="mt-2 text-sm text-muted-foreground">{v.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
      <section className="mx-auto max-w-3xl px-4 pt-24 text-center sm:px-6">
        <h2 className="text-4xl font-semibold">Ready to learn with us?</h2>
        <p className="mt-3 text-muted-foreground">Create a free account and start watching lessons today.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Button asChild variant="emerald" size="lg" className="rounded-full"><Link to="/register">Get started</Link></Button>
          <Button asChild variant="outline" size="lg" className="rounded-full"><Link to="/courses">See courses</Link></Button>
        </div>
      </section>
    </PublicLayout>
  );
}
