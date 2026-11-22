import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";
import { PageHeader } from "@/components/dashboard/ui";
import { PaymentsManager } from "@/components/dashboard/PaymentsManager";

export const Route = createFileRoute("/_authenticated/dashboard/payments")({
  head: () => ({
    meta: [
      { title: "Payment receipts — Ezana Academy" },
      { name: "description", content: "Review and manage Ezana Academy payment receipts." },
    ],
  }),
  component: DashboardPaymentsPage,
});

function DashboardPaymentsPage() {
  const { isStaff } = useAuth();

  return (
    <div>
      <PageHeader
        title={isStaff ? "Payment receipts" : "My payments"}
        description={
          isStaff
            ? "Review Telebirr and bank transfer receipts, approve course unlocks, reject invalid references, or delete records."
            : "Track your submitted Ezana Pro payment receipts and unlocked courses."
        }
      />
      <PaymentsManager />
    </div>
  );
}
