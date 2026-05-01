import { Github, Linkedin, Twitter } from "lucide-react";

import { cn } from "@/lib/utils";

function SocialBubble({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span
      className={cn(
        "flex size-8 items-center justify-center rounded-full border border-white/[0.08] bg-white/[0.04] text-slate-400",
        className,
      )}
    >
      {children}
    </span>
  );
}

export function LandingHeroPreview({ className }: { className?: string }) {
  return (
    <div
      data-slot="landing-hero-preview"
      className={cn(
        "relative overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 shadow-[0_0_60px_-12px_rgba(34,211,238,0.15)] backdrop-blur-sm",
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px before:bg-gradient-to-r before:from-transparent before:via-violet-400/40 before:to-transparent",
        className,
      )}
    >
      <div className="flex gap-4">
        <div className="flex size-14 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-500/20 to-teal-600/10 font-mono text-sm font-semibold text-cyan-200">
          AM
        </div>
        <div className="min-w-0 flex-1 space-y-1">
          <span className="inline-block rounded border border-cyan-500/25 bg-cyan-500/10 px-2 py-0.5 font-mono text-[10px] font-medium uppercase tracking-wider text-cyan-300/90">
            Run snapshot
          </span>
          <h3 className="truncate font-heading text-xl font-semibold tracking-tight text-white">Alex Morgan</h3>
          <p className="font-mono text-sm text-slate-400">verified identity seed</p>
        </div>
      </div>
      <p className="mt-5 text-sm leading-relaxed text-slate-400">
        One run gives you a structured snapshot: accounts, breaches, emails, domains, and signals before you promote
        confirmed findings into your vault graph.
      </p>
      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-white/[0.06] pt-5">
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500">Accounts + signals</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-white">24</p>
        </div>
        <div>
          <p className="font-mono text-[10px] font-semibold uppercase tracking-wider text-slate-500">Open insights</p>
          <p className="mt-1 font-mono text-lg font-semibold tabular-nums text-white">6</p>
        </div>
      </div>
      <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-white/[0.06] pt-5">
        <div className="flex items-center gap-2">
          <SocialBubble>
            <Twitter className="size-3.5" aria-hidden />
          </SocialBubble>
          <SocialBubble>
            <Github className="size-3.5" aria-hidden />
          </SocialBubble>
          <SocialBubble>
            <Linkedin className="size-3.5" aria-hidden />
          </SocialBubble>
        </div>
        <span className="text-xs text-slate-500">ready to review, link, and prioritize</span>
      </div>
    </div>
  );
}
