import Link from "next/link";

import { DemoRequestForm } from "@/components/landing/demo-request-form";
import { LandingHeader } from "@/components/landing/landing-header";
import { LandingDivider, LandingHighlightPills, LandingStripe } from "@/components/landing/landing-page-accents";
import { LandingProblemSection } from "@/components/landing/landing-problem-section";
import { LandingSolutionRoadmapSection } from "@/components/landing/landing-solution-roadmap-section";
import { LandingWireframes } from "@/components/landing/landing-wireframes";
import { buttonVariants } from "@/components/ui/button-variants";
import { GlobeWireframe } from "@/components/ui/globe";
import { cn } from "@/lib/utils";

export function LandingPage() {
  return (
    <div data-page="landing" className="flex min-h-dvh flex-col bg-background text-foreground">
      <LandingHeader />

      <main data-slot="landing-main" className="flex flex-1 flex-col">
        <section
          data-slot="landing-hero"
          className="relative flex min-h-[calc(100dvh-3.5rem)] flex-col justify-center overflow-hidden bg-background px-4 py-16 sm:min-h-[calc(100dvh-4rem)] sm:px-6 lg:py-24"
        >
          {/* Hero wash: accent + primary glows on lighter charcoal base */}
          <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_95%_65%_at_50%_-28%,var(--accent),transparent_58%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_70%_45%_at_50%_0%,var(--primary)_0%,transparent_45%)] opacity-[0.14]" />
            <div className="absolute -top-24 right-[10%] h-[24rem] w-[24rem] rounded-full bg-primary/22 blur-3xl" />
            <div className="absolute -bottom-36 left-[6%] h-[28rem] w-[28rem] rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute -bottom-32 left-[8%] h-[26rem] w-[26rem] rounded-full bg-accent/90 blur-3xl" />
            <div className="absolute inset-x-0 bottom-0 h-[42%] bg-gradient-to-t from-background via-background/40 to-transparent" />
            <div
              className={cn(
                "absolute left-1/2 top-[46%] w-[min(105vw,36rem)] -translate-x-1/2 -translate-y-1/2",
                "opacity-[0.32] sm:top-1/2 sm:w-[min(95vw,40rem)] sm:opacity-[0.4]",
              )}
            >
              <div className="aspect-square w-full">
                <GlobeWireframe />
              </div>
            </div>
          </div>

          <div
            data-slot="landing-hero-content"
            className="relative z-10 mx-auto flex w-full max-w-3xl flex-col items-center gap-10 text-center"
          >
            <div className="space-y-6">
              <p
                data-slot="landing-eyebrow"
                className="text-xs font-medium uppercase tracking-widest text-muted-foreground"
              >
                Personal data, under your control
              </p>
              <h1
                data-slot="landing-title"
                className="text-balance font-heading text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl"
              >
                Your identity graph and sovereign wallet in one place
              </h1>
              <p
                data-slot="landing-lede"
                className="mx-auto max-w-2xl text-pretty text-lg leading-relaxed text-muted-foreground sm:text-xl"
              >
                Connect sources, see how your digital identity fits together, and act from a single
                console—built for clarity, not clutter.
              </p>
            </div>

            <DemoRequestForm />

            <div
              data-slot="landing-cta-row"
              className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center"
            >
              <Link
                data-slot="landing-cta-primary"
                href="/sign-in"
                className={cn(buttonVariants({ size: "lg" }), "w-full justify-center sm:w-auto sm:min-w-[11rem]")}
              >
                Open console
              </Link>
              <Link
                data-slot="landing-cta-secondary"
                href="/sign-up"
                className={cn(
                  buttonVariants({ variant: "outline", size: "lg" }),
                  "w-full justify-center sm:w-auto",
                )}
              >
                Create account
              </Link>
            </div>
          </div>
        </section>

        <LandingStripe surface="alt">
          <LandingHighlightPills />
          <LandingDivider label="Why this exists" />
          <LandingProblemSection />
        </LandingStripe>

        <LandingStripe surface="primary">
          <LandingDivider label="Solution & roadmap" />
          <LandingSolutionRoadmapSection />
        </LandingStripe>

        <LandingStripe surface="alt">
          <LandingDivider label="What's next" />
          <LandingWireframes />
        </LandingStripe>
      </main>
    </div>
  );
}
