/** Downloads rows as a CSV file that opens in Excel. */
export function downloadCsv(filename: string, rows: Record<string, unknown>[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]!);
  const esc = (v: unknown) => {
    const s = v === null || v === undefined ? "" : typeof v === "object" ? JSON.stringify(v) : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".csv") ? filename : `${filename}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function logAudit(action: string, entity: string, entityId?: string, details: Record<string, unknown> = {}) {
  const { supabase } = await import("@/integrations/supabase/client");
  const { data } = await supabase.auth.getUser();
  if (!data.user) return;
  await supabase.from("audit_logs").insert({
    actor_id: data.user.id,
    action,
    entity,
    entity_id: entityId ?? null,
    details: details as never,
  });
}
