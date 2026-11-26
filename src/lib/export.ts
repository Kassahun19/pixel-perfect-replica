export { downloadCsv, logAudit } from "./csv";

function escapeHtml(value: unknown): string {
  const s =
    value === null || value === undefined
      ? ""
      : typeof value === "object"
        ? JSON.stringify(value)
        : String(value);
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Downloads rows as an Excel-compatible Spreadsheet (.xls) using UTF-8 HTML workbook markup,
 * which opens cleanly in Microsoft Excel, LibreOffice Calc, and Google Sheets.
 */
export function downloadExcelXls(
  filename: string,
  sheetName: string,
  rows: Record<string, unknown>[],
  title?: string,
) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]!);
  const headerHtml = headers
    .map(
      (h) =>
        `<th style="background:#0f5132;color:#ffffff;font-weight:bold;padding:8px;border:1px solid #d1d5db;text-align:left;">${escapeHtml(h)}</th>`,
    )
    .join("");
  const bodyHtml = rows
    .map(
      (row, idx) =>
        `<tr style="background:${idx % 2 === 0 ? "#ffffff" : "#f8fafc"};">${headers
          .map(
            (h) =>
              `<td style="padding:6px 8px;border:1px solid #e5e7eb;vertical-align:top;">${escapeHtml(row[h])}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");

  const html = `<!DOCTYPE html>
<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head>
  <meta charset="utf-8" />
  <!--[if gte mso 9]><xml><x:ExcelWorkbook><x:ExcelWorksheets><x:ExcelWorksheet><x:Name>${escapeHtml(sheetName)}</x:Name><x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet></x:ExcelWorksheets></x:ExcelWorkbook></xml><![endif]-->
</head>
<body>
  ${title ? `<h2>${escapeHtml(title)}</h2>` : ""}
  <table><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>
</body>
</html>`;

  const blob = new Blob(["\uFEFF" + html], {
    type: "application/vnd.ms-excel;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename.endsWith(".xls") ? filename : `${filename}.xls`;
  a.click();
  URL.revokeObjectURL(url);
}
