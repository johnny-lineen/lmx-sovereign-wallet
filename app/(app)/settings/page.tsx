import { AppPageHeader } from "@/components/app-page-header";
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
      <AppPageHeader title="Settings" description="Manage your root identity profile." />
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
