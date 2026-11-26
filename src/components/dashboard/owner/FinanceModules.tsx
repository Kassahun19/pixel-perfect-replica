import { useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import {
  ArrowDownToLine,
  CheckCircle2,
  CircleDollarSign,
  CreditCard,
  FileSpreadsheet,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import { displayName } from "@/lib/auth";
import { formatETB } from "@/lib/access";
import { downloadCsv, downloadExcelXls } from "@/lib/export";
import { computeFeeBalance, summarizeFees } from "@/lib/owner/logic";
import type { FeePlan, InvoiceRecord } from "@/lib/owner/types";
import { PaymentsManager } from "@/components/dashboard/PaymentsManager";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  PageHeader,
  Panel,
  STATUS_BADGE,
  StatCard,
} from "@/components/dashboard/ui";
import type { OwnerDataHandle } from "./useOwnerData";

/* ========================================================================== */
/* 4.1 FEES & PAYMENTS                                                        */
/* ========================================================================== */

export function FeesPaymentsModule({ data }: { data: OwnerDataHandle }) {
  const { db, workspace, maps, mutateWorkspace, can, mutating } = data;
  const [view, setView] = useState<"receipts" | "fees">("receipts");
  const [statusFilter, setStatusFilter] = useState("all");
  const [feeDialog, setFeeDialog] = useState<FeePlan | null>(null);

  const students = useMemo(
    () => db.profiles.filter((p) => (maps.rolesByUser.get(p.id) ?? []).includes("student")),
    [db.profiles, maps.rolesByUser],
  );

  const feePlans = useMemo(
    () =>
      (workspace?.feePlans ?? []).filter((f) =>
        statusFilter === "all" ? true : f.status === statusFilter,
      ),
    [workspace?.feePlans, statusFilter],
  );

  const feeTotals = useMemo(() => summarizeFees(workspace?.feePlans ?? []), [workspace?.feePlans]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Fees & Payments"
        description="Manage student & course fee schedules, balances, discounts, due dates, and incoming Telebirr / bank payment receipts."
        actions={
          <div className="flex flex-wrap gap-2">
            <Button
              size="sm"
              variant={view === "receipts" ? "emerald" : "outline"}
              onClick={() => setView("receipts")}
            >
              <Receipt className="h-4 w-4" /> Payment Receipts ({db.payments.length})
            </Button>
            <Button
              size="sm"
              variant={view === "fees" ? "emerald" : "outline"}
              onClick={() => setView("fees")}
            >
              <Wallet className="h-4 w-4" /> Fee Schedules ({(workspace?.feePlans ?? []).length})
            </Button>
            {can("finance", "create") && (
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setFeeDialog({
                    id: crypto.randomUUID(),
                    studentId: students[0]?.id ?? db.profiles[0]?.id ?? "",
                    courseId: db.courses[0]?.id ?? null,
                    title: "Course Tuition Fee",
                    amount: 218,
                    discount: 0,
                    paidAmount: 0,
                    dueDate: new Date().toISOString().slice(0, 10),
                    status: "unpaid",
                    paymentMethod: "Telebirr",
                    notes: "",
                    createdAt: new Date().toISOString(),
                  })
                }
              >
                <Plus className="h-4 w-4" /> Assign Fee
              </Button>
            )}
          </div>
        }
      />

      {view === "receipts" ? (
        <PaymentsManager />
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-4">
            <StatCard
              label="Total Billed"
              value={formatETB(feeTotals.billed)}
              icon={Wallet}
              index={0}
            />
            <StatCard
              label="Collected"
              value={formatETB(feeTotals.collected)}
              icon={CheckCircle2}
              tone="gold"
              index={1}
            />
            <StatCard
              label="Outstanding Balance"
              value={formatETB(feeTotals.outstanding)}
              icon={CircleDollarSign}
              tone="deep"
              index={2}
            />
            <StatCard
              label="Overdue Accounts"
              value={feeTotals.overdueCount}
              icon={Receipt}
              tone="plain"
              index={3}
            />
          </div>

          <Panel
            title="Student & Course Fee Schedules"
            actions={
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="h-9 rounded-md border border-input bg-background px-3 text-xs"
              >
                <option value="all">All Statuses</option>
                <option value="paid">Paid</option>
                <option value="partial">Partial</option>
                <option value="unpaid">Unpaid</option>
                <option value="overdue">Overdue</option>
              </select>
            }
          >
            {feePlans.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student & Course</TableHead>
                    <TableHead>Fee / Discount</TableHead>
                    <TableHead>Paid / Balance</TableHead>
                    <TableHead>Due Date & Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {feePlans.map((fee) => {
                    const balance = computeFeeBalance(fee.amount, fee.discount, fee.paidAmount);
                    const student = maps.profilesById.get(fee.studentId);
                    return (
                      <TableRow key={fee.id}>
                        <TableCell>
                          <p className="font-semibold">
                            {student ? displayName(student) : "Student"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {fee.title}
                            {fee.courseId
                              ? ` · ${maps.coursesById.get(fee.courseId)?.title ?? ""}`
                              : ""}
                          </p>
                        </TableCell>
                        <TableCell className="text-xs tabular-nums">
                          <p className="font-semibold">{formatETB(fee.amount)}</p>
                          {fee.discount > 0 && (
                            <p className="text-emerald-700">-{formatETB(fee.discount)} discount</p>
                          )}
                        </TableCell>
                        <TableCell className="text-xs tabular-nums">
                          <p className="font-medium text-emerald-700">
                            Paid: {formatETB(fee.paidAmount)}
                          </p>
                          <p className="font-semibold">Balance: {formatETB(balance)}</p>
                        </TableCell>
                        <TableCell>
                          <p className="font-mono text-xs text-muted-foreground">{fee.dueDate}</p>
                          <Badge
                            variant={
                              fee.status === "paid"
                                ? "success"
                                : fee.status === "overdue"
                                  ? "destructive"
                                  : fee.status === "partial"
                                    ? "gold"
                                    : "warning"
                            }
                            className="mt-1 capitalize"
                          >
                            {fee.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1.5">
                            {can("finance", "edit") && (
                              <Button size="sm" variant="outline" onClick={() => setFeeDialog(fee)}>
                                Update
                              </Button>
                            )}
                            {can("finance", "edit") && (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() =>
                                  void mutateWorkspace(
                                    {
                                      type: "generate_invoice",
                                      payload: {
                                        studentId: fee.studentId,
                                        courseId: fee.courseId,
                                        feePlanId: fee.id,
                                        paymentId: null,
                                        subtotal: fee.amount,
                                        discount: fee.discount,
                                        total: Math.max(0, fee.amount - fee.discount),
                                        paidAmount: fee.paidAmount,
                                        status: fee.status === "paid" ? "paid" : "issued",
                                        dueDate: fee.dueDate,
                                        paymentMethod: fee.paymentMethod,
                                        notes: fee.title,
                                      },
                                    },
                                    "Invoice generated from fee plan",
                                  )
                                }
                              >
                                Invoice
                              </Button>
                            )}
                            {can("finance", "delete") && (
                              <ConfirmButton
                                title="Delete fee schedule?"
                                confirmLabel="Delete"
                                onConfirm={() =>
                                  void mutateWorkspace(
                                    { type: "delete_fee_plan", id: fee.id },
                                    "Fee deleted",
                                  )
                                }
                                trigger={
                                  <Button size="sm" variant="ghost" className="text-destructive">
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                }
                              />
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            ) : (
              <EmptyState
                title="No fee schedules assigned yet"
                text="Assign tuition or custom fee plans with discounts and due dates."
                icon={Wallet}
              />
            )}
          </Panel>
        </>
      )}

      {/* Fee Modal */}
      <Dialog open={!!feeDialog} onOpenChange={(o) => !o && setFeeDialog(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Fee Schedule & Balance</DialogTitle>
          </DialogHeader>
          {feeDialog && (
            <form
              className="grid gap-3 sm:grid-cols-2"
              onSubmit={(e) => {
                e.preventDefault();
                void mutateWorkspace(
                  { type: "upsert_fee_plan", payload: feeDialog },
                  "Fee plan saved",
                ).then(() => setFeeDialog(null));
              }}
            >
              <label className="space-y-1 text-sm font-medium">
                Student
                <select
                  required
                  value={feeDialog.studentId}
                  onChange={(e) => setFeeDialog({ ...feeDialog, studentId: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  {db.profiles.map((p) => (
                    <option key={p.id} value={p.id}>
                      {displayName(p)}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium">
                Course
                <select
                  value={feeDialog.courseId ?? ""}
                  onChange={(e) => setFeeDialog({ ...feeDialog, courseId: e.target.value || null })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="">General Academy Fee</option>
                  {db.courses.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.title}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium sm:col-span-2">
                Fee Description
                <Input
                  required
                  value={feeDialog.title}
                  onChange={(e) => setFeeDialog({ ...feeDialog, title: e.target.value })}
                />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Amount (ETB)
                <Input
                  type="number"
                  min="0"
                  value={feeDialog.amount}
                  onChange={(e) =>
                    setFeeDialog({ ...feeDialog, amount: Number(e.target.value) || 0 })
                  }
                />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Scholarship / Discount (ETB)
                <Input
                  type="number"
                  min="0"
                  value={feeDialog.discount}
                  onChange={(e) =>
                    setFeeDialog({ ...feeDialog, discount: Number(e.target.value) || 0 })
                  }
                />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Paid Amount (ETB)
                <Input
                  type="number"
                  min="0"
                  value={feeDialog.paidAmount}
                  onChange={(e) =>
                    setFeeDialog({ ...feeDialog, paidAmount: Number(e.target.value) || 0 })
                  }
                />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Due Date
                <Input
                  type="date"
                  value={feeDialog.dueDate}
                  onChange={(e) => setFeeDialog({ ...feeDialog, dueDate: e.target.value })}
                />
              </label>
              <label className="space-y-1 text-sm font-medium">
                Payment Method
                <select
                  value={feeDialog.paymentMethod}
                  onChange={(e) => setFeeDialog({ ...feeDialog, paymentMethod: e.target.value })}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option>Telebirr</option>
                  <option>Bank transfer (CBE)</option>
                  <option>CBE Birr</option>
                  <option>Cash / Office</option>
                </select>
              </label>
              <label className="space-y-1 text-sm font-medium">
                Remaining Balance
                <Input
                  disabled
                  value={formatETB(
                    computeFeeBalance(feeDialog.amount, feeDialog.discount, feeDialog.paidAmount),
                  )}
                />
              </label>
              <label className="space-y-1 text-sm font-medium sm:col-span-2">
                Notes
                <Textarea
                  rows={2}
                  value={feeDialog.notes}
                  onChange={(e) => setFeeDialog({ ...feeDialog, notes: e.target.value })}
                />
              </label>
              <DialogFooter className="sm:col-span-2">
                <Button type="button" variant="outline" onClick={() => setFeeDialog(null)}>
                  Cancel
                </Button>
                <Button type="submit" variant="emerald" disabled={mutating}>
                  Save Fee Plan
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ========================================================================== */
/* 4.2 INVOICES & RECEIPTS                                                    */
/* ========================================================================== */

export function InvoicesReceiptsModule({ data }: { data: OwnerDataHandle }) {
  const { db, workspace, maps, mutateWorkspace, setPrintable, can, mutating } = data;
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({
    studentId: db.profiles[0]?.id ?? "",
    courseId: db.courses[0]?.id ?? "",
    subtotal: "218",
    discount: "0",
    paidAmount: "218",
    status: "paid" as InvoiceRecord["status"],
    dueDate: new Date().toISOString().slice(0, 10),
    paymentMethod: "Telebirr",
    notes: "Ezana Pro Course Access",
  });

  const invoices = useMemo(
    () =>
      (workspace?.invoices ?? []).filter((inv) => {
        if (statusFilter !== "all" && inv.status !== statusFilter) return false;
        if (!search.trim()) return true;
        const student = maps.profilesById.get(inv.studentId);
        return `${inv.invoiceNumber} ${student ? displayName(student) : ""} ${inv.notes}`
          .toLowerCase()
          .includes(search.trim().toLowerCase());
      }),
    [workspace?.invoices, maps.profilesById, search, statusFilter],
  );

  function printInvoice(inv: InvoiceRecord) {
    const student = maps.profilesById.get(inv.studentId);
    const course = inv.courseId ? maps.coursesById.get(inv.courseId)?.title : "Academy Fee";
    setPrintable({
      title: `Invoice / Receipt ${inv.invoiceNumber}`,
      subtitle: `Issued to ${student ? displayName(student) : "Student"} (${student?.email ?? ""})`,
      meta: [
        { label: "Invoice Status", value: inv.status.toUpperCase() },
        { label: "Payment Method", value: inv.paymentMethod },
        { label: "Due Date", value: inv.dueDate },
      ],
      columns: ["Item", "Subtotal", "Discount", "Total", "Paid", "Balance"],
      rows: [
        [
          course ?? inv.notes,
          formatETB(inv.subtotal),
          formatETB(inv.discount),
          formatETB(inv.total),
          formatETB(inv.paidAmount),
          formatETB(Math.max(0, inv.total - inv.paidAmount)),
        ],
      ],
      footerNote: inv.notes || "Thank you for learning with Ezana Academy.",
    });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices & Receipts"
        description="Generate, search, track status, print, and download official academy invoices and payment receipts."
        actions={
          can("finance", "create") ? (
            <Button variant="emerald" size="sm" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> Generate Invoice
            </Button>
          ) : undefined
        }
      />

      <Panel>
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search invoice #, student, notes…"
              className="pl-9"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All Statuses</option>
            <option value="paid">Paid</option>
            <option value="issued">Issued</option>
            <option value="overdue">Overdue</option>
            <option value="void">Void</option>
          </select>
        </div>

        {invoices.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Invoice #</TableHead>
                <TableHead>Student & Item</TableHead>
                <TableHead>Total / Paid</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {invoices.map((inv) => {
                const student = maps.profilesById.get(inv.studentId);
                return (
                  <TableRow key={inv.id}>
                    <TableCell className="font-mono text-xs font-bold">
                      {inv.invoiceNumber}
                    </TableCell>
                    <TableCell>
                      <p className="font-semibold">{student ? displayName(student) : "Learner"}</p>
                      <p className="text-xs text-muted-foreground">
                        {inv.courseId ? maps.coursesById.get(inv.courseId)?.title : inv.notes}
                      </p>
                    </TableCell>
                    <TableCell className="text-xs tabular-nums">
                      <p className="font-semibold">{formatETB(inv.total)}</p>
                      <p className="text-muted-foreground">Paid: {formatETB(inv.paidAmount)}</p>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          inv.status === "paid"
                            ? "success"
                            : inv.status === "overdue"
                              ? "destructive"
                              : inv.status === "void"
                                ? "muted"
                                : "warning"
                        }
                        className="capitalize"
                      >
                        {inv.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => printInvoice(inv)}>
                          <Printer className="h-3.5 w-3.5" /> Print / PDF
                        </Button>
                        {can("finance", "edit") && inv.status !== "paid" && (
                          <Button
                            size="sm"
                            variant="emerald"
                            onClick={() =>
                              void mutateWorkspace(
                                { type: "update_invoice_status", id: inv.id, status: "paid" },
                                "Invoice marked paid",
                              )
                            }
                          >
                            Mark Paid
                          </Button>
                        )}
                        {can("finance", "delete") && (
                          <ConfirmButton
                            title={`Delete ${inv.invoiceNumber}?`}
                            confirmLabel="Delete"
                            onConfirm={() =>
                              void mutateWorkspace(
                                { type: "delete_invoice", id: inv.id },
                                "Invoice deleted",
                              )
                            }
                            trigger={
                              <Button size="sm" variant="ghost" className="text-destructive">
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            }
                          />
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        ) : (
          <EmptyState
            title="No invoices generated yet"
            text="Generate an invoice above or convert any fee schedule or approved payment into an official receipt."
            icon={Receipt}
          />
        )}
      </Panel>

      {/* Also allow one-click receipt generation from approved Supabase payments */}
      {db.payments.filter((p) => p.status === "approved").length > 0 && (
        <Panel title="Approved Payments Ready for Receipt Generation">
          <div className="grid gap-2 sm:grid-cols-2">
            {db.payments
              .filter((p) => p.status === "approved")
              .slice(0, 6)
              .map((p) => (
                <div
                  key={p.id}
                  className="flex items-center justify-between gap-2 rounded-xl border border-border p-3 text-xs"
                >
                  <div>
                    <p className="font-semibold">
                      {maps.profilesById.get(p.user_id)
                        ? displayName(maps.profilesById.get(p.user_id)!)
                        : "Learner"}{" "}
                      · {formatETB(Number(p.amount))}
                    </p>
                    <p className="font-mono text-muted-foreground">
                      {p.reference} ({p.method})
                    </p>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() =>
                      void mutateWorkspace(
                        {
                          type: "generate_invoice",
                          payload: {
                            studentId: p.user_id,
                            courseId: p.course_id,
                            feePlanId: null,
                            paymentId: p.id,
                            subtotal: Number(p.amount),
                            discount: 0,
                            total: Number(p.amount),
                            paidAmount: Number(p.amount),
                            status: "paid",
                            dueDate: p.created_at.slice(0, 10),
                            paymentMethod: p.method,
                            notes: `Ref: ${p.reference}`,
                          },
                        },
                        "Official receipt created",
                      )
                    }
                  >
                    Create Receipt
                  </Button>
                </div>
              ))}
          </div>
        </Panel>
      )}

      {/* Create Invoice Modal */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generate Invoice</DialogTitle>
          </DialogHeader>
          <form
            className="grid gap-3 sm:grid-cols-2"
            onSubmit={(e) => {
              e.preventDefault();
              const sub = Number(form.subtotal) || 0;
              const disc = Number(form.discount) || 0;
              const total = Math.max(0, sub - disc);
              void mutateWorkspace(
                {
                  type: "generate_invoice",
                  payload: {
                    studentId: form.studentId,
                    courseId: form.courseId || null,
                    feePlanId: null,
                    paymentId: null,
                    subtotal: sub,
                    discount: disc,
                    total,
                    paidAmount: Number(form.paidAmount) || 0,
                    status: form.status,
                    dueDate: form.dueDate,
                    paymentMethod: form.paymentMethod,
                    notes: form.notes,
                  },
                },
                "Invoice generated",
              ).then(() => setCreateOpen(false));
            }}
          >
            <label className="space-y-1 text-sm font-medium">
              Student
              <select
                required
                value={form.studentId}
                onChange={(e) => setForm((f) => ({ ...f, studentId: e.target.value }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                {db.profiles.map((p) => (
                  <option key={p.id} value={p.id}>
                    {displayName(p)}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Course
              <select
                value={form.courseId}
                onChange={(e) => setForm((f) => ({ ...f, courseId: e.target.value }))}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">General</option>
                {db.courses.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Subtotal (ETB)
              <Input
                type="number"
                value={form.subtotal}
                onChange={(e) => setForm((f) => ({ ...f, subtotal: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Discount (ETB)
              <Input
                type="number"
                value={form.discount}
                onChange={(e) => setForm((f) => ({ ...f, discount: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Paid Amount (ETB)
              <Input
                type="number"
                value={form.paidAmount}
                onChange={(e) => setForm((f) => ({ ...f, paidAmount: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Status
              <select
                value={form.status}
                onChange={(e) =>
                  setForm((f) => ({ ...f, status: e.target.value as InvoiceRecord["status"] }))
                }
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="paid">Paid</option>
                <option value="issued">Issued</option>
                <option value="overdue">Overdue</option>
              </select>
            </label>
            <label className="space-y-1 text-sm font-medium">
              Due Date
              <Input
                type="date"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium">
              Payment Method
              <Input
                value={form.paymentMethod}
                onChange={(e) => setForm((f) => ({ ...f, paymentMethod: e.target.value }))}
              />
            </label>
            <label className="space-y-1 text-sm font-medium sm:col-span-2">
              Notes
              <Input
                value={form.notes}
                onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              />
            </label>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" variant="emerald" disabled={mutating}>
                Issue Invoice
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}

/* ========================================================================== */
/* 4.3 REVENUE & TRANSACTIONS                                                 */
/* ========================================================================== */

export function TransactionsLedgerModule({ data }: { data: OwnerDataHandle }) {
  const { db, workspace, maps, mutateWorkspace, can } = data;
  const [statusFilter, setStatusFilter] = useState("all");
  const [methodFilter, setMethodFilter] = useState("all");

  const ledger = useMemo(() => {
    return db.payments.map((p) => {
      const adj = workspace?.transactionAdjustments[p.id];
      const txStatus = adj?.refunded
        ? "refunded"
        : p.status === "approved"
          ? "successful"
          : p.status === "rejected"
            ? "failed"
            : "pending";
      return {
        ...p,
        txStatus,
        refundReason: adj?.refundReason ?? "",
        studentName: maps.profilesById.get(p.user_id)
          ? displayName(maps.profilesById.get(p.user_id)!)
          : "Learner",
        courseTitle: maps.coursesById.get(p.course_id)?.title ?? "Course",
      };
    });
  }, [db.payments, workspace?.transactionAdjustments, maps]);

  const methods = useMemo(() => [...new Set(ledger.map((l) => l.method))], [ledger]);

  const filtered = useMemo(
    () =>
      ledger.filter((t) => {
        if (statusFilter !== "all" && t.txStatus !== statusFilter) return false;
        if (methodFilter !== "all" && t.method !== methodFilter) return false;
        return true;
      }),
    [ledger, statusFilter, methodFilter],
  );

  const totals = useMemo(() => {
    let successful = 0;
    let pending = 0;
    let failed = 0;
    let refunded = 0;
    for (const t of ledger) {
      const amt = Number(t.amount || 0);
      if (t.txStatus === "successful") successful += amt;
      else if (t.txStatus === "pending") pending += amt;
      else if (t.txStatus === "failed") failed += amt;
      else if (t.txStatus === "refunded") refunded += amt;
    }
    return { successful, pending, failed, refunded };
  }, [ledger]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Revenue & Transactions"
        description="Monitor academy income and track successful, pending, failed, and refunded transactions."
      />

      <div className="grid gap-4 sm:grid-cols-4">
        <StatCard
          label="Successful Income"
          value={formatETB(totals.successful)}
          icon={CreditCard}
          index={0}
        />
        <StatCard
          label="Pending Clearing"
          value={formatETB(totals.pending)}
          icon={Wallet}
          tone="gold"
          index={1}
        />
        <StatCard
          label="Failed / Declined"
          value={formatETB(totals.failed)}
          icon={CreditCard}
          tone="deep"
          index={2}
        />
        <StatCard
          label="Refunded"
          value={formatETB(totals.refunded)}
          icon={RotateCcw}
          tone="plain"
          index={3}
        />
      </div>

      <Panel>
        <div className="mb-4 flex flex-wrap gap-3">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All Outcomes</option>
            <option value="successful">Successful</option>
            <option value="pending">Pending</option>
            <option value="failed">Failed</option>
            <option value="refunded">Refunded</option>
          </select>
          <select
            value={methodFilter}
            onChange={(e) => setMethodFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All Methods</option>
            {methods.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>
        </div>

        {filtered.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Reference & Date</TableHead>
                <TableHead>Student & Course</TableHead>
                <TableHead>Method</TableHead>
                <TableHead>Amount</TableHead>
                <TableHead>State</TableHead>
                <TableHead className="text-right">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((t) => (
                <TableRow key={t.id}>
                  <TableCell>
                    <p className="font-mono text-xs font-bold">{t.reference}</p>
                    <p className="text-xs text-muted-foreground tabular-nums">
                      {t.created_at.slice(0, 10)}
                    </p>
                  </TableCell>
                  <TableCell>
                    <p className="font-semibold">{t.studentName}</p>
                    <p className="text-xs text-muted-foreground">{t.courseTitle}</p>
                  </TableCell>
                  <TableCell className="text-xs">{t.method}</TableCell>
                  <TableCell className="font-semibold tabular-nums">
                    {formatETB(Number(t.amount))}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        t.txStatus === "successful"
                          ? "success"
                          : t.txStatus === "pending"
                            ? "warning"
                            : t.txStatus === "refunded"
                              ? "gold"
                              : "destructive"
                      }
                      className="capitalize"
                    >
                      {t.txStatus}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    {can("finance", "edit") && t.status === "approved" && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          void mutateWorkspace(
                            {
                              type: "update_transaction_refund",
                              paymentId: t.id,
                              refunded: t.txStatus !== "refunded",
                              refundReason:
                                t.txStatus === "refunded" ? "" : "Owner refund adjustment",
                            },
                            t.txStatus === "refunded"
                              ? "Refund cleared"
                              : "Transaction marked refunded",
                          )
                        }
                      >
                        <RotateCcw className="h-3.5 w-3.5" />
                        {t.txStatus === "refunded" ? "Revert Refund" : "Mark Refunded"}
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <EmptyState title="No transactions match" icon={CreditCard} />
        )}
      </Panel>
    </div>
  );
}

/* ========================================================================== */
/* 4.4 FINANCIAL REPORTS                                                      */
/* ========================================================================== */

export function FinancialReportsModule({ data }: { data: OwnerDataHandle }) {
  const { db, workspace, maps, setPrintable, can } = data;
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");

  const filteredPayments = useMemo(
    () =>
      db.payments.filter((p) => {
        const d = p.created_at.slice(0, 10);
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
        if (categoryFilter !== "all") {
          const course = maps.coursesById.get(p.course_id);
          if (course?.category_id !== categoryFilter) return false;
        }
        return true;
      }),
    [db.payments, dateFrom, dateTo, categoryFilter, maps.coursesById],
  );

  const metrics = useMemo(() => {
    let income = 0;
    let pending = 0;
    let refunded = 0;
    for (const p of filteredPayments) {
      const amt = Number(p.amount || 0);
      const isRefunded = workspace?.transactionAdjustments[p.id]?.refunded;
      if (isRefunded) refunded += amt;
      else if (p.status === "approved") income += amt;
      else if (p.status === "pending") pending += amt;
    }
    const feeSummary = summarizeFees(workspace?.feePlans ?? []);
    return {
      totalIncome: income + feeSummary.collected,
      outstanding: pending + feeSummary.outstanding,
      refunded,
    };
  }, [filteredPayments, workspace]);

  const byMethodChart = useMemo(() => {
    const map = new Map<string, { method: string; approved: number; pending: number }>();
    for (const p of filteredPayments) {
      const cur = map.get(p.method) ?? { method: p.method, approved: 0, pending: 0 };
      if (p.status === "approved") cur.approved += Number(p.amount || 0);
      else if (p.status === "pending") cur.pending += Number(p.amount || 0);
      map.set(p.method, cur);
    }
    return [...map.values()];
  }, [filteredPayments]);

  const exportRows = filteredPayments.map((p) => ({
    Date: p.created_at.slice(0, 10),
    Reference: p.reference,
    Student: maps.profilesById.get(p.user_id)
      ? displayName(maps.profilesById.get(p.user_id)!)
      : "Learner",
    Course: maps.coursesById.get(p.course_id)?.title ?? "Course",
    Method: p.method,
    Amount: Number(p.amount || 0),
    Status: workspace?.transactionAdjustments[p.id]?.refunded ? "refunded" : p.status,
  }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Financial Reports"
        description="Analyze revenue, paid vs outstanding balances, refunds, and export PDF or Excel financial statements."
        actions={
          can("finance", "export") ? (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  downloadCsv("ezana-financial-report.csv", exportRows);
                  toast.success("CSV financial statement downloaded");
                }}
              >
                <ArrowDownToLine className="h-4 w-4" /> CSV
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  downloadExcelXls(
                    "ezana-financial-report.xls",
                    "Financials",
                    exportRows,
                    "Ezana Academy — Financial Report",
                  );
                  toast.success("Excel financial report downloaded");
                }}
              >
                <FileSpreadsheet className="h-4 w-4" /> Excel
              </Button>
              <Button
                size="sm"
                variant="emerald"
                onClick={() =>
                  setPrintable({
                    title: "Academy Financial Statement",
                    subtitle: `${exportRows.length} transactions included`,
                    meta: [
                      { label: "Total Income", value: formatETB(metrics.totalIncome) },
                      { label: "Outstanding Payments", value: formatETB(metrics.outstanding) },
                      { label: "Refunds", value: formatETB(metrics.refunded) },
                    ],
                    columns: [
                      "Date",
                      "Reference",
                      "Student",
                      "Course",
                      "Method",
                      "Amount (ETB)",
                      "Status",
                    ],
                    rows: exportRows.map((r) => [
                      r.Date,
                      r.Reference,
                      r.Student,
                      r.Course,
                      r.Method,
                      formatETB(r.Amount),
                      r.Status,
                    ]),
                    footerNote: "Prepared from live Ezana Academy ledger.",
                  })
                }
              >
                <Printer className="h-4 w-4" /> Export PDF
              </Button>
            </div>
          ) : undefined
        }
      />

      <Panel title="Date & Category Filters">
        <div className="grid gap-3 sm:grid-cols-3">
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
          <select
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="all">All Categories</option>
            {db.categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
      </Panel>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          label="Revenue / Income"
          value={formatETB(metrics.totalIncome)}
          icon={CircleDollarSign}
          index={0}
        />
        <StatCard
          label="Outstanding Payments"
          value={formatETB(metrics.outstanding)}
          icon={Wallet}
          tone="gold"
          index={1}
        />
        <StatCard
          label="Refunds"
          value={formatETB(metrics.refunded)}
          icon={RotateCcw}
          tone="deep"
          index={2}
        />
      </div>

      <Panel title="Revenue Breakdown by Payment Method">
        {byMethodChart.length > 0 ? (
          <div className="h-60 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={byMethodChart}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey="method" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar
                  dataKey="approved"
                  name="Approved Revenue (ETB)"
                  fill="#0f5132"
                  radius={[4, 4, 0, 0]}
                />
                <Bar dataKey="pending" name="Pending (ETB)" fill="#d97706" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <EmptyState title="No financial data matches these filters" />
        )}
      </Panel>
    </div>
  );
}
