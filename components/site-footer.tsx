import Link from "next/link";

import { cn } from "@/lib/utils";

type SiteFooterVariant = "landing" | "console";

const footerLinks = [
  { href: "/sign-in", label: "Sign in" },
  { href: "/search", label: "Scan now" },
] as const;

export function SiteFooter({ variant = "landing" }: { variant?: SiteFooterVariant }) {
  const isLanding = variant === "landing";

  return (
    <footer
      data-slot="site-footer"
      className={cn(
        "border-t text-sm",
        isLanding
          ? "border-white/[0.06] bg-[#030509] py-12 text-slate-500"
          : "border-white/[0.08] bg-[#05070a] py-6 text-slate-500",
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-5 sm:flex-row sm:items-start sm:justify-between sm:gap-12 sm:px-8 lg:px-12 xl:px-16">
        <div className={cn("space-y-2.5", isLanding ? "max-w-sm" : "max-w-md")}>
          <p className="font-heading text-sm font-semibold tracking-tight text-slate-200">LMX Sovereign Wallet</p>
          <p className="text-pretty text-[0.8125rem] leading-relaxed sm:text-sm">
            Identity graph and footprint console. Early access; in active development.
          </p>
        </div>
        <nav className="flex flex-col gap-4 sm:min-w-[12rem] sm:items-end" aria-label="Footer">
          <div className="flex flex-wrap gap-x-5 gap-y-2 sm:justify-end">
            {footerLinks.map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[0.8125rem] font-medium text-slate-300 underline-offset-4 transition-colors hover:text-white hover:underline"
              >
                {link.label}
              </Link>
            ))}
          </div>
          <p className="text-[11px] leading-snug text-slate-600 sm:text-right">
            © {new Date().getFullYear()} LMX Sovereign Wallet. All rights reserved.
          </p>
        </nav>
      </div>
    </footer>
  );
}
