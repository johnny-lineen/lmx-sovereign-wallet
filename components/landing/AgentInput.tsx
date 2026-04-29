"use client";

import { Loader2, SendHorizontal } from "lucide-react";

import { buttonVariants } from "@/components/ui/button-variants";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type AgentInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSubmit: () => void;
  loading: boolean;
};

export function AgentInput({ value, onChange, onSubmit, loading }: AgentInputProps) {
  return (
    <form
      data-slot="landing-agent-input"
      className="rounded-2xl border border-border/40 bg-muted/20 p-1.5 dark:bg-muted/10"
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
    >
      <div className="flex flex-col gap-2 sm:flex-row sm:items-stretch">
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Ask about scan, vault, graph, security, or early access…"
          disabled={loading}
          rows={2}
          className="min-h-[3.25rem] flex-1 resize-none border-0 bg-transparent px-3 py-2.5 text-sm text-foreground shadow-none placeholder:text-muted-foreground/65 focus-visible:ring-0 focus-visible:ring-offset-0"
          maxLength={600}
          aria-label="Your question"
        />
        <button
          type="submit"
          disabled={loading || !value.trim()}
          className={cn(
            buttonVariants({ size: "default" }),
            "shrink-0 gap-2 self-end rounded-xl px-5 sm:self-stretch sm:rounded-xl sm:px-6",
          )}
        >
          {loading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <SendHorizontal className="size-4" aria-hidden />}
          Send
        </button>
      </div>
    </form>
  );
}
