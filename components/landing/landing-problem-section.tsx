import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { CircleDollarSign, HelpCircle, Layers2, Network } from "lucide-react";

import { LandingSectionHeading } from "@/components/landing/landing-section-heading";
import { cn } from "@/lib/utils";

function ProblemCard({
  step,
  title,
  icon: Icon,
  children,
  className,
}: {
  step: number;
  title: string;
  icon: LucideIcon;
  children: ReactNode;
  className?: string;
}) {
  const labelId = `problem-card-${step}-title`;
  return (
    <article
      className={cn(
        "flex h-full flex-col rounded-xl border border-border/70 bg-card/35 p-4 dark:bg-card/20 sm:p-5",
        className,
      )}
      aria-labelledby={labelId}
    >
      <div className="flex items-center gap-2.5">
        <span
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/12 text-xs font-semibold text-primary"
          aria-hidden
        >
          {step}
        </span>
        <span className="rounded-md border border-border/50 bg-muted/25 p-1.5 text-primary" aria-hidden>
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
        <h3 id={labelId} className="min-w-0 flex-1 font-heading text-[0.95rem] font-semibold leading-tight text-foreground sm:text-base">
          {title}
        </h3>
      </div>
      <div className="mt-2.5 flex-1 space-y-2 text-sm leading-snug text-muted-foreground">{children}</div>
    </article>
  );
}

export function LandingProblemSection() {
  return (
    <section
      data-slot="landing-problem"
      aria-labelledby="landing-problem-heading"
      className="mx-auto max-w-5xl px-4 py-12 sm:px-6 md:py-16"
    >
      <LandingSectionHeading
        eyebrow="Why this exists"
        title="Your digital life is fragmented—and hard to see"
        subtitle="We’re building a sovereign wallet and identity graph: one place to see how accounts connect, where you’re exposed, and what to do next."
        id="landing-problem-heading"
      />

      <div className="mt-8 grid gap-3 sm:grid-cols-2 sm:gap-4">
        <ProblemCard step={1} title="Data trails spread everywhere" icon={Network}>
          <p>Every signup, app, and device adds signals outside your control.</p>
          <ul className="list-disc space-y-1 pl-4 marker:text-primary/60">
            <li>Logins and OAuth link services behind the scenes.</li>
            <li>One person becomes many partial profiles.</li>
            <li>Small signals still identify you.</li>
          </ul>
        </ProblemCard>

        <ProblemCard step={2} title="Free often means you’re the economics" icon={CircleDollarSign}>
          <p>Ads, targeting, and data markets fund a lot of what feels “free.”</p>
          <ul className="list-disc space-y-1 pl-4 marker:text-primary/60">
            <li>Behavior is packaged for markets you don’t see.</li>
            <li>Vendors rarely treat you as one whole person.</li>
            <li>Value from your activity rarely returns as control.</li>
          </ul>
        </ProblemCard>

        <ProblemCard step={3} title="Most people can’t map their footprint" icon={HelpCircle}>
          <p>Listing every account—or what breaks if one inbox locks—is usually a guess.</p>
          <p className="text-xs font-medium uppercase tracking-wide text-foreground/80">Sanity check</p>
          <ul className="grid list-none gap-1 pl-0 sm:grid-cols-2 sm:gap-x-4 sm:gap-y-1">
            {[
              "How many accounts do you really have?",
              "Which email or phone is the master key?",
              "What chains together if one login fails?",
              "Where is a single breach worst?",
            ].map((q) => (
              <li key={q} className="flex gap-1.5 text-[13px]">
                <span className="text-primary/70" aria-hidden>
                  ·
                </span>
                <span>{q}</span>
              </li>
            ))}
          </ul>
        </ProblemCard>

        <ProblemCard step={4} title="Great tools, narrow lenses" icon={Layers2}>
          <p>Each category helps—but none shows identity as one connected system you govern.</p>
          <dl className="space-y-2 border-t border-border/50 pt-2 text-[13px]">
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
              <dt className="shrink-0 font-medium text-foreground sm:w-36">Password managers</dt>
              <dd className="text-muted-foreground">Secrets, not how accounts depend on each other.</dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
              <dt className="shrink-0 font-medium text-foreground sm:w-36">Big platforms</dt>
              <dd className="text-muted-foreground">Their ecosystem—not a neutral map of your life.</dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
              <dt className="shrink-0 font-medium text-foreground sm:w-36">Security tools</dt>
              <dd className="text-muted-foreground">Alerts, not structure or reorganization.</dd>
            </div>
            <div className="flex flex-col gap-0.5 sm:flex-row sm:gap-3">
              <dt className="shrink-0 font-medium text-foreground sm:w-36">Finance apps</dt>
              <dd className="text-muted-foreground">Money flows, not the full login graph.</dd>
            </div>
          </dl>
        </ProblemCard>
      </div>

      <p
        className="mt-6 border-t border-border/50 pt-5 text-center text-sm leading-snug text-foreground sm:mt-7 sm:pt-6"
        role="note"
      >
        <span className="font-semibold">What we’re building: </span>
        connect sources, see your identity as a graph, and act from one console—the sections below spell out how.
      </p>
    </section>
  );
}
