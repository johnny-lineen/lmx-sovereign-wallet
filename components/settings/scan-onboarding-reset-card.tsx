"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { resetAllScanOnboardingHints } from "@/lib/scan-onboarding";

export function ScanOnboardingResetCard() {
  const [done, setDone] = useState(false);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Vault scan tips</CardTitle>
        <CardDescription>
          Inline hints on the Email scan, Public audit, and Review queue tabs hide after you dismiss them or finish a
          step. Reset them if you want to see that guidance again.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            resetAllScanOnboardingHints();
            setDone(true);
          }}
        >
          Reset vault scan tips
        </Button>
        {done ? (
          <p className="text-sm text-muted-foreground" role="status">
            Tips are cleared. Open those Vault tabs again to see them.
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
