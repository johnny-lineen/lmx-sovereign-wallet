import type { ReactNode } from "react";
import {
  ArrowRight,
  Bot,
  Compass,
  Database,
  GitBranch,
  KeyRound,
  Layers,
  Link2,
  Puzzle,
  ScanSearch,
  Shield,
  Sparkles,
  Zap,
} from "lucide-react";

import { LandingSectionHeading } from "@/components/landing/landing-section-heading";
import { cn } from "@/lib/utils";

function Callout({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cn(
        "flex gap-3 rounded-xl border border-primary/25 bg-primary/5 px-4 py-3 text-sm leading-relaxed text-foreground dark:bg-primary/10",
        className,
      )}
      role="note"
    >
      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function SubsectionTitle({
  id,
  eyebrow,
  title,
  subtitle,
}: {
  id: string;
  eyebrow: string;
  title: string;
  subtitle?: string;
}) {
  return (
    <header className="mx-auto max-w-2xl text-center">
      <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">{eyebrow}</p>
      <h2
        id={id}
        className="mt-2 font-heading text-xl font-semibold tracking-tight text-foreground sm:text-2xl"
      >
        {title}
      </h2>
      {subtitle ? (
        <p className="mt-2 text-pretty text-sm text-muted-foreground sm:text-base">{subtitle}</p>
      ) : null}
    </header>
  );
}

function PillarCard({
  title,
  description,
  icon: Icon,
}: {
  title: string;
  description: string;
  icon: typeof Database;
}) {
  const labelId = `pillar-${title.replace(/\s+/g, "-").toLowerCase()}`;
  return (
    <article
      className="flex h-full flex-col rounded-xl border border-border/70 bg-card/35 p-4 dark:bg-card/20 sm:p-5"
      aria-labelledby={labelId}
    >
      <div className="flex items-center gap-2.5">
        <span className="rounded-md border border-border/50 bg-muted/25 p-1.5 text-primary" aria-hidden>
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
        <h3 id={labelId} className="font-heading text-[0.95rem] font-semibold leading-tight text-foreground sm:text-base">
          {title}
        </h3>
      </div>
      <p className="mt-2.5 flex-1 text-sm leading-snug text-muted-foreground">{description}</p>
    </article>
  );
}

type RoadmapItem = {
  icon: typeof Database;
  label: string;
  detail: string;
  examples?: string[];
};

const roadmapPhases: {
  phase: string;
  title: string;
  goal: string;
  accent: "chart-2" | "primary" | "chart-5" | "chart-3" | "chart-4";
  items: RoadmapItem[];
}[] = [
  {
    phase: "Phase 1",
    title: "Identity graph (now)",
    goal: "Make your digital life visible.",
    accent: "chart-2",
    items: [
      { icon: Database, label: "Vault + structured data", detail: "A single place for detected accounts and links." },
      { icon: GitBranch, label: "Graph visualization", detail: "See how pieces of your footprint connect." },
      { icon: Sparkles, label: "Basic insights", detail: "Counts, duplicates, fragmentation, concentration." },
      { icon: ScanSearch, label: "Queryable system", detail: "Ask structured questions over your vault." },
      { icon: Layers, label: "Email-based scanning", detail: "Start by connecting email to discover services." },
    ],
  },
  {
    phase: "Phase 2",
    title: "Control layer",
    goal: "Give users control over their data and behavior.",
    accent: "primary",
    items: [
      {
        icon: KeyRound,
        label: "Password management",
        detail: "Secure storage, autofill, login mapping, weak and reused password signals.",
      },
      {
        icon: Shield,
        label: "VPN + privacy layer",
        detail: "Private browsing infrastructure, traffic awareness, tracking and leakage signals.",
      },
      {
        icon: Puzzle,
        label: "Browser extension",
        detail: "Auto-detect accounts, cookies and permissions, ToS risk hints, live footprint updates.",
      },
    ],
  },
  {
    phase: "Phase 3",
    title: "Intelligent system",
    goal: "Turn insight into action.",
    accent: "chart-5",
    items: [
      {
        icon: Bot,
        label: "Personal agent",
        detail:
          "Understands your footprint, surfaces risks and inefficiencies, recommends next steps, and keeps the graph current.",
        examples: [
          "You have 12 unused accounts—want help removing them?",
          "80% of your accounts rely on one email—that concentrates risk.",
        ],
      },
    ],
  },
  {
    phase: "Phase 4",
    title: "Autonomous actions",
    goal: "From visibility to automation.",
    accent: "chart-3",
    items: [
      {
        icon: Zap,
        label: "Agent execution layer",
        detail: "With permission: cancel subscriptions, tighten security, clean up accounts, optimize your footprint.",
      },
    ],
  },
  {
    phase: "Phase 5",
    title: "Sovereign infrastructure",
    goal: "True digital ownership.",
    accent: "chart-4",
    items: [
      {
        icon: Link2,
        label: "Blockchain integration",
        detail: "On-chain anchoring, verifiable ownership, permissioned access, protocol-ready identity.",
      },
      {
        icon: Layers,
        label: "Protocol layer",
        detail: "A programmable vault, permissioned agents, and data you treat as an asset.",
      },
    ],
  },
];

const accentRing: Record<(typeof roadmapPhases)[number]["accent"], string> = {
  "chart-2": "border-chart-2/50 bg-chart-2/15 text-chart-2",
  primary: "border-primary/50 bg-primary/15 text-primary",
  "chart-5": "border-chart-5/50 bg-chart-5/15 text-chart-5",
  "chart-3": "border-chart-3/50 bg-chart-3/15 text-chart-3",
  "chart-4": "border-chart-4/50 bg-chart-4/15 text-chart-4",
};

export function LandingSolutionRoadmapSection() {
  return (
    <div
      data-slot="landing-solution-roadmap"
      className="mx-auto max-w-5xl space-y-16 px-4 py-12 sm:px-6 md:space-y-20 md:py-20"
    >
      <section aria-labelledby="landing-solution-intro-heading">
        <LandingSectionHeading
          eyebrow="The solution"
          title="A sovereign dashboard for your digital life"
          subtitle="The LMX Sovereign Wallet turns scattered accounts, identities, and services into one coherent system you can see and query—not another silo."
          id="landing-solution-intro-heading"
        />

        <div className="mt-8 grid gap-3 sm:grid-cols-3 sm:gap-4">
          <PillarCard
            icon={Database}
            title="A structured vault"
            description="Accounts and services organized as data you can browse, filter, and reason about."
          />
          <PillarCard
            icon={GitBranch}
            title="A visual identity graph"
            description="Relationships between emails, logins, and services shown as connections, not flat lists."
          />
          <PillarCard
            icon={ScanSearch}
            title="A queryable system"
            description="Ask focused questions and get answers grounded in your own footprint."
          />
        </div>

        <div className="mx-auto mt-8 max-w-2xl space-y-3 text-center text-sm leading-relaxed text-muted-foreground sm:text-base">
          <p>
            <span className="font-medium text-foreground">This is not just storage.</span> It is structured understanding
            and control—so you can see dependencies, overlap, and risk at a glance.
          </p>
        </div>

        <Callout className="mx-auto mt-6 max-w-2xl">
          <p>
            <span className="font-semibold text-foreground">Understanding plus control: </span>
            a map of your digital life that stays queryable as it grows.
          </p>
        </Callout>
      </section>

      <section aria-labelledby="landing-mvp-heading" className="border-t border-border/50 pt-16 md:pt-20">
        <SubsectionTitle
          id="landing-mvp-heading"
          eyebrow="Where we are now"
          title="MVP: the first working identity graph"
          subtitle="We are shipping the core loop—ingest, structure, visualize, and query—so early users can prove the idea with real data."
        />

        <div className="mt-8 overflow-hidden rounded-2xl border border-border/70 bg-card/30 shadow-sm dark:bg-card/15">
          <header className="border-b border-border/60 bg-muted/15 px-4 py-4 dark:bg-muted/10 sm:px-6 sm:py-5">
            <h3 className="font-heading text-sm font-semibold text-foreground sm:text-base">What you can do today</h3>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground sm:text-sm">
              These are the shipped pieces you can use in the product right now—each step feeds the same structured vault
              and graph.
            </p>
          </header>

          <div className="px-4 py-5 sm:px-6 sm:py-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">Capabilities</p>
            <ul
              className="mt-3 grid list-none gap-3 p-0 sm:grid-cols-2 sm:gap-x-8 sm:gap-y-3"
              aria-label="Current MVP capabilities"
            >
              {[
                "Connect your digital footprint, starting with email scanning.",
                "Automatically detect accounts and services from connected sources.",
                "Store findings in a structured vault.",
                "Visualize everything as a connected graph.",
              ].map((text) => (
                <li key={text} className="flex gap-2.5 text-sm leading-snug text-muted-foreground">
                  <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-primary/75" aria-hidden />
                  <span>{text}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-t border-border/60 bg-muted/10 px-4 py-5 dark:bg-muted/5 sm:px-6 sm:py-6">
            <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
              Ask and measure
            </p>
            <p className="mt-1 text-xs text-muted-foreground">
              Once data is in the vault, you can query it in plain language and read basic health signals.
            </p>
            <div className="mt-5 grid gap-6 sm:grid-cols-2 sm:items-start sm:gap-8">
              <div className="min-w-0">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground/90">Example questions</h4>
                <ul
                  className="mt-3 list-disc space-y-2 pl-4 text-sm leading-snug text-muted-foreground marker:text-primary/65"
                  aria-label="Example questions you can ask"
                >
                  <li>What accounts use this email?</li>
                  <li>Where am I most exposed?</li>
                </ul>
              </div>
              <div className="min-w-0 border-t border-border/50 pt-6 sm:border-t-0 sm:border-l sm:pt-0 sm:pl-8">
                <h4 className="text-xs font-semibold uppercase tracking-wide text-foreground/90">Insights you can surface</h4>
                <ul className="mt-3 list-disc space-y-2 pl-4 text-sm leading-snug text-muted-foreground marker:text-primary/65">
                  <li>Account count</li>
                  <li>Duplicates</li>
                  <li>Fragmentation</li>
                  <li>Risk concentration</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        <Callout className="mt-6">
          <p>
            <span className="font-semibold text-foreground">What this proves: </span>
            people need a structured, queryable, controllable map of their digital life—not another hidden profile in a
            vendor dashboard.
          </p>
        </Callout>
      </section>

      <section aria-labelledby="landing-different-heading" className="border-t border-border/50 pt-16 md:pt-20">
        <SubsectionTitle
          id="landing-different-heading"
          eyebrow="What makes this different"
          title="We map relationships—not just rows"
          subtitle="Most tools optimize a single category. We focus on how your identity actually connects across services."
        />

        <div className="mt-10 space-y-8">
          <div className="grid gap-4 sm:grid-cols-2 sm:items-stretch sm:gap-5">
            <article className="flex flex-col rounded-2xl border border-border/80 bg-card/50 p-5 dark:border-border/60 dark:bg-card/25 sm:p-6">
              <h3 className="border-b border-border/50 pb-3 font-heading text-sm font-semibold text-foreground sm:text-base">
                What many tools focus on
              </h3>
              <ul className="mt-4 flex flex-1 flex-col gap-2.5 text-sm text-muted-foreground" role="list">
                {["Storing passwords", "Tracking subscriptions", "Managing files"].map((item) => (
                  <li key={item} className="flex gap-2.5 leading-snug">
                    <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-muted-foreground/45" aria-hidden />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </article>

            <article className="flex flex-col rounded-2xl border border-primary/35 bg-primary/[0.06] p-5 ring-1 ring-primary/15 dark:border-primary/45 dark:bg-primary/[0.09] dark:ring-primary/25 dark:shadow-[0_0_40px_-14px_rgba(30,157,241,0.28)] sm:p-6">
              <h3 className="border-b border-primary/20 pb-3 font-heading text-sm font-semibold text-foreground sm:text-base">
                What we do instead
              </h3>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-muted-foreground sm:text-[0.9375rem] sm:leading-relaxed">
                We map <span className="font-semibold text-foreground">relationships</span> across your footprint so the
                model stays alive as you add services and devices.
              </p>
            </article>
          </div>

          <div
            className="rounded-2xl border border-border/70 bg-muted/20 px-5 py-6 dark:bg-muted/10 sm:px-8 sm:py-7"
            aria-labelledby="landing-different-links-label"
          >
            <p
              id="landing-different-links-label"
              className="text-center text-[11px] font-medium uppercase tracking-[0.18em] text-muted-foreground"
            >
              Example links
            </p>
            <ul
              className="mx-auto mt-5 flex max-w-lg flex-col items-center gap-3 sm:mt-6"
              aria-label="How entity types connect in the identity graph"
            >
              {[
                ["Accounts", "Emails"],
                ["Emails", "Services"],
                ["Services", "Payments"],
                ["Devices", "Access"],
              ].map(([a, b]) => (
                <li key={`${a}-${b}`} className="flex w-full max-w-md items-center justify-center gap-2.5 sm:gap-3">
                  <span className="inline-flex min-h-9 min-w-0 flex-1 items-center justify-center rounded-full border border-border/90 bg-background px-3 py-2 text-center text-sm font-medium text-foreground shadow-sm dark:border-border/70 dark:bg-background/90">
                    {a}
                  </span>
                  <ArrowRight className="h-4 w-4 shrink-0 text-primary" strokeWidth={2} aria-hidden />
                  <span className="inline-flex min-h-9 min-w-0 flex-1 items-center justify-center rounded-full border border-border/90 bg-background px-3 py-2 text-center text-sm font-medium text-foreground shadow-sm dark:border-border/70 dark:bg-background/90">
                    {b}
                  </span>
                </li>
              ))}
            </ul>
            <p className="mt-5 text-center text-sm leading-snug text-muted-foreground sm:mt-6">
              Together, this forms a living identity graph.
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="landing-roadmap-heading" className="border-t border-border/50 pt-16 md:pt-20">
        <SubsectionTitle
          id="landing-roadmap-heading"
          eyebrow="Product roadmap"
          title="Building toward full digital sovereignty"
          subtitle="Phased delivery: visibility first, then control, intelligence, automation, and open infrastructure—each phase earns the next."
        />

        <div className="mt-10 w-full">
          <ol className="list-none space-y-8 p-0 sm:space-y-10">
            {roadmapPhases.map((block, index) => {
              const n = index + 1;
              const onLeft = index % 2 === 0;
              const badge = (
                <span
                  className={cn(
                    "flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 bg-background text-sm font-bold tabular-nums leading-none tracking-tight",
                    accentRing[block.accent],
                  )}
                  aria-hidden
                >
                  {n}
                </span>
              );

              const card = (
                <article className="w-full max-w-xl rounded-2xl border border-border/70 bg-card/30 p-4 shadow-sm dark:bg-card/15 sm:p-5">
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                    <p className="text-xs font-semibold uppercase tracking-wide text-primary/90">{block.phase}</p>
                    <span className="text-muted-foreground/50" aria-hidden>
                      ·
                    </span>
                    <h3 className="font-heading text-base font-semibold text-foreground sm:text-lg">{block.title}</h3>
                  </div>
                  <ul className="mt-4 space-y-3">
                    {block.items.map((item) => (
                      <li key={item.label} className="flex gap-3">
                        <span
                          className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border/50 bg-muted/20 text-primary"
                          aria-hidden
                        >
                          <item.icon className="h-4 w-4" strokeWidth={2} />
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-foreground">{item.label}</p>
                          <p className="mt-0.5 text-sm leading-snug text-muted-foreground">{item.detail}</p>
                          {item.examples?.length ? (
                            <ul className="mt-2 space-y-1 border-l-2 border-primary/20 pl-3 text-sm italic text-muted-foreground">
                              {item.examples.map((ex) => (
                                <li key={ex}>“{ex}”</li>
                              ))}
                            </ul>
                          ) : null}
                        </div>
                      </li>
                    ))}
                  </ul>
                  <Callout className="mt-5 border-border/40 bg-muted/20 dark:bg-muted/10">
                    <p>
                      <span className="font-semibold text-foreground">Goal: </span>
                      {block.goal}
                    </p>
                  </Callout>
                </article>
              );

              return (
                <li key={block.phase} className="min-w-0">
                  <span className="sr-only">
                    Step {n}: {block.phase} — {block.title}
                  </span>
                  {/* Mobile: number on the outer edge (left or right) */}
                  <div
                    className={cn(
                      "flex items-start gap-3 sm:gap-4 md:hidden",
                      !onLeft && "flex-row-reverse",
                    )}
                  >
                    {badge}
                    <div className="min-w-0 flex-1">{card}</div>
                  </div>

                  {/* Desktop: alternating sides; phase number on the outer edge only */}
                  <div className="hidden min-w-0 items-start gap-4 md:flex lg:gap-5">
                    {onLeft ? (
                      <>
                        {badge}
                        <div className="min-w-0 w-full max-w-xl shrink-0">{card}</div>
                        <div className="min-w-0 flex-1" aria-hidden />
                      </>
                    ) : (
                      <>
                        <div className="min-w-0 flex-1" aria-hidden />
                        <div className="min-w-0 w-full max-w-xl shrink-0">{card}</div>
                        {badge}
                      </>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        </div>

        <div className="mt-4 text-center text-xs text-muted-foreground">
          <p>
            <span className="font-medium text-foreground">Phase 2 onward: </span>
            password management, privacy tooling, and the browser extension are planned next; timelines will follow early
            graph feedback.
          </p>
        </div>
      </section>

      <section aria-labelledby="landing-vision-heading" className="border-t border-border/50 pt-16 md:pt-20">
        <SubsectionTitle
          id="landing-vision-heading"
          eyebrow="Long-term vision"
          title="Your identity as an operating system"
          subtitle="One system for your digital presence, one graph that represents you, one interface to steer what happens next."
        />

        <div className="mx-auto mt-8 max-w-2xl space-y-4 text-center text-sm leading-relaxed text-muted-foreground sm:text-base">
          <p>Over time, this becomes a personal sovereignty layer for the internet: open, inspectable, and anchored in what you choose to connect.</p>
        </div>

        <div className="mx-auto mt-6 flex justify-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-border/70 bg-card/40 px-4 py-2 text-sm font-medium text-foreground dark:bg-card/20">
            <Compass className="h-4 w-4 text-primary" aria-hidden />
            A personal sovereignty layer for the internet
          </div>
        </div>
      </section>

      <aside
        className="rounded-2xl border border-border bg-muted/20 px-4 py-5 dark:bg-muted/10 sm:px-6 sm:py-6"
        aria-labelledby="landing-trust-heading"
      >
        <h2 id="landing-trust-heading" className="font-heading text-base font-semibold text-foreground sm:text-lg">
          Important: what this is—and isn&apos;t
        </h2>
        <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
          This is <span className="font-medium text-foreground">not</span> another password manager or crypto wallet. It
          is the foundation for a new way to <span className="font-medium text-foreground">understand</span> and{" "}
          <span className="font-medium text-foreground">control</span> your digital identity—starting with a structured,
          queryable map you actually own.
        </p>
      </aside>
    </div>
  );
}
