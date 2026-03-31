import type { Insight, InsightSeverity } from "@prisma/client";
import Link from "next/link";

import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const PREVIEW_LIMIT = 5;

function severityDot(severity: InsightSeverity): string {
  switch (severity) {
    case "high":
      return "bg-destructive";
    case "medium":
      return "bg-amber-500";
    default:
      return "bg-muted-foreground/50";
  }
}

export function DashboardInsightsPreview({ insights }: { insights: Insight[] }) {
  const preview = insights.slice(0, PREVIEW_LIMIT);
  const extra = insights.length - preview.length;

  if (insights.length === 0) {
    return (
      <Card className="h-full">
        <CardHeader>
          <CardTitle className="text-base">Top insights</CardTitle>
          <p className="text-sm text-muted-foreground">
            Rule-based observations from your vault graph will appear here.
          </p>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            No insights yet — add accounts, emails, and relationships in the Vault to generate signals.
          </p>
        </CardContent>
        <CardFooter className="border-t bg-muted/30">
          <Link href="/insights" className="text-sm font-medium text-primary hover:underline">
            Open Insights
          </Link>
        </CardFooter>
      </Card>
    );
  }

  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle className="text-base">Top insights</CardTitle>
        <p className="text-sm text-muted-foreground">Latest risks and recommendations from your graph.</p>
      </CardHeader>
      <CardContent className="space-y-3">
        <ul className="space-y-3">
          {preview.map((i) => (
            <li key={i.id} className="flex gap-3 text-sm">
              <span
                className={cn("mt-1.5 size-2 shrink-0 rounded-full", severityDot(i.severity))}
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-snug">{i.title}</p>
                <p className="line-clamp-2 text-muted-foreground">{i.description}</p>
              </div>
            </li>
          ))}
        </ul>
        {extra > 0 ? (
          <p className="text-xs text-muted-foreground">+{extra} more on the Insights page</p>
        ) : null}
      </CardContent>
      <CardFooter className="border-t bg-muted/30">
        <Link href="/insights" className="text-sm font-medium text-primary hover:underline">
          View all insights
        </Link>
      </CardFooter>
    </Card>
  );
}
