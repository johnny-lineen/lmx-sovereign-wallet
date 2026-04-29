import type { LandingAgentIntent } from "@/lib/landing-agent/types";

const STAGE1 = [
  "What does LMX Sovereign Wallet do in one sentence?",
  "Why map my digital footprint instead of just securing passwords?",
  "Is this a crypto wallet, or something else entirely?",
  "What problem are you solving for teams and individuals?",
] as const;

const STAGE2 = [
  "Walk me through how the inbox scan works end to end.",
  "What becomes a vault item after a scan?",
  "How do relationships end up on the graph?",
  "What do \"insights\" look like in practice?",
] as const;

const STAGE3 = [
  "How is this different from 1Password or LastPass?",
  "Why is the graph the center of the product, not an add-on?",
  "I already use a VPN and MFA - what does LMX add?",
  "How does this compare to a traditional security dashboard?",
] as const;

const STAGE4 = [
  "How do you handle data security and retention?",
  "What's included in the MVP right now?",
  "What is intentionally not built yet?",
  "Do you store or manage my passwords?",
] as const;

const STAGE5 = [
  "How do I request early access or a demo?",
  "What's on the near-term roadmap?",
  "Who gets the most value from joining the waitlist first?",
] as const;

/** Shared by client empty state and server; keep in sync with `buildSuggestedPrompts` initial phase. */
export const INITIAL_SUGGESTED_PROMPTS: string[] = [...STAGE1.slice(0, 4)];

function takeUnique(primary: readonly string[], secondary: readonly string[], cap: number): string[] {
  const out: string[] = [];
  const add = (s: string) => {
    if (out.includes(s) || out.length >= cap) return;
    out.push(s);
  };
  for (const s of primary) add(s);
  for (const s of secondary) add(s);
  return out;
}

/**
 * Suggested prompts after a reply: advance the journey based on detected intent.
 */
export function getFollowUpSuggestedPrompts(intent: LandingAgentIntent): string[] {
  switch (intent) {
    case "what_is_this":
    case "why_it_matters":
    case "who_is_it_for":
      return takeUnique(STAGE2, STAGE3, 4);

    case "how_it_works":
    case "what_it_scans":
    case "graph_explainer":
      return takeUnique(STAGE3, STAGE4, 4);

    case "difference_vs_crypto_wallet":
    case "difference_vs_password_manager":
    case "difference_vs_vpn":
      return takeUnique(STAGE4, STAGE5, 4);

    case "mvp_scope":
    case "roadmap":
    case "trust_security":
      return takeUnique(STAGE5, STAGE2, 4);

    case "access_cta":
      return takeUnique(STAGE2, STAGE4, 4);

    case "fallback_general":
    default:
      return takeUnique(STAGE1, STAGE2, 4);
  }
}

export type SuggestionPhase = "initial" | "reply";

export function buildSuggestedPrompts(intent: LandingAgentIntent, opts: { phase: SuggestionPhase }): string[] {
  if (opts.phase === "initial") {
    return [...INITIAL_SUGGESTED_PROMPTS];
  }
  return getFollowUpSuggestedPrompts(intent);
}
