/** Where Ezana Pro payments go, and the rules for payment receipts. */
export const YEBUNA_PAY_URL =
  "https://ye-buna.com/kassahunmulatu?ref=product_detail&product=6af9e5352ee4a_kassahunmulatu";

export const ACCOUNT_HOLDER = "Kassahun Mulatu Kebede";

export type PaymentAccount = { method: string; label: string; number: string };

export const PAYMENT_ACCOUNTS: PaymentAccount[] = [
  { method: "CBE", label: "Commercial Bank of Ethiopia (CBE)", number: "1000183217198" },
  { method: "Bank of Abyssinia (BOA)", label: "Bank of Abyssinia (BOA)", number: "32419186" },
  { method: "Bunna Bank", label: "Bunna Bank", number: "3609501002452" },
  { method: "Telebirr", label: "Telebirr", number: "0915508167" },
  { method: "Bybit", label: "Bybit address", number: "TC5oVhZsMjMXpbjBAjibF3HS8jggaqX5Ps" },
];

export const ONLINE_METHOD = "Ye-Buna (online)";

export const PAYMENT_METHODS: string[] = [ONLINE_METHOD, ...PAYMENT_ACCOUNTS.map((a) => a.method)];

export const RECEIPT_BUCKET = "payment-receipts";
export const MAX_RECEIPT_MB = 50;
export const MAX_RECEIPT_BYTES = MAX_RECEIPT_MB * 1024 * 1024;
export const RECEIPT_ACCEPT = "image/*,application/pdf";

/** Returns an error message, or null when the file can be uploaded. */
export function validateReceiptFile(file: { size: number; type: string }): string | null {
  if (file.size <= 0) return "The receipt file is empty.";
  if (file.size > MAX_RECEIPT_BYTES) return `The receipt must be ${MAX_RECEIPT_MB}MB or smaller.`;
  const okType = file.type.startsWith("image/") || file.type === "application/pdf";
  if (!okType) return "Upload a photo/screenshot or a PDF of your receipt.";
  return null;
}

/** Storage path for a receipt: always inside the uploader's own folder. */
export function receiptPath(uploaderId: string, fileName: string, now: number = Date.now()): string {
  const ext = (fileName.split(".").pop() ?? "").toLowerCase().replace(/[^a-z0-9]/g, "").slice(0, 8);
  const rand = Math.random().toString(36).slice(2, 8);
  return `${uploaderId}/${now}-${rand}${ext ? `.${ext}` : ""}`;
}
