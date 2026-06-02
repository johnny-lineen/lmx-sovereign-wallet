"use client";

import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

type ScanWizardShellProps = {
  children: ReactNode;
  className?: string;
};

export function ScanWizardShell({ children, className }: ScanWizardShellProps) {
  return (
    <div className={cn("mx-auto w-full max-w-lg", className)}>
      <div className="overflow-hidden rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-6 shadow-[0_0_60px_-12px_rgba(34,211,238,0.12)] backdrop-blur-sm sm:p-7">
        {children}
      </div>
    </div>
  );
}
