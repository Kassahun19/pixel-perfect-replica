import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { PlayCircle } from "lucide-react";
import { coursesQuery } from "@/lib/queries";
import { displayName, ROLE_LABEL, useAuth } from "@/lib/auth";
import { FREE_LESSON_LIMIT } from "@/lib/access";
import { LoadingBlock, PageHeader } from "@/components/dashboard/ui";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: DashboardHome,
});

function DashboardHome() {
  const { profile, primaryRole } = useAuth();
  const { data: courses, isLoading } = useQuery(coursesQuery);
  return (
    <div>
      <PageHeader
        title={`Welcome${profile ? `, ${displayName(profile)}` : ""}`}
        description={`${primaryRole ? ROLE_LABEL[primaryRole] + " · " : ""}Watch the first ${FREE_LESSON_LIMIT} videos of any course for free.`}
      />
      {isLoading ? (
        <LoadingBlock />
      ) : (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {(courses ?? []).map((c) => (
            <Link key={c.id} to="/dashboard/learn/$slug" params={{ slug: c.slug }} className="lift overflow-hidden rounded-2xl border border-border bg-card">
              {c.image_url && <img src={c.image_url} alt={c.title} className="aspect-video w-full object-cover" />}
              <div className="p-5">
                <h3 className="text-lg font-semibold">{c.title}</h3>
                <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <PlayCircle className="h-4 w-4" /> {c.lesson_count} videos
                </p>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
