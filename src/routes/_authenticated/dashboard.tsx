import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { SiteHeader } from "@/components/site/SiteHeader";
import { useAuth } from "@/lib/auth";
import { usePaymentsData } from "@/components/dashboard/PaymentsManager";

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
  const { user, isStaff } = useAuth();
  const { payments } = usePaymentsData(isStaff, user?.id);
  const pendingCount = payments.filter((p) => p.status === "pending").length;

  return (
    <div className="min-h-screen">
      <SiteHeader />
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6">
        <nav className="mb-8 flex flex-wrap items-center gap-2 text-sm font-semibold">
          <Link
            to="/dashboard"
            activeOptions={{ exact: true }}
            className="rounded-full border border-border px-4 py-2 transition-colors hover:border-primary/50 data-[status=active]:border-primary data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
          >
            My courses
          </Link>
          <Link
            to="/dashboard/payments"
            className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 transition-colors hover:border-primary/50 data-[status=active]:border-primary data-[status=active]:bg-primary data-[status=active]:text-primary-foreground"
          >
            <span>{isStaff ? "Payment receipts" : "My payments"}</span>
            {pendingCount > 0 && (
              <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-gold px-1.5 py-0.5 text-[11px] font-bold leading-none text-deep">
                {pendingCount}
              </span>
            )}
          </Link>
          <Link
            to="/pro"
            className="rounded-full border border-border px-4 py-2 transition-colors hover:border-primary/50"
          >
            Ezana Pro
          </Link>
        </nav>
        <Outlet />
      </div>
    </div>
  );
}
