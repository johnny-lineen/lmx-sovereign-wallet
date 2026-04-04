import { LandingProblemSection } from "@/components/landing/landing-problem-section";
import { LandingWireframes } from "@/components/landing/landing-wireframes";
import { Component } from "@/components/ui/globe";

export default function DemoOne() {
  return (
    <div className="min-h-dvh bg-background text-foreground antialiased">
      <div className="relative border-b border-border/60">
        <div
          className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,var(--accent),transparent)]"
          aria-hidden
        />
        <div className="relative mx-auto max-w-5xl px-6 py-12 md:py-16">
          <Component
            title="Your identity graph and sovereign wallet"
            description="Connect sources, see how your digital identity fits together, and act from a single console—this page is a layout preview with wireframes below."
          />
        </div>
      </div>

      <LandingProblemSection />

      <LandingWireframes />
    </div>
  );
}
