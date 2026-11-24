import { describe, expect, it } from "vitest";
import { emailRule, normalizeEmail } from "@/lib/validation";

describe("email validation", () => {
  it("accepts normal Gmail addresses", () => {
    expect(emailRule.safeParse("name@gmail.com").success).toBe(true);
  });

  it("accepts Gmail addresses with dots, plus, digits, underscores, hyphens and capitals", () => {
    const r = emailRule.safeParse("First.Last+test_1@Gmail.com");
    expect(r.success && r.data).toBe("first.last+test_1@gmail.com");
    expect(emailRule.safeParse("abebe-kebede99@gmail.com").success).toBe(true);
  });

  it("removes spaces and invisible characters people paste in", () => {
    expect(normalizeEmail(" na\u200Bme@\u00A0gmail.com\n\uFEFF")).toBe("name@gmail.com");
  });

  it("converts full-width and Ethiopic lookalikes of @ and .", () => {
    expect(normalizeEmail("name＠gmail．com")).toBe("name@gmail.com");
    expect(normalizeEmail("name@gmail።com")).toBe("name@gmail.com");
  });

  it("strips a trailing dot or comma added by mobile keyboards", () => {
    expect(normalizeEmail("name@gmail.com.")).toBe("name@gmail.com");
    expect(normalizeEmail("name@gmail.com,")).toBe("name@gmail.com");
  });

  it("still rejects things that are not emails", () => {
    expect(emailRule.safeParse("name@gmail").success).toBe(false);
    expect(emailRule.safeParse("namegmail.com").success).toBe(false);
    expect(emailRule.safeParse("").success).toBe(false);
  });
});
