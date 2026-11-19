import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Ezana Academy" },
      { name: "description", content: "Your Ezana Academy learning dashboard." },
      { property: "og:title", content: "Dashboard — Ezana Academy" },
      { property: "og:description", content: "Your Ezana Academy learning dashboard." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DashboardLayout,
});

function DashboardLayout() {
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <nav className="mb-8 flex flex-wrap gap-2 text-sm font-semibold">
          <Link to="/dashboard" activeOptions={{ exact: true }} className="rounded-full border border-border px-4 py-2 data-[status=active]:bg-primary data-[status=active]:text-primary-foreground">
            My courses
          </Link>
          <Link to="/pro" className="rounded-full border border-border px-4 py-2">Ezana Pro</Link>
        </nav>
        <Outlet />
      </div>
    </div>
  );
}
