import Link from "next/link";
import { Layers } from "lucide-react";

import { cn } from "@/lib/utils";

export function LandingTopBar() {
  return (
    <header
      data-slot="landing-top-bar"
      className="sticky top-0 z-50 shrink-0 border-b border-white/[0.06] bg-[#05070a]/85 backdrop-blur-md supports-[backdrop-filter]:bg-[#05070a]/75"
    >
      <div className="mx-auto flex h-12 w-full max-w-6xl items-center justify-between gap-3 px-5 sm:h-14 sm:px-8 lg:px-12">
        <Link href="/" className="group flex min-w-0 items-center gap-2.5">
          <span className="flex size-8 items-center justify-center rounded-lg border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 transition-colors group-hover:border-cyan-400/35">
            <Layers className="size-4" aria-hidden />
          </span>
          <span className="truncate font-mono text-sm font-bold tracking-tight text-white sm:text-[0.9375rem]">
            LMX
          </span>
        </Link>

        <Link
          href="/sign-in"
          className={cn(
            "inline-flex h-9 shrink-0 items-center justify-center rounded-full px-5 text-xs font-bold uppercase tracking-wide text-black sm:h-9 sm:px-6 sm:text-[11px]",
            "bg-gradient-to-br from-cyan-400 via-cyan-500 to-teal-600 shadow-[0_0_20px_-4px_rgba(34,211,238,0.35)] transition-[transform,box-shadow] hover:shadow-[0_0_28px_-2px_rgba(34,211,238,0.5)] motion-safe:hover:scale-[1.02]",
          )}
        >
          Scan now
        </Link>
      </div>
    </header>
  );
}
