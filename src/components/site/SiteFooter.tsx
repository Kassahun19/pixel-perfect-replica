import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Mail, MapPin, Phone } from "lucide-react";
import { Logo } from "./Logo";
import { settingsQuery } from "@/lib/queries";

export function SiteFooter() {
  const { data: s } = useQuery(settingsQuery);
  return (
    <footer className="relative mt-24 overflow-hidden bg-deep text-deep-foreground">
      <div className="pattern-tibeb h-2 w-full opacity-80" />
      <div className="pattern-dots pointer-events-none absolute inset-0 opacity-40" />
      <div className="relative mx-auto grid max-w-7xl gap-12 px-4 py-16 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-2">
          <Logo light />
          <p className="mt-5 max-w-md text-sm leading-relaxed text-deep-muted">
            {s?.description ||
              "Ezana Academy brings world-class, practical learning to every Ethiopian learner, wherever they are."}
          </p>
        </div>
        <div>
          <h4 className="font-display text-lg text-gold">Explore</h4>
          <ul className="mt-4 space-y-2 text-sm text-deep-muted">
            <li><Link to="/about" className="hover:text-deep-foreground">About us</Link></li>
            <li><Link to="/courses" className="hover:text-deep-foreground">All courses</Link></li>
            <li><Link to="/pro" className="hover:text-deep-foreground">Ezana Pro</Link></li>
            <li><Link to="/contact" className="hover:text-deep-foreground">Contact</Link></li>
          </ul>
        </div>
        <div>
          <h4 className="font-display text-lg text-gold">Reach us</h4>
          <ul className="mt-4 space-y-3 text-sm text-deep-muted">
            <li className="flex gap-2"><MapPin className="h-4 w-4 shrink-0 text-gold" />{s?.address || "Addis Ababa, Ethiopia"}</li>
            <li className="flex gap-2"><Phone className="h-4 w-4 shrink-0 text-gold" />{s?.phone || "+251 911 000 218"}</li>
            <li className="flex gap-2"><Mail className="h-4 w-4 shrink-0 text-gold" />{s?.email || "hello@ezanaacademy.et"}</li>
          </ul>
        </div>
      </div>
      <div className="relative border-t border-deep-foreground/10 py-6 text-center text-xs text-deep-muted">
        © {new Date().getFullYear()} {s?.name || "Ezana Academy"}. All rights reserved.
      </div>
    </footer>
  );
}
