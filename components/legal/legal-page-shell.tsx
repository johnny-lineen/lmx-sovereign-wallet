import Link from "next/link";
import { Layers } from "lucide-react";

import { SiteFooter } from "@/components/site-footer";
import { LEGAL_CONFIG, LEGAL_ROUTES } from "@/lib/legal-config";
import { cn } from "@/lib/utils";

const legalNav = [
  { href: LEGAL_ROUTES.privacy, label: "Privacy Policy" },
  { href: LEGAL_ROUTES.terms, label: "Terms of Service" },
] as const;

export function LegalPageShell({
  title,
  children,
  active,
}: {
  title: string;
  children: React.ReactNode;
  active: keyof typeof LEGAL_ROUTES;
}) {
  return (
    <div className="flex min-h-dvh flex-col bg-[#05070a] text-slate-200">
      <header className="sticky top-0 z-50 shrink-0 border-b border-white/[0.06] bg-[#05070a]/85 backdrop-blur-md supports-[backdrop-filter]:bg-[#05070a]/75">
        <div className="mx-auto flex h-12 w-full max-w-4xl items-center justify-between gap-3 px-5 sm:h-14 sm:px-8">
          <Link href="/" className="group flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 items-center justify-center rounded-lg border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 transition-colors group-hover:border-cyan-400/35">
              <Layers className="size-4" aria-hidden />
            </span>
            <span className="truncate font-mono text-sm font-bold tracking-tight text-white sm:text-[0.9375rem]">
              {LEGAL_CONFIG.productName}
            </span>
          </Link>

          <nav className="flex shrink-0 items-center gap-3 sm:gap-4" aria-label="Legal">
            {legalNav.map((link) => {
              const isActive = link.href === LEGAL_ROUTES[active];
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "text-[11px] font-medium uppercase tracking-wide transition-colors sm:text-xs",
                    isActive ? "text-cyan-300" : "text-slate-400 hover:text-white",
                  )}
                  aria-current={isActive ? "page" : undefined}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </header>

      <main className="flex-1 px-5 py-10 sm:px-8 sm:py-14">
        <article className="mx-auto max-w-3xl">
          <header className="mb-10 space-y-3 border-b border-white/[0.06] pb-8">
            <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-cyan-400/95">
              Legal
            </p>
            <h1 className="font-heading text-3xl font-semibold tracking-tight text-white sm:text-4xl">
              {title}
            </h1>
            <p className="text-sm text-slate-500">
              Effective {LEGAL_CONFIG.effectiveDate}. Last updated {LEGAL_CONFIG.effectiveDate}.
            </p>
          </header>

          <div className="legal-prose space-y-8 text-sm leading-relaxed text-slate-300 sm:text-[0.9375rem]">
            {children}
          </div>
        </article>
      </main>

      <SiteFooter variant="landing" />
    </div>
  );
}

export function LegalSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-3">
      <h2 className="font-heading text-lg font-semibold text-white">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

export function LegalList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc space-y-2 pl-5 text-slate-300">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
