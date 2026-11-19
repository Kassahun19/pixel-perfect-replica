import { createFileRoute } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { PageHero, PublicLayout } from "@/components/site/PublicLayout";
import { CourseCard } from "@/components/site/CourseCard";
import { Input } from "@/components/ui/input";
import { categoriesQuery, coursesQuery } from "@/lib/queries";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/courses/")({
  head: () => ({
    meta: [
      { title: "Courses — Ezana Academy" },
      { name: "description", content: "Browse every Ezana Academy course: web development, data science, design, mathematics, business and English." },
      { property: "og:title", content: "All courses — Ezana Academy" },
      { property: "og:description", content: "Every course includes 5 free videos. Unlock the full course for ETB 218." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  loader: async ({ context }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(coursesQuery),
      context.queryClient.ensureQueryData(categoriesQuery),
    ]);
  },
  component: Courses,
});

function Courses() {
  const { data: courses } = useSuspenseQuery(coursesQuery);
  const { data: categories } = useSuspenseQuery(categoriesQuery);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");

  const filtered = useMemo(
    () =>
      courses.filter(
        (c) =>
          (cat === "all" || c.category?.slug === cat) &&
          (q.trim() === "" || `${c.title} ${c.short_description}`.toLowerCase().includes(q.toLowerCase())),
      ),
    [courses, q, cat],
  );

  return (
    <PublicLayout>
      <PageHero
        eyebrow="Courses"
        title={<>Find the course that <span className="text-gold-gradient italic">moves you forward.</span></>}
        subtitle="Every course opens with 5 free tutorial videos. Unlock the full course with Ezana Pro for ETB 218."
      />
      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-2">
            {[{ slug: "all", name: "All" }, ...categories].map((c) => (
              <button
                key={c.slug}
                onClick={() => setCat(c.slug)}
                className={cn(
                  "rounded-full border px-4 py-2 text-sm font-semibold transition-all",
                  cat === c.slug
                    ? "border-primary bg-primary text-primary-foreground shadow-soft"
                    : "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary",
                )}
              >
                {c.name}
              </button>
            ))}
          </div>
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search courses…" className="h-11 rounded-full pl-10" />
          </div>
        </div>
        {filtered.length === 0 ? (
          <div className="mt-16 rounded-2xl border border-dashed border-border p-16 text-center text-muted-foreground">
            No courses match your search.
          </div>
        ) : (
          <div className="mt-10 grid gap-7 sm:grid-cols-2 lg:grid-cols-3">
            {filtered.map((c, i) => (
              <CourseCard key={c.id} course={c} index={i} />
            ))}
          </div>
        )}
      </section>
    </PublicLayout>
  );
}
