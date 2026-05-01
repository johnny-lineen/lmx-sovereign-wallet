import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { IdentityDTO } from "@/server/services/identity.service";

const dashboardCardClass =
  "border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] shadow-[0_0_60px_-12px_rgba(34,211,238,0.12)] backdrop-blur-sm";

export function IdentitySummaryCard({ identity }: { identity: IdentityDTO }) {
  return (
    <Card className={dashboardCardClass}>
      <CardHeader>
        <CardTitle className="text-lg text-white">Identity summary</CardTitle>
        <CardDescription className="text-slate-400">Your root LMX identity record</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="text-slate-400">Display name</p>
          <p className="font-medium text-white">{identity.displayName ?? "—"}</p>
        </div>
        <div>
          <p className="text-slate-400">Summary</p>
          <p className="whitespace-pre-wrap font-medium text-slate-200">{identity.summary ?? "—"}</p>
        </div>
        <div>
          <p className="text-slate-400">Identity id</p>
          <p className="break-all font-mono text-xs text-slate-500">{identity.id}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function IdentitySummaryEmpty() {
  return (
    <Card className={dashboardCardClass}>
      <CardHeader>
        <CardTitle className="text-lg text-white">Identity summary</CardTitle>
        <CardDescription className="text-slate-400">Your root LMX identity record</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-slate-400">
          No identity record found yet. Try refreshing the page or check your database connection.
        </p>
      </CardContent>
    </Card>
  );
}
