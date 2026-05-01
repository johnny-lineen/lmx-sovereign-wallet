import type { DemoAccountCountEstimate, DemoFootprintGoal } from "@prisma/client";

import * as demoRequestRepo from "@/server/repositories/demo-request.repository";

const footprintGoalLabels: Record<DemoFootprintGoal, string> = {
  privacy: "Privacy",
  security: "Security",
  accounts: "Accounts",
  data_exposure: "Data exposure",
  just_curious: "Just curious",
};

const accountEstimateLabels: Record<DemoAccountCountEstimate, string> = {
  range_0_25: "0-25",
  range_25_75: "25-75",
  range_75_plus: "75+",
};

const TREND_DAYS = 28;

function utcDayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function startOfUtcDay(d: Date): Date {
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 0, 0, 0, 0));
}

function buildFilledDailySeries(
  sparse: { day: Date; count: number }[],
  dayCount: number,
): { day: string; count: number; label: string }[] {
  const map = new Map<string, number>();
  for (const row of sparse) {
    const key = utcDayKey(new Date(row.day));
    map.set(key, row.count);
  }
  const end = startOfUtcDay(new Date());
  const out: { day: string; count: number; label: string }[] = [];
  for (let i = dayCount - 1; i >= 0; i -= 1) {
    const d = new Date(end);
    d.setUTCDate(d.getUTCDate() - i);
    const day = utcDayKey(d);
    const count = map.get(day) ?? 0;
    const label = new Intl.DateTimeFormat("en-US", {
      month: "short",
      day: "numeric",
      timeZone: "UTC",
    }).format(d);
    out.push({ day, count, label });
  }
  return out;
}

function formatPaceDelta(prior: number, current: number): { label: string; tone: "up" | "down" | "flat" | "new" } {
  if (prior === 0 && current === 0) return { label: "No signups in either window", tone: "flat" };
  if (prior === 0 && current > 0) return { label: "First signups in trailing window", tone: "new" };
  const ratio = (current - prior) / prior;
  const pct = Math.round(ratio * 100);
  if (pct === 0) return { label: "Same pace as prior week", tone: "flat" };
  if (pct > 0) return { label: `${pct}% vs prior 7 days`, tone: "up" };
  return { label: `${pct}% vs prior 7 days`, tone: "down" };
}

export async function getDevOpsDemoMetrics() {
  const now = new Date();
  const startTrend = new Date(now);
  startTrend.setUTCDate(startTrend.getUTCDate() - TREND_DAYS);
  startTrend.setUTCHours(0, 0, 0, 0);

  const endLast7 = startOfUtcDay(now);
  const startLast7 = new Date(endLast7);
  startLast7.setUTCDate(startLast7.getUTCDate() - 7);

  const endPrior7 = startLast7;
  const startPrior7 = new Date(endPrior7);
  startPrior7.setUTCDate(startPrior7.getUTCDate() - 7);

  const [
    totalDemoUsers,
    linkedDemoUsers,
    footprintGoalGroups,
    accountEstimateGroups,
    sourceGroups,
    recentEntries,
    dailySparse,
    last7Count,
    prior7Count,
  ] = await Promise.all([
    demoRequestRepo.countDemoWaitlistEntries(),
    demoRequestRepo.countDemoWaitlistEntriesLinkedToUser(),
    demoRequestRepo.groupDemoWaitlistByFootprintGoal(),
    demoRequestRepo.groupDemoWaitlistByAccountEstimate(),
    demoRequestRepo.groupDemoWaitlistBySource(),
    demoRequestRepo.listRecentDemoWaitlistEntries(50),
    demoRequestRepo.listDemoWaitlistDailyCountsSince(startTrend),
    demoRequestRepo.countDemoWaitlistCreatedBetween(startLast7, endLast7),
    demoRequestRepo.countDemoWaitlistCreatedBetween(startPrior7, endPrior7),
  ]);

  const signupsByDay = buildFilledDailySeries(dailySparse, TREND_DAYS);

  const linkRate =
    totalDemoUsers > 0 ? Math.round((linkedDemoUsers / totalDemoUsers) * 1000) / 10 : null;

  return {
    totals: {
      totalDemoUsers,
      linkedDemoUsers,
      anonymousDemoUsers: Math.max(totalDemoUsers - linkedDemoUsers, 0),
      linkRatePercent: linkRate,
    },
    pace: {
      last7Days: last7Count,
      prior7Days: prior7Count,
      delta: formatPaceDelta(prior7Count, last7Count),
    },
    signupsByDay,
    distributions: {
      footprintGoals: footprintGoalGroups
        .map((group) => ({
          key: group.digitalFootprintGoal,
          label: footprintGoalLabels[group.digitalFootprintGoal],
          count: group._count._all,
        }))
        .sort((a, b) => b.count - a.count),
      accountEstimates: accountEstimateGroups
        .map((group) => ({
          key: group.accountCountEstimate,
          label: accountEstimateLabels[group.accountCountEstimate],
          count: group._count._all,
        }))
        .sort((a, b) => b.count - a.count),
      sources: sourceGroups
        .map((group) => ({
          key: group.source,
          label: formatSourceLabel(group.source),
          count: group._count._all,
        }))
        .sort((a, b) => b.count - a.count),
    },
    recentEntries,
  };
}

function formatSourceLabel(source: string) {
  return source
    .split(/[_\s]+/g)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
