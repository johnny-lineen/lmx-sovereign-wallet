"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { Orbit } from "lucide-react";

import { AgentInput } from "@/components/landing/AgentInput";
import { AgentMessageList, type AgentChatMessage } from "@/components/landing/AgentMessageList";
import { AgentPromptChips } from "@/components/landing/AgentPromptChips";
import { buttonVariants } from "@/components/ui/button-variants";
import { INITIAL_SUGGESTED_PROMPTS } from "@/lib/landing-agent/suggestions";
import type { LandingAgentCta, LandingAgentIntent, LandingAgentQueryResponse } from "@/lib/landing-agent/types";
import { cn } from "@/lib/utils";

function formatIntentLabel(intent: string) {
  return intent
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function LandingAgent() {
  const [messages, setMessages] = useState<AgentChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastIntent, setLastIntent] = useState<LandingAgentIntent | null>(null);
  const [suggestedPrompts, setSuggestedPrompts] = useState<string[]>(() => [...INITIAL_SUGGESTED_PROMPTS]);
  const [lastCta, setLastCta] = useState<LandingAgentCta | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!loading && messages.length === 0) return;
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = useCallback(
    async (text: string) => {
      const trimmed = text.trim();
      if (!trimmed || loading) return;
      setError(null);
      setLastCta(null);
      setLoading(true);
      const userId = crypto.randomUUID();
      setMessages((prev) => [...prev, { id: userId, role: "user", content: trimmed }]);
      setDraft("");
      try {
        const res = await fetch("/api/landing-agent/query", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: trimmed }),
        });
        const data = (await res.json()) as Partial<LandingAgentQueryResponse> & { ok?: boolean; error?: string };
        if (!res.ok || data.error || typeof data.answer !== "string" || !data.intent) {
          setError(typeof data.error === "string" ? data.error : "Could not get an answer. Try again.");
          return;
        }
        const body = data as LandingAgentQueryResponse;
        setLastIntent(body.intent);
        setSuggestedPrompts(body.suggestedPrompts?.length ? body.suggestedPrompts : [...INITIAL_SUGGESTED_PROMPTS]);
        setLastCta(body.cta ?? { type: "none" });
        setMessages((prev) => [
          ...prev,
          { id: crypto.randomUUID(), role: "assistant", content: body.answer },
        ]);
      } catch {
        setError("Network error. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    },
    [loading],
  );

  return (
    <section
      id="landing-agent"
      data-slot="landing-agent"
      className="relative border-t border-white/[0.06] bg-[#05070a] px-5 py-14 sm:px-8 lg:px-12 lg:py-20 xl:px-16"
      aria-labelledby="landing-agent-heading"
    >
      <div className="mx-auto w-full max-w-2xl">
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
                {lastIntent ? (
                  <span className="text-[0.6875rem] text-slate-500">· {formatIntentLabel(lastIntent)}</span>
                ) : null}
              </div>
              <p className="text-pretty text-sm leading-relaxed text-slate-400">
                Ask how the vault, graph, and footprint scan work—grounded answers, no marketing fluff.
              </p>
            </div>
          </header>

          <div className="flex flex-col gap-5">
            <AgentMessageList messages={messages} loading={loading} />

            {lastCta && lastCta.type !== "none" ? (
              <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
                <Link
                  href={lastCta.href}
                  className={cn(buttonVariants({ variant: "secondary", size: "sm" }), "gap-1.5 font-medium")}
                >
                  {lastCta.label}
                </Link>
              </div>
            ) : null}

            {error ? (
              <p className="text-center text-sm text-destructive" role="alert">
                {error}
              </p>
            ) : null}

            <div className="space-y-2.5">
              <p className="text-[0.6875rem] font-medium uppercase tracking-wide text-muted-foreground/80">Suggestions</p>
              <AgentPromptChips prompts={suggestedPrompts} disabled={loading} onSelect={(p) => void send(p)} />
            </div>

            <AgentInput value={draft} onChange={setDraft} loading={loading} onSubmit={() => void send(draft)} />
            <div ref={bottomRef} />
          </div>
        </div>
      </div>
    </section>
  );
}
