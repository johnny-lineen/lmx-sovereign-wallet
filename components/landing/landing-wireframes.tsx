import { Bot, MessageSquare, Send } from "lucide-react";

import { LandingSectionHeading } from "@/components/landing/landing-section-heading";

/** Wireframe placeholder for product agent (UI only). Solution and roadmap live in `LandingSolutionRoadmapSection`. */
export function LandingWireframes() {
  return (
    <div
      data-slot="landing-wireframes"
      className="mx-auto max-w-5xl space-y-20 px-4 py-16 sm:px-6 md:space-y-24 md:py-24"
    >
      <section aria-labelledby="landing-agent-heading">
        <LandingSectionHeading
          eyebrow="Product agent"
          title="Ask what we are building"
          subtitle="Chat shell for a future assistant—no backend wired yet."
          id="landing-agent-heading"
        />
        <div className="mx-auto mt-12 max-w-2xl overflow-hidden rounded-3xl border border-border bg-card/50 shadow-sm dark:bg-card/30">
          <div className="flex items-center gap-3 border-b border-border px-5 py-4">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Bot className="h-5 w-5" aria-hidden />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">Sovereign wallet assistant</p>
              <p className="text-xs text-muted-foreground">Demo UI — answers not connected</p>
            </div>
            <MessageSquare className="ml-auto h-4 w-4 text-muted-foreground/50" aria-hidden />
          </div>
          <div className="space-y-4 px-5 py-6">
            <div className="ml-auto max-w-[85%] rounded-2xl rounded-tr-md border border-dashed border-primary/25 bg-primary/5 px-4 py-3">
              <p className="text-xs text-muted-foreground">Example prompt (wireframe)</p>
              <p className="mt-1 text-sm text-foreground/90">
                How does the identity graph relate to my wallet?
              </p>
            </div>
            <div className="mr-auto max-w-[90%] rounded-2xl rounded-tl-md border border-dashed border-border bg-muted/25 px-4 py-3 dark:bg-muted/15">
              <p className="text-xs text-muted-foreground">Assistant (placeholder)</p>
              <div className="mt-2 space-y-2">
                <div className="h-2 w-full rounded-full bg-muted-foreground/15" />
                <div className="h-2 w-[94%] rounded-full bg-muted-foreground/12" />
                <div className="h-2 w-[78%] rounded-full bg-muted-foreground/10" />
              </div>
            </div>
          </div>
          <div className="border-t border-border bg-muted/10 p-4 dark:bg-muted/5">
            <div className="flex gap-2">
              <div className="relative min-h-11 flex-1 rounded-xl border border-dashed border-border bg-background/80 px-3 py-2.5 text-sm text-muted-foreground">
                Ask about the idea, roadmap, or architecture…
              </div>
              <button
                type="button"
                disabled
                className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-border bg-muted/40 text-muted-foreground opacity-60"
                aria-label="Send message (disabled in demo)"
              >
                <Send className="h-4 w-4" aria-hidden />
              </button>
            </div>
            <p className="mt-2 text-center text-[11px] text-muted-foreground">
              Backend integration coming next — this is a visual placeholder.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
