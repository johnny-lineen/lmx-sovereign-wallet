import type { Insight, InsightSeverity, InsightType } from "@prisma/client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

function severityClass(severity: InsightSeverity): string {
  switch (severity) {
    case "high":
      return "border-destructive/25 bg-destructive/10 text-destructive";
    case "medium":
      return "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-100";
    default:
      return "border-border bg-muted/60 text-muted-foreground";
  }
}

function typeClass(type: InsightType): string {
  switch (type) {
    case "risk":
      return "border-destructive/20 bg-destructive/5 text-destructive";
    case "recommendation":
      return "border-primary/25 bg-primary/5 text-primary";
    default:
      return "border-border bg-muted/40 text-foreground";
  }
}

function InsightMeta({ insight }: { insight: Insight }) {
  return (
    <div className="flex flex-wrap gap-2">
      <span
        className={cn(
          "inline-flex rounded-md border px-2 py-0.5 text-xs font-medium capitalize",
          typeClass(insight.type),
        )}
      >
        {insight.type.replaceAll("_", " ")}
      </span>
      <span
        className={cn(
          "inline-flex rounded-md border px-2 py-0.5 text-xs font-medium capitalize",
          severityClass(insight.severity),
        )}
      >
        {insight.severity}
      </span>
    </div>
  );
}

function RelatedItemsHint({ ids }: { ids: string[] }) {
  if (ids.length === 0) return null;
  const preview = ids.slice(0, 4).join(", ");
  const more = ids.length > 4 ? ` +${ids.length - 4} more` : "";
  return (
    <p className="mt-3 font-mono text-xs text-muted-foreground break-all" title={ids.join("\n")}>
      Related vault items ({ids.length}): {preview}
      {more}
    </p>
  );
}

function productivityLabel(title: string): string {
  if (title.includes("Email shared")) return "Inbox security";
  if (title.includes("without recovery")) return "Recovery resilience";
  if (title.includes("Financial exposure")) return "Payment risk";
  if (title.includes("High connectivity")) return "Blast radius";
  if (title.includes("Duplicate email entries")) return "Data hygiene";
  return "Account hardening";
}

function impactSummary(ids: string[]): string {
  if (ids.length === 0) return "No linked items";
  if (ids.length === 1) return "Impacts 1 linked item";
  return `Impacts ${ids.length} linked items`;
}

export function InsightsList({ insights }: { insights: Insight[] }) {
  if (insights.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-base">No insights yet</CardTitle>
          <CardDescription>
            Add vault items and relationships (emails, accounts, recovery links, payment methods). The engine
            will surface risks and recommendations automatically.
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <ul className="space-y-4">
      {insights.map((insight) => (
        <li key={insight.id}>
          <Card className="h-full">
            <CardHeader className="gap-2 pb-2">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <CardTitle className="text-base leading-snug">{insight.title}</CardTitle>
                <InsightMeta insight={insight} />
              </div>
            </CardHeader>
            <CardContent className="space-y-0 pt-0">
              <p className="text-sm leading-relaxed text-muted-foreground">{insight.description}</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <span className="inline-flex rounded-md border border-primary/20 bg-primary/5 px-2 py-0.5 text-xs font-medium text-primary">
                  {productivityLabel(insight.title)}
                </span>
                <span className="inline-flex rounded-md border border-border bg-muted/50 px-2 py-0.5 text-xs font-medium text-muted-foreground">
                  {impactSummary(insight.relatedItemIds)}
                </span>
              </div>
              <RelatedItemsHint ids={insight.relatedItemIds} />
            </CardContent>
          </Card>
        </li>
      ))}
    </ul>
  );
}
