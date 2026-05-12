import type { ComponentType } from "react";
import { Activity, BarChart3, Gauge, Layers, MessageSquareText, Radio, Terminal } from "lucide-react";

import type { getDevOpsDemoMetrics, getDevOpsFeedbackSummary } from "@/server/services/dev-ops.service";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type DevOpsMetrics = Awaited<ReturnType<typeof getDevOpsDemoMetrics>>;
type DevOpsFeedback = Awaited<ReturnType<typeof getDevOpsFeedbackSummary>>;

const cardSurface =
  "border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] shadow-[0_0_50px_-16px_rgba(34,211,238,0.22)] backdrop-blur-sm";

/** Pixel cap for bars; parent uses matching h-* so layout stays aligned with Tailwind scale. */
const SIGNUP_BAR_MAX_PX = 120;

export function DevOpsDashboard({ metrics, feedback }: { metrics: DevOpsMetrics; feedback: DevOpsFeedback }) {
  const { totals, pace, signupsByDay, distributions, recentEntries } = metrics;
  const peakCount = Math.max(0, ...signupsByDay.map((d) => d.count));
  const activity = recentEntries.slice(0, 24);

  function barHeightPx(count: number): number {
    if (peakCount === 0) {
      return 4;
    }
    if (count === 0) {
      return 2;
    }
    return Math.max(6, Math.round((count / peakCount) * SIGNUP_BAR_MAX_PX));
  }

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <SectionHeading icon={Gauge} title="KPIs" subtitle="Headline intake health and account linkage." />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiTile
            label="Total signups"
            value={totals.totalDemoUsers}
            hint="All-time demo waitlist rows"
          />
          <KpiTile
            label="Linked to Clerk"
            value={totals.linkedDemoUsers}
            hint={
              totals.linkRatePercent != null
                ? `${totals.linkRatePercent}% of signups tied to a user session`
                : "No signups yet"
            }
          />
          <KpiTile
            label="Last 7 days"
            value={pace.last7Days}
            hint={pace.delta.label}
            deltaTone={pace.delta.tone}
          />
          <KpiTile
            label="Prior 7 days"
            value={pace.prior7Days}
            hint="Rolling comparison window"
          />
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading
          icon={BarChart3}
          title="Trends"
          subtitle="Daily signups (UTC). Spot bursts, droughts, and campaign effects."
        />
        <Card className={cardSurface}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-white">28-day signup volume</CardTitle>
            <CardDescription className="text-slate-400">
              {peakCount === 0
                ? "No signups in this window — bars show the minimum height for alignment."
                : `Bar height scales to the busiest day (${peakCount} signup${peakCount === 1 ? "" : "s"}).`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Fixed row height + pixel bar heights: % heights inside nested flex columns often resolve to ~0. */}
            <div className="flex h-[140px] items-end gap-0.5 sm:gap-1">
              {signupsByDay.map((d) => {
                const hPx = barHeightPx(d.count);
                return (
                  <div
                    key={d.day}
                    className="group flex min-w-0 flex-1 flex-col items-center justify-end"
                    title={`${d.day}: ${d.count}`}
                  >
                    <span className="mb-1 min-h-[1rem] text-[10px] font-medium text-cyan-300/90 opacity-0 transition-opacity group-hover:opacity-100 sm:text-xs">
                      {d.count > 0 ? d.count : ""}
                    </span>
                    <div
                      className="w-full max-w-[14px] rounded-t-sm bg-gradient-to-t from-cyan-500/25 to-cyan-400/80 ring-1 ring-cyan-400/15 sm:max-w-[18px]"
                      style={{ height: `${hPx}px` }}
                    />
                  </div>
                );
              })}
            </div>
            <div className="flex justify-between text-[10px] text-slate-500 sm:text-xs">
              <span>{signupsByDay[0]?.label ?? "—"}</span>
              <span className="text-slate-400">UTC</span>
              <span>{signupsByDay[signupsByDay.length - 1]?.label ?? "—"}</span>
            </div>
          </CardContent>
        </Card>
      </section>

      <section className="space-y-3">
        <SectionHeading
          icon={Layers}
          title="Segmentation"
          subtitle="How prospects describe goals, scale, and where they entered the funnel."
        />
        <div className="grid gap-4 lg:grid-cols-3">
          <DistributionCard title="Footprint goals" items={distributions.footprintGoals} empty="No goals recorded." />
          <DistributionCard
            title="Account estimates"
            items={distributions.accountEstimates}
            empty="No estimates recorded."
          />
          <DistributionCard title="Sources" items={distributions.sources} empty="No source tags yet." />
        </div>
      </section>

      <section className="space-y-3">
        <SectionHeading
          icon={MessageSquareText}
          title="Product feedback"
          subtitle="Authenticated in-app signals (last 7 days by topic and surface). Treat message and metadata as potentially sensitive."
        />
        {feedback.migrationNeeded ? (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/95">
            <p className="font-medium text-amber-50">The ProductFeedback table is not in this database yet.</p>
            <p className="mt-1 text-amber-200/90">
              Use the same <code className="rounded bg-black/25 px-1 font-mono text-[11px] text-amber-50">DATABASE_URL</code> as the app, then run{" "}
              <code className="rounded bg-black/25 px-1 font-mono text-[11px] text-amber-50">npx prisma migrate deploy</code>{" "}
              (or <code className="rounded bg-black/25 px-1 font-mono text-[11px] text-amber-50">npx prisma migrate dev</code> locally). Reload this page after it succeeds.
            </p>
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <KpiTile
            label="Feedback (7 days)"
            value={feedback.totals.last7Days}
            hint="All themes and surfaces"
          />
          <KpiTile
            label="Feedback (28 days)"
            value={feedback.totals.last28Days}
            hint="Rolling month window"
          />
        </div>
        <div className="grid gap-4 lg:grid-cols-2">
          <DistributionCard
            title="Themes (7 days)"
            items={feedback.themes7d.map((t) => ({ label: t.label, count: t.count }))}
            empty="No feedback in the last 7 days."
          />
          <DistributionCard
            title="Surfaces (7 days)"
            items={feedback.surfaces7d.map((s) => ({ label: s.label, count: s.count }))}
            empty="No surface tags in the last 7 days."
          />
        </div>
        <Card className={cardSurface}>
          <CardHeader className="pb-2">
            <CardTitle className="text-base text-white">Feedback stream</CardTitle>
            <CardDescription className="text-slate-400">
              {feedback.recentRows.length === 0
                ? "No rows to show."
                : `Latest ${feedback.recentRows.length} rows — expand a row for full message and metadata.`}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {feedback.recentRows.length > 0 ? (
              <ul className="max-h-[min(520px,55vh)] divide-y divide-white/[0.06] overflow-y-auto">
                {feedback.recentRows.map((row) => (
                  <li key={row.id} className="px-4 py-3 sm:px-5">
                    <details className="group">
                      <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
                          <span className="font-medium text-white">{row.themeLabel}</span>
                          <span className="rounded border border-white/[0.08] px-1.5 py-0.5 font-mono text-[11px] text-violet-300/90">
                            {row.surface}
                          </span>
                          <span className="shrink-0 font-mono text-[11px] text-slate-500">
                            {formatUtcShort(row.createdAt)}
                          </span>
                          <span className="text-xs text-slate-500">
                            {row.userEmail ?? row.clerkUserId ?? "—"}
                            {row.rating != null ? (
                              <span className="ml-2 text-slate-400">
                                · rating{" "}
                                <span className="text-cyan-300/90">
                                  {row.rating === 1 ? "+1" : row.rating === -1 ? "−1" : "0"}
                                </span>
                              </span>
                            ) : null}
                          </span>
                        </div>
                        {row.message ? (
                          <p className="mt-1 line-clamp-2 text-sm text-slate-400">{row.message}</p>
                        ) : (
                          <p className="mt-1 text-sm text-slate-500">No message text</p>
                        )}
                        <p className="mt-1 text-[11px] text-slate-500 group-open:hidden">Tap to expand</p>
                      </summary>
                      <div className="mt-3 space-y-2 border-t border-white/[0.06] pt-3">
                        {row.message ? (
                          <p className="whitespace-pre-wrap text-sm text-slate-300">{row.message}</p>
                        ) : null}
                        {row.metadata != null ? (
                          <pre className="max-h-40 overflow-auto rounded-lg border border-white/[0.08] bg-black/40 p-2 font-mono text-[11px] leading-relaxed text-slate-400">
                            {JSON.stringify(row.metadata, null, 2)}
                          </pre>
                        ) : (
                          <p className="text-xs text-slate-500">No metadata</p>
                        )}
                      </div>
                    </details>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="p-6 text-sm text-slate-400">No feedback rows yet.</p>
            )}
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <section className="space-y-3">
          <SectionHeading
            icon={Activity}
            title="Intake activity"
            subtitle="Latest submissions — use as a live ops log for landing intake."
          />
          <Card className={cardSurface}>
            <CardContent className="p-0">
              {activity.length > 0 ? (
                <ul className="max-h-[min(520px,55vh)] divide-y divide-white/[0.06] overflow-y-auto">
                  {activity.map((entry, i) => (
                    <li key={entry.id} className="flex gap-3 px-4 py-3 sm:px-5">
                      <div className="flex w-5 shrink-0 flex-col items-center pt-1">
                        <span className="size-2 rounded-full bg-cyan-400/90 shadow-[0_0_10px_rgba(34,211,238,0.35)]" />
                        {i < activity.length - 1 ? (
                          <span className="mt-1 w-px flex-1 min-h-[12px] bg-gradient-to-b from-white/15 to-transparent" />
                        ) : null}
                      </div>
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                          <p className="truncate font-medium text-white">{entry.email}</p>
                          <span className="shrink-0 font-mono text-[11px] text-slate-500">
                            {formatUtcShort(entry.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-slate-400">
                          <span className="text-slate-300">{entry.digitalFootprintGoal.replaceAll("_", " ")}</span>
                          {" · "}
                          {entry.accountCountEstimate.replace("range_", "").replaceAll("_", "-")} accounts
                          {" · "}
                          <span className="text-violet-300/90">{entry.source}</span>
                          {entry.clerkUserId ? (
                            <span className="ml-1.5 rounded border border-emerald-500/25 bg-emerald-500/10 px-1.5 py-0.5 text-[11px] font-medium text-emerald-300/95">
                              linked
                            </span>
                          ) : null}
                        </p>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="p-6 text-sm text-slate-400">No intake events yet.</p>
              )}
            </CardContent>
          </Card>
        </section>

        <section className="space-y-3">
          <SectionHeading
            icon={Terminal}
            title="Dev logs & runtime"
            subtitle="Where to watch local output and what environment this page ran under."
          />
          <Card className={cardSurface}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base text-white">
                <Radio className="size-4 text-cyan-400/90" aria-hidden />
                Quick reference
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm text-slate-300">
              <div className="rounded-lg border border-white/[0.08] bg-black/30 px-3 py-2 font-mono text-xs leading-relaxed text-slate-400">
                <p>
                  <span className="text-slate-500">NODE_ENV</span>{" "}
                  <span className="text-cyan-200/90">{process.env.NODE_ENV}</span>
                </p>
                {process.env.VERCEL_ENV ? (
                  <p>
                    <span className="text-slate-500">VERCEL_ENV</span>{" "}
                    <span className="text-cyan-200/90">{process.env.VERCEL_ENV}</span>
                  </p>
                ) : null}
              </div>
              <ul className="list-inside list-disc space-y-2 text-slate-400">
                <li>
                  Local server logs: watch the terminal where <code className="text-slate-300">npm run dev</code> is
                  running.
                </li>
                <li>
                  Next dev file log (when present):{" "}
                  <code className="break-all text-slate-300">.next/dev/logs/next-development.log</code>
                </li>
                <li>Production / hosted logs: use your host&apos;s log explorer (e.g. Vercel Runtime Logs).</li>
              </ul>
            </CardContent>
          </Card>

          <Card className={cardSurface}>
            <CardHeader className="pb-2">
              <CardTitle className="text-base text-white">Full intake table</CardTitle>
              <CardDescription className="text-slate-400">Sortable-style export view (last 50 rows).</CardDescription>
            </CardHeader>
            <CardContent className="p-0 sm:p-2">
              {recentEntries.length > 0 ? (
                <div className="overflow-x-auto rounded-lg border border-white/[0.06] sm:border-0">
                  <table className="w-full min-w-[640px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-white/[0.08] text-slate-400">
                        <th className="px-3 py-2 font-medium">Email</th>
                        <th className="px-3 py-2 font-medium">Goal</th>
                        <th className="px-3 py-2 font-medium">Est.</th>
                        <th className="px-3 py-2 font-medium">Src</th>
                        <th className="px-3 py-2 font-medium">L</th>
                        <th className="px-3 py-2 font-medium">When</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentEntries.map((entry) => (
                        <tr key={entry.id} className="border-b border-white/[0.05] text-slate-200">
                          <td className="max-w-[200px] truncate px-3 py-2">{entry.email}</td>
                          <td className="px-3 py-2">{entry.digitalFootprintGoal.replaceAll("_", " ")}</td>
                          <td className="px-3 py-2">
                            {entry.accountCountEstimate.replace("range_", "").replaceAll("_", "-")}
                          </td>
                          <td className="px-3 py-2 text-xs text-violet-300/85">{entry.source}</td>
                          <td className="px-3 py-2">{entry.clerkUserId ? "Y" : "—"}</td>
                          <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-400">
                            {formatUtc(entry.createdAt)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="p-4 text-sm text-slate-400">No rows.</p>
              )}
            </CardContent>
          </Card>
        </section>
      </div>
    </div>
  );
}

function SectionHeading({
  icon: Icon,
  title,
  subtitle,
}: {
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <Icon className="size-4 text-cyan-400/85" aria-hidden />
        <h3 className="text-base font-semibold text-white">{title}</h3>
      </div>
      <p className="text-sm text-slate-400">{subtitle}</p>
    </div>
  );
}

function KpiTile({
  label,
  value,
  hint,
  deltaTone,
}: {
  label: string;
  value: number;
  hint: string;
  deltaTone?: "up" | "down" | "flat" | "new";
}) {
  const toneClass =
    deltaTone === "up"
      ? "text-emerald-400/90"
      : deltaTone === "down"
        ? "text-rose-400/90"
        : deltaTone === "new"
          ? "text-cyan-300/90"
          : "text-slate-500";
  return (
    <Card className={cardSurface}>
      <CardHeader className="pb-1">
        <CardTitle className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-3xl font-semibold tracking-tight text-white">{value}</p>
        <p className={`text-xs leading-snug ${deltaTone ? toneClass : "text-slate-500"}`}>{hint}</p>
      </CardContent>
    </Card>
  );
}

function DistributionCard({
  title,
  items,
  empty,
}: {
  title: string;
  items: { label: string; count: number }[];
  empty: string;
}) {
  const max = Math.max(1, ...items.map((i) => i.count));
  const total = items.reduce((s, i) => s + i.count, 0);
  return (
    <Card className={cardSurface}>
      <CardHeader className="pb-2">
        <CardTitle className="text-base text-white">{title}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length > 0 ? (
          items.map((item) => {
            const pct = total > 0 ? Math.round((item.count / total) * 1000) / 10 : 0;
            const barPct = (item.count / max) * 100;
            return (
              <div key={item.label} className="space-y-1">
                <div className="flex justify-between gap-2 text-sm">
                  <span className="text-slate-300">{item.label}</span>
                  <span className="shrink-0 font-medium text-white">
                    {item.count}
                    <span className="ml-1.5 text-xs font-normal text-slate-500">({pct}%)</span>
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.06]">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-cyan-500/40 to-cyan-400/90"
                    style={{ width: `${barPct}%` }}
                  />
                </div>
              </div>
            );
          })
        ) : (
          <p className="text-sm text-slate-400">{empty}</p>
        )}
      </CardContent>
    </Card>
  );
}

function formatUtc(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(value);
}

function formatUtcShort(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(value);
}
