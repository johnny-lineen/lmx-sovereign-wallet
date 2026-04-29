export const LANDING_AGENT_INTENTS = [
  "what_is_this",
  "why_it_matters",
  "how_it_works",
  "what_it_scans",
  "graph_explainer",
  "difference_vs_crypto_wallet",
  "difference_vs_password_manager",
  "difference_vs_vpn",
  "mvp_scope",
  "roadmap",
  "trust_security",
  "who_is_it_for",
  "access_cta",
  "fallback_general",
] as const;

export type LandingAgentIntent = (typeof LANDING_AGENT_INTENTS)[number];

export type LandingAgentCtaType = "waitlist" | "sign_in" | "none";

export type LandingAgentCta =
  | { type: "waitlist"; label: string; href: string }
  | { type: "sign_in"; label: string; href: string }
  | { type: "none"; label?: undefined; href?: undefined };

export type LandingAgentQueryResponse = {
  intent: LandingAgentIntent;
  answer: string;
  suggestedPrompts: string[];
  cta: LandingAgentCta;
};

/** Prepared inputs for optional OpenAI phrasing; `deterministicAnswer` is always the safe fallback. */
export type LandingAgentPlan = {
  intent: LandingAgentIntent;
  suggestedPrompts: string[];
  cta: LandingAgentCta;
  userMessage: string;
  deterministicAnswer: string;
  factsForModel: string;
};

export type LandingKnowledge = {
  oneLiner: string;
  productOverview: string;
  problem: string;
  solution: string;
  whoItIsFor: string;
  mvpIncludes: string;
  mvpDoesNotInclude: string;
  howScanWorks: string;
  whyGraphMatters: string;
  diffVsPasswordManager: string;
  diffVsVpn: string;
  diffVsCryptoWallet: string;
  roadmapSummary: string;
  trustPrivacyFraming: string;
  waitlistCta: string;
};
