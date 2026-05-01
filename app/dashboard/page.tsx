import { AppPageHeader } from "@/components/app-page-header";
import { ActionCenter } from "@/components/actions/action-center";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { IdentitySummaryCard, IdentitySummaryEmpty } from "@/components/dashboard/identity-summary-card";
import { DashboardInsightsPreview } from "@/components/insights/dashboard-insights-preview";
import { SectionPlaceholder } from "@/components/placeholders/section-placeholder";
import Link from "next/link";
import * as identityService from "@/server/services/identity.service";
import * as graphService from "@/server/services/graph.service";
import * as insightService from "@/server/services/insight.service";
import * as vaultService from "@/server/services/vault.service";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const [identity, vaultItemCount, insights, graphPayload] = await Promise.all([
    identityService.getRootIdentityForClerkUser(userId),
    vaultService.countVaultItemsForClerkUser(userId),
    insightService.generateInsightsForClerkUser(userId),
    graphService.getGraphPayloadForClerkUser(userId),
  ]);
  const activeInsights = insights === null ? "—" : insights.length;
  const graphOverview = graphPayload?.overview;

  return (
    <div className="space-y-6">
      <AppPageHeader
        title="Dashboard"
        description="Understand your footprint fast: ingest, view your graph, and prioritize actions."
      />

      <Card className="border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] shadow-[0_0_60px_-12px_rgba(34,211,238,0.12)] backdrop-blur-sm">
        <CardContent className="space-y-4 p-4 sm:p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-1">
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-cyan-400/95">Identity owner</p>
              <p className="text-xl font-semibold text-white">
                {identity?.displayName ?? "Vault owner"}
              </p>
              <p className="text-sm text-slate-400">
                {identity?.summary ?? "Your root identity and highest-priority risks in one place."}
              </p>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 font-medium text-slate-300">
                Vault items {vaultItemCount}
              </span>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 font-medium text-slate-300">
                Active insights {activeInsights}
              </span>
              <span className="rounded-full border border-white/[0.08] bg-white/[0.04] px-3 py-1.5 font-medium text-slate-300">
                Providers {graphOverview?.distinctProviders ?? 0}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            {identity ? <IdentitySummaryCard identity={identity} /> : <IdentitySummaryEmpty />}
            <Card className="overflow-hidden border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] shadow-[0_0_60px_-12px_rgba(34,211,238,0.12)] backdrop-blur-sm">
              <CardHeader className="pb-2">
                <CardTitle className="text-base text-white">Graph preview</CardTitle>
                <p className="text-sm text-slate-400">Quick snapshot of linked entities discovered in your vault.</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="relative h-28 rounded-xl border border-white/[0.08] bg-[#05070a]/90">
                  <span className="absolute left-1/2 top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-cyan-400 shadow-md shadow-cyan-400/20" />
                  <span className="absolute left-[28%] top-[34%] size-2.5 rounded-full bg-violet-500/90" />
                  <span className="absolute right-[27%] top-[30%] size-2.5 rounded-full bg-violet-500/90" />
                  <span className="absolute left-[25%] bottom-[28%] size-2.5 rounded-full bg-violet-500/90" />
                  <span className="absolute right-[31%] bottom-[22%] size-2.5 rounded-full bg-orange-500/90" />
                  <span className="absolute left-1/2 top-1/2 h-px w-[56%] -translate-x-1/2 bg-white/20" />
                  <span className="absolute left-1/2 top-1/2 h-[56%] w-px -translate-y-1/2 bg-white/20" />
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-slate-400">
                  <p>Nodes: {graphOverview?.totalNodes ?? 0}</p>
                  <p>Edges: {graphOverview?.totalEdges ?? 0}</p>
                  <p>Emails: {graphOverview?.emailCount ?? 0}</p>
                  <p>Accounts: {graphOverview?.accountCount ?? 0}</p>
                </div>
                <Button size="sm" nativeButton={false} render={<Link href="/graph" />}>
                  Open full graph
                </Button>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-2">
            <div>
              <h2 className="text-base font-semibold text-white">Actionable insights</h2>
              <p className="text-sm text-slate-400">
                Prioritized findings from your graph, ready for remediation.
              </p>
            </div>
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
        </div>

        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-white">Recommended next actions</h2>
            <p className="text-sm text-slate-400">Execute focused actions to reduce risk quickly.</p>
          </div>
          <ActionCenter />
        </div>
      </div>
    </div>
  );
}
