import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { PublicLayout } from "@/components/site/PublicLayout";
import { ProPlanCard } from "@/components/site/ProPlanCard";
import { PaymentRequestForm } from "@/components/site/PaymentRequestForm";
import { PaymentAccounts, PayOnlineButton } from "@/components/site/PaymentAccounts";
import { MyPaymentStatus } from "@/components/site/MyPaymentStatus";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { coursesQuery } from "@/lib/queries";
import { FREE_LESSON_LIMIT, formatETB } from "@/lib/access";

export const Route = createFileRoute("/pro")({
  validateSearch: (s: Record<string, unknown>): { course?: string | undefined } => ({
    course: typeof s["course"] === "string" ? s["course"] : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Ezana Pro — Unlock the full course for ETB 218" },
      { name: "description", content: "Upgrade to Ezana Pro to unlock every tutorial video in a course for a one-time ETB 218." },
      { property: "og:title", content: "Ezana Pro — ETB 218 per course" },
      { property: "og:description", content: "Unlock every tutorial video in a course with a single payment." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Pro,
});

function Pro() {
  const { course } = Route.useSearch();
  const { user } = useAuth();
  const { data: courses = [] } = useQuery(coursesQuery);
  const target = courses.find((c) => c.slug === course);

  return (
    <PublicLayout>
      <section className="relative overflow-hidden bg-hero py-20 text-deep-foreground">
        <div className="pattern-dots absolute inset-0 opacity-40" />
        <div className="relative mx-auto max-w-3xl px-4 text-center sm:px-6">
          <span className="inline-flex animate-fade-up items-center gap-2 rounded-full bg-gold/15 px-4 py-1.5 text-sm font-semibold text-gold">
            <Lock className="h-4 w-4" /> This video is part of Ezana Pro
          </span>
          <h1 className="mt-6 animate-fade-up text-4xl font-semibold md:text-6xl [animation-delay:100ms]">
            Upgrade to unlock {target ? <span className="text-gold-gradient italic">{target.title}</span> : "the full course"}
          </h1>
          <p className="mt-5 animate-fade-up text-lg text-deep-muted [animation-delay:200ms]">
            You've used your {FREE_LESSON_LIMIT} free videos. Pay {formatETB()} once to watch the rest of this course.
          </p>
        </div>
      </section>
      <section className="mx-auto -mt-10 grid max-w-6xl gap-8 px-4 sm:px-6 lg:grid-cols-2">
        <div className="animate-fade-up">
          <ProPlanCard>
            <PayOnlineButton className="w-full" />
            <p className="mt-3 text-center text-xs text-deep-muted">Or pay by bank, Telebirr or Bybit using the account details shown with the payment form.</p>
          </ProPlanCard>
        </div>
        <div className="animate-fade-up rounded-[2rem] border border-border bg-card p-8 shadow-soft [animation-delay:150ms] md:p-10">
          <h2 className="text-3xl font-semibold">Pay and unlock</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Pay online or by transfer, then submit your transaction reference and receipt. Your payment shows as Pending until our team approves it.
          </p>
          <div className="mt-6">
            <PaymentAccounts />
          </div>
          <h3 className="mt-8 text-xl font-semibold">Submit your payment</h3>
          <div className="mt-4">
            {user ? (
              <PaymentRequestForm defaultCourseSlug={course} />
            ) : (
              <div className="rounded-2xl bg-secondary/60 p-6 text-center">
                <p>Create a free account or log in to upgrade.</p>
                <div className="mt-4 flex justify-center gap-2">
                  <Button asChild variant="emerald"><Link to="/register">Get started</Link></Button>
                  <Button asChild variant="outline"><Link to="/login">Login</Link></Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
      {user && (
        <section className="mx-auto mt-8 max-w-6xl px-4 pb-4 sm:px-6">
          <MyPaymentStatus userId={user.id} />
        </section>
      )}
    </PublicLayout>
  );
}
