import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { IdentitySettingsForm } from "@/components/settings/identity-settings-form";
import * as identityService from "@/server/services/identity.service";
import { auth } from "@clerk/nextjs/server";

export default async function SettingsPage() {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const identity = await identityService.getRootIdentityForClerkUser(userId);

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Settings</h2>
        <p className="text-muted-foreground">Manage your root identity profile.</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle>Root identity</CardTitle>
          <CardDescription>Updates apply to your primary LMX identity record.</CardDescription>
        </CardHeader>
        <CardContent>
          {identity ? (
            <IdentitySettingsForm
              initialDisplayName={identity.displayName}
              initialSummary={identity.summary}
            />
          ) : (
            <p className="text-sm text-muted-foreground">
              Identity not found. Ensure your database is migrated and reachable, then refresh.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
