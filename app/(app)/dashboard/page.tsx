import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { IdentitySummaryCard, IdentitySummaryEmpty } from "@/components/dashboard/identity-summary-card";
import { SectionPlaceholder } from "@/components/placeholders/section-placeholder";
import * as identityService from "@/server/services/identity.service";
import { auth } from "@clerk/nextjs/server";

export default async function DashboardPage() {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const identity = await identityService.getRootIdentityForClerkUser(userId);

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Dashboard</h2>
        <p className="text-muted-foreground">Phase 1 foundation — placeholders for upcoming features.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {identity ? <IdentitySummaryCard identity={identity} /> : <IdentitySummaryEmpty />}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Linked nodes</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">—</p>
            <p className="text-xs text-muted-foreground">Placeholder KPI</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Signals</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-semibold">—</p>
            <p className="text-xs text-muted-foreground">Placeholder KPI</p>
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <SectionPlaceholder
          title="Graph preview"
          description="Identity graph visualization will appear here."
          emptyMessage="Graph rendering is not enabled in Phase 1."
        />
        <SectionPlaceholder
          title="Top insights"
          description="Ranked insights from your identity graph."
          emptyMessage="No insights yet — Phase 2 will populate this section."
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Agent</CardTitle>
          <p className="text-sm text-muted-foreground">
            Natural language control surface (not wired in Phase 1).
          </p>
        </CardHeader>
        <CardContent>
          <Textarea
            readOnly
            placeholder="Ask the sovereign agent about your identity graph…"
            className="min-h-[100px] resize-none bg-muted/30"
          />
        </CardContent>
      </Card>
    </div>
  );
}
