import type { GraphEdgePayload, GraphNodePayload, GraphPayload } from "@/lib/graph-payload";

const meta = (status: string, summary?: string, source = "public_audit") =>
  ({
    status,
    ...(summary ? { summary } : {}),
    provenance: {
      source,
      confidence: 0.88,
      evidenceSummary: "Synthetic footprint preview for marketing",
    },
  }) as const;

function buildDemoOverview(nodes: GraphNodePayload[], edges: GraphEdgePayload[]): GraphPayload["overview"] {
  const emails = nodes.filter((n) => n.type === "email");
  const accountLike = nodes.filter((n) => n.type === "account" || n.type === "subscription");
  const distinctProviders = new Set(
    accountLike.map((n) => n.provider?.trim().toLowerCase()).filter((p): p is string => Boolean(p)),
  ).size;

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const emailAdj = new Map<string, Set<string>>();
  const accountAdj = new Map<string, Set<string>>();

  for (const e of edges) {
    const a = nodeById.get(e.source);
    const b = nodeById.get(e.target);
    if (!a || !b) continue;

    const register = (emailNode: GraphNodePayload, other: GraphNodePayload) => {
      if (other.type !== "account" && other.type !== "subscription") return;
      const provider = (other.provider ?? other.label).trim();
      if (!emailAdj.has(provider)) emailAdj.set(provider, new Set());
      if (!accountAdj.has(provider)) accountAdj.set(provider, new Set());
      emailAdj.get(provider)!.add(emailNode.id);
      accountAdj.get(provider)!.add(other.id);
    };

    if (a.type === "email") register(a, b);
    else if (b.type === "email") register(b, a);
  }

  const highFragmentationClusters = [...emailAdj.entries()]
    .filter(([, emailIds]) => emailIds.size >= 2)
    .map(([provider, emailIds]) => ({
      provider,
      emailCount: emailIds.size,
      accountLikeNodeCount: accountAdj.get(provider)?.size ?? 0,
    }))
    .sort((a, b) => b.emailCount - a.emailCount || b.accountLikeNodeCount - a.accountLikeNodeCount)
    .slice(0, 8);

  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    accountCount: nodes.filter((n) => n.type === "account").length,
    subscriptionCount: nodes.filter((n) => n.type === "subscription").length,
    emailCount: emails.length,
    distinctProviders,
    highFragmentationClusters,
    anchorEmailNodeId: "demo-email-primary",
  };
}

/**
 * Rich static graph for the landing "See it in action" demo (johndoe footprint).
 * Overview is derived from nodes/edges so counts and fragmentation clusters stay accurate.
 */
const DEMO_NODES: GraphNodePayload[] = [
  {
    id: "demo-email-primary",
    label: "john.doe@gmail.com",
    type: "email",
    provider: "Google",
    metadataPreview: { ...meta("verified", "Primary inbox · Gmail scan + audit seed") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-email-work",
    label: "jdoe@acme.corp",
    type: "email",
    provider: "Acme IT",
    metadataPreview: { ...meta("verified", "Work Microsoft 365 tenant") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-email-icloud",
    label: "johndoe@icloud.com",
    type: "email",
    provider: "Apple",
    metadataPreview: { ...meta("verified", "Personal Apple ecosystem") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-email-alumni",
    label: "jdoe92@state.edu",
    type: "email",
    provider: "State University",
    metadataPreview: { ...meta("active", "Legacy .edu · still receiving vendor mail") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-email-recovery",
    label: "johnjohn.backup@gmail.com",
    type: "email",
    provider: "Google",
    metadataPreview: { ...meta("active", "Recovery + low-signal alias") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-identity",
    label: "John Doe · identity cluster",
    type: "identity_profile",
    provider: "Aggregated",
    metadataPreview: { ...meta("verified", "Name + handles unified across sources") },
    mergeGroupSize: 3,
  },

  {
    id: "demo-account-github",
    label: "GitHub · @johndoe",
    type: "account",
    provider: "GitHub",
    metadataPreview: { ...meta("active", "Public repos · org SSO at Acme") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-account-x",
    label: "X · @johndoe",
    type: "social_account",
    provider: "X",
    metadataPreview: { ...meta("active", "3.2K followers · tech & coffee") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-account-reddit",
    label: "Reddit · u/johndoe",
    type: "social_account",
    provider: "Reddit",
    metadataPreview: { ...meta("active", "12.4K karma · 4y account") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-account-linkedin",
    label: "LinkedIn · John Doe",
    type: "social_account",
    provider: "LinkedIn",
    metadataPreview: { ...meta("active", "Staff engineer · open to advisory") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-account-youtube",
    label: "YouTube · John Doe",
    type: "social_account",
    provider: "YouTube",
    metadataPreview: { ...meta("active", "Subscriptions drive recommendations") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-account-instagram",
    label: "Instagram · @johndoe",
    type: "social_account",
    provider: "Instagram",
    metadataPreview: { ...meta("active", "Cross-linked from X bio") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-account-discord",
    label: "Discord · johndoe#2048",
    type: "account",
    provider: "Discord",
    metadataPreview: { ...meta("active", "Communities + Nitro billing") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-account-steam",
    label: "Steam · johndoe",
    type: "account",
    provider: "Valve",
    metadataPreview: { ...meta("active", "Wallet + seasonal sales") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-account-amazon",
    label: "Amazon · johndoe",
    type: "account",
    provider: "Amazon",
    metadataPreview: { ...meta("active", "Prime + marketplace history") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-account-apple",
    label: "Apple ID · johndoe@icloud.com",
    type: "account",
    provider: "Apple",
    metadataPreview: { ...meta("active", "iCloud+ · Family Sharing admin") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-account-stackoverflow",
    label: "Stack Overflow · johndoe",
    type: "account",
    provider: "Stack Exchange",
    metadataPreview: { ...meta("active", "Reputation linked to alumni email era") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-account-medium",
    label: "Medium · @johndoe",
    type: "account",
    provider: "Medium",
    metadataPreview: { ...meta("inactive", "Occasional posts") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-account-twitch",
    label: "Twitch · johndoe",
    type: "social_account",
    provider: "Twitch",
    metadataPreview: { ...meta("active", "Prime Gaming link") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-account-notion",
    label: "Notion · workspace",
    type: "account",
    provider: "Notion",
    metadataPreview: { ...meta("active", "Personal + team guest access") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-account-figma",
    label: "Figma · johndoe",
    type: "account",
    provider: "Figma",
    metadataPreview: { ...meta("active", "Org seat + side projects") },
    mergeGroupSize: 1,
  },

  {
    id: "demo-sub-netflix",
    label: "Netflix",
    type: "subscription",
    provider: "Netflix",
    metadataPreview: { ...meta("active", "4K plan · renewal notices") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-sub-spotify",
    label: "Spotify Premium",
    type: "subscription",
    provider: "Spotify",
    metadataPreview: { ...meta("active", "Student discount expired") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-sub-dropbox",
    label: "Dropbox Plus",
    type: "subscription",
    provider: "Dropbox",
    metadataPreview: { ...meta("active", "Work docs + personal archive") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-sub-adobe",
    label: "Adobe Creative Cloud",
    type: "subscription",
    provider: "Adobe",
    metadataPreview: { ...meta("active", "Photography plan") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-sub-m365",
    label: "Microsoft 365",
    type: "subscription",
    provider: "Microsoft",
    metadataPreview: { ...meta("active", "Acme tenant billing") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-sub-slack",
    label: "Slack Pro",
    type: "subscription",
    provider: "Slack",
    metadataPreview: { ...meta("active", "Acme workspace") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-sub-zoom",
    label: "Zoom Pro",
    type: "subscription",
    provider: "Zoom",
    metadataPreview: { ...meta("active", "Reimbursed by employer") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-sub-aws",
    label: "AWS",
    type: "subscription",
    provider: "Amazon Web Services",
    metadataPreview: { ...meta("active", "Side project credits") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-sub-1password",
    label: "1Password Families",
    type: "subscription",
    provider: "1Password",
    metadataPreview: { ...meta("active", "Shared vault invites") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-sub-copilot",
    label: "GitHub Copilot",
    type: "subscription",
    provider: "GitHub",
    metadataPreview: { ...meta("active", "Individual seat") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-sub-disney",
    label: "Disney+",
    type: "subscription",
    provider: "Disney",
    metadataPreview: { ...meta("active", "Bundle w/ Hulu") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-sub-hulu",
    label: "Hulu",
    type: "subscription",
    provider: "Hulu",
    metadataPreview: { ...meta("active", "Ads tier + HBO add-on") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-sub-nordvpn",
    label: "NordVPN",
    type: "subscription",
    provider: "NordVPN",
    metadataPreview: { ...meta("active", "Travel Wi‑Fi habit") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-sub-peloton",
    label: "Peloton",
    type: "subscription",
    provider: "Peloton",
    metadataPreview: { ...meta("active", "All-access membership") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-sub-audible",
    label: "Audible",
    type: "subscription",
    provider: "Audible",
    metadataPreview: { ...meta("active", "Credits roll monthly") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-sub-google-one",
    label: "Google One",
    type: "subscription",
    provider: "Google",
    metadataPreview: { ...meta("active", "2 TB storage") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-sub-uber-one",
    label: "Uber One",
    type: "subscription",
    provider: "Uber",
    metadataPreview: { ...meta("active", "Delivery + rides") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-sub-notion",
    label: "Notion Plus",
    type: "subscription",
    provider: "Notion",
    metadataPreview: { ...meta("active", "AI add-on trial") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-sub-icloud-plus",
    label: "iCloud+",
    type: "subscription",
    provider: "Apple",
    metadataPreview: { ...meta("active", "200 GB tier") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-sub-youtube-premium",
    label: "YouTube Premium",
    type: "subscription",
    provider: "YouTube",
    metadataPreview: { ...meta("active", "Background play + Music") },
    mergeGroupSize: 1,
  },

  {
    id: "demo-device-iphone",
    label: "iPhone 15 Pro",
    type: "device",
    provider: "Apple",
    metadataPreview: { ...meta("active", "Signed into iCloud") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-device-mac",
    label: "MacBook Air M3",
    type: "device",
    provider: "Apple",
    metadataPreview: { ...meta("active", "Work profile + personal Apple ID") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-pay-visa",
    label: "Visa ····4242",
    type: "payment_method_reference",
    provider: "Chase",
    metadataPreview: { ...meta("active", "Default card across consumer subs") },
    mergeGroupSize: 1,
  },
  {
    id: "demo-pay-amex",
    label: "Amex ····1001",
    type: "payment_method_reference",
    provider: "American Express",
    metadataPreview: { ...meta("active", "Travel + annual software renewals") },
    mergeGroupSize: 1,
  },
];

/** Email → account/subscription edges (plus a few identity / device / payment links). */
const DEMO_EDGES: GraphEdgePayload[] = [
  ["demo-email-primary", "demo-identity", "Primary inbox seed"],
  ["demo-email-primary", "demo-account-github", "Account email"],
  ["demo-email-primary", "demo-account-x", "Account email"],
  ["demo-email-primary", "demo-account-reddit", "Account email"],
  ["demo-email-primary", "demo-account-instagram", "Account email"],
  ["demo-email-primary", "demo-account-discord", "Account email"],
  ["demo-email-primary", "demo-account-steam", "Account email"],
  ["demo-email-primary", "demo-account-amazon", "Account email"],
  ["demo-email-primary", "demo-account-medium", "Account email"],
  ["demo-email-primary", "demo-account-notion", "Account email"],
  ["demo-email-primary", "demo-account-figma", "Account email"],
  ["demo-email-primary", "demo-sub-netflix", "Billing email"],
  ["demo-email-primary", "demo-sub-spotify", "Billing email"],
  ["demo-email-primary", "demo-sub-dropbox", "Billing email"],
  ["demo-email-primary", "demo-sub-adobe", "Billing email"],
  ["demo-email-primary", "demo-sub-1password", "Billing email"],
  ["demo-email-primary", "demo-sub-copilot", "Billing email"],
  ["demo-email-primary", "demo-sub-disney", "Billing email"],
  ["demo-email-primary", "demo-sub-hulu", "Billing email"],
  ["demo-email-primary", "demo-sub-nordvpn", "Billing email"],
  ["demo-email-primary", "demo-sub-peloton", "Billing email"],
  ["demo-email-primary", "demo-sub-audible", "Billing email"],
  ["demo-email-primary", "demo-sub-google-one", "Billing email"],
  ["demo-email-primary", "demo-sub-uber-one", "Billing email"],
  ["demo-email-primary", "demo-sub-notion", "Personal workspace AI"],
  ["demo-email-primary", "demo-account-linkedin", "Public profile email"],
  ["demo-email-primary", "demo-account-youtube", "Channel contact"],
  ["demo-email-primary", "demo-account-twitch", "Payout email"],
  ["demo-email-primary", "demo-device-iphone", "Device sign-in"],
  ["demo-email-primary", "demo-pay-visa", "Card on file"],

  ["demo-email-work", "demo-account-github", "Work SSO recovery"],
  ["demo-email-work", "demo-account-linkedin", "Work profile"],
  ["demo-email-work", "demo-sub-dropbox", "Team folder"],
  ["demo-email-work", "demo-sub-m365", "Tenant license"],
  ["demo-email-work", "demo-sub-slack", "Workspace billing"],
  ["demo-email-work", "demo-sub-zoom", "Host license"],
  ["demo-email-work", "demo-sub-aws", "Dev sandbox"],
  ["demo-email-work", "demo-sub-netflix", "Personal profile on work laptop"],
  ["demo-email-work", "demo-account-notion", "Guest workspace"],
  ["demo-email-work", "demo-sub-notion", "Shared team billing"],
  ["demo-email-work", "demo-device-mac", "MDM enrolled"],
  ["demo-email-work", "demo-pay-amex", "T&E card"],

  ["demo-email-icloud", "demo-account-apple", "Apple ID email"],
  ["demo-email-icloud", "demo-account-youtube", "Linked Google migration"],
  ["demo-email-icloud", "demo-sub-spotify", "Family plan invite"],
  ["demo-email-icloud", "demo-sub-dropbox", "Personal space"],
  ["demo-email-icloud", "demo-sub-icloud-plus", "Storage tier"],
  ["demo-email-icloud", "demo-sub-youtube-premium", "Bundle overlap"],
  ["demo-email-icloud", "demo-device-iphone", "Find My"],
  ["demo-email-icloud", "demo-device-mac", "Handoff"],

  ["demo-email-alumni", "demo-account-stackoverflow", "Legacy registration"],
  ["demo-email-alumni", "demo-account-amazon", "Old .edu trial"],
  ["demo-email-alumni", "demo-sub-audible", "Student promo chain"],
  ["demo-email-alumni", "demo-sub-adobe", "Creative Cloud edu → personal"],

  ["demo-email-recovery", "demo-account-github", "Backup & 2FA recovery"],
  ["demo-email-recovery", "demo-sub-google-one", "Storage alerts"],
].map(([source, target, label], i) => ({
  id: `demo-edge-${i}`,
  source: source as string,
  target: target as string,
  label: label as string,
}));

export const LANDING_DEMO_GRAPH_PAYLOAD: GraphPayload = {
  overview: buildDemoOverview(DEMO_NODES, DEMO_EDGES),
  nodes: DEMO_NODES,
  edges: DEMO_EDGES,
};
