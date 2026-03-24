import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { IdentityDTO } from "@/server/services/identity.service";

export function IdentitySummaryCard({ identity }: { identity: IdentityDTO }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Identity summary</CardTitle>
        <CardDescription>Your root LMX identity record</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        <div>
          <p className="text-muted-foreground">Display name</p>
          <p className="font-medium">{identity.displayName ?? "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Summary</p>
          <p className="whitespace-pre-wrap font-medium">{identity.summary ?? "—"}</p>
        </div>
        <div>
          <p className="text-muted-foreground">Identity id</p>
          <p className="break-all font-mono text-xs text-muted-foreground">{identity.id}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export function IdentitySummaryEmpty() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Identity summary</CardTitle>
        <CardDescription>Your root LMX identity record</CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          No identity record found yet. Try refreshing the page or check your database connection.
        </p>
      </CardContent>
    </Card>
  );
}
