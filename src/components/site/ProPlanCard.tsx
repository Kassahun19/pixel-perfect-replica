import { Check, Crown } from "lucide-react";
import { formatETB } from "@/lib/access";
import type { ReactNode } from "react";

export const PRO_BENEFITS = [
  "Every tutorial video in the course, unlocked",
  "Lifetime access with no monthly fees",
  "Track your progress lesson by lesson",
  "Learn on phone, tablet or computer",
  "Course completion record on your dashboard",
  "Priority support from our team",
];

export function ProPlanCard({ children }: { children?: ReactNode }) {
  return (
    <div className="relative overflow-hidden rounded-[2rem] bg-deep p-1 shadow-elegant">
      <div className="absolute inset-0 bg-gold-gradient opacity-60" />
      <div className="relative rounded-[1.8rem] bg-deep p-8 text-deep-foreground md:p-10">
        <div className="shimmer-gold pointer-events-none absolute inset-0 rounded-[1.8rem] opacity-20" />
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-2 rounded-full bg-gold px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-gold-foreground">
            <Crown className="h-4 w-4" /> Ezana Pro
          </span>
          <span className="text-xs uppercase tracking-widest text-deep-muted">Per course</span>
        </div>
        <p className="mt-8 font-display text-6xl font-semibold text-gold">{formatETB()}</p>
        <p className="mt-1 text-sm text-deep-muted">One-time payment. Full course, forever.</p>
        <ul className="mt-8 space-y-3">
          {PRO_BENEFITS.map((b) => (
            <li key={b} className="flex items-start gap-3 text-sm">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-gold/20 text-gold">
                <Check className="h-3.5 w-3.5" />
              </span>
              {b}
            </li>
          ))}
        </ul>
        {children && <div className="mt-8">{children}</div>}
      </div>
    </div>
  );
}
