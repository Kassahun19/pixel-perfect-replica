import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Loader2, Send } from "lucide-react";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { coursesQuery, settingsQuery } from "@/lib/queries";
import { useAuth } from "@/lib/auth";
import { PRO_PRICE_ETB, formatETB } from "@/lib/access";

export const PAYMENT_METHODS = ["Telebirr", "CBE Birr", "Bank transfer (CBE)", "Awash Bank", "Dashen Bank", "Cash at office"];

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
  const { data: settings } = useQuery(settingsQuery);
  const initial = courses.find((c) => c.slug === defaultCourseSlug)?.id ?? "";
  const [courseId, setCourseId] = useState<string>(initial);
  const [method, setMethod] = useState("Telebirr");
  const [reference, setReference] = useState("");
  const [note, setNote] = useState("");
  const selected = courseId || initial;

  const m = useMutation({
    mutationFn: async () => {
      const parsed = schema.safeParse({ course_id: selected, method, reference, note: note || undefined });
      if (!parsed.success) throw new Error(parsed.error.issues[0]?.message);
      const { error } = await supabase.from("payments").insert({
        user_id: studentId ?? user!.id,
        course_id: parsed.data.course_id,
        method: parsed.data.method,
        reference: parsed.data.reference,
        note: parsed.data.note ?? null,
        amount: PRO_PRICE_ETB,
      });
      if (error) {
        if (error.code === "23505") throw new Error("You already have a pending or approved payment for this course.");
        throw new Error(error.message);
      }
    },
    onSuccess: () => {
      toast.success("Payment submitted! We'll unlock the course once it's confirmed.");
      setReference("");
      setNote("");
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
      {settings?.payment_instructions && (
        <div className="rounded-xl border border-gold/40 bg-gold-soft/60 p-4 text-sm text-gold-foreground">
          <p className="font-bold">How to pay {formatETB()}</p>
          <p className="mt-1">{settings.payment_instructions}</p>
        </div>
      )}
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
        <Label htmlFor="note">Note (optional)</Label>
        <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything we should know" className="h-11" />
      </div>
      <Button type="submit" variant="hero" size="lg" className="w-full" disabled={m.isPending}>
        {m.isPending ? <Loader2 className="animate-spin" /> : <Send />} Submit payment of {formatETB()}
      </Button>
    </form>
  );
}
