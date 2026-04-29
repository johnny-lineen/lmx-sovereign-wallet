import { LANDING_AGENT_KNOWLEDGE } from "@/lib/landing-agent/knowledge";
import { messageSuggestsSignIn } from "@/lib/landing-agent/intents";
import type { LandingAgentIntent, LandingKnowledge } from "@/lib/landing-agent/types";

function blocks(direct: string, framing: string, why: string): string {
  return [direct.trim(), framing.trim(), why.trim()].filter(Boolean).join("\n\n");
}

function fallbackAnswer(k: LandingKnowledge, normalized: string): string {
  if (messageSuggestsSignIn(normalized)) {
    return blocks(
      "If you already have an account, use Sign in in the header to open the console (vault, graph, and insights).",
      k.productOverview,
      "If you are new, the waitlist is the right path while we expand early access.",
    );
  }
  return blocks(
    k.oneLiner,
    k.productOverview,
    "Pick a suggested question below to go deeper on the scan, the graph, scope, or access.",
  );
}

export function composeLandingAnswer(
  intent: LandingAgentIntent,
  k: LandingKnowledge = LANDING_AGENT_KNOWLEDGE,
  normalizedMessage = "",
): string {
  switch (intent) {
    case "what_is_this":
      return blocks(
        k.oneLiner,
        k.productOverview,
        "The MVP is deliberately about legibility and structure before automated enforcement layers.",
      );

    case "why_it_matters":
      return blocks(
        k.problem,
        k.solution,
        "Without a map, you optimize anecdotes. The graph turns fragmented signals into something you can inspect and act on.",
      );

    case "how_it_works":
      return blocks(
        "You authenticate, connect a supported source when available, run an import, then explore vault items, the graph, and insights inside the console.",
        k.howScanWorks,
        k.whyGraphMatters,
      );

    case "what_it_scans":
      return blocks(
        "Scans are explicit: you connect a source and trigger processing—nothing passive or hidden.",
        k.howScanWorks,
        "Outputs are structured vault entries the graph and insights can reason about deterministically.",
      );

    case "graph_explainer":
      return blocks(
        "The graph is the relationship view across entities such as inboxes, senders, accounts, and subscriptions.",
        k.whyGraphMatters,
        "Insights read from that same structure so highlights stay explainable from underlying items.",
      );

    case "difference_vs_crypto_wallet":
      return blocks(
        k.diffVsCryptoWallet,
        k.productOverview,
        "Today’s build is a data and identity console, not on-chain asset custody or swap flows.",
      );

    case "difference_vs_password_manager":
      return blocks(
        k.diffVsPasswordManager,
        k.solution,
        "Use the right tool for credentials; use LMX when you need footprint visibility and linkage.",
      );

    case "difference_vs_vpn":
      return blocks(
        k.diffVsVpn,
        k.solution,
        "LMX complements network tools by clarifying identity-shaped data, not by tunneling traffic.",
      );

    case "mvp_scope":
      return blocks(
        "Here is what the MVP is meant to do today.",
        `${k.mvpIncludes}\n\nNot in scope as shipped positioning: ${k.mvpDoesNotInclude}`,
        "We describe only what is built or actively in motion—no borrowed roadmap from other categories.",
      );

    case "roadmap":
      return blocks(
        k.roadmapSummary,
        `Today’s anchor: ${k.mvpIncludes}`,
        "Near term stays focused on richer mapping and review workflows; anything beyond ships when it is real in product.",
      );

    case "trust_security":
      return blocks(
        "Security is deployment-bound: auth, transport, database access, and secrets are yours to harden in production.",
        k.trustPrivacyFraming,
        "This landing assistant does not query your personal vault; it only carries public positioning.",
      );

    case "who_is_it_for":
      return blocks(
        k.whoItIsFor,
        k.problem,
        k.solution,
      );

    case "access_cta":
      return blocks(
        k.waitlistCta,
        "If you already have credentials, sign in from the header to reach the console.",
        "We keep early access tight so feedback stays actionable.",
      );

    case "fallback_general":
    default:
      return fallbackAnswer(k, normalizedMessage);
  }
}
