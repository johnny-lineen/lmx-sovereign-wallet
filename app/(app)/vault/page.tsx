import { ProfileIngestionSection } from "@/components/vault/profile-ingestion-section";
import { VaultOverview } from "@/components/vault/vault-overview";
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
      <div>
        <h2 className="text-2xl font-semibold tracking-tight">Vault</h2>
        <p className="text-muted-foreground">Identity-linked items and relationships for your account.</p>
      </div>
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
        <ProfileIngestionSection />
      </Suspense>
      {library ? (
        <VaultOverview library={library} clerkUserId={userId} />
      ) : (
        <p className="text-sm text-muted-foreground">Could not load vault data for this session.</p>
      )}
    </div>
  );
}
