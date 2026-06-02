"use client";

import { UserButton } from "@clerk/nextjs";
import { Layers } from "lucide-react";
import Link from "next/link";

import { ScanWizard } from "@/components/scan/scan-wizard";

const appLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/vault", label: "Vault" },
  { href: "/graph", label: "Graph" },
  { href: "/insights", label: "Insights" },
] as const;

export function ScanOnboardingPage() {
  return (
    <div className="flex min-h-dvh flex-col bg-[#05070a] text-slate-200">
      <header className="sticky top-0 z-50 shrink-0 border-b border-white/[0.06] bg-[#05070a]/85 backdrop-blur-md supports-[backdrop-filter]:bg-[#05070a]/75">
        <div className="mx-auto flex h-12 w-full max-w-6xl items-center justify-between gap-3 px-5 sm:h-14 sm:px-8 lg:px-12">
          <Link href="/dashboard" className="group flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 transition-colors group-hover:border-cyan-400/35">
              <Layers className="size-4" aria-hidden />
            </span>
            <span className="truncate font-mono text-sm font-bold tracking-tight text-white sm:text-[0.9375rem]">LMX</span>
          </Link>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-3 sm:gap-5">
            <nav
              className="min-w-0 flex-1 overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:none] sm:flex-initial sm:overflow-visible [&::-webkit-scrollbar]:hidden"
              aria-label="App"
            >
              <div className="flex items-center justify-end gap-4 whitespace-nowrap pr-1 text-xs font-medium text-slate-400 sm:text-sm">
                {appLinks.map((item) => (
                  <Link key={item.href} href={item.href} className="transition-colors hover:text-white">
                    {item.label}
                  </Link>
                ))}
              </div>
            </nav>
            <span className="shrink-0">
              <UserButton />
            </span>
          </div>
        </div>
      </header>

      <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-5 py-10 sm:px-8 sm:py-14 lg:px-12">
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
          <div
            className="absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage: `linear-gradient(to right, rgba(148, 163, 184, 0.12) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(148, 163, 184, 0.12) 1px, transparent 1px)`,
              backgroundSize: "44px 44px",
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,211,238,0.12),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_45%_at_80%_60%,rgba(139,92,246,0.06),transparent_50%)]" />
        </div>

        <div className="relative z-10 w-full max-w-lg">
          <ScanWizard />
        </div>
      </main>
    </div>
  );
}
