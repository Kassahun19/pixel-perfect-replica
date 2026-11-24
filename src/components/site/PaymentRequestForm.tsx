import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { ArrowUpRight, Check, CreditCard, ExternalLink, Landmark, Loader2, Send, Smartphone, Upload, WalletCards } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { coursesQuery } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { PRO_PRICE_ETB, formatETB } from "@/lib/access";

export const ONLINE_PAYMENT_URL = "https://ye-buna.com/kassahunmulatu?ref=product_detail&product=6af9e5352ee4a_kassahunmulatu";
export const PAYMENT_METHODS = ["Telebirr", "CBE", "Bank of Abyssinia", "Bunna Bank", "BYBIT"];
const RECEIPT_BUCKET = "payment-receipts";
const MAX_RECEIPT_BYTES = 50 * 1024 * 1024;
const RECEIPT_NOTE_PREFIX = "[receipt-path]";

const schema = z.object({
  course_id: z.string().uuid("Choose a course"),
  method: z.string().min(1, "Choose a payment method"),
  reference: z.string().trim().min(4, "Enter your transaction reference").max(100),
  note: z.string().trim().max(500).optional(),
});

export function myPaymentsQueryKey(userId: string | undefined) {
  return ["payments", "mine", userId];
}

export function PaymentRequestForm({ defaultCourseSlug, studentId, onDone }: { defaultCourseSlug?: string | undefined; studentId?: string | undefined; onDone?: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: courses = [] } = useQuery(coursesQuery);
  const initial = courses.find((c) => c.slug === defaultCourseSlug)?.id ?? "";
  const [courseId, setCourseId] = useState<string>(initial);
  const [paymentOption, setPaymentOption] = useState<"manual" | "online">("manual");
  const [manualMethod, setManualMethod] = useState("Telebirr");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [receipt, setReceipt] = useState<File | null>(null);
  const receiptInput = useRef<HTMLInputElement>(null);
  const selected = courseId || initial;

  const m = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({ course_id: selected, method: paymentOption === "online" ? "Online (Ye Buna)" : manualMethod, reference, note: note || undefined });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
      if (!receipt) throw new Error("Upload your payment receipt");
      if (receipt.size > MAX_RECEIPT_BYTES) throw new Error("Receipt must be 50 MB or smaller");
      if (!/^(image\/(jpeg|png|webp)|application\/pdf)$/.test(receipt.type)) throw new Error("Upload a JPG, PNG, WebP, or PDF receipt");
      if (!user) throw new Error("Log in to submit a payment");

      const safeName = receipt.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const receiptPath = `${user.id}/${crypto.randomUUID()}-${safeName}`;
      const { error: uploadError } = await supabase.storage.from(RECEIPT_BUCKET).upload(receiptPath, receipt, {
        cacheControl: "3600", contentType: receipt.type, upsert: false,
      });
      if (uploadError) throw new Error(`Receipt upload failed: ${uploadError.message}`);

      const { error } = await supabase.from("payments").insert({
        user_id: studentId ?? user!.id,
        course_id: parsed.data.course_id,
        method: parsed.data.method,
        reference: parsed.data.reference,
        note: `${RECEIPT_NOTE_PREFIX}${receiptPath}${parsed.data.note ? `\n${parsed.data.note}` : ""}`,
        amount: PRO_PRICE_ETB,
      });
      if (error) {
        await supabase.storage.from(RECEIPT_BUCKET).remove([receiptPath]);
        if (error.code === "23505") throw new Error("You already have a pending or approved payment for this course.");
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      toast.success("Payment submitted! We'll unlock the course once it's confirmed.");
      setReference("");
      setNote("");
      setReceipt(null);
      if (receiptInput.current) receiptInput.current.value = "";
      qc.invalidateQueries({ queryKey: ["payments"] });
      onDone?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate();
      }}
      className="space-y-4"
    >
      <section className="space-y-3" aria-labelledby="payment-options-title">
        <div className="flex items-end justify-between gap-3">
          <div><p className="text-xs font-bold uppercase tracking-[0.18em] text-primary">Secure checkout</p><h3 id="payment-options-title" className="mt-1 text-lg font-semibold">Choose how to pay</h3></div>
          <span className="rounded-full bg-gold-soft px-3 py-1 text-xs font-bold text-gold-foreground">{formatETB()} once</span>
        </div>

        <button type="button" aria-pressed={paymentOption === "manual"} onClick={() => setPaymentOption("manual")} className={`group relative w-full overflow-hidden rounded-2xl border p-4 text-left shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-elegant motion-reduce:transform-none motion-reduce:transition-none ${paymentOption === "manual" ? "border-primary bg-emerald-50/80 ring-2 ring-primary/15 dark:bg-primary/10" : "border-border bg-card hover:border-primary/40"}`}>
          <span className="pointer-events-none absolute -right-8 -top-10 h-28 w-28 animate-float rounded-full bg-gold/15 blur-2xl" />
          <div className="relative flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-gradient text-primary-foreground shadow-soft"><Landmark className="h-5 w-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="flex flex-wrap items-center gap-2 font-semibold">Manual payment <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Bank · Telebirr · BYBIT</span></span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">Send {formatETB()} to an account below, then enter your transaction reference and upload the receipt.</span>
            </span>
            <span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${paymentOption === "manual" ? "border-primary bg-primary text-primary-foreground" : "border-border text-transparent"}`}><Check className="h-3.5 w-3.5" /></span>
          </div>
          <span className="relative mt-4 block rounded-xl border border-border/70 bg-background/75 p-3">
            <span className="mb-2 flex items-center gap-2 text-xs font-bold text-foreground"><WalletCards className="h-4 w-4 text-primary" /> Account holder: Kassahun Mulatu Kebede</span>
            <span className="grid gap-x-3 gap-y-1.5 text-xs text-muted-foreground sm:grid-cols-2">
              <span className="flex items-center justify-between gap-2"><strong className="text-foreground">CBE</strong><span>1000183217198</span></span>
              <span className="flex items-center justify-between gap-2"><strong className="text-foreground">BOA</strong><span>32419186</span></span>
              <span className="flex items-center justify-between gap-2"><strong className="text-foreground">Bunna</strong><span>3609501002452</span></span>
              <span className="flex items-center justify-between gap-2"><strong className="text-foreground">Telebirr</strong><span>0915508167</span></span>
              <span className="flex items-center justify-between gap-2 sm:col-span-2"><strong className="text-foreground">BYBIT</strong><span className="break-all text-right">TC5oVhZsMjMXpbjBAjibF3HS8jggaqX5Ps</span></span>
            </span>
          </span>
          <span className="relative mt-3 flex items-center gap-2 text-[11px] font-medium text-muted-foreground"><Smartphone className="h-3.5 w-3.5 text-primary" /> Choose your transfer method below. Payment stays pending until reviewed.</span>
        </button>

        <div className={`group relative overflow-hidden rounded-2xl border p-4 shadow-soft transition duration-300 hover:-translate-y-1 hover:shadow-elegant motion-reduce:transform-none motion-reduce:transition-none ${paymentOption === "online" ? "border-gold bg-gradient-to-br from-amber-50 via-card to-orange-50 ring-2 ring-gold/20 dark:from-amber-950/30 dark:via-card dark:to-orange-950/20" : "border-gold/40 bg-gradient-to-br from-amber-50/80 via-card to-orange-50/80 hover:border-gold dark:from-amber-950/20 dark:via-card dark:to-orange-950/20"}`}>
          <span className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 animate-float rounded-full bg-gold/20 blur-2xl [animation-delay:700ms]" />
          <div className="relative flex items-start gap-3">
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gold-gradient text-gold-foreground shadow-soft"><CreditCard className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <button type="button" aria-pressed={paymentOption === "online"} onClick={() => setPaymentOption("online")} className="text-left font-semibold hover:text-primary">Pay online with Ye Buna</button>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Complete the secure Ye Buna checkout for {formatETB()}. Return here with your payment reference and receipt so we can verify your course access.</p>
            </div>
            <span className={`mt-1 flex h-5 w-5 shrink-0 items-center justify-center rounded-full border transition ${paymentOption === "online" ? "border-gold bg-gold text-gold-foreground" : "border-gold/40 text-transparent"}`}><Check className="h-3.5 w-3.5" /></span>
          </div>
          <a href={ONLINE_PAYMENT_URL} target="_blank" rel="noreferrer" onClick={() => setPaymentOption("online")} className="relative mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-deep px-4 py-3 text-sm font-bold text-deep-foreground shadow-soft transition hover:scale-[1.01] hover:bg-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 motion-reduce:transform-none">
            Continue to Ye Buna <ExternalLink className="h-4 w-4" /><ArrowUpRight className="h-4 w-4 opacity-70" />
          </a>
          <p className="relative mt-2 text-center text-[11px] text-muted-foreground">You’ll return here to submit the payment reference and receipt.</p>
        </div>
      </section>
      <div className="space-y-2">
        <Label>Course</Label>
        <Select value={selected} onValueChange={setCourseId}>
          <SelectTrigger className="h-11"><SelectValue placeholder="Choose a course" /></SelectTrigger>
          <SelectContent>
            {courses.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.title}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Payment method</Label>
          {paymentOption === "manual" ? <Select value={manualMethod} onValueChange={setManualMethod}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>{PAYMENT_METHODS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}</SelectContent>
          </Select> : <div className="flex h-11 items-center rounded-md border border-gold/50 bg-gold/10 px-3 text-sm font-semibold">Online (Ye Buna)</div>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="ref">Transaction reference</Label>
          <Input id="ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. FT24321ABCD" className="h-11" />
        </div>
      </div>
      <div className="space-y-2">
        <Label htmlFor="note">Note (optional)</Label>
        <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything we should know" className="h-11" />
      </div>
      <div className="space-y-2">
        <Label htmlFor="receipt">Payment receipt (JPG, PNG, WebP, or PDF; max 50 MB)</Label>
        <Input ref={receiptInput} id="receipt" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" className="h-auto min-h-11 py-2" onChange={(e) => setReceipt(e.target.files?.[0] ?? null)} />
        {receipt && <p className="text-xs text-muted-foreground">{receipt.name} · {(receipt.size / (1024 * 1024)).toFixed(1)} MB</p>}
      </div>
      <Button type="submit" variant="hero" size="lg" className="w-full" disabled={m.isPending}>
        {m.isPending ? <Loader2 className="animate-spin" /> : receipt ? <Send /> : <Upload />} Submit payment of {formatETB()}
      </Button>
    </form>
  );
}
