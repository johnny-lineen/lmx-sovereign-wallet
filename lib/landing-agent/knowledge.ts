import type { LandingKnowledge } from "@/lib/landing-agent/types";

/** Primary source of truth for the public landing agent. Edit here, not in the composer. */
export const LANDING_AGENT_KNOWLEDGE = {
  oneLiner:
    "LMX Sovereign Wallet is a digital identity graph and control layer: map your footprint, structure what you find, and turn it into clear next steps—not a trading wallet.",

  productOverview:
    "The product centers on a Vault of ingested items, a Graph that shows how entities relate, Insights that surface explainable patterns, and guided queries so you can interrogate your own data without drowning in it. The MVP is about visibility and structure first; deeper automated protection comes later.",

  problem:
    "Identity and subscriptions are scattered across inboxes, vendors, and accounts. Most people lack a single, honest picture of where they show up online and what that implies.",

  solution:
    "Connect sources where the deployment supports them (for example optional Gmail OAuth), run an import on your terms, and let the system normalize signals into vault items and a relationship graph. Insights highlight what stands out so you can decide what to review, tighten, or leave as-is.",

  whoItIsFor:
    "Operators, founders, and security-minded individuals who want a serious map of their digital footprint—not a gimmick dashboard. Useful if you are consolidating accounts, auditing exposure, or simply want legibility before you act.",

  mvpIncludes:
    "Vault storage for imported items, a graph view of relationships, rule-based Insights with traceable inputs, Clerk-based authentication, and agent-style guided queries against your own data in the product console. Optional Gmail-backed import when Google API credentials are configured for your environment.",

  mvpDoesNotInclude:
    "A full password manager, a VPN, browser autofill, or blockchain-native transaction execution as part of this MVP. Those may inform long-term direction but are not shipped as core features today.",

  howScanWorks:
    "Imports are user-initiated. Where Gmail OAuth is enabled, you authorize Google, the app pulls scoped mailbox-derived signals through a deterministic pipeline, and results land as structured vault items—nothing runs until you connect and trigger a scan. Other sources follow the same pattern: explicit connection, explicit processing.",

  whyGraphMatters:
    "The graph is the lens. Lists hide structure; the graph exposes how senders, accounts, subscriptions, and inboxes tie together so patterns become obvious instead of buried in threads.",

  diffVsPasswordManager:
    "Password managers excel at credentials and fill workflows. LMX starts with footprint visibility and relationships across signals—not replacing your password manager, but answering a different question: what exists, how does it connect, and what should you look at next.",

  diffVsVpn:
    "A VPN shifts network egress and can obscure IP-based tracking in some cases. LMX does not tunnel traffic; it helps you see and reason about identity-shaped data you already generate across services and mail.",

  diffVsCryptoWallet:
    "Despite the name, this is not a crypto trading wallet. There is no seed phrase custody model for assets here. The focus is sovereign identity data: map, understand, and steer your footprint—not swap tokens.",

  roadmapSummary:
    "Near term stays anchored on richer sources, sharper insights, and review workflows. Later phases can add stronger protection and action layers, always gated by what is actually built—no pretending future features already exist.",

  trustPrivacyFraming:
    "Authentication uses Clerk. Your connected data lives in the application database under your deployment’s controls (for example PostgreSQL via Prisma). This public assistant never reads your personal vault. Follow production hardening for your host: HTTPS, secret hygiene, least-privilege database roles. We do not claim third-party certifications or legal guarantees in this MVP unless you add them explicitly to your own compliance story.",

  waitlistCta:
    "Request early access with your email in the waitlist form above. Updates are intentional—no spam, unsubscribe anytime.",
} satisfies LandingKnowledge;
