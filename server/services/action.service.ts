import type { Insight, UserActionPriority, UserActionStatus } from "@prisma/client";

import * as actionRepo from "@/server/repositories/action.repository";
import * as userRepo from "@/server/repositories/user.repository";
import { generateInsightsForUser, insightPriorityScore, rankInsightsForActioning } from "@/server/services/insight.service";

export type UserActionDTO = {
  id: string;
  insightId: string | null;
  title: string;
  description: string;
  status: UserActionStatus;
  priority: UserActionPriority;
  relatedItemIds: string[];
  metadata: unknown;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

const MIN_FOCUSED_ACTIONS = 3;
const MAX_FOCUSED_ACTIONS = 5;

type ActionTheme =
  | "inbox_compartmentalization"
  | "recovery_hardening"
  | "payment_surface_reduction"
  | "hub_blast_radius"
  | "vault_hygiene"
  | "account_hardening";

type ActionTemplate = {
  title: string;
  goal: string;
  steps: string[];
};

type FocusedActionPlan = {
  actionKey: string;
  insightId: string | null;
  title: string;
  description: string;
  priority: UserActionPriority;
  relatedItemIds: string[];
  metadata: {
    source: "focused_security_action";
    theme: ActionTheme;
    insightCount: number;
    insightIds: string[];
    estimatedMinutes: number;
  };
};

const ACTION_TEMPLATES: Record<ActionTheme, ActionTemplate> = {
  inbox_compartmentalization: {
    title: "Segment high-value accounts away from shared inboxes",
    goal: "Reduce takeover blast radius from one compromised inbox.",
    steps: [
      "Move your most critical accounts to a dedicated security email.",
      "Enable MFA on the source and destination inboxes before migration.",
      "Validate recovery paths for moved accounts and remove stale recovery links.",
    ],
  },
  recovery_hardening: {
    title: "Add and test recovery paths for exposed accounts",
    goal: "Prevent permanent lockout and speed incident recovery.",
    steps: [
      "Add at least one independent recovery method per flagged account.",
      "Store recovery dependencies in your vault graph so the path is explicit.",
      "Run one recovery drill to confirm codes, links, and backup channels work.",
    ],
  },
  payment_surface_reduction: {
    title: "Reduce payment-link exposure on sensitive accounts",
    goal: "Limit fraud paths if an account or payment reference is abused.",
    steps: [
      "Remove unused payment links and stale cards from flagged accounts.",
      "Enable purchase/transfer alerts and MFA on payment-linked services.",
      "Separate critical services from shared payment instruments where possible.",
    ],
  },
  hub_blast_radius: {
    title: "Break high-connectivity identity hubs into safer boundaries",
    goal: "Lower systemic risk from highly connected identity nodes.",
    steps: [
      "Review hub items with many relationships and split non-essential links.",
      "Create dedicated identities for admin or financial workflows.",
      "Re-check graph connectivity to confirm blast radius decreased.",
    ],
  },
  vault_hygiene: {
    title: "Clean duplicate identity records to improve decision quality",
    goal: "Improve transparency so security actions target the right entities.",
    steps: [
      "Merge duplicate email records and keep one canonical identity node.",
      "Relink orphaned relationships to the canonical item.",
      "Re-run insights to verify duplicate-driven noise is removed.",
    ],
  },
  account_hardening: {
    title: "Harden remaining high-risk accounts",
    goal: "Raise baseline account security across unresolved risks.",
    steps: [
      "Enable MFA and rotate weak/reused passwords on flagged accounts.",
      "Confirm trusted devices/sessions and revoke unknown access.",
      "Update account metadata so ownership and recovery state are explicit.",
    ],
  },
};

function actionKeyForTheme(theme: ActionTheme): string {
  return `focus_action_${theme}`;
}

export function scopedActionKeyForUser(userId: string, baseActionKey: string): string {
  return `${baseActionKey}_${userId}`;
}

function themeForInsight(i: Insight): ActionTheme {
  if (i.title.includes("Email shared")) return "inbox_compartmentalization";
  if (i.title.includes("without recovery")) return "recovery_hardening";
  if (i.title.includes("Financial exposure")) return "payment_surface_reduction";
  if (i.title.includes("High connectivity")) return "hub_blast_radius";
  if (i.title.includes("Duplicate email entries")) return "vault_hygiene";
  return "account_hardening";
}

function mergeRelatedItemIds(insights: Insight[]): string[] {
  return [...new Set(insights.flatMap((i) => i.relatedItemIds))].sort((a, b) => a.localeCompare(b));
}

function actionDescriptionFromTheme(theme: ActionTheme, insights: Insight[]): string {
  const template = ACTION_TEMPLATES[theme];
  const impact = mergeRelatedItemIds(insights).length;
  const severe = insights.filter((i) => i.severity === "high").length;
  const why = `Why this matters: ${template.goal} This action addresses ${insights.length} insight(s) across ${impact} related item(s), including ${severe} high-severity signal(s).`;
  const steps = template.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");
  return `${why}\n\nSuccess criteria:\n- All listed steps completed and verified.\n- Related risk signals decrease after refresh.\n\nSteps:\n${steps}`;
}

function prioritizedFocusedInsights(insights: Insight[]): Insight[] {
  if (insights.length <= MAX_FOCUSED_ACTIONS) {
    return rankInsightsForActioning(insights, MAX_FOCUSED_ACTIONS);
  }
  const base = rankInsightsForActioning(insights, MAX_FOCUSED_ACTIONS);
  if (base.length >= MIN_FOCUSED_ACTIONS) return base;
  return rankInsightsForActioning(insights, MIN_FOCUSED_ACTIONS);
}

export function buildFocusedActionPlan(insights: Insight[]): FocusedActionPlan[] {
  const focused = prioritizedFocusedInsights(insights);
  const grouped = new Map<ActionTheme, Insight[]>();
  for (const insight of focused) {
    const theme = themeForInsight(insight);
    const bucket = grouped.get(theme) ?? [];
    bucket.push(insight);
    grouped.set(theme, bucket);
  }

  return [...grouped.entries()]
    .map(([theme, themedInsights]) => ({
      theme,
      insights: themedInsights,
      score: themedInsights.reduce((sum, i) => sum + insightPriorityScore(i), 0),
      priority: themedInsights.some((i) => i.severity === "high")
        ? ("high" as UserActionPriority)
        : themedInsights.some((i) => i.type === "recommendation")
          ? ("medium" as UserActionPriority)
          : ("low" as UserActionPriority),
    }))
    .sort((a, b) => b.score - a.score || a.theme.localeCompare(b.theme))
    .slice(0, MAX_FOCUSED_ACTIONS)
    .map((entry) => {
      const template = ACTION_TEMPLATES[entry.theme];
      return {
        actionKey: actionKeyForTheme(entry.theme),
        insightId: entry.insights[0]?.id ?? null,
        title: template.title,
        description: actionDescriptionFromTheme(entry.theme, entry.insights),
        priority: entry.priority,
        relatedItemIds: mergeRelatedItemIds(entry.insights),
        metadata: {
          source: "focused_security_action" as const,
          theme: entry.theme,
          insightCount: entry.insights.length,
          insightIds: entry.insights.map((i) => i.id),
          estimatedMinutes: entry.priority === "high" ? 25 : 15,
        },
      };
    });
}

function toDTO(row: actionRepo.UserActionRow): UserActionDTO {
  return {
    id: row.id,
    insightId: row.insightId,
    title: row.title,
    description: row.description,
    status: row.status,
    priority: row.priority,
    relatedItemIds: row.relatedItemIds,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
  };
}

export async function syncAdvisoryActionsForClerkUser(clerkUserId: string): Promise<UserActionDTO[] | null> {
  const user = await userRepo.findUserByClerkId(clerkUserId);
  if (!user) return null;

  const insights = await generateInsightsForUser(user.id);
  const groupedEntries = buildFocusedActionPlan(insights);

  const keepActionIds: string[] = [];
  for (const entry of groupedEntries) {
    const scopedActionKey = scopedActionKeyForUser(user.id, entry.actionKey);
    keepActionIds.push(scopedActionKey);
    await actionRepo.upsertUserActionForUser(user.id, scopedActionKey, {
      insightId: entry.insightId,
      title: entry.title,
      description: entry.description,
      priority: entry.priority,
      relatedItemIds: entry.relatedItemIds,
      metadata: entry.metadata,
    });
  }

  await actionRepo.deleteUserActionsByPrefixForUser(user.id, ["insight_action_", "focus_action_"], keepActionIds);

  const rows = await actionRepo.listUserActionsForUser(user.id);
  const ordered = rows
    .filter((row) => row.actionKey.startsWith("focus_action_"))
    .sort((a, b) => {
      const pa = a.priority === "high" ? 3 : a.priority === "medium" ? 2 : 1;
      const pb = b.priority === "high" ? 3 : b.priority === "medium" ? 2 : 1;
      return pb - pa || a.title.localeCompare(b.title);
    })
    .slice(0, MAX_FOCUSED_ACTIONS);
  return ordered.map(toDTO);
}

export async function updateActionStatusForClerkUser(
  clerkUserId: string,
  actionId: string,
  status: UserActionStatus,
): Promise<"ok" | "USER_NOT_FOUND" | "NOT_FOUND"> {
  const user = await userRepo.findUserByClerkId(clerkUserId);
  if (!user) return "USER_NOT_FOUND";
  const ok = await actionRepo.updateUserActionStatusForUser(user.id, actionId, status);
  return ok ? "ok" : "NOT_FOUND";
}
