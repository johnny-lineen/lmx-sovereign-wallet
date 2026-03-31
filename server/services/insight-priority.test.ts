import assert from "node:assert/strict";
import test from "node:test";

import type { Insight, InsightSeverity, InsightType } from "@prisma/client";

import { insightPriorityScore, rankInsightsForActioning } from "@/server/services/insight.service";

function makeInsight(params: {
  id: string;
  type: InsightType;
  severity: InsightSeverity;
  relatedItemCount: number;
  title?: string;
}): Insight {
  return {
    id: params.id,
    userId: "user-1",
    type: params.type,
    title: params.title ?? params.id,
    description: "test",
    severity: params.severity,
    relatedItemIds: Array.from({ length: params.relatedItemCount }, (_, i) => `item-${i + 1}`),
    createdAt: new Date("2026-01-01T00:00:00.000Z"),
  };
}

test("insightPriorityScore ranks high-risk above lower-severity signals", () => {
  const highRisk = makeInsight({ id: "a", type: "risk", severity: "high", relatedItemCount: 3 });
  const mediumRecommendation = makeInsight({
    id: "b",
    type: "recommendation",
    severity: "medium",
    relatedItemCount: 5,
  });

  assert.ok(insightPriorityScore(highRisk) > insightPriorityScore(mediumRecommendation));
});

test("rankInsightsForActioning applies deterministic ordering and limit", () => {
  const insights = [
    makeInsight({ id: "ins-1", title: "zeta", type: "insight", severity: "low", relatedItemCount: 1 }),
    makeInsight({ id: "ins-2", title: "beta", type: "risk", severity: "high", relatedItemCount: 2 }),
    makeInsight({ id: "ins-3", title: "alpha", type: "risk", severity: "high", relatedItemCount: 2 }),
    makeInsight({ id: "ins-4", title: "gamma", type: "recommendation", severity: "medium", relatedItemCount: 3 }),
  ];

  const ranked = rankInsightsForActioning(insights, 3);
  assert.equal(ranked.length, 3);
  assert.deepEqual(
    ranked.map((i) => i.id),
    ["ins-3", "ins-2", "ins-4"],
  );
});
