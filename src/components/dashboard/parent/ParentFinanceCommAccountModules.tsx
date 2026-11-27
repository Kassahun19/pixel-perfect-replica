import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import {
  Bell,
  CheckCircle2,
  CreditCard,
  ExternalLink,
  Eye,
  FileCheck2,
  FileEdit,
  KeyRound,
  Link2,
  Mail,
  Megaphone,
  MessageSquare,
  Printer,
  Receipt,
  Search,
  Send,
  Settings,
  ShieldCheck,
  UserRound,
  Wallet,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { displayName, useAuth } from "@/lib/auth";
import { formatETB, PRO_PRICE_ETB } from "@/lib/access";
import {
  ACCOUNT_HOLDER,
  MAX_RECEIPT_MB,
  ONLINE_METHOD,
  PAYMENT_ACCOUNTS,
  PAYMENT_METHODS,
  RECEIPT_ACCEPT,
  RECEIPT_BUCKET,
  receiptPath,
  validateReceiptFile,
  YEBUNA_PAY_URL,
} from "@/lib/payment-info";
import { computeFeeStatus, formatCompactDate, paginateRows } from "@/lib/owner/logic";
import type { ProfileCorrectionRequest } from "@/lib/owner/types";
import type { ParentSubmenuId } from "@/lib/parent/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  EmptyState,
  PageHeader,
  Pager,
  Panel,
  StatCard,
  STATUS_BADGE,
} from "@/components/dashboard/ui";
import type { ParentDataHandle } from "./useParentData";

/* ========================================================================== */
/* 4.1 CHILD'S FEES                                                           */
/* ========================================================================== */

export function ParentChildFeesModule({
  data,
  onNavigate,
}: {
  data: ParentDataHandle;
  onNavigate: (id: ParentSubmenuId) => void;
}) {
  const child = data.activeChild;
  const childName = child.profile ? displayName(child.profile) : "Linked Child";

  const totals = useMemo(() => {
    let billed = 0;
    let paid = 0;
    let balance = 0;
    for (const fp of child.feePlans) {
      const net = Math.max(0, fp.amount - fp.discount);
      billed += net;
      paid += fp.paidAmount;
      balance += Math.max(0, net - fp.paidAmount);
    }
    return { billed, paid, balance };
  }, [child.feePlans]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Child's Fees"
        description={`Tuition plans, discounts, due dates, paid amounts, and balances for ${childName}.`}
        actions={
          <Button variant="emerald" size="sm" onClick={() => onNavigate("make-payment")}>
            <CreditCard className="h-4 w-4" />
            Make a Payment
          </Button>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Total Net Fees" value={formatETB(totals.billed)} icon={Wallet} index={0} />
        <StatCard
          label="Verified Paid"
          value={formatETB(totals.paid)}
          icon={CheckCircle2}
          tone="gold"
          index={1}
        />
        <StatCard
          label="Remaining Balance"
          value={formatETB(totals.balance)}
          icon={ShieldCheck}
          tone="deep"
          index={2}
        />
      </div>

      <Panel title="Fee Schedule & Breakdown">
        {child.feePlans.length === 0 ? (
          <EmptyState
            title="No assigned fee plans for this child"
            text="Course access payments (Ezana Pro ETB 218 per course) or academy fee plans appear here."
            icon={Wallet}
            action={
              <Button variant="emerald" onClick={() => onNavigate("make-payment")}>
                Submit Course Payment
              </Button>
            }
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                <tr>
                  <th className="py-2 pr-4">Fee Plan</th>
                  <th className="py-2 pr-4">Course</th>
                  <th className="py-2 pr-4">Due Date</th>
                  <th className="py-2 pr-4 text-right">Net Total</th>
                  <th className="py-2 pr-4 text-right">Paid</th>
                  <th className="py-2 pr-4 text-right">Balance</th>
                  <th className="py-2 text-right">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border tabular-nums">
                {child.feePlans.map((fp) => {
                  const net = Math.max(0, fp.amount - fp.discount);
                  const bal = Math.max(0, net - fp.paidAmount);
                  const st = computeFeeStatus(fp.amount, fp.discount, fp.paidAmount, fp.dueDate);
                  return (
                    <tr key={fp.id} className="hover:bg-secondary/30">
                      <td className="py-2.5 pr-4 font-semibold">{fp.title}</td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {fp.courseId
                          ? data.maps.coursesById.get(fp.courseId)?.title ?? "Course"
                          : "General Tuition"}
                      </td>
                      <td className="py-2.5 pr-4 font-mono text-xs">{fp.dueDate || "—"}</td>
                      <td className="py-2.5 pr-4 text-right font-mono">{formatETB(net)}</td>
                      <td className="py-2.5 pr-4 text-right font-mono">{formatETB(fp.paidAmount)}</td>
                      <td className="py-2.5 pr-4 text-right font-mono font-semibold">
                        {formatETB(bal)}
                      </td>
                      <td className="py-2.5 text-right">
                        <Badge
                          variant={
                            st === "paid"
                              ? "success"
                              : st === "overdue"
                                ? "destructive"
                                : "gold"
                          }
                        >
                          {st}
                        </Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ========================================================================== */
/* 4.2 MAKE A PAYMENT                                                         */
/* ========================================================================== */

export function ParentMakePaymentModule({
  data,
  onNavigate,
}: {
  data: ParentDataHandle;
  onNavigate: (id: ParentSubmenuId) => void;
}) {
  const { user } = useAuth();
  const ws = data.workspace;
  const [targetChildId, setTargetChildId] = useState(() => data.selectedChildId);
  const [courseId, setCourseId] = useState(() => data.db.courses[0]?.id ?? "");
  const [method, setMethod] = useState(ONLINE_METHOD);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const effectiveChildId =
    targetChildId && data.linkedChildIds.includes(targetChildId)
      ? targetChildId
      : data.selectedChildId;
  const activeCourseId = courseId || data.db.courses[0]?.id || "";
  const feeMatch = (ws?.feePlans ?? []).find(
    (f) => f.studentId === effectiveChildId && f.courseId === activeCourseId,
  );
  const payableAmount = feeMatch
    ? Math.max(1, feeMatch.amount - feeMatch.discount - feeMatch.paidAmount)
    : PRO_PRICE_ETB;

  async function submitPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    if (!effectiveChildId) {
      toast.error("Choose a linked child before submitting a payment.");
      return;
    }
    if (!activeCourseId) {
      toast.error("Choose a course or fee item.");
      return;
    }
    const cleanRef = reference.trim();
    if (cleanRef.length < 4) {
      toast.error("Enter a valid transaction reference (at least 4 characters).");
      return;
    }
    if (
      data.db.payments.some(
        (p) => p.reference.trim().toLowerCase() === cleanRef.toLowerCase(),
      )
    ) {
      toast.error("This transaction reference has already been submitted.");
      return;
    }

    setSubmitting(true);
    let uploadedPath: string | null = null;
    try {
      if (file) {
        const problem = validateReceiptFile(file);
        if (problem) throw new Error(problem);
        uploadedPath = receiptPath(user.id, file.name);
        const { error: upErr } = await supabase.storage
          .from(RECEIPT_BUCKET)
          .upload(uploadedPath, file, { contentType: file.type, upsert: false });
        if (upErr) throw new Error(`Receipt upload failed: ${upErr.message}`);
      }

      const { error } = await supabase.from("payments").insert({
        user_id: effectiveChildId,
        course_id: activeCourseId,
        method,
        reference: cleanRef,
        note: [
          `Paid by parent (${displayName(data.maps.childProfilesById.get(effectiveChildId)) || effectiveChildId})`,
          note.trim(),
        ]
          .filter(Boolean)
          .join(" · "),
        amount: PRO_PRICE_ETB,
        receipt_path: uploadedPath,
      });

      if (error) {
        if (uploadedPath) await supabase.storage.from(RECEIPT_BUCKET).remove([uploadedPath]);
        if (error.code === "23505") {
          throw new Error(
            "This child already has an active or pending payment for this course.",
          );
        }
        throw new Error(error.message);
      }

      data.setSelectedChildId(effectiveChildId);
      setReference("");
      setNote("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      await data.refreshAll("Payment submitted — pending verification by academy staff.");
      onNavigate("payment-history");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not submit payment.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Make a Payment"
        description="Submit tuition or Ezana Pro payment for a linked child. Payments remain pending until verified by Owner or Admin."
      />

      {data.linkedChildIds.length === 0 ? (
        <EmptyState
          title="No linked child found"
          text="Request a verified link to your child's student account before submitting a payment."
          icon={CreditCard}
          action={
            <Button variant="emerald" onClick={() => onNavigate("linked-children")}>
              Request Child Link
            </Button>
          }
        />
      ) : (
        <div className="grid gap-6 xl:grid-cols-2">
          <Panel title="Official Ezana Academy Payment Accounts">
            <div className="space-y-4">
              <div className="rounded-xl border border-gold/40 bg-gold/10 p-4">
                <p className="text-xs font-semibold text-muted-foreground">Account Holder</p>
                <p className="text-base font-semibold">{ACCOUNT_HOLDER}</p>
                <Button asChild variant="emerald" size="sm" className="mt-3">
                  <a href={YEBUNA_PAY_URL} target="_blank" rel="noopener noreferrer">
                    <ExternalLink className="h-4 w-4" /> Pay Online via Ye-Buna
                  </a>
                </Button>
              </div>
              <div className="divide-y divide-border rounded-xl border border-border">
                {PAYMENT_ACCOUNTS.map((acc) => (
                  <div
                    key={acc.method}
                    className="flex items-center justify-between gap-3 px-4 py-3 text-xs"
                  >
                    <span className="font-semibold">{acc.label}</span>
                    <span className="font-mono font-bold text-primary select-all">
                      {acc.number}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </Panel>

          <Panel title="Submit Child Payment Proof">
            <form onSubmit={(e) => void submitPayment(e)} className="space-y-4">
              <div>
                <Label htmlFor="p-pay-child">Select Linked Child</Label>
                <select
                  id="p-pay-child"
                  value={effectiveChildId}
                  onChange={(e) => setTargetChildId(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  {data.linkedChildIds.map((cid) => (
                    <option key={cid} value={cid}>
                      {data.maps.resolvePersonName(cid, "Linked Child")}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="p-pay-course">Course / Fee Item</Label>
                <select
                  id="p-pay-course"
                  value={activeCourseId}
                  onChange={(e) => setCourseId(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  {data.db.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label htmlFor="p-pay-method">Payment Method</Label>
                  <select
                    id="p-pay-method"
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                    className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                  >
                    {PAYMENT_METHODS.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <Label htmlFor="p-pay-amount">Payable Fee</Label>
                  <Input
                    id="p-pay-amount"
                    value={formatETB(payableAmount)}
                    readOnly
                    className="mt-1 bg-secondary/40 font-semibold tabular-nums"
                  />
                </div>
              </div>

              <div>
                <Label htmlFor="p-pay-ref">Transaction Reference *</Label>
                <Input
                  id="p-pay-ref"
                  value={reference}
                  onChange={(e) => setReference(e.target.value)}
                  placeholder="e.g. FT26324TX891 or Telebirr ref"
                  required
                  className="mt-1 font-mono"
                />
              </div>

              <div>
                <Label htmlFor="p-pay-file">
                  Upload Receipt Screenshot / PDF (max {MAX_RECEIPT_MB} MB)
                </Label>
                <Input
                  ref={fileRef}
                  id="p-pay-file"
                  type="file"
                  accept={RECEIPT_ACCEPT}
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                  className="mt-1"
                />
              </div>

              <div>
                <Label htmlFor="p-pay-note">Payment Note (optional)</Label>
                <Textarea
                  id="p-pay-note"
                  rows={2}
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Sender phone or bank branch note"
                  className="mt-1"
                />
              </div>

              <Button type="submit" variant="emerald" disabled={submitting}>
                {submitting ? "Submitting Payment…" : "Submit Payment for Verification"}
              </Button>
            </form>
          </Panel>
        </div>
      )}
    </div>
  );
}

/* ========================================================================== */
/* 4.3 PAYMENT HISTORY                                                        */
/* ========================================================================== */

export function ParentPaymentHistoryModule({ data }: { data: ParentDataHandle }) {
  const [childFilter, setChildFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [previewReceipt, setPreviewReceipt] = useState<{
    url: string;
    reference: string;
    isPdf: boolean;
  } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.db.payments.filter((p) => {
      if (childFilter !== "all" && p.user_id !== childFilter) return false;
      if (statusFilter !== "all" && p.status !== statusFilter) return false;
      if (!q) return true;
      const childName = data.maps.resolvePersonName(p.user_id, "").toLowerCase();
      const courseName = (data.maps.coursesById.get(p.course_id)?.title ?? "").toLowerCase();
      return (
        p.reference.toLowerCase().includes(q) ||
        p.method.toLowerCase().includes(q) ||
        childName.includes(q) ||
        courseName.includes(q)
      );
    });
  }, [childFilter, data.db.payments, data.maps, search, statusFilter]);

  const paged = paginateRows(filtered, page, 12);

  async function openReceipt(path: string | null, refCode: string) {
    const signedUrl = await data.getSignedReceiptUrl(path);
    if (!signedUrl) return;
    setPreviewReceipt({
      url: signedUrl,
      reference: refCode,
      isPdf: (path ?? "").toLowerCase().endsWith(".pdf"),
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment History"
        description="Chronological record of submitted, pending, approved, and rejected payments for your children."
      />

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            placeholder="Search reference, child, method…"
            className="pl-9"
          />
        </div>
        <select
          aria-label="Filter payments by child"
          value={childFilter}
          onChange={(e) => {
            setChildFilter(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-lg border border-border bg-card px-3 text-xs font-semibold"
        >
          <option value="all">All Linked Children</option>
          {data.linkedChildIds.map((id) => (
            <option key={id} value={id}>
              {data.maps.resolvePersonName(id, "Linked Child")}
            </option>
          ))}
        </select>
        <select
          aria-label="Filter payments by status"
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
          className="h-10 rounded-lg border border-border bg-card px-3 text-xs font-semibold"
        >
          <option value="all">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
        </select>
      </div>

      <Panel title="Transactions Log">
        {paged.items.length === 0 ? (
          <EmptyState
            title="No payment transactions found"
            text="Submitted fee and course payments for your linked children appear here."
            icon={Receipt}
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-border text-xs uppercase text-muted-foreground">
                  <tr>
                    <th className="py-2 pr-4">Date</th>
                    <th className="py-2 pr-4">Child</th>
                    <th className="py-2 pr-4">Course</th>
                    <th className="py-2 pr-4">Method & Ref</th>
                    <th className="py-2 pr-4 text-right">Amount</th>
                    <th className="py-2 pr-4 text-right">Status</th>
                    <th className="py-2 text-right">Receipt</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border tabular-nums">
                  {paged.items.map((p) => (
                    <tr key={p.id} className="hover:bg-secondary/30">
                      <td className="py-2.5 pr-4 font-mono text-xs">
                        {formatCompactDate(p.created_at)}
                      </td>
                      <td className="py-2.5 pr-4 font-medium">
                        {data.maps.resolvePersonName(p.user_id, "Linked Child")}
                      </td>
                      <td className="py-2.5 pr-4 text-muted-foreground">
                        {data.maps.coursesById.get(p.course_id)?.title ?? "Course"}
                      </td>
                      <td className="py-2.5 pr-4 text-xs">
                        <span className="font-semibold">{p.method}</span> ·{" "}
                        <span className="font-mono">{p.reference}</span>
                      </td>
                      <td className="py-2.5 pr-4 text-right font-mono font-semibold">
                        {formatETB(p.amount)}
                      </td>
                      <td className="py-2.5 pr-4 text-right">
                        <Badge
                          variant={
                            STATUS_BADGE[p.status] ??
                            (p.status === "approved"
                              ? "success"
                              : p.status === "rejected"
                                ? "destructive"
                                : "gold")
                          }
                        >
                          {p.status}
                        </Badge>
                      </td>
                      <td className="py-2.5 text-right">
                        {p.receipt_path ? (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => void openReceipt(p.receipt_path, p.reference)}
                          >
                            <Eye className="h-3.5 w-3.5" />
                            View
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pager
              page={paged.page}
              pageCount={paged.pageCount}
              onPage={setPage}
            />
          </>
        )}
      </Panel>

      <Dialog open={!!previewReceipt} onOpenChange={(o) => !o && setPreviewReceipt(null)}>
        <DialogContent className="max-w-2xl">
          {previewReceipt && (
            <>
              <DialogHeader>
                <DialogTitle>Payment Receipt — {previewReceipt.reference}</DialogTitle>
                <DialogDescription>
                  Private signed receipt view for payer and academy staff only.
                </DialogDescription>
              </DialogHeader>
              {previewReceipt.isPdf ? (
                <iframe
                  src={previewReceipt.url}
                  title={`Receipt ${previewReceipt.reference}`}
                  className="h-[60vh] w-full rounded-lg border border-border"
                />
              ) : (
                <img
                  src={previewReceipt.url}
                  alt={`Receipt ${previewReceipt.reference}`}
                  className="max-h-[60vh] w-full rounded-lg border border-border object-contain"
                />
              )}
              <DialogFooter>
                <Button variant="outline" onClick={() => setPreviewReceipt(null)}>
                  Close
                </Button>
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ========================================================================== */
/* 4.4 OUTSTANDING BALANCES                                                   */
/* ========================================================================== */

export function ParentOutstandingBalancesModule({
  data,
  onNavigate,
}: {
  data: ParentDataHandle;
  onNavigate: (id: ParentSubmenuId) => void;
}) {
  const ws = data.workspace;
  const [childFilter, setChildFilter] = useState("all");

  const unpaidPlans = useMemo(
    () =>
      (ws?.feePlans ?? [])
        .map((fp) => {
          const net = Math.max(0, fp.amount - fp.discount);
          const balance = Math.max(0, net - fp.paidAmount);
          const st = computeFeeStatus(fp.amount, fp.discount, fp.paidAmount, fp.dueDate);
          return { fp, balance, st };
        })
        .filter(
          (row) =>
            row.balance > 0 &&
            (childFilter === "all" || row.fp.studentId === childFilter),
        ),
    [childFilter, ws?.feePlans],
  );

  const totalDue = unpaidPlans.reduce((s, r) => s + r.balance, 0);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Outstanding Balances"
        description="Pending and overdue tuition balances across all linked children with quick settlement links."
        actions={
          <select
            aria-label="Filter balances by child"
            value={childFilter}
            onChange={(e) => setChildFilter(e.target.value)}
            className="h-9 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold"
          >
            <option value="all">All Linked Children</option>
            {data.linkedChildIds.map((id) => (
              <option key={id} value={id}>
                {data.maps.resolvePersonName(id, "Linked Child")}
              </option>
            ))}
          </select>
        }
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <StatCard label="Total Outstanding Balance" value={formatETB(totalDue)} icon={Wallet} index={0} />
        <StatCard
          label="Open / Overdue Plans"
          value={unpaidPlans.length}
          icon={ShieldCheck}
          tone="gold"
          hint={`${unpaidPlans.filter((u) => u.st === "overdue").length} overdue`}
          index={1}
        />
      </div>

      <Panel title="Unpaid & Overdue Fee Items">
        {unpaidPlans.length === 0 ? (
          <EmptyState
            title="Zero outstanding balances"
            text="All fee plans across the selected children are currently settled."
            icon={CheckCircle2}
          />
        ) : (
          <div className="space-y-3">
            {unpaidPlans.map(({ fp, balance, st }) => (
              <div
                key={fp.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border p-4 tabular-nums"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-semibold">{fp.title}</p>
                    <Badge variant={st === "overdue" ? "destructive" : "gold"}>{st}</Badge>
                  </div>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Child: {data.maps.resolvePersonName(fp.studentId, "Linked Child")} · Due:{" "}
                    {fp.dueDate || "Open"}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-base font-bold text-foreground">
                    {formatETB(balance)}
                  </span>
                  <Button
                    size="sm"
                    variant="emerald"
                    onClick={() => {
                      data.setSelectedChildId(fp.studentId);
                      onNavigate("make-payment");
                    }}
                  >
                    Pay Now
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </Panel>
    </div>
  );
}

/* ========================================================================== */
/* 4.5 INVOICES & RECEIPTS                                                    */
/* ========================================================================== */

export function ParentInvoicesReceiptsModule({ data }: { data: ParentDataHandle }) {
  const ws = data.workspace;
  const [childFilter, setChildFilter] = useState("all");

  const invoices = useMemo(
    () =>
      (ws?.invoices ?? []).filter(
        (inv) => childFilter === "all" || inv.studentId === childFilter,
      ),
    [childFilter, ws?.invoices],
  );

  const approvedPayments = useMemo(
    () =>
      data.db.payments.filter(
        (p) => p.status === "approved" && (childFilter === "all" || p.user_id === childFilter),
      ),
    [childFilter, data.db.payments],
  );

  function printInvoice(invId: string) {
    const inv = invoices.find((i) => i.id === invId);
    if (!inv) return;
    const childName = data.maps.resolvePersonName(inv.studentId, "Linked Child");
    data.setPrintable({
      title: `Official Invoice — ${inv.invoiceNumber}`,
      subtitle: `Student: ${childName} · Issued ${formatCompactDate(inv.issuedAt)}`,
      columns: ["Description", "Subtotal", "Discount", "Total", "Paid", "Status"],
      rows: [
        [
          inv.courseId
            ? data.maps.coursesById.get(inv.courseId)?.title ?? "Tuition Fee"
            : "Tuition Fee",
          formatETB(inv.subtotal),
          formatETB(inv.discount),
          formatETB(inv.total),
          formatETB(inv.paidAmount),
          inv.status.toUpperCase(),
        ],
      ],
      footerNote: `Method: ${inv.paymentMethod || "Ezana Pay"} · Due Date: ${inv.dueDate}`,
    });
  }

  function printPaymentReceipt(paymentId: string) {
    const p = approvedPayments.find((x) => x.id === paymentId);
    if (!p) return;
    const childName = data.maps.resolvePersonName(p.user_id, "Linked Child");
    data.setPrintable({
      title: `Verified Payment Receipt — ${p.reference}`,
      subtitle: `Student: ${childName} · Verified ${formatCompactDate(p.reviewed_at ?? p.created_at)}`,
      columns: ["Course", "Method", "Reference", "Amount", "Status"],
      rows: [
        [
          data.maps.coursesById.get(p.course_id)?.title ?? "Course",
          p.method,
          p.reference,
          formatETB(p.amount),
          "APPROVED",
        ],
      ],
      footerNote: p.review_note || "Verified by Ezana Academy Finance",
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices & Receipts"
        description="View and print itemized tuition invoices and verified payment confirmation receipts."
        actions={
          <select
            aria-label="Filter invoices by child"
            value={childFilter}
            onChange={(e) => setChildFilter(e.target.value)}
            className="h-9 rounded-lg border border-border bg-card px-2.5 text-xs font-semibold"
          >
            <option value="all">All Linked Children</option>
            {data.linkedChildIds.map((id) => (
              <option key={id} value={id}>
                {data.maps.resolvePersonName(id, "Linked Child")}
              </option>
            ))}
          </select>
        }
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={`Invoices (${invoices.length})`}>
          {invoices.length === 0 ? (
            <EmptyState
              title="No formal invoices issued"
              text="Generated tuition and fee invoices appear here."
              icon={FileCheck2}
            />
          ) : (
            <div className="space-y-2.5">
              {invoices.map((inv) => (
                <div
                  key={inv.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border p-3.5 tabular-nums"
                >
                  <div>
                    <p className="font-mono text-sm font-bold">{inv.invoiceNumber}</p>
                    <p className="text-xs text-muted-foreground">
                      {data.maps.resolvePersonName(inv.studentId, "Child")} · {formatETB(inv.total)}{" "}
                      · {inv.status}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => printInvoice(inv.id)}>
                    <Printer className="h-3.5 w-3.5" />
                    Print
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Panel>

        <Panel title={`Verified Receipts (${approvedPayments.length})`}>
          {approvedPayments.length === 0 ? (
            <EmptyState
              title="No verified receipts yet"
              text="Approved payments generate printable official receipts here."
              icon={Receipt}
            />
          ) : (
            <div className="space-y-2.5">
              {approvedPayments.map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-border p-3.5 tabular-nums"
                >
                  <div>
                    <p className="font-mono text-sm font-bold">{p.reference}</p>
                    <p className="text-xs text-muted-foreground">
                      {data.maps.resolvePersonName(p.user_id, "Child")} ·{" "}
                      {data.maps.coursesById.get(p.course_id)?.title ?? "Course"} ·{" "}
                      {formatETB(p.amount)}
                    </p>
                  </div>
                  <Button size="sm" variant="outline" onClick={() => printPaymentReceipt(p.id)}>
                    <Printer className="h-3.5 w-3.5" />
                    Print Receipt
                  </Button>
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* 5.1 MESSAGES TO INSTRUCTORS & 5.2 MESSAGES TO ADMIN                        */
/* ========================================================================== */

function ScopedDirectMessagesView({
  data,
  title,
  description,
  recipients,
  emptyRecipientsText,
}: {
  data: ParentDataHandle;
  title: string;
  description: string;
  recipients: { id: string; fullName: string }[];
  emptyRecipientsText: string;
}) {
  const { user } = useAuth();
  const ws = data.workspace;
  const [recipientId, setRecipientId] = useState(() => recipients[0]?.id ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const recipientIdSet = useMemo(() => new Set(recipients.map((r) => r.id)), [recipients]);

  const effectiveRecipientId =
    recipientId && recipientIdSet.has(recipientId) ? recipientId : recipients[0]?.id ?? "";

  const thread = useMemo(() => {
    if (!user) return [];
    return (ws?.internalMessages ?? []).filter(
      (m) =>
        (m.senderId === user.id && recipientIdSet.has(m.recipientId)) ||
        (m.recipientId === user.id && recipientIdSet.has(m.senderId)),
    );
  }, [recipientIdSet, user, ws?.internalMessages]);

  async function sendMessage(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !effectiveRecipientId || !subject.trim() || !body.trim()) return;
    await data.mutateWorkspace(
      {
        type: "send_internal_message",
        payload: {
          id: crypto.randomUUID(),
          senderId: user.id,
          recipientId: effectiveRecipientId,
          subject: subject.trim(),
          body: body.trim(),
          read: false,
          archived: false,
          deleted: false,
          createdAt: new Date().toISOString(),
        },
      },
      "Message sent",
    );
    setSubject("");
    setBody("");
  }

  return (
    <div className="space-y-6">
      <PageHeader title={title} description={description} />

      <div className="grid gap-6 xl:grid-cols-[0.95fr_1.25fr]">
        <Panel title="Compose Message">
          {recipients.length === 0 ? (
            <EmptyState
              title="No recipients available"
              text={emptyRecipientsText}
              icon={Mail}
            />
          ) : (
            <form onSubmit={(e) => void sendMessage(e)} className="space-y-3">
              <div>
                <Label htmlFor="dm-rec">Recipient</Label>
                <select
                  id="dm-rec"
                  value={effectiveRecipientId}
                  onChange={(e) => setRecipientId(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  {recipients.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.fullName}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <Label htmlFor="dm-subj">Subject</Label>
                <Input
                  id="dm-subj"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Topic or question"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="dm-body">Message</Label>
                <Textarea
                  id="dm-body"
                  rows={4}
                  value={body}
                  onChange={(e) => setBody(e.target.value)}
                  placeholder="Write your message clearly…"
                  required
                  className="mt-1"
                />
              </div>
              <Button type="submit" variant="emerald" disabled={data.mutating}>
                <Send className="h-4 w-4" />
                Send Message
              </Button>
            </form>
          )}
        </Panel>

        <Panel title={`Inbox & Sent (${thread.length})`}>
          {thread.length === 0 ? (
            <EmptyState
              title="No messages yet"
              text="Conversations with selected recipients appear here."
              icon={Mail}
            />
          ) : (
            <div className="space-y-3">
              {thread.map((m) => {
                const isSent = m.senderId === user?.id;
                const peerId = isSent ? m.recipientId : m.senderId;
                return (
                  <div key={m.id} className="rounded-xl border border-border p-3.5">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-semibold">{m.subject}</p>
                        <p className="text-xs text-muted-foreground tabular-nums">
                          {isSent ? "To" : "From"} {data.maps.resolvePersonName(peerId)} ·{" "}
                          {formatCompactDate(m.createdAt)}
                        </p>
                      </div>
                      {!isSent && !m.read && (
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() =>
                            void data.mutateWorkspace({
                              type: "update_internal_message",
                              id: m.id,
                              patch: { read: true },
                            })
                          }
                        >
                          Mark Read
                        </Button>
                      )}
                    </div>
                    <p className="mt-2 whitespace-pre-wrap text-xs text-foreground/90">{m.body}</p>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

export function ParentMessagesInstructorsModule({ data }: { data: ParentDataHandle }) {
  return (
    <ScopedDirectMessagesView
      data={data}
      title="Messages to Instructors"
      description="Direct communication with instructors assigned to your linked children's courses and classes."
      recipients={data.maps.instructors}
      emptyRecipientsText="No instructors are currently assigned to your linked children's enrolled courses."
    />
  );
}

export function ParentMessagesAdminModule({ data }: { data: ParentDataHandle }) {
  return (
    <ScopedDirectMessagesView
      data={data}
      title="Messages to Admin"
      description="Send inquiries to academy administrators regarding student records, fees, attendance, or links."
      recipients={data.maps.admins}
      emptyRecipientsText="Academy administration contacts will appear once configured."
    />
  );
}

/* ========================================================================== */
/* 5.3 TEACHER COMMUNICATION                                                  */
/* ========================================================================== */

export function ParentTeacherCommModule({ data }: { data: ParentDataHandle }) {
  const { user } = useAuth();
  const ws = data.workspace;
  const child = data.activeChild;
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const thread = useMemo(
    () =>
      (ws?.parentMessages ?? []).filter(
        (pm) => !pm.studentId || pm.studentId === child.childId,
      ),
    [child.childId, ws?.parentMessages],
  );

  async function sendNote(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !subject.trim() || !body.trim()) return;
    await data.mutateWorkspace(
      {
        type: "send_parent_message",
        payload: {
          parentId: user.id,
          studentId: child.childId || null,
          senderId: user.id,
          senderRole: "parent",
          subject: subject.trim(),
          body: body.trim(),
          includeSnapshot: false,
          snapshotSummary: null,
          read: false,
        },
      },
      "Teacher communication note sent",
    );
    setSubject("");
    setBody("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Teacher Communication"
        description={`Child-linked academic notes, feedback, and parent replies for ${child.profile ? displayName(child.profile) : "your child"}.`}
      />

      <div className="grid gap-6 xl:grid-cols-[0.9fr_1.3fr]">
        <Panel title="Send Child Update / Inquiry">
          <form onSubmit={(e) => void sendNote(e)} className="space-y-3">
            <Input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject (e.g. Homework follow-up)"
              required
            />
            <Textarea
              rows={4}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Write a message regarding this child's progress or class needs…"
              required
            />
            <Button type="submit" variant="emerald" disabled={data.mutating}>
              <Send className="h-4 w-4" />
              Post Note
            </Button>
          </form>
        </Panel>

        <Panel title="Teacher–Parent Updates Log">
          {thread.length === 0 ? (
            <EmptyState
              title="No teacher updates yet"
              text="Instructor progress notes and parent replies for this child appear here."
              icon={MessageSquare}
            />
          ) : (
            <div className="space-y-3">
              {thread.map((pm) => (
                <div key={pm.id} className="rounded-xl border border-border p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="text-sm font-semibold">{pm.subject}</p>
                      <p className="text-xs text-muted-foreground tabular-nums">
                        {data.maps.resolvePersonName(pm.senderId, pm.senderRole)} ({pm.senderRole}) ·{" "}
                        {formatCompactDate(pm.createdAt)}
                      </p>
                    </div>
                    {!pm.read && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() =>
                          void data.mutateWorkspace({
                            type: "mark_parent_message_read",
                            id: pm.id,
                          })
                        }
                      >
                        Mark Read
                      </Button>
                    )}
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-xs text-foreground/90">{pm.body}</p>
                  {pm.snapshotSummary && (
                    <p className="mt-2 rounded-lg bg-secondary/40 px-2.5 py-1.5 text-[11px] text-muted-foreground">
                      Snapshot: {pm.snapshotSummary}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </Panel>
      </div>
    </div>
  );
}

/* ========================================================================== */
/* 5.4 ACADEMY ANNOUNCEMENTS & 5.5 NOTIFICATIONS                              */
/* ========================================================================== */

export function ParentAnnouncementsModule({ data }: { data: ParentDataHandle }) {
  const [search, setSearch] = useState("");
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return data.db.announcements.filter(
      (a) =>
        !q ||
        a.title.toLowerCase().includes(q) ||
        a.body.toLowerCase().includes(q),
    );
  }, [data.db.announcements, search]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Academy Announcements"
        description="Official notices published for parents, guardians, and students across the academy."
      />
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search announcements…"
          className="pl-9"
        />
      </div>
      {filtered.length === 0 ? (
        <EmptyState
          title="No announcements found"
          text="Academy announcements and term updates appear here."
          icon={Megaphone}
        />
      ) : (
        <div className="space-y-3">
          {filtered.map((a) => (
            <Panel
              key={a.id}
              title={a.title}
              actions={
                <span className="font-mono text-xs text-muted-foreground tabular-nums">
                  {formatCompactDate(a.publish_at)}
                </span>
              }
            >
              <p className="whitespace-pre-wrap text-sm text-foreground/90">{a.body}</p>
            </Panel>
          ))}
        </div>
      )}
    </div>
  );
}

export function ParentNotificationsModule({
  data,
  onNavigate,
}: {
  data: ParentDataHandle;
  onNavigate: (id: ParentSubmenuId) => void;
}) {
  const { user } = useAuth();
  const ws = data.workspace;
  const [filter, setFilter] = useState<"all" | "unread">("all");

  const items = useMemo(() => {
    const list = ws?.notifications ?? [];
    if (filter === "unread" && user) {
      return list.filter((n) => !n.readBy.includes(user.id));
    }
    return list;
  }, [filter, user, ws?.notifications]);

  function targetForCategory(cat: string): ParentSubmenuId {
    if (cat === "finance") return "child-fees";
    if (cat === "academic") return "attendance-tracking";
    if (cat === "communication") return "teacher-communication";
    return "linked-children";
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Notifications"
        description="Real-time alerts for attendance, grade releases, fee deadlines, messages, and child links."
        actions={
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={filter === "all" ? "emerald" : "outline"}
              onClick={() => setFilter("all")}
            >
              All
            </Button>
            <Button
              size="sm"
              variant={filter === "unread" ? "emerald" : "outline"}
              onClick={() => setFilter("unread")}
            >
              Unread
            </Button>
          </div>
        }
      />

      {items.length === 0 ? (
        <EmptyState
          title="No notifications"
          text="Important academic and tuition notifications will appear here."
          icon={Bell}
        />
      ) : (
        <div className="space-y-2.5">
          {items.map((n) => {
            const isRead = user ? n.readBy.includes(user.id) : true;
            return (
              <div
                key={n.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-4"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Badge variant={isRead ? "outline" : "gold"}>{n.category}</Badge>
                    <p className="truncate font-semibold text-sm">{n.title}</p>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">{n.message}</p>
                  <p className="mt-1 font-mono text-[11px] text-muted-foreground tabular-nums">
                    {formatCompactDate(n.createdAt)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => onNavigate(targetForCategory(n.category))}
                  >
                    Open
                  </Button>
                  {!isRead && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() =>
                        void data.mutateWorkspace({ type: "mark_notification_read", id: n.id })
                      }
                    >
                      Mark Read
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

/* ========================================================================== */
/* 6.1 MY PROFILE                                                             */
/* ========================================================================== */

export function ParentProfileModule({ data }: { data: ParentDataHandle }) {
  const { user, profile, refresh } = useAuth();
  const ws = data.workspace;
  const [firstName, setFirstName] = useState(profile?.first_name ?? "");
  const [lastName, setLastName] = useState(profile?.last_name ?? "");
  const [phone, setPhone] = useState(profile?.phone ?? "");
  const [bio, setBio] = useState(profile?.bio ?? "");
  const [saving, setSaving] = useState(false);

  const [corrOpen, setCorrOpen] = useState(false);
  const [corrField, setCorrField] = useState<ProfileCorrectionRequest["field"]>("other");
  const [corrValue, setCorrValue] = useState("");
  const [corrReason, setCorrReason] = useState("");

  async function saveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({
          first_name: firstName.trim(),
          last_name: lastName.trim(),
          phone: phone.trim() || null,
          bio: bio.trim() || null,
        })
        .eq("id", user.id);
      if (error) throw new Error(error.message);
      await refresh();
      await data.refreshAll("Parent profile updated");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update profile.");
    } finally {
      setSaving(false);
    }
  }

  async function submitParentCorrection(e: React.FormEvent) {
    e.preventDefault();
    if (!user || !corrValue.trim() || !corrReason.trim()) return;
    await data.mutateWorkspace(
      {
        type: "request_profile_correction",
        payload: {
          studentId: user.id,
          requesterId: user.id,
          targetType: "parent",
          field: corrField,
          requestedValue: corrValue.trim(),
          reason: corrReason.trim(),
        },
      },
      "Parent profile correction request sent to academy admin",
    );
    setCorrValue("");
    setCorrReason("");
    setCorrOpen(false);
  }

  const myCorrections = (ws?.profileCorrectionRequests ?? []).filter(
    (r) => r.targetType === "parent" && r.requesterId === user?.id,
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="My Profile"
        description="Manage your guardian contact details or submit an official correction request."
        actions={
          <Button variant="outline" size="sm" onClick={() => setCorrOpen(true)}>
            <FileEdit className="h-4 w-4" />
            Request Account Correction
          </Button>
        }
      />

      <Panel title="Parent / Guardian Contact Profile">
        <form onSubmit={(e) => void saveProfile(e)} className="grid gap-4 md:grid-cols-2">
          <div>
            <Label htmlFor="par-fn">First Name</Label>
            <Input
              id="par-fn"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="par-ln">Last Name</Label>
            <Input
              id="par-ln"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="par-email">Registered Email</Label>
            <Input
              id="par-email"
              value={profile?.email ?? user?.email ?? ""}
              readOnly
              className="mt-1 bg-secondary/40"
            />
          </div>
          <div>
            <Label htmlFor="par-phone">Phone Number</Label>
            <Input
              id="par-phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="+251 9..."
              className="mt-1"
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="par-bio">Guardian Relationship & Notes</Label>
            <Textarea
              id="par-bio"
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Emergency contact note or preferred contact hours"
              className="mt-1"
            />
          </div>
          <div className="md:col-span-2">
            <Button type="submit" variant="emerald" disabled={saving}>
              <UserRound className="h-4 w-4" />
              {saving ? "Saving…" : "Save Contact Profile"}
            </Button>
          </div>
        </form>
      </Panel>

      {myCorrections.length > 0 && (
        <Panel title="Account Correction Requests">
          <div className="divide-y divide-border">
            {myCorrections.map((c) => (
              <div
                key={c.id}
                className="flex items-center justify-between gap-2 py-2.5 text-sm first:pt-0 last:pb-0"
              >
                <div>
                  <p className="font-semibold">
                    {c.field}: {c.requestedValue}
                  </p>
                  <p className="text-xs text-muted-foreground">{c.reason}</p>
                </div>
                <Badge variant={c.status === "approved" ? "success" : "gold"}>{c.status}</Badge>
              </div>
            ))}
          </div>
        </Panel>
      )}

      <Dialog open={corrOpen} onOpenChange={setCorrOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Official Account Correction</DialogTitle>
            <DialogDescription>
              Submit a request to update email or restricted guardian identity fields.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => void submitParentCorrection(e)} className="space-y-3">
            <select
              aria-label="Field type"
              value={corrField}
              onChange={(e) => setCorrField(e.target.value as ProfileCorrectionRequest["field"])}
              className="h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
            >
              <option value="guardianName">Legal Guardian Name</option>
              <option value="other">Registered Email / Identity</option>
            </select>
            <Input
              value={corrValue}
              onChange={(e) => setCorrValue(e.target.value)}
              placeholder="Requested official value"
              required
            />
            <Textarea
              rows={3}
              value={corrReason}
              onChange={(e) => setCorrReason(e.target.value)}
              placeholder="Reason for this update"
              required
            />
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCorrOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="emerald" disabled={data.mutating}>
                Submit Request
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ========================================================================== */
/* 6.2 LINKED CHILDREN                                                        */
/* ========================================================================== */

export function ParentLinkedChildrenModule({ data }: { data: ParentDataHandle }) {
  const { user } = useAuth();
  const ws = data.workspace;
  const [requestType, setRequestType] = useState<"link" | "correction">("link");
  const [targetStudentId, setTargetStudentId] = useState("");
  const [studentName, setStudentName] = useState("");
  const [studentIdentifier, setStudentIdentifier] = useState("");
  const [relationship, setRelationship] = useState("Mother");
  const [notes, setNotes] = useState("");

  async function submitLinkRequest(e: React.FormEvent) {
    e.preventDefault();
    if (!user || (!studentName.trim() && !studentIdentifier.trim())) return;
    await data.mutateWorkspace(
      {
        type: "request_child_link",
        payload: {
          parentId: user.id,
          studentIdentifier: studentIdentifier.trim(),
          studentName: studentName.trim(),
          relationship: relationship.trim() || "Parent",
          requestType,
          targetStudentId: requestType === "correction" ? targetStudentId || null : null,
          notes: notes.trim(),
        },
      },
      "Child link request submitted to academy administration",
    );
    setStudentName("");
    setStudentIdentifier("");
    setNotes("");
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Linked Children"
        description="Verified student accounts linked to your profile, plus requests to link another child or correct relationship records."
      />

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title={`Verified Child Links (${data.linkedChildIds.length})`}>
          {data.linkedChildIds.length === 0 ? (
            <EmptyState
              title="No verified links yet"
              text="Submit a child verification request on the right so admin staff can link your child."
              icon={Link2}
            />
          ) : (
            <div className="space-y-2.5">
              {data.linkedChildIds.map((cid) => {
                const cp = data.maps.childProfilesById.get(cid);
                const meta = ws?.studentMetaByChild[cid];
                const rel =
                  ws?.relationshipsByChild[cid] ??
                  data.maps.linksByChildId.get(cid)?.relationship ??
                  "Parent";
                return (
                  <div
                    key={cid}
                    className="flex items-center justify-between gap-3 rounded-xl border border-border p-3"
                  >
                    <div>
                      <p className="font-semibold text-sm">
                        {cp ? displayName(cp) : "Linked Student"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        <span className="font-mono">
                          {meta?.studentCode ?? `STU-${cid.slice(0, 6).toUpperCase()}`}
                        </span>{" "}
                        · Relationship: {rel}
                      </p>
                    </div>
                    <Badge variant="success">Verified</Badge>
                  </div>
                );
              })}
            </div>
          )}
        </Panel>

        <Panel title="Request Child Link / Correction">
          <form onSubmit={(e) => void submitLinkRequest(e)} className="space-y-3">
            <div>
              <Label htmlFor="lnk-type">Request Type</Label>
              <select
                id="lnk-type"
                value={requestType}
                onChange={(e) => setRequestType(e.target.value as "link" | "correction")}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="link">Link Additional Child</option>
                <option value="correction">Request Link / Relationship Correction</option>
              </select>
            </div>
            {requestType === "correction" && data.linkedChildIds.length > 0 && (
              <div>
                <Label htmlFor="lnk-target">Existing Linked Child</Label>
                <select
                  id="lnk-target"
                  value={targetStudentId}
                  onChange={(e) => setTargetStudentId(e.target.value)}
                  className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
                >
                  <option value="">Select child…</option>
                  {data.linkedChildIds.map((id) => (
                    <option key={id} value={id}>
                      {data.maps.resolvePersonName(id, "Linked Child")}
                    </option>
                  ))}
                </select>
              </div>
            )}
            <div>
              <Label htmlFor="lnk-name">Student Full Name *</Label>
              <Input
                id="lnk-name"
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Child's registered full name"
                required
                className="mt-1"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label htmlFor="lnk-ident">Student ID or Email *</Label>
                <Input
                  id="lnk-ident"
                  value={studentIdentifier}
                  onChange={(e) => setStudentIdentifier(e.target.value)}
                  placeholder="STU-... or student@email"
                  required
                  className="mt-1"
                />
              </div>
              <div>
                <Label htmlFor="lnk-rel">Relationship</Label>
                <Input
                  id="lnk-rel"
                  value={relationship}
                  onChange={(e) => setRelationship(e.target.value)}
                  placeholder="Mother / Father / Guardian"
                  required
                  className="mt-1"
                />
              </div>
            </div>
            <div>
              <Label htmlFor="lnk-notes">Verification Notes</Label>
              <Textarea
                id="lnk-notes"
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional admission number or contact reference for admin verification"
                className="mt-1"
              />
            </div>
            <Button type="submit" variant="emerald" disabled={data.mutating}>
              <Link2 className="h-4 w-4" />
              Submit Request
            </Button>
          </form>
        </Panel>
      </div>

      {(ws?.childLinkRequests ?? []).length > 0 && (
        <Panel title="Link Request History">
          <div className="divide-y divide-border">
            {(ws?.childLinkRequests ?? []).map((req) => (
              <div
                key={req.id}
                className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm first:pt-0 last:pb-0"
              >
                <div>
                  <p className="font-semibold">
                    {req.studentName} ({req.relationship}) —{" "}
                    <span className="font-mono text-xs">{req.studentIdentifier}</span>
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {req.requestType === "correction" ? "Correction" : "New Link"} ·{" "}
                    {formatCompactDate(req.createdAt)}
                  </p>
                </div>
                <Badge
                  variant={
                    req.status === "approved"
                      ? "success"
                      : req.status === "rejected"
                        ? "destructive"
                        : "gold"
                  }
                >
                  {req.status}
                </Badge>
              </div>
            ))}
          </div>
        </Panel>
      )}
    </div>
  );
}

/* ========================================================================== */
/* 6.3 ACCOUNT SETTINGS & 6.4 CHANGE PASSWORD                                 */
/* ========================================================================== */

export function ParentAccountSettingsModule({ data }: { data: ParentDataHandle }) {
  const ws = data.workspace;
  const current = ws?.myAccountPrefs;
  const [language, setLanguage] = useState<"en" | "am">(current?.language ?? "en");
  const [timezone, setTimezone] = useState(current?.timezone ?? "Africa/Addis_Ababa");
  const [emailNotifications, setEmailNotifications] = useState(
    current?.emailNotifications ?? true,
  );
  const [inAppNotifications, setInAppNotifications] = useState(
    current?.inAppNotifications ?? true,
  );
  const [paymentReviewDigest, setPaymentReviewDigest] = useState(
    current?.paymentReviewDigest ?? true,
  );

  async function savePrefs(e: React.FormEvent) {
    e.preventDefault();
    await data.mutateWorkspace(
      {
        type: "update_account_prefs",
        prefs: {
          language,
          timezone,
          emailNotifications,
          inAppNotifications,
          paymentReviewDigest,
          weeklyExecutiveSummary: true,
        },
      },
      "Parent notification preferences saved",
    );
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Account Settings"
        description="Configure your display language, timezone, and parent alert preferences."
      />
      <Panel title="Preferences & Alert Channels">
        <form onSubmit={(e) => void savePrefs(e)} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label htmlFor="par-lang">Preferred Language</Label>
              <select
                id="par-lang"
                value={language}
                onChange={(e) => setLanguage(e.target.value as "en" | "am")}
                className="mt-1 h-10 w-full rounded-lg border border-border bg-background px-3 text-sm"
              >
                <option value="en">English</option>
                <option value="am">Amharic (አማርኛ)</option>
              </select>
            </div>
            <div>
              <Label htmlFor="par-tz">Timezone</Label>
              <Input
                id="par-tz"
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="mt-1"
              />
            </div>
          </div>

          <div className="space-y-2.5">
            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={emailNotifications}
                onChange={(e) => setEmailNotifications(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Email notifications for grades, attendance alerts, and fee reminders
            </label>
            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={inAppNotifications}
                onChange={(e) => setInAppNotifications(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              In-app notifications inside the Parent Dashboard
            </label>
            <label className="flex items-center gap-2.5 text-sm">
              <input
                type="checkbox"
                checked={paymentReviewDigest}
                onChange={(e) => setPaymentReviewDigest(e.target.checked)}
                className="h-4 w-4 rounded border-border"
              />
              Payment receipt verification status updates
            </label>
          </div>

          <Button type="submit" variant="emerald" disabled={data.mutating}>
            <Settings className="h-4 w-4" />
            Save Preferences
          </Button>
        </form>
      </Panel>
    </div>
  );
}

export function ParentChangePasswordModule({ minLength }: { minLength: number }) {
  const { user } = useAuth();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saving, setSaving] = useState(false);

  async function submitPassword(e: React.FormEvent) {
    e.preventDefault();
    if (!user?.email) return;
    if (newPassword.length < minLength) {
      toast.error(`Password must be at least ${minLength} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match.");
      return;
    }
    setSaving(true);
    try {
      const { error: verifyErr } = await supabase.auth.signInWithPassword({
        email: user.email,
        password: currentPassword,
      });
      if (verifyErr) {
        throw new Error("Current password is incorrect.");
      }
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw new Error(error.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast.success("Password updated successfully");
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not change password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Change Password"
        description={`Verify your current credentials and choose a new password (minimum ${minLength} characters).`}
      />
      <Panel title="Update Security Credentials">
        <form onSubmit={(e) => void submitPassword(e)} className="max-w-md space-y-4">
          <div>
            <Label htmlFor="par-cur-pw">Current Password</Label>
            <Input
              id="par-cur-pw"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="par-new-pw">New Password</Label>
            <Input
              id="par-new-pw"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              minLength={minLength}
              required
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="par-conf-pw">Confirm New Password</Label>
            <Input
              id="par-conf-pw"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              minLength={minLength}
              required
              className="mt-1"
            />
          </div>
          <Button type="submit" variant="emerald" disabled={saving}>
            <KeyRound className="h-4 w-4" />
            {saving ? "Updating Password…" : "Update Password"}
          </Button>
        </form>
      </Panel>
    </div>
  );
}
