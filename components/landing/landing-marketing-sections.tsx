import type { ReactNode } from "react";
import Link from "next/link";
import { Check, GitBranch, Radio, Shield, Sparkles, X } from "lucide-react";

import { cn } from "@/lib/utils";

const ctaGradient =
  "inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 via-cyan-500 to-teal-600 px-8 text-sm font-bold uppercase tracking-wide text-black shadow-[0_0_28px_-4px_rgba(34,211,238,0.4)] transition-[transform,box-shadow] hover:shadow-[0_0_36px_-2px_rgba(34,211,238,0.5)] motion-safe:hover:scale-[1.02]";

function SectionShell({
  id,
  children,
  className,
  innerClassName,
}: {
  id?: string;
  children: ReactNode;
  className?: string;
  innerClassName?: string;
}) {
  return (
    <section
      id={id}
      className={cn("border-t border-white/[0.06] px-5 py-20 sm:px-8 sm:py-24 lg:px-12 lg:py-28", className)}
    >
      <div className={cn("mx-auto max-w-6xl", innerClassName)}>{children}</div>
    </section>
  );
}

function SectionTitle({
  eyebrow,
  title,
  subtitle,
  align = "center",
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  align?: "center" | "left";
}) {
  return (
    <div className={cn("max-w-3xl", align === "center" ? "mx-auto text-center" : "text-left")}>
      <p className="font-mono text-[11px] font-medium uppercase tracking-[0.2em] text-cyan-400/90">{eyebrow}</p>
      <h2 className="mt-3 font-heading text-3xl font-semibold tracking-tight text-white sm:text-4xl">{title}</h2>
      <p className="mt-4 text-pretty text-base leading-relaxed text-slate-400 sm:text-lg">{subtitle}</p>
    </div>
  );
}

function StatCard({ value, label, sub }: { value: string; label: string; sub: string }) {
  return (
    <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-6 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)]">
      <p className="font-mono text-3xl font-semibold tracking-tight text-white sm:text-4xl">{value}</p>
      <p className="mt-2 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-sm leading-snug text-slate-500">{sub}</p>
    </div>
  );
}

export function LandingMarketingSections() {
  return (
    <>
      <SectionShell className="bg-[#080a0f]">
        <div className="grid gap-14 lg:grid-cols-2 lg:items-center lg:gap-16">
          <SectionTitle
            align="left"
            eyebrow="Live pipeline"
            title="Watch run progress update live."
            subtitle="Adapters run in parallel and stream updates to the run timeline. You see hits, misses, and stage status as processing completes."
          />
          <div
            className="overflow-hidden rounded-2xl border border-white/[0.1] bg-[#0c1018] shadow-[0_0_48px_-20px_rgba(34,211,238,0.2)]"
            aria-hidden
          >
            <div className="flex items-center justify-between border-b border-white/[0.06] px-4 py-3">
              <div className="flex items-center gap-2">
                <Radio className="size-4 text-cyan-400" />
                <span className="font-mono text-xs text-slate-400">Footprint scan</span>
              </div>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide text-emerald-400">
                Live
              </span>
            </div>
            <div className="space-y-1 border-b border-white/[0.06] px-4 py-3">
              <p className="font-mono text-[10px] uppercase tracking-wider text-slate-500">Seed</p>
              <p className="font-mono text-sm text-white">Alex Morgan · verified email</p>
            </div>
            <ul className="divide-y divide-white/[0.05] p-2">
              {[
                { name: "Public account surfaces", state: "done", detail: "12 candidates · 3 low confidence" },
                { name: "Breach source check", state: "done", detail: "No new critical exposures" },
                { name: "Public search signals", state: "run", detail: "Resolving web candidates…" },
                { name: "Vault linking & review", state: "wait", detail: "Queued after signal enrichment" },
              ].map((row) => (
                <li key={row.name} className="flex items-start gap-3 rounded-lg px-2 py-3 sm:px-3">
                  <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.03]">
                    {row.state === "done" ? (
                      <Check className="size-3.5 text-emerald-400" />
                    ) : row.state === "run" ? (
                      <span className="size-3.5 animate-pulse rounded-full bg-cyan-400/80 motion-reduce:animate-none" />
                    ) : (
                      <span className="size-2 rounded-full bg-slate-600" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-200">{row.name}</p>
                    <p className="mt-0.5 text-xs text-slate-500">{row.detail}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </SectionShell>

      <SectionShell className="bg-[#05070a]">
        <div className="grid gap-14 lg:grid-cols-2 lg:items-center lg:gap-20">
          <div className="order-2 lg:order-1">
            <div className="relative rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.04] to-transparent p-8 pl-6 sm:p-10">
              <div className="font-mono text-xs text-cyan-400/90">Cascade</div>
              <div className="mt-6 space-y-0">
                <div className="flex gap-4">
                  <div className="flex w-8 shrink-0 flex-col items-center">
                    <div className="size-2.5 rounded-full bg-cyan-400" />
                    <div className="min-h-[2.5rem] w-px flex-1 bg-gradient-to-b from-cyan-500/50 to-white/10" />
                  </div>
                  <div className="pb-6">
                    <p className="font-mono text-sm text-white">@alexm</p>
                    <p className="text-xs text-slate-500">Seed handle</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex w-8 shrink-0 flex-col items-center">
                    <div className="size-2.5 rounded-full bg-violet-400/90" />
                    <div className="min-h-[3.5rem] w-px flex-1 bg-gradient-to-b from-violet-500/40 to-white/10" />
                  </div>
                  <div className="pb-6">
                    <p className="font-mono text-sm text-white">alex.m@company.com</p>
                    <p className="text-xs text-slate-500">Discovered / verified</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <div className="flex w-8 shrink-0 flex-col items-center pt-1">
                    <GitBranch className="size-4 text-slate-500" />
                  </div>
                  <div className="grid gap-3 sm:grid-cols-3">
                    {["GitHub", "LinkedIn", "News mentions"].map((t) => (
                      <div
                        key={t}
                        className="rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-3 text-center"
                      >
                        <p className="text-xs font-medium text-slate-300">{t}</p>
                        <p className="mt-1 font-mono text-[10px] uppercase text-slate-600">Linked</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <SectionTitle
              align="left"
              eyebrow="Deep scan"
              title="One scan becomes many signals."
              subtitle="When a run surfaces a new email, username, or strong alias, follow-on adapters run automatically. You get expanded coverage without restarting from scratch."
            />
          </div>
        </div>
      </SectionShell>

      <SectionShell className="bg-[#080a0f]">
        <SectionTitle
          eyebrow="Coverage"
          title="Adapters across your footprint."
          subtitle="Account surfaces, breach checks, public search enrichment, optional inbox context, and graph-linked review—designed to compound instead of returning a flat URL list."
        />
        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard value="6+" label="Core adapters" sub="Username, breach, SERP, inbox, identity match, name hints." />
          <StatCard value="Live" label="Progressive results" sub="See stages complete as the run advances." />
          <StatCard value="1" label="Vault graph" sub="Tie findings back to entities you control." />
          <StatCard value="100%" label="Authorized sources" sub="Public data and APIs you opt into—not dark-web dumps." />
        </div>
      </SectionShell>

      <SectionShell className="bg-[#05070a]">
        <div className="grid gap-10 md:grid-cols-2 md:gap-12">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 sm:p-10">
            <div className="flex size-11 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
              <Sparkles className="size-5" aria-hidden />
            </div>
            <h3 className="mt-6 font-heading text-xl font-semibold text-white">Public &amp; authorized sources</h3>
            <p className="mt-3 text-pretty leading-relaxed text-slate-400">
              We work from profile pages, reputable APIs, breach disclosure indexes where appropriate, and your own
              connected inbox—never scraped password markets or &quot;combo lists&quot; sold as OSINT.
            </p>
          </div>
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] p-8 sm:p-10">
            <div className="flex size-11 items-center justify-center rounded-xl bg-violet-500/10 text-violet-300">
              <Shield className="size-5" aria-hidden />
            </div>
            <h3 className="mt-6 font-heading text-xl font-semibold text-white">Your scan. Your vault.</h3>
            <p className="mt-3 text-pretty leading-relaxed text-slate-400">
              Results stay tied to your account for review and export policies you set. We do not resell search history
              or footprint graphs to data brokers.
            </p>
          </div>
        </div>
      </SectionShell>

      <SectionShell id="compare" className="bg-[#080a0f]">
        <SectionTitle
          eyebrow="Why LMX"
          title="Better signal than guess-and-check scanners."
          subtitle="Many tools only confirm that a URL loads. LMX is built to surface structured context, confidence, and next hops you can act on inside your sovereign wallet."
        />
        <div className="mt-14 overflow-x-auto rounded-2xl border border-white/[0.08] bg-[#0a0d14]">
          <table className="w-full min-w-[36rem] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-white/[0.08]">
                <th className="px-5 py-4 font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  Capability
                </th>
                <th className="px-5 py-4 font-heading text-sm font-semibold text-cyan-300">LMX Sovereign Wallet</th>
                <th className="px-5 py-4 font-heading text-sm font-semibold text-slate-500">Typical free scanners</th>
              </tr>
            </thead>
            <tbody className="text-slate-300">
              {[
                ["Entity summaries (bio, handles, confidence)", "high", "low"],
                ["First-party maintained adapters", "yes", "no"],
                ["Deep cascade on new identifiers", "yes", "rare"],
                ["Account vault + graph linkage", "full", "none"],
                ["Live per-stage progress", "yes", "no"],
              ].map(([cap, lmx, other]) => (
                <tr key={cap} className="border-b border-white/[0.05] last:border-0">
                  <td className="px-5 py-4 text-slate-400">{cap}</td>
                  <td className="px-5 py-4">
                    <CellMark kind={lmx} />
                  </td>
                  <td className="px-5 py-4">
                    <CellMark kind={other} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </SectionShell>

      <SectionShell id="plans" className="bg-[#05070a]">
        <SectionTitle
          eyebrow="Plans"
          title="Simple access. No surprise fees in beta."
          subtitle="We are in early access: start with the footprint scan and vault, then scale as we ship team controls and billing."
        />
        <div className="mt-14 grid gap-6 lg:grid-cols-3">
          {[
            {
              name: "Early access",
              price: "Free during beta",
              blurb: "Footprint scan, review queue, and core vault graph for individuals on the waitlist.",
              cta: "Join waitlist",
              href: "#waitlist",
              highlight: false,
            },
            {
              name: "Pro",
              price: "Coming soon",
              blurb: "Higher scan limits, priority runs, and advanced export controls when billing goes live.",
              cta: "Scan now",
              href: "/sign-up",
              highlight: true,
            },
            {
              name: "Team",
              price: "Contact us",
              blurb: "Shared vault policies, audit trails, and org-wide footprint programs.",
              cta: "Get updates",
              href: "#waitlist",
              highlight: false,
            },
          ].map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "relative flex flex-col rounded-2xl border p-8",
                plan.highlight
                  ? "border-cyan-500/35 bg-gradient-to-b from-cyan-500/10 to-transparent shadow-[0_0_40px_-16px_rgba(34,211,238,0.25)]"
                  : "border-white/[0.08] bg-white/[0.02]",
              )}
            >
              {plan.highlight ? (
                <span className="absolute right-5 top-5 rounded-full bg-cyan-500/20 px-2.5 py-0.5 font-mono text-[10px] font-bold uppercase tracking-wide text-cyan-200">
                  Best value
                </span>
              ) : null}
              <h3 className="font-heading text-lg font-semibold text-white">{plan.name}</h3>
              <p className="mt-2 font-mono text-sm text-cyan-400/90">{plan.price}</p>
              <p className="mt-4 flex-1 text-sm leading-relaxed text-slate-400">{plan.blurb}</p>
              <Link
                href={plan.href}
                className={cn(
                  "mt-8 inline-flex h-11 items-center justify-center rounded-full text-sm font-bold uppercase tracking-wide",
                  plan.highlight ? ctaGradient : "border border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08]",
                )}
              >
                {plan.cta}
              </Link>
            </div>
          ))}
        </div>
      </SectionShell>

      <SectionShell className="border-white/[0.06] bg-gradient-to-b from-[#080a0f] to-[#05070a]">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="font-heading text-3xl font-semibold tracking-tight text-white sm:text-4xl">Start scanning.</h2>
          <p className="mt-4 text-lg text-slate-400">Create an account or join the waitlist—we will meet you there.</p>
          <div className="mt-10 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/sign-up" className={ctaGradient}>
              Scan now
            </Link>
            <Link
              href="#waitlist"
              className="text-sm font-medium text-slate-400 underline-offset-4 transition-colors hover:text-white hover:underline"
            >
              Join waitlist
            </Link>
          </div>
        </div>
      </SectionShell>
    </>
  );
}

function CellMark({ kind }: { kind: string }) {
  const k = kind.toLowerCase();
  if (k === "yes" || k === "full" || k === "high") {
    return (
      <span className="inline-flex items-center gap-2 text-emerald-400">
        <Check className="size-4 shrink-0" aria-hidden />
        <span className="capitalize">{kind}</span>
      </span>
    );
  }
  if (k === "rare") {
    return <span className="text-sm text-amber-400/90">Rare</span>;
  }
  if (k === "no" || k === "none" || k === "low") {
    return (
      <span className="inline-flex items-center gap-2 text-slate-500">
        <X className="size-4 shrink-0 opacity-70" aria-hidden />
        <span className="capitalize">{kind}</span>
      </span>
    );
  }
  return <span>{kind}</span>;
}
