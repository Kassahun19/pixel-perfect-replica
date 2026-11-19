import type { ReactNode } from "react";
import { SiteHeader } from "./SiteHeader";
import { SiteFooter } from "./SiteFooter";

export function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  );
}

export function PageHero({ eyebrow, title, subtitle }: { eyebrow: string; title: ReactNode; subtitle?: string }) {
  return (
    <section className="relative overflow-hidden bg-hero text-deep-foreground">
      <div className="pattern-dots absolute inset-0 opacity-50" />
      <div className="absolute -right-24 -top-24 h-80 w-80 rounded-full bg-gold/20 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-4 py-20 sm:px-6 md:py-28">
        <p className="animate-fade-up text-xs font-bold uppercase tracking-[0.3em] text-gold">{eyebrow}</p>
        <h1 className="mt-4 max-w-3xl animate-fade-up text-4xl font-semibold leading-tight [animation-delay:100ms] md:text-6xl">
          {title}
        </h1>
        {subtitle && (
          <p className="mt-5 max-w-2xl animate-fade-up text-lg text-deep-muted [animation-delay:200ms]">{subtitle}</p>
        )}
      </div>
      <div className="pattern-tibeb h-1.5 w-full opacity-70" />
    </section>
  );
}
