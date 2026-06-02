"use client";

import { useState } from "react";

import { dashboardCardClass } from "@/components/dashboard/dashboard-styles";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

import type { DashboardBreachAccountRow } from "@/server/services/dashboard-breach.service";

const VISIBLE_COUNT = 20;

type BreachAccountsSectionProps = {
  accounts: DashboardBreachAccountRow[];
};

export function BreachAccountsSection({ accounts }: BreachAccountsSectionProps) {
  const [expanded, setExpanded] = useState(false);

  if (accounts.length === 0) {
    return (
      <Card className={dashboardCardClass}>
        <CardHeader>
          <CardTitle className="text-lg text-white">Accounts found</CardTitle>
          <CardDescription className="text-slate-400">
            Services discovered from your inbox scans.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-slate-400">No accounts found yet. Run a scan to discover services.</p>
        </CardContent>
      </Card>
    );
  }

  const hasMore = accounts.length > VISIBLE_COUNT;
  const visible = expanded || !hasMore ? accounts : accounts.slice(0, VISIBLE_COUNT);
  const hiddenCount = accounts.length - VISIBLE_COUNT;

  return (
    <Card className={dashboardCardClass}>
      <CardHeader>
        <CardTitle className="text-lg text-white">Accounts found</CardTitle>
        <CardDescription className="text-slate-400">
          {accounts.length} service{accounts.length === 1 ? "" : "s"} from import scans.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-white/[0.03]">
          {visible.map((account) => (
            <li
              key={account.id}
              className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 text-sm"
            >
              <div className="min-w-0 space-y-0.5">
                <p className="truncate font-medium text-white">{account.providerName}</p>
                {account.sourceEmail ? (
                  <p className="truncate text-xs text-slate-500">{account.sourceEmail}</p>
                ) : null}
              </div>
              {account.isBreachedService ? (
                <span className="shrink-0 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-300">
                  breached service
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        {hasMore ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-slate-400 hover:text-white"
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? "Show fewer" : `Show all ${accounts.length} accounts`}
            {!expanded && hiddenCount > 0 ? ` (${hiddenCount} more)` : null}
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
