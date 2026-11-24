import { Link } from "@tanstack/react-router";
import { Paperclip } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STATUS_BADGE } from "@/components/dashboard/ui";
import { usePaymentsData } from "@/components/dashboard/PaymentsManager";
import { formatETB } from "@/lib/access";

const STATUS_TEXT: Record<string, string> = {
  pending: "Pending review",
  approved: "Approved — course unlocked",
  rejected: "Rejected",
};

/** The signed-in learner's own payment requests and their review status. */
export function MyPaymentStatus({ userId }: { userId: string }) {
  const { payments, isLoading } = usePaymentsData(false, userId);
  if (isLoading || payments.length === 0) return null;
  return (
    <div className="rounded-[2rem] border border-border bg-card p-8 shadow-soft md:p-10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-2xl font-semibold">Your payment requests</h2>
        <Link to="/dashboard/payments" className="text-sm font-semibold text-primary hover:underline">View all</Link>
      </div>
      <ul className="mt-5 divide-y divide-border overflow-hidden rounded-xl border border-border">
        {payments.slice(0, 5).map((p) => (
          <li key={p.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{p.courseTitle}</p>
              <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
                {p.method} · <span className="font-mono">{p.reference}</span> · {formatETB(Number(p.amount))}
                {p.receipt_path && <Paperclip className="h-3 w-3" aria-label="Receipt attached" />}
              </p>
              {p.status === "rejected" && p.review_note && (
                <p className="mt-1 text-xs text-destructive">{p.review_note}</p>
              )}
            </div>
            <Badge variant={STATUS_BADGE[p.status] ?? "muted"}>{STATUS_TEXT[p.status] ?? p.status}</Badge>
          </li>
        ))}
      </ul>
    </div>
  );
}
