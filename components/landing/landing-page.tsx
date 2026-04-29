import Link from "next/link";
import { Layers, Play } from "lucide-react";

import { DemoRequestForm } from "@/components/landing/demo-request-form";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingAgent } from "@/components/landing/LandingAgent";
import { LandingHeroPreview } from "@/components/landing/landing-hero-preview";
import { LandingMarketingSections } from "@/components/landing/landing-marketing-sections";
import { LandingTopBar } from "@/components/landing/landing-top-bar";
import { cn } from "@/lib/utils";

const pageBg = "bg-[#05070a] text-slate-200";

export function LandingPage() {
  return (
    <div data-page="landing" className={cn("flex min-h-dvh flex-col", pageBg)}>
      <LandingTopBar />

      <main data-slot="landing-main" className="flex flex-1 flex-col">
        <section
          data-slot="landing-hero"
          className="relative flex flex-1 flex-col justify-center overflow-hidden px-5 py-16 sm:px-8 sm:py-20 lg:px-12 lg:py-24"
        >
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

          <div className="relative z-10 mx-auto grid w-full max-w-6xl gap-12 lg:grid-cols-2 lg:items-center lg:gap-16">
            <div className="flex max-w-xl flex-col gap-8 text-center lg:text-left">
              <div className="flex flex-col items-center gap-5 lg:items-start">
                <p
                  data-slot="landing-eyebrow"
                  className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-cyan-400/95"
                >
                  Footprint intelligence
                </p>
                <h1
                  data-slot="landing-title"
                  className="text-balance font-heading text-4xl font-semibold leading-[1.08] tracking-[-0.02em] text-white sm:text-5xl lg:text-[3.25rem]"
                >
                  See what the internet knows.
                </h1>
                <p
                  data-slot="landing-lede"
                  className="max-w-lg text-pretty text-base leading-relaxed text-slate-400 sm:text-[1.0625rem]"
                >
                  Public surfaces, breach signals, and inbox context—searched, enriched, and cross-referenced in one
                  run. Clear intelligence from data you already have access to, in seconds.
                </p>
              </div>

              <div
                data-slot="landing-cta-row"
                className="flex flex-col items-center gap-5 sm:flex-row sm:flex-wrap sm:justify-center lg:justify-start"
              >
                <Link
                  href="/sign-in"
                  className={cn(
                    "inline-flex h-12 min-w-[11rem] items-center justify-center rounded-full px-8",
                    "bg-gradient-to-br from-cyan-400 via-cyan-500 to-teal-600 text-sm font-bold uppercase tracking-wide text-black",
                    "shadow-[0_0_32px_-4px_rgba(34,211,238,0.45)] transition-[transform,box-shadow] hover:shadow-[0_0_40px_-2px_rgba(34,211,238,0.55)] motion-safe:hover:scale-[1.02]",
                  )}
                >
                  Scan now
                </Link>
                <Link
                  href="#landing-agent-play"
                  className="group inline-flex items-center gap-2 text-sm font-medium text-slate-400 transition-colors hover:text-white"
                >
                  <span className="flex size-8 items-center justify-center rounded-full border border-white/10 bg-white/[0.04] text-white transition-colors group-hover:border-cyan-500/30 group-hover:bg-cyan-500/10">
                    <Play className="size-3.5 fill-current" aria-hidden />
                  </span>
                  See it in action
                </Link>
              </div>

              <p className="flex items-center justify-center gap-2 text-xs text-slate-600 lg:justify-start">
                <Layers className="size-3.5 text-cyan-500/60" aria-hidden />
                <span>Built for sovereign identity mapping</span>
              </p>
            </div>

            <div className="mx-auto w-full max-w-md lg:mx-0 lg:max-w-none">
              <LandingHeroPreview />
            </div>
          </div>
        </section>

        <LandingAgent />

        <LandingMarketingSections />

        <section
          id="waitlist"
          data-slot="landing-waitlist"
          className="border-t border-white/[0.06] bg-[#05070a] px-5 py-14 sm:px-8 lg:px-12"
        >
          <div className="mx-auto max-w-md space-y-6 text-center">
            <div className="space-y-2">
              <h2 className="font-heading text-lg font-semibold text-white">Request early access</h2>
              <p className="text-sm text-slate-500">Waitlist updates only. Unsubscribe anytime.</p>
            </div>
            <DemoRequestForm showFormHeader={false} surface="deep" />
          </div>
        </section>
      </main>

      <LandingFooter />
    </div>
  );
}
