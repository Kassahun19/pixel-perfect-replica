import { describe, expect, it } from "vitest";
import { MAX_RECEIPT_BYTES, PAYMENT_ACCOUNTS, PAYMENT_METHODS, YEBUNA_PAY_URL, receiptPath, validateReceiptFile } from "@/lib/payment-info";

describe("payment receipts", () => {
  it("accepts a receipt of exactly 50MB", () => {
    expect(MAX_RECEIPT_BYTES).toBe(50 * 1024 * 1024);
    expect(validateReceiptFile({ size: 50 * 1024 * 1024, type: "image/jpeg" })).toBeNull();
  });

  it("rejects a receipt larger than 50MB", () => {
    expect(validateReceiptFile({ size: 50 * 1024 * 1024 + 1, type: "application/pdf" })).toMatch(/50MB/);
  });

  it("only accepts images and PDFs", () => {
    expect(validateReceiptFile({ size: 1000, type: "application/pdf" })).toBeNull();
    expect(validateReceiptFile({ size: 1000, type: "video/mp4" })).not.toBeNull();
  });

  it("stores receipts inside the uploader's own folder", () => {
    expect(receiptPath("user-123", "Receipt.PNG", 1).startsWith("user-123/1-")).toBe(true);
    expect(receiptPath("user-123", "Receipt.PNG", 1).endsWith(".png")).toBe(true);
  });
});

describe("payment accounts", () => {
  it("uses the owner's account numbers", () => {
    const byMethod = Object.fromEntries(PAYMENT_ACCOUNTS.map((a) => [a.method, a.number]));
    expect(byMethod["CBE"]).toBe("1000183217198");
    expect(byMethod["Bank of Abyssinia (BOA)"]).toBe("32419186");
    expect(byMethod["Bunna Bank"]).toBe("3609501002452");
    expect(byMethod["Telebirr"]).toBe("0915508167");
    expect(byMethod["Bybit"]).toBe("TC5oVhZsMjMXpbjBAjibF3HS8jggaqX5Ps");
  });

  it("offers Ye-Buna online payment", () => {
    expect(YEBUNA_PAY_URL).toBe("https://ye-buna.com/kassahunmulatu?ref=product_detail&product=6af9e5352ee4a_kassahunmulatu");
    expect(PAYMENT_METHODS[0]).toBe("Ye-Buna (online)");
  });
});
