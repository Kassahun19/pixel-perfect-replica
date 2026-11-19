import type { ReactNode } from "react";
import { Logo } from "./Logo";
import hero from "@/assets/ezana-hero.jpg.asset.json";

export function AuthShell({ title, subtitle, children }: { title: string; subtitle: string; children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-hero lg:block">
        <img src={hero.url} alt="" className="absolute inset-0 h-full w-full object-cover opacity-40 mix-blend-luminosity" />
        <div className="pattern-dots absolute inset-0 opacity-40" />
        <div className="relative flex h-full flex-col justify-between p-12 text-deep-foreground">
          <Logo light />
          <div>
            <p className="font-display text-5xl font-semibold leading-tight">
              "Knowledge is the light <span className="text-gold-gradient italic">that never fades.</span>"
            </p>
            <p className="mt-4 text-deep-muted">Join thousands of learners growing with Ezana Academy.</p>
          </div>
          <div className="pattern-tibeb h-1.5 w-40 rounded-full" />
        </div>
      </div>
      <div className="flex items-center justify-center px-4 py-12 sm:px-8">
        <div className="w-full max-w-md animate-fade-up">
          <div className="lg:hidden"><Logo /></div>
          <h1 className="mt-8 text-4xl font-semibold lg:mt-0">{title}</h1>
          <p className="mt-2 text-muted-foreground">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
    </div>
  );
}
