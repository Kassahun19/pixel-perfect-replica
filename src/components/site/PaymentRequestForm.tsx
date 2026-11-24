import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { Link } from "@tanstack/react-router";
import { toast } from "sonner";
import { Clock, FileText, Loader2, Paperclip, Send, X } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { coursesQuery } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { PRO_PRICE_ETB, formatETB } from "@/lib/access";
import {
  MAX_RECEIPT_MB,
  ONLINE_METHOD,
  PAYMENT_METHODS as METHODS,
  RECEIPT_ACCEPT,
  RECEIPT_BUCKET,
  receiptPath,
  validateReceiptFile,
} from "@/lib/payment-info";

export const PAYMENT_METHODS = METHODS;

const schema = z.object({
  course_id: z.string().uuid("Choose a course"),
  method: z.string().min(1, "Choose a payment method"),
  reference: z.string().trim().min(4, "Enter your transaction reference").max(100),
  note: z.string().trim().max(500).optional(),
});

export function myPaymentsQueryKey(userId: string | undefined) {
  return ["payments", "mine", userId];
}

function formatSize(bytes: number) {
  return bytes >= 1024 * 1024 ? `${(bytes / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

export function PaymentRequestForm({ defaultCourseSlug, studentId, onDone }: { defaultCourseSlug?: string | undefined; studentId?: string | undefined; onDone?: () => void }) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { data: courses = [] } = useQuery(coursesQuery);
  const initial = courses.find((c) => c.slug === defaultCourseSlug)?.id ?? "";
  const [courseId, setCourseId] = useState<string>(initial);
  const [method, setMethod] = useState(ONLINE_METHOD);
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);
  const selected = courseId || initial;

  const m = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Please log in first.");
      const parsed = schema.safeParse({ course_id: selected, method, reference, note: note || undefined });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);

      let path: string | null = null;
      if (file) {
        const problem = validateReceiptFile(file);
        if (problem) throw new Error(problem);
        path = receiptPath(user.id, file.name);
        const { error: upErr } = await supabase.storage.from(RECEIPT_BUCKET).upload(path, file, {
          contentType: file.type,
          upsert: false,
        });
        if (upErr) throw new Error(`Receipt upload failed: ${upErr.message}`);
      }

      const { error } = await supabase.from("payments").insert({
        user_id: studentId ?? user.id,
        course_id: parsed.data.course_id,
        method: parsed.data.method,
        reference: parsed.data.reference,
        note: parsed.data.note ?? null,
        amount: PRO_PRICE_ETB,
        receipt_path: path,
      });
      if (error) {
        if (path) await supabase.storage.from(RECEIPT_BUCKET).remove([path]);
        if (error.code === "23505") throw new Error("You already have a pending or approved payment for this course.");
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      toast.success("Payment submitted! It's pending until our team reviews it.");
      setReference("");
      setNote("");
      setFile(null);
      if (fileRef.current) fileRef.current.value = "";
      setSubmitted(true);
      qc.invalidateQueries({ queryKey: ["payments"] });
      onDone?.();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (submitted) {
    return (
      <div className="rounded-2xl border border-gold/40 bg-gold-soft/60 p-6 text-center">
        <Clock className="mx-auto h-10 w-10 text-gold-foreground" />
        <p className="mt-3 text-lg font-semibold text-gold-foreground">Payment submitted — Pending review</p>
        <p className="mt-1 text-sm text-gold-foreground">
          Your payment stays <span className="font-bold">Pending</span> until the Ezana team approves or rejects it. The course unlocks as soon as it's approved.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button asChild variant="emerald"><Link to="/dashboard/payments">View my payments</Link></Button>
          <Button type="button" variant="outline" onClick={() => setSubmitted(false)}>Submit another payment</Button>
        </div>
      </div>
    );
  }

  return (
    <form
      noValidate
      onSubmit={(e) => {
        e.preventDefault();
        m.mutate();
      }}
      className="space-y-4"
    >
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
          <Label>How did you pay?</Label>
          <Select value={method} onValueChange={setMethod}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {PAYMENT_METHODS.map((p) => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="ref">Transaction reference</Label>
          <Input id="ref" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. FT24321ABCD" className="h-11" />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="receipt">Payment receipt (photo, screenshot or PDF · max {MAX_RECEIPT_MB}MB)</Label>
        <input
          ref={fileRef}
          id="receipt"
          type="file"
          accept={RECEIPT_ACCEPT}
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            if (!f) return;
            const problem = validateReceiptFile(f);
            if (problem) {
              toast.error(problem);
              e.target.value = "";
              return;
            }
            setFile(f);
          }}
        />
        {file ? (
          <div className="flex items-center gap-3 rounded-xl border border-primary/40 bg-secondary/50 px-4 py-3">
            <FileText className="h-5 w-5 shrink-0 text-primary" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{file.name}</p>
              <p className="text-xs text-muted-foreground">{formatSize(file.size)}</p>
            </div>
            <button
              type="button"
              aria-label="Remove receipt"
              onClick={() => {
                setFile(null);
                if (fileRef.current) fileRef.current.value = "";
              }}
              className="inline-flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <label
            htmlFor="receipt"
            className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-border bg-secondary/30 px-4 py-6 text-center text-sm transition-colors hover:border-primary hover:bg-secondary/60"
          >
            <Paperclip className="h-5 w-5 text-primary" />
            <span className="font-semibold">Upload receipt</span>
            <span className="text-xs text-muted-foreground">JPG, PNG or PDF up to {MAX_RECEIPT_MB}MB</span>
          </label>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="note">Note (optional)</Label>
        <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything we should know" className="h-11" />
      </div>
      <Button type="submit" variant="hero" size="lg" className="w-full" disabled={m.isPending}>
        {m.isPending ? <Loader2 className="animate-spin" /> : <Send />} Submit payment of {formatETB()}
      </Button>
    </form>
  );
}
