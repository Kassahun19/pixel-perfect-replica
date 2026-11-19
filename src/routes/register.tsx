import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Loader2, MailCheck } from "lucide-react";
import { z } from "zod";
import { AuthShell } from "@/components/site/AuthShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";
import { passwordRule } from "@/lib/validation";

export const Route = createFileRoute("/register")({
  head: () => ({
    meta: [
      { title: "Get started — Ezana Academy" },
      { name: "description", content: "Create your free Ezana Academy account and watch 5 free videos in every course." },
      { property: "og:title", content: "Get started — Ezana Academy" },
      { property: "og:description", content: "Create a free account and start learning today." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Register,
});


const schema = z
  .object({
    first_name: z.string().trim().min(1, "Enter your first name").max(60),
    last_name: z.string().trim().min(1, "Enter your last name").max(60),
    email: z.string().trim().email("Enter a valid email").max(255),
    password: passwordRule,
    confirm: z.string(),
  })
  .refine((d) => d.password === d.confirm, { message: "Passwords don't match", path: ["confirm"] });

function Register() {
  const navigate = useNavigate();
  const { user, loading } = useAuth();
  const [form, setForm] = useState({ first_name: "", last_name: "", email: "", password: "", confirm: "" });
  const [busy, setBusy] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && user) navigate({ to: "/dashboard", replace: true });
  }, [user, loading, navigate]);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = schema.safeParse(form);
    if (!parsed.success) {
      toast.error(parsed.error.issues[0].message);
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.auth.signUp({
      email: parsed.data.email,
      password: parsed.data.password,
      options: {
        emailRedirectTo: `${window.location.origin}/dashboard`,
        data: { first_name: parsed.data.first_name, last_name: parsed.data.last_name },
      },
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    if (data.session) {
      toast.success("Welcome to Ezana Academy!");
      navigate({ to: "/dashboard", replace: true });
    } else {
      setSentTo(parsed.data.email);
    }
  }

  if (sentTo) {
    return (
      <AuthShell title="Check your email" subtitle="One last step to activate your account.">
        <div className="rounded-2xl border border-border bg-card p-8 text-center">
          <MailCheck className="mx-auto h-12 w-12 text-primary" />
          <p className="mt-4">We sent a confirmation link to <strong>{sentTo}</strong>. Click it to open your dashboard.</p>
          <Button asChild variant="outline" className="mt-6"><Link to="/login">Back to login</Link></Button>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your account" subtitle="Start free. Watch 5 videos in every course.">
      <form onSubmit={onSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label htmlFor="first_name">First name</Label>
            <Input id="first_name" value={form.first_name} onChange={set("first_name")} className="h-11" autoComplete="given-name" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="last_name">Last name</Label>
            <Input id="last_name" value={form.last_name} onChange={set("last_name")} className="h-11" autoComplete="family-name" />
          </div>
        </div>
        <div className="space-y-2">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" value={form.email} onChange={set("email")} className="h-11" autoComplete="email" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" value={form.password} onChange={set("password")} className="h-11" autoComplete="new-password" />
          <p className="text-xs text-muted-foreground">At least 8 characters, with a letter and a number.</p>
        </div>
        <div className="space-y-2">
          <Label htmlFor="confirm">Confirm password</Label>
          <Input id="confirm" type="password" value={form.confirm} onChange={set("confirm")} className="h-11" autoComplete="new-password" />
        </div>
        <Button type="submit" variant="emerald" size="lg" className="w-full" disabled={busy}>
          {busy && <Loader2 className="animate-spin" />} Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account? <Link to="/login" className="font-semibold text-primary hover:underline">Login</Link>
      </p>
    </AuthShell>
  );
}
