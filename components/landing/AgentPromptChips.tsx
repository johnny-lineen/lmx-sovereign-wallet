"use client";

import { cn } from "@/lib/utils";

type AgentPromptChipsProps = {
  prompts: string[];
  disabled?: boolean;
  onSelect: (prompt: string) => void;
};

export function AgentPromptChips({ prompts, disabled, onSelect }: AgentPromptChipsProps) {
  if (prompts.length === 0) return null;

  return (
    <div
      className="flex flex-wrap gap-1.5 sm:gap-2"
      data-slot="landing-agent-prompt-chips"
    >
      {prompts.map((q) => (
        <button
          key={q}
          type="button"
          disabled={disabled}
          onClick={() => onSelect(q)}
          className={cn(
            "max-w-full rounded-full border border-transparent bg-muted/45 px-3 py-1.5 text-left text-[0.8125rem] font-normal leading-snug text-foreground/85",
            "transition-[background-color,color,box-shadow] duration-150",
            "hover:bg-muted/75 hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
            "disabled:pointer-events-none disabled:opacity-50",
            "sm:px-3.5 sm:py-2",
          )}
        >
          {q}
        </button>
      ))}
    </div>
  );
}
