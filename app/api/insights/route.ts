import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { generateInsightsForClerkUser, rankInsightsForActioning, summarizeInsightRisk } from "@/server/services/insight.service";

async function insightsPayload(userId: string) {
  const insights = await generateInsightsForClerkUser(userId);
  if (!insights) {
    return null;
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

  return {
    riskSummary: summarizeInsightRisk(insights),
    insights: mapped,
    topInsights,
  };
}

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await insightsPayload(userId);
  if (!payload) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(payload);
}

/** Regenerates persisted insights (same body as GET). */
export async function POST() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await insightsPayload(userId);
  if (!payload) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(payload);
}
