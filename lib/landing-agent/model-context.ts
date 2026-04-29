import { LANDING_AGENT_KNOWLEDGE } from "@/lib/landing-agent/knowledge";
import type { LandingAgentIntent, LandingKnowledge } from "@/lib/landing-agent/types";

function section(title: string, body: string): string {
  return `### ${title}\n${body.trim()}\n`;
}

/**
 * Intent-scoped facts for the model (plus global guardrails). Keeps prompts smaller than dumping the whole knowledge object every time.
 */
export function buildFactsBlockForIntent(
  intent: LandingAgentIntent,
  k: LandingKnowledge = LANDING_AGENT_KNOWLEDGE,
): string {
  const core = [
    section("Positioning (one line)", k.oneLiner),
    section("What the MVP is not (do not claim these as shipped)", k.mvpDoesNotInclude),
  ];

  const byIntent: Record<LandingAgentIntent, string[]> = {
    what_is_this: [section("Product overview", k.productOverview)],
    why_it_matters: [section("Problem", k.problem), section("Solution", k.solution)],
    how_it_works: [
      section("How processing works", k.howScanWorks),
      section("Why the graph", k.whyGraphMatters),
      section("MVP includes", k.mvpIncludes),
    ],
    what_it_scans: [section("Scan / import behavior", k.howScanWorks), section("MVP includes", k.mvpIncludes)],
    graph_explainer: [
      section("Why the graph matters", k.whyGraphMatters),
      section("Product overview", k.productOverview),
    ],
    difference_vs_crypto_wallet: [
      section("Vs crypto wallet", k.diffVsCryptoWallet),
      section("Product overview", k.productOverview),
    ],
    difference_vs_password_manager: [
      section("Vs password manager", k.diffVsPasswordManager),
      section("Solution angle", k.solution),
    ],
    difference_vs_vpn: [section("Vs VPN", k.diffVsVpn), section("Solution angle", k.solution)],
    mvp_scope: [section("MVP includes", k.mvpIncludes)],
    roadmap: [section("Roadmap (directional)", k.roadmapSummary), section("MVP includes today", k.mvpIncludes)],
    trust_security: [section("Trust and privacy framing", k.trustPrivacyFraming)],
    who_is_it_for: [section("Who it is for", k.whoItIsFor), section("Problem", k.problem)],
    access_cta: [section("Waitlist / access", k.waitlistCta), section("Product overview", k.productOverview)],
    fallback_general: [
      section("Product overview", k.productOverview),
      section("Solution", k.solution),
      section("Waitlist", k.waitlistCta),
    ],
  };

  return [...core, ...byIntent[intent]].join("\n");
}
