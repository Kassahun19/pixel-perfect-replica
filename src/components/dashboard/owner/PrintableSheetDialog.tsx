import { Printer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import type { PrintableReportPayload } from "./useOwnerData";

export function PrintableSheetDialog({
  payload,
  academyName = "Ezana Academy",
  onClose,
}: {
  payload: PrintableReportPayload | null;
  academyName?: string;
  onClose: () => void;
}) {
  return (
    <Dialog open={!!payload} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto print:max-h-none print:max-w-none print:border-0 print:shadow-none">
        <DialogHeader className="print:hidden">
          <div className="flex items-center justify-between gap-3 pr-6">
            <DialogTitle>{payload?.title ?? "Printable Document"}</DialogTitle>
            <div className="flex items-center gap-2">
              <Button type="button" variant="emerald" size="sm" onClick={() => window.print()}>
                <Printer className="h-4 w-4" /> Print / Save as PDF
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={onClose}>
                <X className="h-4 w-4" /> Close
              </Button>
            </div>
          </div>
        </DialogHeader>

        {payload && (
          <div className="rounded-xl border border-border bg-white p-6 text-slate-900 print:border-0 print:p-0">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-700">
                  {academyName}
                </p>
                <h2 className="mt-1 font-display text-2xl font-semibold text-slate-900">
                  {payload.title}
                </h2>
                <p className="mt-1 text-sm text-slate-600">{payload.subtitle}</p>
              </div>
              <div className="text-right text-xs text-slate-500">
                <p>Generated</p>
                <p className="font-mono font-medium text-slate-800">
                  {new Date().toLocaleString("en-US", {
                    month: "short",
                    day: "numeric",
                    year: "numeric",
                    hour: "numeric",
                    minute: "2-digit",
                  })}
                </p>
              </div>
            </div>

            {payload.meta && payload.meta.length > 0 && (
              <div className="mt-4 grid gap-3 rounded-lg bg-slate-50 p-4 sm:grid-cols-3">
                {payload.meta.map((item) => (
                  <div key={item.label}>
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                      {item.label}
                    </p>
                    <p className="mt-0.5 text-sm font-semibold text-slate-900 tabular-nums">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 overflow-x-auto">
              <table className="w-full border-collapse text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b-2 border-emerald-700 bg-slate-50">
                    {payload.columns.map((col) => (
                      <th key={col} className="px-3 py-2.5 font-semibold text-slate-800">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {payload.rows.map((row, idx) => (
                    <tr key={idx}>
                      {row.map((cell, cIdx) => (
                        <td key={cIdx} className="px-3 py-2 text-slate-700 tabular-nums">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {payload.rows.length === 0 && (
                    <tr>
                      <td
                        colSpan={payload.columns.length}
                        className="px-3 py-8 text-center text-slate-500"
                      >
                        No records included in this report.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {payload.footerNote && (
              <p className="mt-6 border-t border-slate-200 pt-3 text-xs text-slate-500">
                {payload.footerNote}
              </p>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
