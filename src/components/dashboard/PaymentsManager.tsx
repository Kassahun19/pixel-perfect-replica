import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import {
  CheckCircle2,
  Clock,
  Crown,
  Download,
  ExternalLink,
  Eye,
  FileText,
  Paperclip,
  Receipt,
  RotateCcw,
  Search,
  Trash2,
  XCircle,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import { useAuth } from "@/lib/auth";
import { coursesQuery } from "@/lib/queries";
import { formatETB } from "@/lib/access";
import { RECEIPT_BUCKET } from "@/lib/payment-info";
import { downloadCsv, logAudit } from "@/lib/csv";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ConfirmButton,
  EmptyState,
  ErrorBlock,
  LoadingBlock,
  Panel,
  STATUS_BADGE,
  StatCard,
} from "@/components/dashboard/ui";
import { cn } from "@/lib/utils";

type PaymentRow = Database["public"]["Tables"]["payments"]["Row"];
type ProfileLite = {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string | null;
};

const SEED_COURSE_TITLES: Record<string, string> = {
  "22222222-2222-4222-8222-222222222201": "Full-Stack Web Development",
  "22222222-2222-4222-8222-222222222202": "Data Science & AI Foundations",
  "22222222-2222-4222-8222-222222222203": "UI/UX Design Masterclass",
  "22222222-2222-4222-8222-222222222204": "Mathematics for Grade 11 & 12",
  "22222222-2222-4222-8222-222222222205": "Entrepreneurship & Startup Growth",
  "22222222-2222-4222-8222-222222222206": "Spoken English & Communication",
};

export function usePaymentsData(isStaff: boolean, userId: string | undefined) {
  const { data: courses = [] } = useQuery(coursesQuery);

  const paymentsQuery = useQuery({
    queryKey: ["payments", isStaff ? "all" : "mine", userId],
    enabled: !!userId,
    queryFn: async () => {
      let q = supabase.from("payments").select("*").order("created_at", { ascending: false });
      if (!isStaff) {
        q = q.eq("user_id", userId!);
      }
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data ?? []) as PaymentRow[];
    },
  });

  const profilesQuery = useQuery({
    queryKey: ["profiles", "payment-lookup"],
    enabled: !!userId && isStaff,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("id,first_name,last_name,email,phone");
      if (error) throw new Error(error.message);
      return (data ?? []) as ProfileLite[];
    },
  });

  const enriched = useMemo(() => {
    const profileMap = new Map((profilesQuery.data ?? []).map((p) => [p.id, p]));
    const courseMap = new Map(courses.map((c) => [c.id, c]));
    return (paymentsQuery.data ?? []).map((p) => {
      const prof = profileMap.get(p.user_id);
      const studentName = prof
        ? `${prof.first_name} ${prof.last_name}`.trim() || prof.email
        : "Learner";
      const course = courseMap.get(p.course_id);
      const courseTitle = course?.title ?? SEED_COURSE_TITLES[p.course_id] ?? "Ezana Course";
      return {
        ...p,
        studentName,
        studentEmail: prof?.email ?? "",
        studentPhone: prof?.phone ?? "",
        courseTitle,
        courseSlug: course?.slug,
      };
    });
  }, [paymentsQuery.data, profilesQuery.data, courses]);

  return {
    payments: enriched,
    isLoading: paymentsQuery.isLoading,
    error: paymentsQuery.error,
  };
}

export type EnrichedPayment = ReturnType<typeof usePaymentsData>["payments"][number];

function formatDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

function ReceiptPreview({ path }: { path: string | null }) {
  const { data: url, isLoading, error } = useQuery({
    queryKey: ["receipt-url", path],
    enabled: !!path,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error: err } = await supabase.storage.from(RECEIPT_BUCKET).createSignedUrl(path!, 60 * 10);
      if (err) throw new Error(err.message);
      return data.signedUrl;
    },
  });
  if (!path) return <p className="text-sm text-muted-foreground">No receipt uploaded — check the reference only.</p>;
  if (isLoading) return <p className="text-sm text-muted-foreground">Loading receipt…</p>;
  if (error || !url) return <p className="text-sm text-destructive">Couldn't load the receipt file.</p>;
  const isPdf = path.toLowerCase().endsWith(".pdf");
  return (
    <div className="space-y-2">
      {isPdf ? (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
          <FileText className="h-4 w-4 text-primary" /> PDF receipt
        </div>
      ) : (
        <a href={url} target="_blank" rel="noopener noreferrer">
          <img src={url} alt="Payment receipt" className="max-h-72 w-full rounded-lg border border-border bg-card object-contain" />
        </a>
      )}
      <Button asChild variant="outline" size="sm">
        <a href={url} target="_blank" rel="noopener noreferrer">
          <ExternalLink className="h-3.5 w-3.5" /> Open full receipt
        </a>
      </Button>
    </div>
  );
}

export function PaymentsManager({ pendingOnly = false }: { pendingOnly?: boolean }) {
  const { user, isStaff } = useAuth();
  const qc = useQueryClient();
  const { payments, isLoading, error } = usePaymentsData(isStaff, user?.id);

  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "approved" | "rejected">(
    pendingOnly ? "pending" : "all",
  );
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<EnrichedPayment | null>(null);
  const [rejectTarget, setRejectTarget] = useState<EnrichedPayment | null>(null);
  const [reviewNote, setReviewNote] = useState("");

  const updateStatusMutation = useMutation({
    mutationFn: async ({
      payment,
      status,
      note,
    }: {
      payment: EnrichedPayment;
      status: Database["public"]["Enums"]["payment_status"];
      note?: string | null;
    }) => {
      const { error: err } = await supabase
        .from("payments")
        .update({
          status,
          review_note: note ?? null,
          reviewed_by: status === "pending" ? null : user?.id ?? null,
          reviewed_at: status === "pending" ? null : new Date().toISOString(),
        })
        .eq("id", payment.id);
      if (err) throw new Error(err.message);
      await logAudit(`payment_${status}`, "payment", payment.id, {
        reference: payment.reference,
        course_id: payment.course_id,
        user_id: payment.user_id,
        note: note ?? null,
      });
    },
    onSuccess: (_, vars) => {
      const label =
        vars.status === "approved"
          ? "Payment approved — course unlocked for learner!"
          : vars.status === "rejected"
            ? "Payment receipt rejected."
            : "Payment moved back to pending.";
      toast.success(label);
      setSelected(null);
      setRejectTarget(null);
      setReviewNote("");
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["unlocked"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (payment: EnrichedPayment) => {
      const { error: err } = await supabase.from("payments").delete().eq("id", payment.id);
      if (err) throw new Error(err.message);
      if (payment.receipt_path) {
        await supabase.storage.from(RECEIPT_BUCKET).remove([payment.receipt_path]);
      }
      await logAudit("payment_deleted", "payment", payment.id, {
        reference: payment.reference,
        course_id: payment.course_id,
        user_id: payment.user_id,
      });
    },
    onSuccess: () => {
      toast.success("Payment receipt deleted.");
      setSelected(null);
      qc.invalidateQueries({ queryKey: ["payments"] });
      qc.invalidateQueries({ queryKey: ["unlocked"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const counts = useMemo(() => {
    let pending = 0;
    let approved = 0;
    let rejected = 0;
    let revenue = 0;
    for (const p of payments) {
      if (p.status === "pending") pending += 1;
      else if (p.status === "approved") {
        approved += 1;
        revenue += Number(p.amount ?? 0);
      } else if (p.status === "rejected") rejected += 1;
    }
    return { all: payments.length, pending, approved, rejected, revenue };
  }, [payments]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return payments.filter((p) => {
      if (pendingOnly && p.status !== "pending") return false;
      if (!pendingOnly && statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      return `${p.studentName} ${p.studentEmail} ${p.courseTitle} ${p.method} ${p.reference} ${p.note ?? ""}`
        .toLowerCase()
        .includes(q);
    });
  }, [payments, pendingOnly, statusFilter, search]);

  if (isLoading) return <LoadingBlock label="Loading payment receipts…" />;
  if (error) return <ErrorBlock error={error} />;

  const handleExport = () => {
    downloadCsv(
      "ezana-payment-receipts.csv",
      filtered.map((p) => ({
        id: p.id,
        student: p.studentName,
        email: p.studentEmail,
        course: p.courseTitle,
        method: p.method,
        reference: p.reference,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        note: p.note ?? "",
        receipt_attached: p.receipt_path ? "yes" : "no",
        review_note: p.review_note ?? "",
        submitted_at: p.created_at,
        reviewed_at: p.reviewed_at ?? "",
      })),
    );
  };

  return (
    <div className="space-y-6">
      {!pendingOnly && isStaff && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Pending receipts"
            value={counts.pending}
            icon={Clock}
            tone="gold"
            hint="Waiting for review"
            index={0}
          />
          <StatCard
            label="Approved"
            value={counts.approved}
            icon={CheckCircle2}
            tone="emerald"
            hint="Courses unlocked"
            index={1}
          />
          <StatCard
            label="Verified revenue"
            value={formatETB(counts.revenue)}
            icon={Receipt}
            tone="deep"
            hint="Confirmed payments"
            index={2}
          />
          <StatCard
            label="Rejected"
            value={counts.rejected}
            icon={XCircle}
            tone="plain"
            hint="Declined references"
            index={3}
          />
        </div>
      )}

      <Panel
        title={
          pendingOnly
            ? `Pending payment receipts (${counts.pending})`
            : isStaff
              ? "Payment receipts"
              : "My payment requests"
        }
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {pendingOnly && (
              <Button asChild variant="outline" size="sm">
                <Link to="/dashboard/payments">View all receipts ({counts.all})</Link>
              </Button>
            )}
            {!pendingOnly && isStaff && filtered.length > 0 && (
              <Button variant="outline" size="sm" onClick={handleExport}>
                <Download className="h-4 w-4" /> Export CSV
              </Button>
            )}
            {!isStaff && (
              <Button asChild variant="hero" size="sm">
                <Link to="/pro">
                  <Crown className="h-4 w-4" /> Upgrade a course
                </Link>
              </Button>
            )}
          </div>
        }
      >
        {!pendingOnly && (
          <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["all", `All (${counts.all})`],
                  ["pending", `Pending (${counts.pending})`],
                  ["approved", `Approved (${counts.approved})`],
                  ["rejected", `Rejected (${counts.rejected})`],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setStatusFilter(key)}
                  className={cn(
                    "cursor-pointer rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-all",
                    statusFilter === key
                      ? "border-primary bg-primary text-primary-foreground shadow-soft"
                      : "border-border bg-card text-muted-foreground hover:border-primary hover:text-primary",
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="relative w-full md:w-72">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search reference, student, course…"
                className="h-10 rounded-full pl-9"
              />
            </div>
          </div>
        )}

        {filtered.length === 0 ? (
          <EmptyState
            icon={Receipt}
            title={
              pendingOnly
                ? "No pending payment receipts"
                : "No payment receipts found"
            }
            text={
              pendingOnly
                ? "All submitted Telebirr and bank payment receipts have been reviewed."
                : isStaff
                  ? "No payment receipts match your current filter."
                  : "Submit a Telebirr or bank transfer reference on Ezana Pro to unlock a full course."
            }
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                {isStaff && <TableHead>Student</TableHead>}
                <TableHead>Course</TableHead>
                <TableHead>Receipt & Method</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((p) => (
                <TableRow key={p.id}>
                  {isStaff && (
                    <TableCell>
                      <p className="font-semibold">{p.studentName}</p>
                      {p.studentEmail && (
                        <p className="text-xs text-muted-foreground">{p.studentEmail}</p>
                      )}
                    </TableCell>
                  )}
                  <TableCell>
                    <p className="font-medium">{p.courseTitle}</p>
                    {p.note && (
                      <p className="mt-0.5 line-clamp-1 max-w-xs text-xs text-muted-foreground">
                        {p.note}
                      </p>
                    )}
                  </TableCell>
                  <TableCell>
                    <p className="font-mono text-xs font-bold text-foreground">{p.reference}</p>
                    <p className="text-xs text-muted-foreground">{p.method}</p>
                    {p.receipt_path && (
                      <p className="mt-0.5 inline-flex items-center gap-1 text-xs font-semibold text-primary">
                        <Paperclip className="h-3 w-3" /> Receipt attached
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="font-semibold">
                    {formatETB(Number(p.amount))}
                  </TableCell>
                  <TableCell>
                    <Badge variant={STATUS_BADGE[p.status] ?? "muted"} className="capitalize">
                      {p.status}
                    </Badge>
                    {p.review_note && (
                      <p className="mt-1 line-clamp-1 max-w-44 text-xs text-muted-foreground">
                        {p.review_note}
                      </p>
                    )}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {formatDate(p.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex flex-wrap justify-end gap-1.5">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelected(p);
                          setReviewNote(p.review_note ?? "");
                        }}
                        title="Inspect receipt"
                      >
                        <Eye className="h-3.5 w-3.5" /> View
                      </Button>
                      {isStaff && p.status !== "approved" && (
                        <Button
                          type="button"
                          variant="emerald"
                          size="sm"
                          disabled={updateStatusMutation.isPending}
                          onClick={() =>
                            updateStatusMutation.mutate({
                              payment: p,
                              status: "approved",
                              note: p.review_note ?? "Verified & approved",
                            })
                          }
                        >
                          <CheckCircle2 className="h-3.5 w-3.5" /> Approve
                        </Button>
                      )}
                      {isStaff && p.status !== "rejected" && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          className="border-destructive/40 text-destructive hover:bg-destructive/10"
                          disabled={updateStatusMutation.isPending}
                          onClick={() => {
                            setRejectTarget(p);
                            setReviewNote(p.review_note ?? "");
                          }}
                        >
                          <XCircle className="h-3.5 w-3.5" /> Reject
                        </Button>
                      )}
                      {isStaff && p.status !== "pending" && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          disabled={updateStatusMutation.isPending}
                          onClick={() =>
                            updateStatusMutation.mutate({
                              payment: p,
                              status: "pending",
                              note: null,
                            })
                          }
                          title="Move back to pending"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                        </Button>
                      )}
                      {(isStaff || p.status === "pending") && (
                        <ConfirmButton
                          title="Delete payment receipt?"
                          description={`This will permanently remove receipt ${p.reference} (${formatETB(Number(p.amount))}).`}
                          confirmLabel="Delete receipt"
                          onConfirm={() => deleteMutation.mutate(p)}
                          trigger={
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                              title="Delete receipt"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          }
                        />
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Panel>

      {/* Inspect Receipt Dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Receipt className="h-5 w-5 text-primary" /> Payment Receipt
            </DialogTitle>
            <DialogDescription>
              Review transaction reference and learner details before updating status.
            </DialogDescription>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3 rounded-xl border border-border bg-secondary/40 p-4 text-sm">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Reference
                  </p>
                  <p className="mt-0.5 font-mono font-bold">{selected.reference}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Status
                  </p>
                  <div className="mt-0.5">
                    <Badge variant={STATUS_BADGE[selected.status] ?? "muted"} className="capitalize">
                      {selected.status}
                    </Badge>
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Method
                  </p>
                  <p className="mt-0.5 font-medium">{selected.method}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Amount
                  </p>
                  <p className="mt-0.5 font-display text-lg font-semibold text-primary">
                    {formatETB(Number(selected.amount))}
                  </p>
                </div>
                {isStaff && (
                  <div className="col-span-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Learner
                    </p>
                    <p className="mt-0.5 font-medium">
                      {selected.studentName}
                      {selected.studentEmail ? ` · ${selected.studentEmail}` : ""}
                      {selected.studentPhone ? ` · ${selected.studentPhone}` : ""}
                    </p>
                  </div>
                )}
                <div className="col-span-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Course
                  </p>
                  <p className="mt-0.5 font-medium">{selected.courseTitle}</p>
                </div>
                {selected.note && (
                  <div className="col-span-2">
                    <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                      Learner note
                    </p>
                    <p className="mt-0.5 text-muted-foreground">{selected.note}</p>
                  </div>
                )}
                <div className="col-span-2">
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Receipt file
                  </p>
                  <div className="mt-1.5">
                    <ReceiptPreview path={selected.receipt_path} />
                  </div>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Submitted
                  </p>
                  <p className="mt-0.5 text-xs">{formatDate(selected.created_at)}</p>
                </div>
                <div>
                  <p className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Reviewed
                  </p>
                  <p className="mt-0.5 text-xs">{formatDate(selected.reviewed_at)}</p>
                </div>
              </div>

              {isStaff && (
                <div className="space-y-2">
                  <Label htmlFor="review-note">Review note (optional)</Label>
                  <Textarea
                    id="review-note"
                    rows={2}
                    value={reviewNote}
                    onChange={(e) => setReviewNote(e.target.value)}
                    placeholder="e.g. Verified in Telebirr statement, or Reference not found"
                  />
                </div>
              )}

              <DialogFooter className="flex-wrap gap-2 sm:justify-between">
                {(isStaff || selected.status === "pending") && (
                  <ConfirmButton
                    title="Delete payment receipt?"
                    description={`Permanently delete receipt ${selected.reference}?`}
                    confirmLabel="Delete"
                    onConfirm={() => deleteMutation.mutate(selected)}
                    trigger={
                      <Button type="button" variant="destructive" size="sm">
                        <Trash2 className="h-4 w-4" /> Delete
                      </Button>
                    }
                  />
                )}
                {isStaff && (
                  <div className="flex flex-wrap gap-2">
                    {selected.status !== "pending" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={updateStatusMutation.isPending}
                        onClick={() =>
                          updateStatusMutation.mutate({
                            payment: selected,
                            status: "pending",
                            note: null,
                          })
                        }
                      >
                        <RotateCcw className="h-4 w-4" /> Reopen
                      </Button>
                    )}
                    {selected.status !== "rejected" && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="border-destructive/40 text-destructive hover:bg-destructive/10"
                        disabled={updateStatusMutation.isPending}
                        onClick={() =>
                          updateStatusMutation.mutate({
                            payment: selected,
                            status: "rejected",
                            note: reviewNote.trim() || "Payment reference could not be verified",
                          })
                        }
                      >
                        <XCircle className="h-4 w-4" /> Reject
                      </Button>
                    )}
                    {selected.status !== "approved" && (
                      <Button
                        type="button"
                        variant="emerald"
                        size="sm"
                        disabled={updateStatusMutation.isPending}
                        onClick={() =>
                          updateStatusMutation.mutate({
                            payment: selected,
                            status: "approved",
                            note: reviewNote.trim() || "Verified & approved",
                          })
                        }
                      >
                        <CheckCircle2 className="h-4 w-4" /> Approve & unlock
                      </Button>
                    )}
                  </div>
                )}
              </DialogFooter>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Reject Reason Dialog */}
      <Dialog open={!!rejectTarget} onOpenChange={(open) => !open && setRejectTarget(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Reject payment receipt</DialogTitle>
            <DialogDescription>
              {rejectTarget
                ? `Add an optional reason for rejecting reference ${rejectTarget.reference}.`
                : ""}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Label htmlFor="reject-note">Reason (optional)</Label>
            <Textarea
              id="reject-note"
              rows={3}
              value={reviewNote}
              onChange={(e) => setReviewNote(e.target.value)}
              placeholder="e.g. Transaction reference not found in Telebirr / CBE"
            />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRejectTarget(null)}>
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={updateStatusMutation.isPending || !rejectTarget}
              onClick={() =>
                rejectTarget &&
                updateStatusMutation.mutate({
                  payment: rejectTarget,
                  status: "rejected",
                  note: reviewNote.trim() || "Payment reference could not be verified",
                })
              }
            >
              Reject receipt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
