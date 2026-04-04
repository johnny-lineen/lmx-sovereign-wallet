import type { ReactNode } from "react";
import { Database, GitBranch, ScanSearch } from "lucide-react";

import { cn } from "@/lib/utils";

/** Horizontal rhythm break: gradient lines + optional micro-label (primary dots). */
export function LandingDivider({ label, className }: { label?: string; className?: string }) {
  return (
    <div
      className={cn(
        "mx-auto flex w-full max-w-5xl items-center gap-3 px-4 py-7 sm:px-6 sm:py-9",
        className,
      )}
      role="separator"
      aria-hidden={!label}
      aria-label={label}
    >
      <div className="h-px flex-1 bg-gradient-to-r from-transparent via-primary/40 to-border/50" />
      <div className="flex shrink-0 items-center gap-2">
        <span className="h-1 w-1 rounded-full bg-primary/70" aria-hidden />
        {label ? (
          <span className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
        ) : null}
        <span className="h-1 w-1 rounded-full bg-primary/70" aria-hidden />
      </div>
      <div className="h-px flex-1 bg-gradient-to-l from-transparent via-primary/35 to-border/40" />
    </div>
  );
}

/**
 * Alternating landing stripes: true page background vs. secondary wash (`--landing-section-alt` in globals).
 */
export function LandingStripe({
  surface,
  children,
  className,
}: {
  surface: "primary" | "alt";
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "w-full border-t border-border/40",
        surface === "primary"
          ? "bg-gradient-to-b from-background via-background to-accent/50"
          : "bg-landing-section-alt",
        className,
      )}
    >
      {children}
    </div>
  );
}

/** Compact row of branded pills—use between hero and body or between major blocks. */
export function LandingHighlightPills() {
  const items = [
    { icon: Database, label: "Structured vault" },
    { icon: GitBranch, label: "Identity graph" },
    { icon: ScanSearch, label: "Queryable footprint" },
  ] as const;

  return (
    <div
      className="mx-auto flex w-full max-w-3xl flex-wrap items-center justify-center gap-2 px-4 pb-2 pt-4 sm:gap-3 sm:px-6 sm:pb-4 sm:pt-6"
      aria-label="Product focus areas"
    >
      {items.map(({ icon: Icon, label }) => (
        <div
          key={label}
          className="inline-flex items-center gap-2 rounded-full border border-border/60 bg-card/90 px-3 py-1.5 text-xs font-medium text-foreground shadow-md shadow-black/20"
        >
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-primary/12 text-primary" aria-hidden>
            <Icon className="h-3.5 w-3.5" strokeWidth={2} />
          </span>
          {label}
        </div>
      ))}
    </div>
  );
}
