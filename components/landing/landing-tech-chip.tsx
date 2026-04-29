import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function LandingTechChip({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md border border-border/50 bg-background/40 px-2 py-0.5 font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-muted-foreground backdrop-blur-sm dark:bg-background/25",
        className,
      )}
    >
      {children}
    </span>
  );
}
