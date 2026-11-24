import { createFileRoute } from "@tanstack/react-router";
import { RoleDashboard } from "@/components/dashboard/RoleDashboard";

export const Route = createFileRoute("/_authenticated/dashboard/")({
  component: DashboardHome,
});

function DashboardHome() {
  return <RoleDashboard />;
}
