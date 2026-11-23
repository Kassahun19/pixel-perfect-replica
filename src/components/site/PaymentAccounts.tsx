import { useState } from "react";
import { Check, Copy, ExternalLink, Globe } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { ACCOUNT_HOLDER, PAYMENT_ACCOUNTS, YEBUNA_PAY_URL } from "@/lib/payment-info";
import { formatETB } from "@/lib/access";

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      aria-label={`Copy ${label}`}
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(value);
          setCopied(true);
          toast.success(`${label} copied`);
          setTimeout(() => setCopied(false), 1500);
        } catch {
          toast.error("Couldn't copy. Please select the number and copy it.");
        }
      }}
      className="inline-flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:border-primary hover:text-primary"
    >
      {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4" />}
    </button>
  );
}

export function PayOnlineButton({ className }: { className?: string }) {
  return (
    <Button asChild variant="hero" size="lg" className={className}>
      <a href={YEBUNA_PAY_URL} target="_blank" rel="noopener noreferrer">
        <Globe /> Pay online with Ye-Buna <ExternalLink className="h-4 w-4" />
      </a>
    </Button>
  );
}

export function PaymentAccounts() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-gold/40 bg-gold-soft/60 p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-gold-foreground">Option 1 · Pay online</p>
        <p className="mt-1 text-sm text-gold-foreground">
          Pay {formatETB()} securely on Ye-Buna, then come back and submit your reference and receipt below.
        </p>
        <PayOnlineButton className="mt-4 w-full" />
      </div>

      <div className="rounded-2xl border border-border bg-secondary/40 p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Option 2 · Bank, Telebirr or Bybit</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Send {formatETB()} to any account below. Account holder: <span className="font-semibold text-foreground">{ACCOUNT_HOLDER}</span>
        </p>
        <ul className="mt-4 divide-y divide-border overflow-hidden rounded-xl border border-border bg-card">
          {PAYMENT_ACCOUNTS.map((a) => (
            <li key={a.method} className="flex items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-muted-foreground">{a.label}</p>
                <p className="break-all font-mono text-sm font-bold text-foreground">{a.number}</p>
              </div>
              <CopyButton value={a.number} label={a.label} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
