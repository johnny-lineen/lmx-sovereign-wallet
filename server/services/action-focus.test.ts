import assert from "node:assert/strict";
import test from "node:test";

import type { Insight, InsightSeverity, InsightType } from "@prisma/client";

import { buildFocusedActionPlan, scopedActionKeyForUser } from "@/server/services/action.service";

function makeInsight(params: {
  id: string;
  title: string;
  type: InsightType;
  severity: InsightSeverity;
  relatedItemIds: string[];
}): Insight {
  return {
    id: params.id,
    userId: "user-1",
    type: params.type,
    title: params.title,
    description: "test",
    severity: params.severity,
    relatedItemIds: params.relatedItemIds,
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

test("buildFocusedActionPlan groups related insights into capped focused actions", () => {
  const insights: Insight[] = [
    makeInsight({
      id: "i1",
      title: "Email shared across multiple accounts",
      type: "risk",
      severity: "high",
      relatedItemIds: ["e1", "a1", "a2"],
    }),
    makeInsight({
      id: "i2",
      title: "Accounts without recovery relationships",
      type: "recommendation",
      severity: "medium",
      relatedItemIds: ["a3", "a4"],
    }),
    makeInsight({
      id: "i3",
      title: "Financial exposure via linked payment methods",
      type: "risk",
      severity: "high",
      relatedItemIds: ["a5", "p1"],
    }),
    makeInsight({
      id: "i4",
      title: "High connectivity: primary inbox",
      type: "insight",
      severity: "high",
      relatedItemIds: ["e2"],
    }),
    makeInsight({
      id: "i5",
      title: "Duplicate email entries in vault",
      type: "insight",
      severity: "medium",
      relatedItemIds: ["e3", "e4"],
    }),
    makeInsight({
      id: "i6",
      title: "Generic lower insight",
      type: "insight",
      severity: "low",
      relatedItemIds: ["x1"],
    }),
  ];

  const plan = buildFocusedActionPlan(insights);
  assert.ok(plan.length <= 5);
  assert.ok(plan.length >= 3);
  assert.ok(plan.some((a) => a.actionKey === "focus_action_inbox_compartmentalization"));
  assert.ok(plan.some((a) => a.actionKey === "focus_action_recovery_hardening"));
  assert.ok(plan.some((a) => a.actionKey === "focus_action_payment_surface_reduction"));
  assert.ok(plan.every((a) => a.metadata.source === "focused_security_action"));
});

test("scopedActionKeyForUser is deterministic and user-isolated", () => {
  const baseKey = "focus_action_inbox_compartmentalization";
  const userAKey = scopedActionKeyForUser("user-a", baseKey);
  const userBKey = scopedActionKeyForUser("user-b", baseKey);

  assert.equal(userAKey, "focus_action_inbox_compartmentalization_user-a");
  assert.equal(userBKey, "focus_action_inbox_compartmentalization_user-b");
  assert.notEqual(userAKey, userBKey);
});
