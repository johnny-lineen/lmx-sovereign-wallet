import { ActionCenter } from "@/components/actions/action-center";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { IdentitySummaryCard, IdentitySummaryEmpty } from "@/components/dashboard/identity-summary-card";
import { DashboardInsightsPreview } from "@/components/insights/dashboard-insights-preview";
import { SectionPlaceholder } from "@/components/placeholders/section-placeholder";
import Link from "next/link";
import * as identityService from "@/server/services/identity.service";
import * as insightService from "@/server/services/insight.service";
import * as vaultService from "@/server/services/vault.service";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const [identity, vaultItemCount, insights] = await Promise.all([
    identityService.getRootIdentityForClerkUser(userId),
    vaultService.countVaultItemsForClerkUser(userId),
    insightService.generateInsightsForClerkUser(userId),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">
          Understand your footprint fast: ingest, view your graph, and prioritize actions.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {identity ? <IdentitySummaryCard identity={identity} /> : <IdentitySummaryEmpty />}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Vault items</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{vaultItemCount}</p>
            <p className="text-xs text-muted-foreground">Stored identity graph nodes</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Active insights</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">{insights === null ? "—" : insights.length}</p>
            <p className="text-xs text-muted-foreground">From the rule engine (refreshed on load)</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Graph view</CardTitle>
            <p className="text-sm text-muted-foreground">
              Open your relationship graph to see how inboxes, accounts, and subscriptions connect.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              The graph includes type color mapping, relationship labels, and node-level explainability.
            </p>
            <Button size="sm" nativeButton={false} render={<Link href="/graph" />}>
              Open Graph
            </Button>
          </CardContent>
        </Card>
        {insights === null ? (
          <SectionPlaceholder
            title="Top insights"
            description="Ranked insights from your identity graph."
            emptyMessage="Insights could not be loaded."
          />
        ) : (
          <DashboardInsightsPreview insights={insights} />
        )}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agent</CardTitle>
          <p className="text-sm text-muted-foreground">
            Advisory action planning surface for your identity graph.
          </p>
        </CardHeader>
        <CardContent>
          <Textarea readOnly value="Use the Action Center below to execute prioritized remediation steps." className="min-h-[100px] resize-none bg-muted/30" />
        </CardContent>
      </Card>

      <ActionCenter />
    </div>
  );
}
