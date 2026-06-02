import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

import { dashboardCardClass } from "@/components/dashboard/dashboard-styles";

type BreachMetricCardsProps = {
  totalAccountCount: number;
  totalBreachCount: number;
  emailsExposedCount: number;
};

export function BreachMetricCards({
  totalAccountCount,
  totalBreachCount,
  emailsExposedCount,
}: BreachMetricCardsProps) {
  const metrics = [
    { label: "Total accounts found", value: totalAccountCount },
    { label: "Breach hits", value: totalBreachCount },
    { label: "Emails exposed", value: emailsExposedCount },
  ] as const;

  return (
    <Card className={dashboardCardClass}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-white">Exposure overview</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid gap-2 sm:grid-cols-3">
          {metrics.map((metric) => (
            <div
              key={metric.label}
              className="rounded-lg border border-white/[0.08] bg-white/[0.03] px-3 py-2.5"
            >
              <p className="text-xs text-slate-500">{metric.label}</p>
              <p className="text-lg font-semibold text-white">{metric.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
