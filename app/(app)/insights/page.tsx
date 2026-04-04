import { AppPageHeader } from "@/components/app-page-header";
import { InsightsList } from "@/components/insights/insights-list";
import { generateInsightsForClerkUser, summarizeInsightRisk } from "@/server/services/insight.service";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

export default async function InsightsPage() {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const insights = await generateInsightsForClerkUser(userId);
  const riskSummary = insights ? summarizeInsightRisk(insights) : null;

  return (
    <div className="space-y-8">
      <AppPageHeader
        title="Insights"
        description="Deterministic rules over your vault — no external APIs. Refreshed each time you open this page."
      />

      {insights === null ? (
        <p className="text-sm text-destructive" role="alert">
          Could not load insights. Try again after signing in.
        </p>
      ) : (
        <div className="space-y-4">
          {riskSummary ? (
            <div className="rounded-lg border border-border/60 bg-muted/20 p-3">
              <p className="text-sm font-medium">Identity Risk Score: {riskSummary.score}/100</p>
              <p className="text-xs text-muted-foreground">
                High-risk: {riskSummary.breakdown.highRiskCount} · Medium-risk: {riskSummary.breakdown.mediumRiskCount} · High severity: {riskSummary.breakdown.highSeverityCount}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">{riskSummary.explanation}</p>
            </div>
          ) : null}
          <InsightsList insights={insights} />
        </div>
      )}
    </div>
  );
}
