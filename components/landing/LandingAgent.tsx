"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Orbit, Search } from "lucide-react";

const PLATFORM_CHIPS = ["GitHub", "X", "Reddit", "LinkedIn", "YouTube"] as const;
const DEMO_RESULTS = [
  { platform: "GitHub", title: "John Doe", handle: "@johndoe", detail: "24 repos", meta: "187 followers" },
  { platform: "X", title: "John Doe", handle: "@johndoe", detail: "thoughts on tech and coffee", meta: "3.2K followers" },
  { platform: "Reddit", title: "u/johndoe", handle: "u/johndoe", detail: "12.4K karma", meta: "4y account age" },
] as const;
const DEMO_STEPS = ["running adapters", "bucketing pipelines", "staging graph-ready hits"] as const;

export function LandingAgent() {
  const [isActivated, setIsActivated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);
  const [demoStarted, setDemoStarted] = useState(false);
  const [visibleDemoResults, setVisibleDemoResults] = useState(0);

  const playQuickDemo = useCallback(async () => {
    if (loading) return;
    setIsActivated(true);
    setDemoStarted(true);
    setVisibleDemoResults(0);
    setStepIndex(0);
    setProgress(12);
    setLoading(true);

    try {
      const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
      await wait(450);
      setProgress(38);
      setStepIndex(1);
      await wait(620);
      setProgress(71);
      setStepIndex(2);
      await wait(740);
      setProgress(100);
      setLoading(false);

      for (let i = 1; i <= DEMO_RESULTS.length; i += 1) {
        await wait(220);
        setVisibleDemoResults(i);
      }
    } finally {
      setLoading(false);
    }
  }, [loading]);

  useEffect(() => {
    const triggerFromHash = () => {
      if (window.location.hash !== "#landing-agent-play") return;
      setIsActivated(true);
      window.requestAnimationFrame(() => {
        document.getElementById("landing-agent")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      void playQuickDemo();
      window.requestAnimationFrame(() => {
        window.history.replaceState(null, "", "#landing-agent");
      });
    };

    triggerFromHash();
    window.addEventListener("hashchange", triggerFromHash);
    return () => window.removeEventListener("hashchange", triggerFromHash);
  }, [playQuickDemo]);

  useEffect(() => {
    const onTriggerClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest('a[href="#landing-agent-play"]');
      if (!anchor) return;

      event.preventDefault();
      setIsActivated(true);
      window.requestAnimationFrame(() => {
        document.getElementById("landing-agent")?.scrollIntoView({ behavior: "smooth", block: "start" });
      });
      void playQuickDemo();
      window.requestAnimationFrame(() => {
        window.history.replaceState(null, "", "#landing-agent");
      });
    };

    document.addEventListener("click", onTriggerClick);
    return () => document.removeEventListener("click", onTriggerClick);
  }, [playQuickDemo]);

  const runningText = loading ? DEMO_STEPS[stepIndex] : demoStarted ? "complete" : "waiting";

  return (
    <section
      id="landing-agent"
      data-slot="landing-agent"
      className={`relative bg-[#05070a] ${isActivated ? "border-t border-white/[0.06] px-5 py-14 sm:px-8 lg:px-12 lg:py-20 xl:px-16" : "h-0 overflow-hidden border-0 p-0"}`}
      aria-labelledby="landing-agent-heading"
    >
      <div id="landing-agent-play" aria-hidden className="absolute -top-4" />
      <div className="mx-auto w-full max-w-6xl">
        <div className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-5 shadow-[0_0_48px_-16px_rgba(34,211,238,0.12)] backdrop-blur-sm sm:p-6">
          <header className="mb-5 flex items-start gap-3 sm:mb-6">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-cyan-500/10 text-cyan-400">
              <Orbit className="size-[1.125rem]" aria-hidden />
            </span>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                <h2
                  id="landing-agent-heading"
                  className="font-heading text-lg font-semibold tracking-tight text-white"
                >
                  See it in action
                </h2>
              </div>
              <p className="text-pretty text-sm leading-relaxed text-slate-400">
                Stylized preview of a footprint run: adapters fan out, pipeline buckets fill in, then you promote the
                strongest account hits into the vault and graph.
              </p>
            </div>
          </header>

          <div className="space-y-4">
            <div className="rounded-xl border border-cyan-900/45 bg-[#081229]/80 p-3 sm:p-4">
              <div className="flex flex-col gap-3">
                <div className="flex items-center gap-2 rounded-xl border border-slate-700/80 bg-[#071022]/95 px-3 py-2.5">
                  <span className="font-mono text-[10px] uppercase tracking-wide text-slate-500">Username</span>
                  <p className="font-mono text-sm text-slate-200">johndoe</p>
                </div>
                <div className="h-1.5 w-full overflow-hidden rounded-full bg-cyan-950/90">
                  <div
                    className={`h-full rounded-full bg-cyan-400 transition-all duration-500 ${loading ? "animate-pulse" : ""}`}
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="text-cyan-200/90">{runningText}</span>
                  <span className="text-cyan-100/80">
                    {visibleDemoResults} result{visibleDemoResults === 1 ? "" : "s"} found
                  </span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {PLATFORM_CHIPS.map((chip, idx) => (
                    <span
                      key={chip}
                      className={`rounded border px-2 py-0.5 text-[10px] uppercase tracking-wide ${
                        visibleDemoResults > 0 && idx < visibleDemoResults + 1
                          ? "border-cyan-400/45 bg-cyan-500/10 text-cyan-200"
                          : "border-slate-700/80 bg-slate-900/70 text-slate-500"
                      }`}
                    >
                      {chip}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {DEMO_RESULTS.slice(0, visibleDemoResults).map((r) => (
                <article key={r.platform} className="rounded-xl border border-cyan-400/30 bg-slate-900/85 p-3">
                  <p className="text-[10px] font-semibold uppercase tracking-wide text-cyan-300/90">{r.platform}</p>
                  <p className="mt-1 text-sm font-semibold text-cyan-50">{r.title}</p>
                  <p className="text-xs text-cyan-100/70">{r.handle}</p>
                  <p className="mt-2 text-xs text-cyan-100/70">{r.detail}</p>
                  <p className="mt-1 text-xs text-cyan-200">{r.meta}</p>
                </article>
              ))}
            </div>

            <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
              <button
                type="button"
                onClick={() => void playQuickDemo()}
                disabled={loading}
                className="inline-flex h-10 items-center justify-center rounded-full border border-white/15 px-5 text-xs font-semibold uppercase tracking-wide text-slate-300 transition hover:border-cyan-500/40 hover:text-white disabled:opacity-60"
              >
                Replay demo
              </button>
              <Link
                href="/sign-in"
                className="inline-flex h-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 via-cyan-500 to-teal-600 px-5 text-xs font-bold uppercase tracking-wide text-black shadow-[0_0_28px_-4px_rgba(34,211,238,0.45)] transition hover:shadow-[0_0_36px_-2px_rgba(34,211,238,0.55)]"
              >
                Scan now
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
