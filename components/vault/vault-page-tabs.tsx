"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { ProfileIngestionSection } from "@/components/vault/profile-ingestion-section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { VaultPublicAuditTab } from "@/components/vault/vault-public-audit-tab";
import { VaultReviewQueueTab } from "@/components/vault/vault-review-queue-tab";
import { dispatchVaultDataChanged } from "@/lib/vault-changed-event";
import type { VaultLibraryDTO } from "@/server/services/vault.service";

import { VaultOverview } from "@/components/vault/vault-overview";

const TAB_VALUES = ["items", "email", "audit", "review"] as const;
type VaultTabValue = (typeof TAB_VALUES)[number];

function isVaultTab(v: string | null): v is VaultTabValue {
  return v !== null && (TAB_VALUES as readonly string[]).includes(v);
}

export function VaultPageTabs({
  library,
  clerkUserId,
}: {
  library: VaultLibraryDTO;
  clerkUserId: string;
}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const value: VaultTabValue = isVaultTab(tabParam) ? tabParam : "items";
  const [clearLoading, setClearLoading] = useState(false);

  const onValueChange = useCallback(
    (next: string | number | null) => {
      const v = typeof next === "string" && isVaultTab(next) ? next : "items";
      const params = new URLSearchParams(searchParams.toString());
      if (v === "items") params.delete("tab");
      else params.set("tab", v);
      const q = params.toString();
      router.replace(q ? `/vault?${q}` : "/vault", { scroll: false });
    },
    [router, searchParams],
  );

  const auditHighlightRunId = useMemo(() => searchParams.get("highlightAudit"), [searchParams]);

  const onClearVault = useCallback(async () => {
    if (clearLoading) return;
    const ok = window.confirm("Clear your temporary vault data for testing?");
    if (!ok) return;

    setClearLoading(true);
    try {
      const res = await fetch("/api/testing/clear-vault", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: "DELETE_TEMP_VAULT_DATA" }),
      });
      if (!res.ok) {
        window.alert("Could not clear vault data.");
        return;
      }
      router.refresh();
      dispatchVaultDataChanged();
    } catch {
      window.alert("Could not clear vault data.");
    } finally {
      setClearLoading(false);
    }
  }, [clearLoading, router]);

  return (
    <Tabs value={value} onValueChange={onValueChange} className="w-full">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <TabsList className="h-auto min-h-9 w-full flex-wrap justify-start gap-1 md:w-fit">
          <TabsTrigger value="items">Items</TabsTrigger>
          <TabsTrigger value="email">Email scan</TabsTrigger>
          <TabsTrigger value="audit">Public footprint audit</TabsTrigger>
          <TabsTrigger value="review">Review queue</TabsTrigger>
        </TabsList>
        <Button
          type="button"
          variant="destructive"
          size="sm"
          disabled={clearLoading}
          onClick={() => void onClearVault()}
        >
          {clearLoading ? "Clearing..." : "Clear vault (temp)"}
        </Button>
      </div>

      <TabsContent value="items" className="space-y-6">
        <VaultOverview library={library} clerkUserId={clerkUserId} />
      </TabsContent>

      <TabsContent value="email" className="space-y-6">
        <ProfileIngestionSection />
      </TabsContent>

      <TabsContent value="audit" className="space-y-6">
        <VaultPublicAuditTab highlightRunId={auditHighlightRunId} />
      </TabsContent>

      <TabsContent value="review" className="space-y-6">
        <VaultReviewQueueTab />
      </TabsContent>

      <p className="text-center text-xs text-muted-foreground">
        Open the{" "}
        <Link href="/graph" className="underline underline-offset-2 hover:text-foreground">
          graph
        </Link>{" "}
        to explore relationships; use filters to focus on{" "}
        <span className="font-medium text-foreground">Public audit</span> provenance.
      </p>
    </Tabs>
  );
}
