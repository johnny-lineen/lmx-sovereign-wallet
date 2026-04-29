import { AppPageHeader } from "@/components/app-page-header";
import { VaultPageTabs } from "@/components/vault/vault-page-tabs";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { profileFromClerkUser } from "@/lib/clerk-profile";
import { ensureUserAndRootLMXIdentity } from "@/server/services/identity-bootstrap.service";
import * as vaultService from "@/server/services/vault.service";
import { auth, currentUser } from "@clerk/nextjs/server";
import { Suspense } from "react";

export const dynamic = "force-dynamic";

export default async function VaultPage() {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const clerkUser = await currentUser();
  await ensureUserAndRootLMXIdentity(userId, profileFromClerkUser(clerkUser));

  const library = await vaultService.getVaultLibraryForClerkUser(userId);

  return (
    <div className="space-y-6">
      <AppPageHeader
        title="Vault"
        description="Identity-linked items and relationships for your account."
      />
      {library ? (
        <Suspense
          fallback={
            <Card>
              <CardHeader>
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-full max-w-md" />
              </CardHeader>
              <CardContent className="space-y-3">
                <Skeleton className="h-8 w-full" />
                <Skeleton className="h-8 w-full" />
              </CardContent>
            </Card>
          }
        >
          <VaultPageTabs library={library} clerkUserId={userId} />
        </Suspense>
      ) : (
        <p className="text-sm text-muted-foreground">Could not load vault data for this session.</p>
      )}
    </div>
  );
}
