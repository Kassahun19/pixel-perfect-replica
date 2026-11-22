import { z } from "zod";

export const passwordRule = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Za-z]/, "Password must include a letter")
  .regex(/[0-9]/, "Password must include a number");

// Whitespace (incl. non-breaking space, newlines) plus invisible characters:
// soft hyphen, zero-width space/non-joiner/joiner, word joiner, BOM.
const INVISIBLE = /[\s\u00A0\u00AD\u200B-\u200D\u2060\uFEFF]/g;
// Full-width / small-form / Ethiopic-keyboard lookalikes.
const AT_LOOKALIKES = /[\uFF20\uFE6B]/g; // ＠ ﹫
const DOT_LOOKALIKES = /[\uFF0E\u3002\uFF61\u1362]/g; // ． 。 ｡ ።

/** Cleans what people type or paste into an email field before validating it. */
export function normalizeEmail(value: string): string {
  return value
    .replace(INVISIBLE, "")
    .replace(AT_LOOKALIKES, "@")
    .replace(DOT_LOOKALIKES, ".")
    .replace(/[.,]+$/, "")
    .toLowerCase();
}

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const emailRule = z.preprocess(
  (v) => (typeof v === "string" ? normalizeEmail(v) : v),
  z
    .string()
    .min(1, "Enter your email")
    .max(255, "Email must be less than 255 characters")
    .regex(EMAIL_PATTERN, "Enter a valid email"),
);
