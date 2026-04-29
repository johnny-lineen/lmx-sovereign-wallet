import type { Insight, InsightSeverity, InsightType, VaultItemType, VaultRelationType } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import * as vaultRepo from "@/server/repositories/vault.repository";

/** Minimum undirected relationship count to flag a vault item as a high-connectivity hub. */
const HIGH_CONNECTIVITY_MIN_DEGREE = 5;

/** Severity when degree is at or above this second threshold. */
const HIGH_CONNECTIVITY_SEVERE_MIN_DEGREE = 8;

type ItemRow = {
  id: string;
  type: VaultItemType;
  title: string;
  metadata: Record<string, unknown> | null;
};

type RelRow = {
  fromItemId: string;
  toItemId: string;
  relationType: VaultRelationType;
};

type GeneratedInsight = {
  type: InsightType;
  title: string;
  description: string;
  severity: InsightSeverity;
  relatedItemIds: string[];
};

export type InsightRiskSummary = {
  score: number;
  breakdown: {
    highRiskCount: number;
    mediumRiskCount: number;
    highSeverityCount: number;
    mediumSeverityCount: number;
    recommendationCount: number;
  };
  explanation: string;
};

const INSIGHT_ACTION_DEFAULT_LIMIT = 5;

function normalizeEmailTitle(title: string): string {
  return title.trim().toLowerCase();
}

function sortUniqueIds(ids: string[]): string[] {
  return [...new Set(ids)].sort((a, b) => a.localeCompare(b));
}

function compareInsights(a: GeneratedInsight, b: GeneratedInsight): number {
  const typeOrder: InsightType[] = ["risk", "recommendation", "insight"];
  const sevOrder: InsightSeverity[] = ["high", "medium", "low"];
  const ta = typeOrder.indexOf(a.type);
  const tb = typeOrder.indexOf(b.type);
  if (ta !== tb) return ta - tb;
  const sa = sevOrder.indexOf(a.severity);
  const sb = sevOrder.indexOf(b.severity);
  if (sa !== sb) return sa - sb;
  return a.title.localeCompare(b.title);
}

function severityScore(severity: InsightSeverity): number {
  if (severity === "high") return 3;
  if (severity === "medium") return 2;
  return 1;
}

function typeScore(type: InsightType): number {
  if (type === "risk") return 3;
  if (type === "recommendation") return 2;
  return 1;
}

function blastRadiusScore(relatedItemIds: string[]): number {
  return Math.min(5, relatedItemIds.length);
}

export function insightPriorityScore(insight: Pick<Insight, "type" | "severity" | "relatedItemIds">): number {
  return severityScore(insight.severity) * 100 + typeScore(insight.type) * 10 + blastRadiusScore(insight.relatedItemIds);
}

export function rankInsightsForActioning<T extends Pick<Insight, "id" | "title" | "type" | "severity" | "relatedItemIds">>(
  insights: T[],
  limit = INSIGHT_ACTION_DEFAULT_LIMIT,
): T[] {
  const sorted = [...insights].sort((a, b) => {
    const scoreDiff = insightPriorityScore(b) - insightPriorityScore(a);
    if (scoreDiff !== 0) return scoreDiff;
    return a.title.localeCompare(b.title) || a.id.localeCompare(b.id);
  });
  if (limit <= 0) return [];
  return sorted.slice(0, limit);
}

function accountAndEmailForUsesEmail(
  rel: RelRow,
  byId: Map<string, ItemRow>,
): { accountId: string; emailId: string } | null {
  const from = byId.get(rel.fromItemId);
  const to = byId.get(rel.toItemId);
  if (!from || !to) return null;
  if (from.type === "account" && to.type === "email") {
    return { accountId: from.id, emailId: to.id };
  }
  if (to.type === "account" && from.type === "email") {
    return { accountId: to.id, emailId: from.id };
  }
  return null;
}

function accountAndPaymentForPaysWith(
  rel: RelRow,
  byId: Map<string, ItemRow>,
): { accountId: string; paymentId: string } | null {
  const from = byId.get(rel.fromItemId);
  const to = byId.get(rel.toItemId);
  if (!from || !to) return null;
  if (from.type === "account" && to.type === "payment_method_reference") {
    return { accountId: from.id, paymentId: to.id };
  }
  if (to.type === "account" && from.type === "payment_method_reference") {
    return { accountId: to.id, paymentId: from.id };
  }
  return null;
}

/**
 * Pure rule engine: deterministic insights from vault items and relationships.
 * `items` / `relationships` must belong to a single user (caller enforces).
 */
export function buildInsightsFromVaultData(items: ItemRow[], relationships: RelRow[]): GeneratedInsight[] {
  const byId = new Map(items.map((i) => [i.id, i]));
  const insights: GeneratedInsight[] = [];

  // --- Rule: one email vault item linked to multiple accounts (uses_email) ---
  const emailIdToAccounts = new Map<string, Set<string>>();
  for (const rel of relationships) {
    if (rel.relationType !== "uses_email") continue;
    const pair = accountAndEmailForUsesEmail(rel, byId);
    if (!pair) continue;
    let set = emailIdToAccounts.get(pair.emailId);
    if (!set) {
      set = new Set();
      emailIdToAccounts.set(pair.emailId, set);
    }
    set.add(pair.accountId);
  }
  for (const [emailId, accounts] of emailIdToAccounts) {
    if (accounts.size < 2) continue;
    const email = byId.get(emailId);
    const label = email?.title?.trim() || "this email";
    const accountList = sortUniqueIds([...accounts]);
    insights.push({
      type: "risk",
      title: "Email shared across multiple accounts",
      description: `The email “${label}” is linked to ${accounts.size} accounts via uses_email. One compromised inbox can affect each of those accounts.`,
      severity: "high",
      relatedItemIds: sortUniqueIds([emailId, ...accountList]),
    });
  }

  // --- Rule: duplicate email-type items with the same normalized address ---
  const normToEmailIds = new Map<string, string[]>();
  for (const item of items) {
    if (item.type !== "email") continue;
    const norm = normalizeEmailTitle(item.title);
    if (!norm) continue;
    const list = normToEmailIds.get(norm) ?? [];
    list.push(item.id);
    normToEmailIds.set(norm, list);
  }
  for (const [norm, ids] of normToEmailIds) {
    if (ids.length < 2) continue;
    insights.push({
      type: "insight",
      title: "Duplicate email entries in vault",
      description: `The address “${norm}” appears as ${ids.length} separate vault items. Merging or linking duplicates keeps the graph easier to reason about.`,
      severity: "medium",
      relatedItemIds: sortUniqueIds(ids),
    });
  }

  // --- Rule: accounts with no recovers_with relationship ---
  const accountIds = items.filter((i) => i.type === "account").map((i) => i.id);
  const accountsWithRecovery = new Set<string>();
  for (const rel of relationships) {
    if (rel.relationType !== "recovers_with") continue;
    if (byId.get(rel.fromItemId)?.type === "account") {
      accountsWithRecovery.add(rel.fromItemId);
    }
    if (byId.get(rel.toItemId)?.type === "account") {
      accountsWithRecovery.add(rel.toItemId);
    }
  }
  const missingRecovery = accountIds.filter((id) => !accountsWithRecovery.has(id)).sort((a, b) => a.localeCompare(b));
  if (missingRecovery.length > 0) {
    const titles = missingRecovery
      .map((id) => byId.get(id)?.title?.trim() || id)
      .slice(0, 8)
      .join(", ");
    const more = missingRecovery.length > 8 ? ` (+${missingRecovery.length - 8} more)` : "";
    insights.push({
      type: "recommendation",
      title: "Accounts without recovery relationships",
      description: `${missingRecovery.length} account(s) have no recovers_with link to a recovery email, backup account, or similar: ${titles}${more}.`,
      severity: "medium",
      relatedItemIds: missingRecovery,
    });
  }

  // --- Rule: high undirected degree (connectivity hub) ---
  const degree = new Map<string, number>();
  for (const rel of relationships) {
    if (!byId.has(rel.fromItemId) || !byId.has(rel.toItemId)) continue;
    degree.set(rel.fromItemId, (degree.get(rel.fromItemId) ?? 0) + 1);
    degree.set(rel.toItemId, (degree.get(rel.toItemId) ?? 0) + 1);
  }
  const hubCandidates = [...degree.entries()]
    .filter(([, d]) => d >= HIGH_CONNECTIVITY_MIN_DEGREE)
    .sort(([a], [b]) => a.localeCompare(b));
  for (const [itemId, d] of hubCandidates) {
    const node = byId.get(itemId);
    const label = node?.title?.trim() || itemId;
    insights.push({
      type: "insight",
      title: `High connectivity: ${label}`,
      description: `This item participates in ${d} relationship edge(s) (counting each link once). Hubs amplify blast radius if something changes or is compromised.`,
      severity: d >= HIGH_CONNECTIVITY_SEVERE_MIN_DEGREE ? "high" : "medium",
      relatedItemIds: [itemId],
    });
  }

  // --- Rule: financial exposure (pays_with between account and payment method) ---
  const exposedAccounts = new Set<string>();
  const paymentIds = new Set<string>();
  for (const rel of relationships) {
    if (rel.relationType !== "pays_with") continue;
    const pair = accountAndPaymentForPaysWith(rel, byId);
    if (!pair) continue;
    exposedAccounts.add(pair.accountId);
    paymentIds.add(pair.paymentId);
  }
  if (exposedAccounts.size > 0) {
    const acctSorted = sortUniqueIds([...exposedAccounts]);
    const paySorted = sortUniqueIds([...paymentIds]);
    insights.push({
      type: "risk",
      title: "Financial exposure via linked payment methods",
      description: `${exposedAccounts.size} account(s) have a pays_with link to a payment method in the vault. Card or account takeover can affect spend paths tied to those items.`,
      severity: "high",
      relatedItemIds: sortUniqueIds([...acctSorted, ...paySorted]),
    });
  }

  // --- Public footprint audit (metadata.source === public_audit) ---
  const auditItems = items.filter((i) => i.metadata?.source === "public_audit");
  if (auditItems.length > 0) {
    const profileLike = auditItems.filter(
      (i) => i.type === "social_account" || i.type === "identity_profile",
    );
    const breachLike = auditItems.filter(
      (i) => i.type === "custom" && i.metadata?.auditSubtype === "breach_event",
    );
    const brokerLike = auditItems.filter(
      (i) => i.type === "custom" && i.metadata?.auditSubtype === "data_broker_listing",
    );

    insights.push({
      type: "insight",
      title: `${auditItems.length} vault item(s) sourced from public footprint audit`,
      description: `These entries were inferred from public or approved signals and are confidence-scored. Breakdown: ${profileLike.length} profile-like, ${breachLike.length} exposure-like, ${brokerLike.length} broker-like (by metadata hints).`,
      severity: "low",
      relatedItemIds: sortUniqueIds(auditItems.map((i) => i.id)),
    });

    if (breachLike.length > 0) {
      insights.push({
        type: "risk",
        title: `${breachLike.length} exposure signal(s) linked to audited identifiers`,
        description:
          "Breach or exposure findings are not proof of active compromise; treat them as signals to verify and rotate credentials where appropriate.",
        severity: "medium",
        relatedItemIds: sortUniqueIds(breachLike.map((i) => i.id)),
      });
    }

    const emailNeighbors = new Map<string, Set<string>>();
    for (const rel of relationships) {
      if (rel.relationType !== "uses_email" && rel.relationType !== "linked_to") continue;
      const a = byId.get(rel.fromItemId);
      const b = byId.get(rel.toItemId);
      if (!a || !b) continue;

      let emailId: string | null = null;
      let auditItem: ItemRow | null = null;
      if (a.type === "email" && b.metadata?.source === "public_audit") {
        emailId = a.id;
        auditItem = b;
      } else if (b.type === "email" && a.metadata?.source === "public_audit") {
        emailId = b.id;
        auditItem = a;
      }
      if (!emailId || !auditItem) continue;

      let set = emailNeighbors.get(emailId);
      if (!set) {
        set = new Set();
        emailNeighbors.set(emailId, set);
      }
      set.add(auditItem.id);
    }
    for (const [emailId, set] of emailNeighbors) {
      if (set.size < 3) continue;
      const email = byId.get(emailId);
      const label = email?.title?.trim() || "an email";
      insights.push({
        type: "insight",
        title: "Public identity concentration around one email",
        description: `${set.size} public-audit items link to “${label}”. Consider whether that inbox is your primary public anchor.`,
        severity: "low",
        relatedItemIds: sortUniqueIds([emailId, ...set]),
      });
    }
  }

  insights.sort(compareInsights);
  return insights;
}

export function summarizeInsightRisk(insights: Pick<Insight, "type" | "severity">[]): InsightRiskSummary {
  const highRiskCount = insights.filter((i) => i.type === "risk" && i.severity === "high").length;
  const mediumRiskCount = insights.filter((i) => i.type === "risk" && i.severity === "medium").length;
  const highSeverityCount = insights.filter((i) => i.severity === "high").length;
  const mediumSeverityCount = insights.filter((i) => i.severity === "medium").length;
  const recommendationCount = insights.filter((i) => i.type === "recommendation").length;

  const raw =
    highRiskCount * 22 +
    mediumRiskCount * 12 +
    Math.max(0, highSeverityCount - highRiskCount) * 8 +
    Math.max(0, mediumSeverityCount - mediumRiskCount) * 4 -
    Math.min(recommendationCount * 2, 10);
  const score = Math.max(0, Math.min(100, Math.round(raw)));

  return {
    score,
    breakdown: {
      highRiskCount,
      mediumRiskCount,
      highSeverityCount,
      mediumSeverityCount,
      recommendationCount,
    },
    explanation:
      "Score is deterministic: high-risk and high-severity signals raise the score most; recommendations lower residual uncertainty.",
  };
}

/**
 * Regenerates persisted insights for the application user (`User.id`, not Clerk id).
 * Replaces all existing rows for that user with a fresh deterministic run.
 */
export async function generateInsightsForUser(userId: string): Promise<Insight[]> {
  const [items, relationships] = await Promise.all([
    vaultRepo.listVaultItemsForUser(userId),
    vaultRepo.listVaultRelationshipsForUser(userId),
  ]);

  const itemRows: ItemRow[] = items.map((i) => ({
    id: i.id,
    type: i.type,
    title: i.title,
    metadata:
      i.metadata && typeof i.metadata === "object" && !Array.isArray(i.metadata)
        ? (i.metadata as Record<string, unknown>)
        : null,
  }));
  const relRows: RelRow[] = relationships.map((r) => ({
    fromItemId: r.fromItemId,
    toItemId: r.toItemId,
    relationType: r.relationType,
  }));

  const generated = buildInsightsFromVaultData(itemRows, relRows);

  return prisma.$transaction(async (tx) => {
    await tx.insight.deleteMany({ where: { userId } });
    if (generated.length === 0) {
      return [];
    }
    await tx.insight.createMany({
      data: generated.map((g) => ({
        userId,
        type: g.type,
        title: g.title,
        description: g.description,
        severity: g.severity,
        relatedItemIds: g.relatedItemIds,
      })),
    });
    return tx.insight.findMany({
      where: { userId },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    });
  });
}

export async function generateInsightsForClerkUser(clerkUserId: string): Promise<Insight[] | null> {
  const user = await prisma.user.findUnique({ where: { clerkUserId } });
  if (!user) return null;
  return generateInsightsForUser(user.id);
}
