"use client";

import { Button } from "@/components/ui/button";

type ScanOnboardingHintProps = {
  title: string;
  body: string;
  onDismiss: () => void;
};

export function ScanOnboardingHint({ title, body, onDismiss }: ScanOnboardingHintProps) {
  return (
    <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm">
      <p className="font-medium text-foreground">{title}</p>
      <p className="mt-1 text-muted-foreground">{body}</p>
      <div className="mt-2">
        <Button type="button" variant="ghost" size="xs" className="text-muted-foreground" onClick={onDismiss}>
          Got it
        </Button>
      </div>
    </div>
  );
}
