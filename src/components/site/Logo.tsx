import { Link } from "@tanstack/react-router";
import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={cn("h-9 w-9", className)} aria-hidden>
      <rect width="40" height="40" rx="11" className="fill-primary" />
      <path d="M16 33V12.5L20 7l4 5.5V33z" className="fill-gold" />
      <path d="M17.5 16h5M17.5 20h5M17.5 24h5M17.5 28h5" className="stroke-primary" strokeWidth="1.4" />
      <path d="M11 33h18" className="stroke-gold" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Logo({ light = false, className }: { light?: boolean; className?: string }) {
  return (
    <Link to="/" className={cn("group flex items-center gap-2.5", className)} aria-label="Ezana Academy home">
      <LogoMark className="transition-transform duration-500 group-hover:rotate-6" />
      <span className="leading-none">
        <span className={cn("block font-display text-xl font-semibold", light ? "text-deep-foreground" : "text-foreground")}>
          Ezana
        </span>
        <span className={cn("block text-[10px] font-semibold uppercase tracking-[0.28em]", light ? "text-gold" : "text-primary")}>
          Academy
        </span>
      </span>
    </Link>
  );
}
