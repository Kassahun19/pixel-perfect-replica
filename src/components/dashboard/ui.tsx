import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronDown, ChevronUp, Inbox, Loader2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-3xl font-semibold md:text-4xl">{title}</h1>
        {description && <p className="mt-1.5 text-muted-foreground">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function StatCard({
  label,
  value,
  icon: Icon,
  hint,
  tone = "emerald",
  index = 0,
}: {
  label: string;
  value: ReactNode;
  icon: LucideIcon;
  hint?: string;
  tone?: "emerald" | "gold" | "deep" | "plain";
  index?: number;
}) {
  const tones = {
    emerald: "bg-emerald-gradient text-primary-foreground",
    gold: "bg-gold-gradient text-gold-foreground",
    deep: "bg-deep text-deep-foreground",
    plain: "bg-card text-card-foreground border border-border",
  };
  return (
    <div
      className={cn("lift relative animate-fade-up overflow-hidden rounded-2xl p-5 shadow-soft", tones[tone])}
      style={{ animationDelay: `${index * 70}ms` }}
    >
      <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-current opacity-10" />
      <div className="flex items-start justify-between">
        <p className="text-sm font-semibold opacity-80">{label}</p>
        <Icon className="h-5 w-5 opacity-80" />
      </div>
      <p className="mt-3 font-display text-3xl font-semibold">{value}</p>
      {hint && <p className="mt-1 text-xs opacity-70">{hint}</p>}
    </div>
  );
}

export function Panel({ title, actions, children, className }: { title?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn("rounded-2xl border border-border bg-card p-5 shadow-soft md:p-6", className)}>
      {(title || actions) && (
        <div className="mb-4 flex items-center justify-between gap-3">
          {title && <h2 className="text-xl font-semibold">{title}</h2>}
          {actions}
        </div>
      )}
      {children}
    </section>
  );
}

export function EmptyState({ title, text, icon: Icon = Inbox, action }: { title: string; text?: string; icon?: LucideIcon; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center rounded-2xl border border-dashed border-border px-6 py-14 text-center">
      <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-secondary text-primary">
        <Icon className="h-7 w-7" />
      </span>
      <p className="mt-4 text-lg font-semibold">{title}</p>
      {text && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{text}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function LoadingBlock({ label = "Loading…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin" /> {label}
    </div>
  );
}

export function ErrorBlock({ error }: { error: unknown }) {
  return (
    <div className="rounded-2xl border border-destructive/40 bg-destructive/10 p-6 text-sm text-destructive">
      {error instanceof Error ? error.message : "Something went wrong."}
    </div>
  );
}

export function ConfirmButton({
  trigger,
  title,
  description,
  confirmLabel = "Confirm",
  onConfirm,
  destructive = true,
}: {
  trigger: ReactNode;
  title: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
  destructive?: boolean;
}) {
  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>{trigger}</AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && <AlertDialogDescription>{description}</AlertDialogDescription>}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={destructive ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

export function Pager({ page, pageCount, onPage }: { page: number; pageCount: number; onPage: (p: number) => void }) {
  if (pageCount <= 1) return null;
  return (
    <div className="mt-4 flex items-center justify-end gap-2 text-sm">
      <button className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40" disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <span className="text-muted-foreground">Page {page} of {pageCount}</span>
      <button className="rounded-lg border border-border px-3 py-1.5 disabled:opacity-40" disabled={page >= pageCount} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </div>
  );
}

export function SidebarMenuNav({
  ariaLabel,
  children,
  className,
}: {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
}) {
  const navRef = useRef<HTMLElement | null>(null);
  const [scrollState, setScrollState] = useState({ canUp: false, canDown: false });

  const syncScrollState = useCallback(() => {
    const el = navRef.current;
    if (!el) return;
    const canUp = el.scrollTop > 4;
    const canDown = el.scrollTop + el.clientHeight < el.scrollHeight - 4;
    setScrollState((prev) =>
      prev.canUp === canUp && prev.canDown === canDown ? prev : { canUp, canDown },
    );
  }, []);

  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    syncScrollState();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(syncScrollState) : null;
    ro?.observe(el);
    const mo =
      typeof MutationObserver !== "undefined" ? new MutationObserver(syncScrollState) : null;
    mo?.observe(el, { childList: true, subtree: true });
    window.addEventListener("resize", syncScrollState);
    return () => {
      ro?.disconnect();
      mo?.disconnect();
      window.removeEventListener("resize", syncScrollState);
    };
  }, [syncScrollState]);

  const scrollByStep = (delta: number) => {
    const el = navRef.current;
    if (!el) return;
    if (typeof el.scrollBy === "function") {
      el.scrollBy({ top: delta, behavior: "smooth" });
    } else {
      el.scrollTop += delta;
    }
    syncScrollState();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {scrollState.canUp && (
        <button
          type="button"
          onClick={() => scrollByStep(-180)}
          aria-label="Scroll sidebar menu up"
          className="mb-1 flex w-full shrink-0 items-center justify-center gap-1 rounded-lg border border-border/70 bg-secondary/60 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ChevronUp className="h-3.5 w-3.5" />
          <span>Scroll up</span>
        </button>
      )}

      <nav
        ref={navRef}
        aria-label={ariaLabel}
        onScroll={syncScrollState}
        className={cn(
          "sidebar-scrollbar min-h-0 flex-1 space-y-1.5 overflow-y-scroll overscroll-contain pr-1.5",
          className,
        )}
      >
        {children}
      </nav>

      {scrollState.canDown && (
        <button
          type="button"
          onClick={() => scrollByStep(180)}
          aria-label="Scroll sidebar menu down"
          className="mt-1 flex w-full shrink-0 items-center justify-center gap-1 rounded-lg border border-border/70 bg-secondary/60 py-1 text-[11px] font-semibold text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
        >
          <ChevronDown className="h-3.5 w-3.5" />
          <span>Scroll down</span>
        </button>
      )}
    </div>
  );
}

export const STATUS_BADGE: Record<string, "success" | "warning" | "destructive" | "muted" | "gold"> = {
  active: "success",
  approved: "success",
  published: "success",
  resolved: "success",
  pending: "warning",
  open: "warning",
  in_progress: "gold",
  draft: "muted",
  inactive: "muted",
  archived: "muted",
  rejected: "destructive",
  suspended: "destructive",
};
