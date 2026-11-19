/** Business rules for course access and pricing. */
export const FREE_LESSON_LIMIT = 5;
export const PRO_PRICE_ETB = 218;
export const CURRENCY = "ETB";

/** `index` is the zero-based position of a lesson inside its course, ordered by position. */
export function isFreeLesson(index: number): boolean {
  return index >= 0 && index < FREE_LESSON_LIMIT;
}

export function isLessonLocked(index: number, opts: { unlocked: boolean; signedIn: boolean }): boolean {
  if (!opts.signedIn) return true;
  if (opts.unlocked) return false;
  return !isFreeLesson(index);
}

export function formatETB(amount: number = PRO_PRICE_ETB): string {
  return `${CURRENCY} ${amount.toLocaleString("en-US", { maximumFractionDigits: 2 })}`;
}
