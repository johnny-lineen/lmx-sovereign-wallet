import type { ImportCandidateSignal, VaultItemType } from "@prisma/client";

/** Parsed Gmail metadata used by deterministic rules. */
export type GmailMessageMeta = {
  messageId: string;
  subject: string;
  snippet: string;
  fromRaw: string;
  fromEmail: string | null;
  fromDomain: string | null;
};

const PERSONAL_FROM_DOMAINS = new Set([
  "gmail.com",
  "googlemail.com",
  "yahoo.com",
  "ymail.com",
  "outlook.com",
  "hotmail.com",
  "live.com",
  "icloud.com",
  "me.com",
  "mac.com",
  "proton.me",
  "protonmail.com",
  "aol.com",
]);

/** Map registrable sending domains to a canonical provider bucket (aggregation key). */
const DOMAIN_CANONICAL: Record<string, string> = {
  "amazon.co.uk": "amazon.com",
  "amazon.de": "amazon.com",
  "amazon.fr": "amazon.com",
  "amazon.ca": "amazon.com",
  "amazon.com.au": "amazon.com",
  "primevideo.com": "amazon.com",
  "audible.com": "amazon.com",
  "uber.com": "uber.com",
  "uberinternal.com": "uber.com",
  "lyftmail.com": "lyft.com",
  "lyft.com": "lyft.com",
  "openai.com": "openai.com",
  "email.openai.com": "openai.com",
};

const PROVIDER_LABELS: Record<string, string> = {
  "netflix.com": "Netflix",
  "spotify.com": "Spotify",
  "apple.com": "Apple",
  "amazon.com": "Amazon",
  "amazon.co.uk": "Amazon",
  "github.com": "GitHub",
  "google.com": "Google",
  "microsoft.com": "Microsoft",
  "adobe.com": "Adobe",
  "dropbox.com": "Dropbox",
  "notion.so": "Notion",
  "notion.com": "Notion",
  "figma.com": "Figma",
  "stripe.com": "Stripe",
  "paypal.com": "PayPal",
  "chase.com": "Chase",
  "bankofamerica.com": "Bank of America",
  "coinbase.com": "Coinbase",
  "discord.com": "Discord",
  "slack.com": "Slack",
  "zoom.us": "Zoom",
  "linkedin.com": "LinkedIn",
  "twitter.com": "X (Twitter)",
  "x.com": "X",
  "facebook.com": "Meta",
  "meta.com": "Meta",
  "instagram.com": "Instagram",
  "openai.com": "OpenAI (ChatGPT)",
  "uber.com": "Uber",
  "lyft.com": "Lyft",
  "airbnb.com": "Airbnb",
  "booking.com": "Booking.com",
  "expedia.com": "Expedia",
  "delta.com": "Delta",
  "united.com": "United Airlines",
  "southwest.com": "Southwest",
  "hulu.com": "Hulu",
  "disneyplus.com": "Disney+",
  "max.com": "Max",
  "paramountplus.com": "Paramount+",
  "docusign.com": "DocuSign",
  "mailchimp.com": "Mailchimp",
  "twilio.com": "Twilio",
  "vercel.com": "Vercel",
  "cloudflare.com": "Cloudflare",
  "digitalocean.com": "DigitalOcean",
  "heroku.com": "Heroku",
  "atlassian.com": "Atlassian",
  "jetbrains.com": "JetBrains",
};

const PUBLIC_ICANN_DOUBLE = new Set([
  "co.uk",
  "com.au",
  "co.jp",
  "co.nz",
  "com.br",
  "co.za",
  "com.mx",
  "co.in",
  "com.sg",
]);

/** Subject/snippet hints of bulk marketing — dampen unless transactional signals also match. */
const MARKETING_HINT =
  /\b(unsubscribe|view in browser|view this email in|limited[-\s]time|%\s*off|percent off|flash sale|newsletter|weekly digest|special offer|act now|don'?t miss|marketing email|promotional)\b/i;

type RuleDef = {
  signal: ImportCandidateSignal;
  /** Points toward an account / service relationship. */
  accountWeight: number;
  /** Points toward recurring billing / subscription. */
  subscriptionWeight: number;
  /** Counts as strong transactional evidence (receipts, security, orders, etc.). */
  strongTransactional: boolean;
  test: (text: string) => boolean;
};

/**
 * Rules are evaluated against subject + snippet. Multiple rules may match one message;
 * per-signal weights are merged with max() per message to avoid double-counting the same class.
 */
const RULES: RuleDef[] = [
  {
    signal: "password_reset",
    accountWeight: 18,
    subscriptionWeight: 0,
    strongTransactional: true,
    test: (t) =>
      /\b(reset your password|password reset|forgot your password|reset password|create a new password|set a new password|password was changed|your password has been reset)\b/i.test(
        t,
      ),
  },
  {
    signal: "security_alert",
    accountWeight: 16,
    subscriptionWeight: 0,
    strongTransactional: true,
    test: (t) =>
      /\b(security alert|unusual activity|new sign-?in|sign-?in from a new (device|location)|verification code|two-?factor|2fa|confirm (this )?login|someone tried to log|login (attempt|notification)|new device (signed in|added)|authenticator|recovery code)\b/i.test(
        t,
      ),
  },
  {
    signal: "welcome_account",
    accountWeight: 12,
    subscriptionWeight: 0,
    strongTransactional: true,
    test: (t) =>
      /\b(verify your (email|e-?mail|account)|confirm your (email|e-?mail|account)|email verification|activation (code|link)|confirm registration)\b/i.test(
        t,
      ),
  },
  {
    signal: "receipt_invoice",
    accountWeight: 17,
    subscriptionWeight: 0,
    strongTransactional: true,
    test: (t) =>
      /\b(receipt|e-?receipt|invoice|tax invoice|order confirmation|payment (received|confirmed|successful)|thank you for your (order|purchase)|your order (#|number|has|is)|purchase confirmation|sales receipt|billing statement|amount (due|paid)|charged to|payment summary)\b/i.test(
        t,
      ),
  },
  {
    signal: "receipt_invoice",
    accountWeight: 16,
    subscriptionWeight: 0,
    strongTransactional: true,
    test: (t) =>
      /\b(your (uber|lyft) (trip|receipt|ride)|ride receipt|trip (summary|receipt)|e-?receipt for your ride|here'?s your ride)\b/i.test(
        t,
      ),
  },
  {
    signal: "receipt_invoice",
    accountWeight: 15,
    subscriptionWeight: 0,
    strongTransactional: true,
    test: (t) =>
      /\b(itinerary|boarding pass|trip summary|flight confirmation|hotel confirmation|check-?in (details|confirmation)|reservation confirmed)\b/i.test(
        t,
      ),
  },
  {
    signal: "subscription_renewal",
    accountWeight: 6,
    subscriptionWeight: 17,
    strongTransactional: true,
    test: (t) =>
      /\b(subscription (renewed|renewal|update)|renew(s|ed|al)|auto-?renew|recurring (payment|charge|billing)|membership (renewed|renewal)|plan (renewed|renewal)|billing (cycle|period)|monthly (invoice|billing|charge)|annual (renewal|billing)|will (be )?charged|payment (method|details) (on file|ending)|renews on)\b/i.test(
        t,
      ),
  },
  {
    signal: "subscription_renewal",
    accountWeight: 5,
    subscriptionWeight: 14,
    strongTransactional: true,
    test: (t) =>
      /\b(your .{0,40}(plan|plus|pro|premium|membership)|tier (change|upgrade|downgrade)|invoice for your .{0,30}(subscription|plan|membership))\b/i.test(
        t,
      ),
  },
  {
    signal: "account_activity",
    accountWeight: 11,
    subscriptionWeight: 0,
    strongTransactional: true,
    test: (t) =>
      /\b(account (summary|statement|activity)|usage (report|summary|notification)|your (api )?usage|activity (digest|summary)|service usage|data usage)\b/i.test(
        t,
      ),
  },
  {
    signal: "welcome_account",
    accountWeight: 9,
    subscriptionWeight: 0,
    strongTransactional: false,
    test: (t) =>
      /\b(welcome to|thanks for signing up|your account (has been )?created|complete your registration|activate your account|get started with)\b/i.test(
        t,
      ),
  },
  {
    signal: "account_activity",
    accountWeight: 7,
    subscriptionWeight: 0,
    strongTransactional: false,
    test: (t) =>
      /\b(your account|account (update|settings)|profile (updated|change)|email (address )?changed|privacy (update|policy))\b/i.test(
        t,
      ),
  },
];

const SIGNAL_PRIORITY: ImportCandidateSignal[] = [
  "password_reset",
  "security_alert",
  "receipt_invoice",
  "subscription_renewal",
  "welcome_account",
  "account_activity",
];

/** Minimum aggregated account score to emit an account candidate. */
const ACCOUNT_AGG_THRESHOLD = 14;
/** Minimum aggregated subscription score to emit a subscription candidate. */
const SUBSCRIPTION_AGG_THRESHOLD = 13;
/** Single-message “strong” bypass for account (after dampening). */
const ACCOUNT_SINGLE_STRONG = 15;
/** Single-message bypass for subscription. */
const SUBSCRIPTION_SINGLE_STRONG = 14;
/** Weak-only paths need more mail from the same provider. */
const WEAK_ACCOUNT_REPEAT_THRESHOLD = 22;
/** Max contribution from one message into a bucket (limits duplicate regex overlap). */
const PER_MESSAGE_CAP = 24;

export function parseEmailFromFromHeader(fromRaw: string): { email: string | null; domain: string | null } {
  const m = fromRaw.match(/<?([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})>?/);
  if (!m?.[1]) return { email: null, domain: null };
  const email = m[1].toLowerCase();
  const domain = email.split("@")[1] ?? null;
  return { email, domain };
}

export function registrableDomainFromHost(host: string): string {
  const h = host.toLowerCase().trim();
  const parts = h.split(".").filter(Boolean);
  if (parts.length < 2) return h;
  const lastTwo = `${parts[parts.length - 2]}.${parts[parts.length - 1]}`;
  if (PUBLIC_ICANN_DOUBLE.has(lastTwo) && parts.length >= 3) {
    return parts.slice(-3).join(".");
  }
  return parts.slice(-2).join(".");
}

function normalizeProviderDomain(fromDomain: string | null): string | null {
  if (!fromDomain) return null;
  const reg = registrableDomainFromHost(fromDomain);
  return DOMAIN_CANONICAL[reg] ?? DOMAIN_CANONICAL[fromDomain.toLowerCase()] ?? reg;
}

function providerLabelForDomain(normalizedDomain: string | null): string | null {
  if (!normalizedDomain) return null;
  return PROVIDER_LABELS[normalizedDomain] ?? null;
}

function titleForCandidate(normalizedDomain: string | null, provider: string | null, fallback: string): string {
  if (provider) return provider;
  if (normalizedDomain) {
    const parts = normalizedDomain.split(".");
    const sld = parts.length >= 2 ? parts[parts.length - 2] : normalizedDomain;
    if (!sld) return fallback.slice(0, 80);
    return sld.charAt(0).toUpperCase() + sld.slice(1);
  }
  return fallback.slice(0, 120);
}

function shouldSkipDomain(domain: string | null): boolean {
  if (!domain) return true;
  const reg = registrableDomainFromHost(domain);
  return PERSONAL_FROM_DOMAINS.has(reg);
}

function messageText(meta: GmailMessageMeta): string {
  const sub = (meta.subject || "").trim();
  const sn = (meta.snippet || "").trim();
  return `${sub}\n${sn}`.trim();
}

function analyzeMessage(meta: GmailMessageMeta): {
  normalizedDomain: string;
  rawDomain: string;
  accountScore: number;
  subscriptionScore: number;
  signalWeights: Map<ImportCandidateSignal, { account: number; subscription: number }>;
  strongTransactional: boolean;
  sample: { messageId: string; subject: string };
} | null {
  const subject = (meta.subject || "").trim();
  if (!subject && !(meta.snippet || "").trim()) return null;

  const domain = meta.fromDomain;
  if (shouldSkipDomain(domain)) return null;

  const normalizedDomain = normalizeProviderDomain(domain);
  if (!normalizedDomain) return null;

  const text = messageText(meta);
  if (!text) return null;

  const matchedRules = RULES.filter((r) => r.test(text));
  if (matchedRules.length === 0) return null;

  const strongTransactional = matchedRules.some((r) => r.strongTransactional);
  const marketingHit = MARKETING_HINT.test(subject) || MARKETING_HINT.test(meta.snippet || "");
  const dampen = marketingHit && !strongTransactional ? 0.35 : 1;

  const signalWeights = new Map<ImportCandidateSignal, { account: number; subscription: number }>();

  let accountGross = 0;
  let subscriptionGross = 0;

  for (const rule of matchedRules) {
    const aw = rule.accountWeight * dampen;
    const sw = rule.subscriptionWeight * dampen;
    if (aw > 0) accountGross += aw;
    if (sw > 0) subscriptionGross += sw;

    const cur = signalWeights.get(rule.signal) ?? { account: 0, subscription: 0 };
    cur.account = Math.max(cur.account, aw);
    cur.subscription = Math.max(cur.subscription, sw);
    signalWeights.set(rule.signal, cur);
  }

  const accountScore = Math.min(accountGross, PER_MESSAGE_CAP);
  const subscriptionScore = Math.min(subscriptionGross, PER_MESSAGE_CAP);

  return {
    normalizedDomain,
    rawDomain: domain!,
    accountScore,
    subscriptionScore,
    signalWeights,
    strongTransactional,
    sample: { messageId: meta.messageId, subject },
  };
}

type MessageSample = { messageId: string; subject: string };

type ProviderAgg = {
  normalizedDomain: string;
  rawDomains: Set<string>;
  accountScore: number;
  subscriptionScore: number;
  /** Merged max weight per signal across messages (for metadata + primary signal pick). */
  signalTotals: Map<ImportCandidateSignal, { account: number; subscription: number }>;
  messagesForAccount: MessageSample[];
  messagesForSubscription: MessageSample[];
  contributingMessageIds: Set<string>;
  anyStrongAccount: boolean;
  anyStrongSubscription: boolean;
  maxSingleAccount: number;
  maxSingleSubscription: number;
  weakOnlyAccountMessages: number;
};

function emptyAgg(normalizedDomain: string): ProviderAgg {
  return {
    normalizedDomain,
    rawDomains: new Set(),
    accountScore: 0,
    subscriptionScore: 0,
    signalTotals: new Map(),
    messagesForAccount: [],
    messagesForSubscription: [],
    contributingMessageIds: new Set(),
    anyStrongAccount: false,
    anyStrongSubscription: false,
    maxSingleAccount: 0,
    maxSingleSubscription: 0,
    weakOnlyAccountMessages: 0,
  };
}

function mergeSignalTotals(
  into: Map<ImportCandidateSignal, { account: number; subscription: number }>,
  from: Map<ImportCandidateSignal, { account: number; subscription: number }>,
) {
  for (const [sig, w] of from) {
    const cur = into.get(sig) ?? { account: 0, subscription: 0 };
    cur.account += w.account;
    cur.subscription += w.subscription;
    into.set(sig, cur);
  }
}

function isWeakAccountOnly(analysis: NonNullable<ReturnType<typeof analyzeMessage>>): boolean {
  if (analysis.strongTransactional) return false;
  return analysis.accountScore > 0 && analysis.accountScore < 10;
}

function pickPrimarySignal(
  totals: Map<ImportCandidateSignal, { account: number; subscription: number }>,
  bucket: "account" | "subscription",
): ImportCandidateSignal {
  let best: ImportCandidateSignal = "account_activity";
  let bestW = -1;
  for (const sig of SIGNAL_PRIORITY) {
    const w = totals.get(sig);
    if (!w) continue;
    const score = bucket === "account" ? w.account : w.subscription;
    if (score > bestW) {
      bestW = score;
      best = sig;
    }
  }
  return best;
}

function buildEvidenceSummary(params: {
  bucket: "account" | "subscription";
  signalTotals: Map<ImportCandidateSignal, { account: number; subscription: number }>;
  score: number;
  sampleSubjects: string[];
}): string {
  const { bucket, signalTotals, score, sampleSubjects } = params;
  const parts: string[] = [];
  const labels: Record<ImportCandidateSignal, string> = {
    password_reset: "password / reset",
    security_alert: "login or security",
    receipt_invoice: "receipt, order, or invoice",
    subscription_renewal: "renewal or recurring billing",
    welcome_account: "signup or verification",
    account_activity: "account or usage updates",
  };
  const ranked = SIGNAL_PRIORITY.map((s) => ({
    s,
    w: bucket === "account" ? (signalTotals.get(s)?.account ?? 0) : (signalTotals.get(s)?.subscription ?? 0),
  }))
    .filter((x) => x.w > 0)
    .sort((a, b) => b.w - a.w)
    .slice(0, 4);
  if (ranked.length) {
    parts.push(
      `Signals: ${ranked.map((r) => `${labels[r.s]} (${r.w.toFixed(0)})`).join(", ")}. Aggregated score ${score.toFixed(1)}.`,
    );
  }
  if (sampleSubjects.length) {
    parts.push(`Examples: ${sampleSubjects.slice(0, 3).join(" · ")}`);
  }
  return parts.join(" ");
}

export type ExtractedCandidate = {
  signal: ImportCandidateSignal;
  suggestedType: VaultItemType;
  title: string;
  provider: string | null;
  providerDomain: string | null;
  evidence: Record<string, unknown>;
  dedupeKey: string;
};

/**
 * Scans all messages together, aggregates scores per normalized provider domain,
 * and returns account and/or subscription candidates with rich evidence metadata.
 */
export function aggregateImportCandidatesFromMessages(metas: GmailMessageMeta[]): ExtractedCandidate[] {
  const byProvider = new Map<string, ProviderAgg>();

  for (const meta of metas) {
    const a = analyzeMessage(meta);
    if (!a) continue;

    let agg = byProvider.get(a.normalizedDomain);
    if (!agg) {
      agg = emptyAgg(a.normalizedDomain);
      byProvider.set(a.normalizedDomain, agg);
    }

    agg.rawDomains.add(a.rawDomain);
    agg.contributingMessageIds.add(meta.messageId);
    agg.accountScore += a.accountScore;
    agg.subscriptionScore += a.subscriptionScore;
    mergeSignalTotals(agg.signalTotals, a.signalWeights);

    if (a.accountScore > 0) {
      agg.messagesForAccount.push(a.sample);
      if (a.strongTransactional) agg.anyStrongAccount = true;
      if (isWeakAccountOnly(a)) agg.weakOnlyAccountMessages += 1;
    }
    agg.maxSingleAccount = Math.max(agg.maxSingleAccount, a.accountScore);

    if (a.subscriptionScore > 0) {
      agg.messagesForSubscription.push(a.sample);
      if (a.strongTransactional && a.subscriptionScore >= 10) agg.anyStrongSubscription = true;
    }
    agg.maxSingleSubscription = Math.max(agg.maxSingleSubscription, a.subscriptionScore);
  }

  const out: ExtractedCandidate[] = [];

  for (const agg of byProvider.values()) {
    const provider = providerLabelForDomain(agg.normalizedDomain);
    const titleBase = titleForCandidate(agg.normalizedDomain, provider, agg.messagesForAccount[0]?.subject ?? "");

    const emitAccount =
      agg.accountScore >= ACCOUNT_AGG_THRESHOLD ||
      agg.maxSingleAccount >= ACCOUNT_SINGLE_STRONG ||
      (agg.anyStrongAccount && agg.accountScore >= 12) ||
      (agg.weakOnlyAccountMessages >= 3 && agg.accountScore >= WEAK_ACCOUNT_REPEAT_THRESHOLD);

    const emitSubscription =
      agg.subscriptionScore >= SUBSCRIPTION_AGG_THRESHOLD ||
      agg.maxSingleSubscription >= SUBSCRIPTION_SINGLE_STRONG ||
      (agg.anyStrongSubscription && agg.subscriptionScore >= 11) ||
      (agg.messagesForSubscription.length >= 2 && agg.subscriptionScore >= 11);

    const sampleSubjectsAccount = [...new Set(agg.messagesForAccount.map((m) => m.subject).filter(Boolean))];
    const sampleSubjectsSub = [...new Set(agg.messagesForSubscription.map((m) => m.subject).filter(Boolean))];

    const signalCounts: Record<string, number> = {};
    for (const [sig, w] of agg.signalTotals) {
      const sum = w.account + w.subscription;
      if (sum > 0) signalCounts[sig] = Math.round(sum * 10) / 10;
    }

    const baseEvidence = {
      normalizedProviderDomain: agg.normalizedDomain,
      rawSenderDomains: [...agg.rawDomains],
      aggregated: true,
      signalScoreTotals: signalCounts,
      messageCountContributing: agg.contributingMessageIds.size,
    };

    if (emitAccount) {
      const primary = pickPrimarySignal(agg.signalTotals, "account");
      const sampleIds = [...new Set(agg.messagesForAccount.map((m) => m.messageId))].slice(0, 12);
      const summary = buildEvidenceSummary({
        bucket: "account",
        signalTotals: agg.signalTotals,
        score: agg.accountScore,
        sampleSubjects: sampleSubjectsAccount,
      });
      out.push({
        signal: primary,
        suggestedType: "account",
        title: titleBase,
        provider,
        providerDomain: agg.normalizedDomain,
        evidence: {
          ...baseEvidence,
          bucket: "account",
          aggregatedScore: Math.round(agg.accountScore * 10) / 10,
          summary,
          sampleSubjects: sampleSubjectsAccount.slice(0, 8),
          sampleMessageIds: sampleIds,
          gmailMessageId: sampleIds[0] ?? null,
          subject: sampleSubjectsAccount[0] ?? "",
        },
        dedupeKey: `${agg.normalizedDomain.toLowerCase()}::account`,
      });
    }

    if (emitSubscription) {
      const primary = pickPrimarySignal(agg.signalTotals, "subscription");
      const sampleIds = [...new Set(agg.messagesForSubscription.map((m) => m.messageId))].slice(0, 12);
      const summary = buildEvidenceSummary({
        bucket: "subscription",
        signalTotals: agg.signalTotals,
        score: agg.subscriptionScore,
        sampleSubjects: sampleSubjectsSub,
      });
      out.push({
        signal: primary,
        suggestedType: "subscription",
        title: titleBase,
        provider,
        providerDomain: agg.normalizedDomain,
        evidence: {
          ...baseEvidence,
          bucket: "subscription",
          aggregatedScore: Math.round(agg.subscriptionScore * 10) / 10,
          summary,
          sampleSubjects: sampleSubjectsSub.slice(0, 8),
          sampleMessageIds: sampleIds,
          gmailMessageId: sampleIds[0] ?? null,
          subject: sampleSubjectsSub[0] ?? sampleSubjectsAccount[0] ?? "",
        },
        dedupeKey: `${agg.normalizedDomain.toLowerCase()}::subscription`,
      });
    }
  }

  return out;
}

/**
 * @deprecated Prefer {@link aggregateImportCandidatesFromMessages} — kept for narrow tests.
 * Mirrors legacy single-message behavior using the new scorer (no cross-message aggregation).
 */
export function extractCandidateFromMessage(meta: GmailMessageMeta): ExtractedCandidate | null {
  return aggregateImportCandidatesFromMessages([meta])[0] ?? null;
}

export function buildGmailMessageMeta(
  messageId: string,
  headers: { name?: string | null; value?: string | null }[],
  snippet?: string | null,
): GmailMessageMeta {
  const map = new Map<string, string>();
  for (const h of headers) {
    const n = h.name?.toLowerCase();
    const v = h.value;
    if (n && v) map.set(n, v);
  }
  const subject = map.get("subject") ?? "";
  const fromRaw = map.get("from") ?? "";
  const { email, domain } = parseEmailFromFromHeader(fromRaw);
  return {
    messageId,
    subject,
    snippet: (snippet ?? "").trim(),
    fromRaw,
    fromEmail: email,
    fromDomain: domain,
  };
}
