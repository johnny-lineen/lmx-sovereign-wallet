import { breachSeverityClass } from "@/lib/breach-severity";
import { cn } from "@/lib/utils";

import { dashboardCardClass } from "@/components/dashboard/dashboard-styles";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

import type { DashboardEmailBreachReport } from "@/server/services/dashboard-breach.service";

type BreachReportSectionProps = {
  emailReports: DashboardEmailBreachReport[];
};

export function BreachReportSection({ emailReports }: BreachReportSectionProps) {
  if (emailReports.length === 0) {
    return null;
  }

  return (
    <Card className={dashboardCardClass}>
      <CardHeader>
        <CardTitle className="text-lg text-white">Breach report</CardTitle>
        <CardDescription className="text-slate-400">
          Known breaches affecting your scanned email addresses.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {emailReports.map((report) => (
          <section key={report.email} className="space-y-3">
            <h3 className="text-sm font-semibold text-white">{report.email}</h3>
            <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-white/[0.03]">
              {report.breaches.map((breach) => (
                <li key={`${report.email}-${breach.name}`} className="space-y-2 px-3 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <p className="font-medium text-white">{breach.name}</p>
                    <span
                      className={cn(
                        "inline-flex rounded-md border px-2 py-0.5 text-xs font-medium capitalize",
                        breachSeverityClass(breach.severity),
                      )}
                    >
                      {breach.severity}
                    </span>
                  </div>
                  <dl className="grid gap-1 text-xs text-slate-400 sm:grid-cols-2">
                    <div>
                      <dt className="inline text-slate-500">Breach date: </dt>
                      <dd className="inline text-slate-300">{breach.breachDate || "—"}</dd>
                    </div>
                    <div className="sm:col-span-2">
                      <dt className="text-slate-500">Data exposed</dt>
                      <dd className="text-slate-300">
                        {breach.dataClasses.length > 0 ? breach.dataClasses.join(", ") : "—"}
                      </dd>
                    </div>
                  </dl>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </CardContent>
    </Card>
  );
}
