import { AppPageHeader } from "@/components/app-page-header";
import { BreachAccountsSection } from "@/components/dashboard/breach-accounts-section";
import { BreachAlertBanner } from "@/components/dashboard/breach-alert-banner";
import { BreachMetricCards } from "@/components/dashboard/breach-metric-cards";
import { BreachReportSection } from "@/components/dashboard/breach-report-section";
import { Card, CardContent } from "@/components/ui/card";
import * as identityService from "@/server/services/identity.service";
import { getDashboardBreachSummaryForClerkUser } from "@/server/services/dashboard-breach.service";
import * as vaultService from "@/server/services/vault.service";
import { auth } from "@clerk/nextjs/server";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const [identity, vaultItemCount, breachSummary] = await Promise.all([
    identityService.getRootIdentityForClerkUser(userId),
    vaultService.countVaultItemsForClerkUser(userId),
    getDashboardBreachSummaryForClerkUser(userId),
  ]);

  return (
    <div className="space-y-6">
      <AppPageHeader
        title="Dashboard"
        description="Understand your footprint fast: ingest, view your graph, and prioritize actions."
      />

      {breachSummary && breachSummary.totalBreachCount > 0 ? (
        <BreachAlertBanner
          emailsExposedCount={breachSummary.emailsExposedCount}
          uniqueBreachCount={breachSummary.uniqueBreachCount}
        />
      ) : null}

      {breachSummary ? (
        <>
          <BreachMetricCards
            totalAccountCount={breachSummary.totalAccountCount}
            totalBreachCount={breachSummary.totalBreachCount}
            emailsExposedCount={breachSummary.emailsExposedCount}
          />
          <BreachReportSection emailReports={breachSummary.emailReports} />
          <BreachAccountsSection accounts={breachSummary.accounts} />
        </>
      ) : null}

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
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
