import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { CheckCircle2, Loader2, Mail, MapPin, Phone, Send } from "lucide-react";
import { z } from "zod";
import { PageHero, PublicLayout } from "@/components/site/PublicLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { settingsQuery } from "@/lib/queries";
import { emailRule } from "@/lib/validation";

export const Route = createFileRoute("/contact")({
  head: () => ({
    meta: [
      { title: "Contact Ezana Academy" },
      { name: "description", content: "Get in touch with Ezana Academy by phone, email or the contact form. We reply within one working day." },
      { property: "og:title", content: "Contact Ezana Academy" },
      { property: "og:description", content: "Questions about courses or payments? We're here to help." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Contact,
});

const schema = z.object({
  name: z.string().trim().min(1, "Enter your name").max(120),
  email: emailRule,
  subject: z.string().trim().max(200),
  message: z.string().trim().min(5, "Write a short message").max(5000),
});

function Contact() {
  const { data: s } = useQuery(settingsQuery);
  const [form, setForm] = useState({ name: "", email: "", subject: "", message: "" });
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) return void toast.error(parsed.error.issues[0]?.message);
    setBusy(true);
    const { error } = await supabase.from("contact_messages").insert({
      name: parsed.data.name,
      email: parsed.data.email,
      subject: parsed.data.subject,
      message: parsed.data.message,
    });
    setBusy(false);
    if (error) return void toast.error("Couldn't send your message. Please try again.");
    setSent(true);
    setForm({ name: "", email: "", subject: "", message: "" });
  }

  const info = [
    { icon: MapPin, label: "Visit us", value: s?.address || "Bole Road, Addis Ababa, Ethiopia" },
    { icon: Phone, label: "Call us", value: s?.phone || "+251 911 000 218" },
    { icon: Mail, label: "Email us", value: s?.email || "hello@ezanaacademy.et" },
  ];

  return (
    <PublicLayout>
      <PageHero
        eyebrow="Contact"
        title={<>We'd love to <span className="text-gold-gradient italic">hear from you.</span></>}
        subtitle="Questions about a course, payments or partnerships? Send us a message and we'll reply within one working day."
      />
      <section className="mx-auto grid max-w-7xl gap-10 px-4 py-20 sm:px-6 lg:grid-cols-[1fr_1.4fr]">
        <div className="space-y-4">
          {info.map((i) => (
            <div key={i.label} className="lift flex items-start gap-4 rounded-2xl border border-border bg-card p-6">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-emerald-gradient text-primary-foreground">
                <i.icon className="h-5 w-5" />
              </span>
              <div>
                <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{i.label}</p>
                <p className="mt-1 font-semibold">{i.value}</p>
              </div>
            </div>
          ))}
          <div className="rounded-2xl bg-deep p-6 text-deep-foreground">
            <p className="font-display text-xl text-gold">Office hours</p>
            <p className="mt-2 text-sm text-deep-muted">Monday – Saturday, 8:30 AM – 6:00 PM (EAT)</p>
          </div>
        </div>
        <div className="rounded-3xl border border-border bg-card p-8 shadow-soft md:p-10">
          {sent ? (
            <div className="flex flex-col items-center py-12 text-center">
              <CheckCircle2 className="h-14 w-14 text-success" />
              <h2 className="mt-4 text-3xl font-semibold">Message sent!</h2>
              <p className="mt-2 text-muted-foreground">Thank you. Our team will get back to you soon.</p>
              <Button variant="outline" className="mt-6" onClick={() => setSent(false)}>Send another</Button>
            </div>
          ) : (
            <form onSubmit={onSubmit} noValidate className="space-y-5">
              <h2 className="text-3xl font-semibold">Send a message</h2>
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="h-11" />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" type="email" inputMode="email" autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="h-11" />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="subject">Subject</Label>
                <Input id="subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} className="h-11" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="message">Message</Label>
                <Textarea id="message" rows={6} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
              </div>
              <Button type="submit" variant="emerald" size="lg" disabled={busy}>
                {busy ? <Loader2 className="animate-spin" /> : <Send />} Send message
              </Button>
            </form>
          )}
        </div>
      </section>
    </PublicLayout>
  );
}
