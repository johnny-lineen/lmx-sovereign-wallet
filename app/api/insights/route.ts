import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { generateInsightsForClerkUser, rankInsightsForActioning, summarizeInsightRisk } from "@/server/services/insight.service";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const insights = await generateInsightsForClerkUser(userId);
  if (!insights) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const mapped = insights.map((i) => ({
      id: i.id,
      userId: i.userId,
      type: i.type,
      title: i.title,
      description: i.description,
      severity: i.severity,
      relatedItemIds: i.relatedItemIds,
      createdAt: i.createdAt.toISOString(),
    }));
  const topInsights = rankInsightsForActioning(insights, 5).map((i) => ({
    id: i.id,
    title: i.title,
    type: i.type,
    severity: i.severity,
    relatedItemCount: i.relatedItemIds.length,
  }));

  return NextResponse.json({
    riskSummary: summarizeInsightRisk(insights),
    insights: mapped,
    topInsights,
  });
}
