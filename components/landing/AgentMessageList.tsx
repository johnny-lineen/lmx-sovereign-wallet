"use client";

import { Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

export type AgentChatMessage = { id: string; role: "user" | "assistant"; content: string };

type AgentMessageListProps = {
  messages: AgentChatMessage[];
  loading: boolean;
  loadingText?: string;
};

export function AgentMessageList({ messages, loading, loadingText = "Thinking…" }: AgentMessageListProps) {
  const empty = messages.length === 0;

  return (
    <div
      data-slot="landing-agent-messages"
      className={cn(
        "max-h-[min(20rem,48dvh)] space-y-4 overflow-y-auto overflow-x-hidden py-1 pr-1 text-[0.9375rem] leading-relaxed [scrollbar-gutter:stable]",
      )}
      role="log"
      aria-live="polite"
      aria-relevant="additions"
    >
      {empty ? (
        <div className="flex min-h-[9.5rem] flex-col justify-center gap-2 px-2 py-2 text-center sm:min-h-[10rem]">
          <p className="font-heading text-[0.9375rem] font-medium tracking-tight text-foreground">Start with a question</p>
          <p className="mx-auto max-w-[22rem] text-pretty text-sm leading-relaxed text-muted-foreground">
            Use a suggestion below or type your own. Replies stay within our public product story—vault, graph, insights, and roadmap.
          </p>
        </div>
      ) : (
        messages.map((m) => (
          <div
            key={m.id}
            className={cn("flex flex-col gap-1", m.role === "user" ? "items-end" : "items-start")}
          >
            <span className="px-1 text-[0.65rem] font-medium text-muted-foreground/90">
              {m.role === "user" ? "You" : "LMX"}
            </span>
            <div
              className={cn(
                "max-w-[min(100%,28rem)] rounded-2xl px-3.5 py-2.5 sm:px-4 sm:py-3",
                m.role === "user"
                  ? "bg-primary/12 text-foreground"
                  : "bg-muted/50 text-foreground/95 dark:bg-muted/25",
              )}
            >
              <p className="whitespace-pre-wrap text-pretty">{m.content}</p>
            </div>
          </div>
        ))
      )}
      {loading ? (
        <div className="flex items-center gap-2.5 pl-1 text-muted-foreground">
          <Loader2 className="size-4 shrink-0 animate-spin opacity-80" aria-hidden />
          <span className="text-sm">{loadingText}</span>
        </div>
      ) : null}
    </div>
  );
}
