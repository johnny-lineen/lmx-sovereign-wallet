import { breachSeverityFromDataClasses } from "@/lib/breach-severity";
import { prisma } from "@/lib/prisma";
import type { HibpBreach } from "@/server/services/hibp.service";
import * as gmailImportRepo from "@/server/repositories/gmail-import.repository";
import * as userRepo from "@/server/repositories/user.repository";

export type DashboardBreachRow = {
  name: string;
  domain: string;
  breachDate: string;
  dataClasses: string[];
  severity: "high" | "medium" | "low";
};

export type DashboardEmailBreachReport = {
  email: string;
  breaches: DashboardBreachRow[];
};

export type DashboardBreachAccountRow = {
  id: string;
  providerName: string;
  sourceEmail: string | null;
  providerDomain: string | null;
  isBreachedService: boolean;
};

export type DashboardBreachSummary = {
  totalAccountCount: number;
  totalBreachCount: number;
  emailsExposedCount: number;
  uniqueBreachCount: number;
  emailReports: DashboardEmailBreachReport[];
  accounts: DashboardBreachAccountRow[];
};

function parseBreachesJson(value: unknown): HibpBreach[] {
  if (!Array.isArray(value)) return [];
  const rows: HibpBreach[] = [];
  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    rows.push({
      Name: typeof row.Name === "string" ? row.Name : "",
      Domain: typeof row.Domain === "string" ? row.Domain : "",
      BreachDate: typeof row.BreachDate === "string" ? row.BreachDate : "",
      DataClasses: Array.isArray(row.DataClasses)
        ? row.DataClasses.filter((c): c is string => typeof c === "string")
        : [],
      IsSensitive: Boolean(row.IsSensitive),
    });
  }
  return rows;
}

function normalizeDomain(domain: string): string {
  return domain.trim().toLowerCase().replace(/^www\./, "");
}

function domainsMatch(providerDomain: string, breachDomain: string): boolean {
  const a = normalizeDomain(providerDomain);
  const b = normalizeDomain(breachDomain);
  if (!a || !b) return false;
  return a === b || a.endsWith(`.${b}`) || b.endsWith(`.${a}`);
}

export async function getDashboardBreachSummaryForClerkUser(
  clerkUserId: string,
): Promise<DashboardBreachSummary | null> {
  const user = await userRepo.findUserByClerkId(clerkUserId);
  if (!user) return null;

  const [scans, candidates] = await Promise.all([
    prisma.breachScan.findMany({
      where: { userId: user.id },
      orderBy: { email: "asc" },
    }),
    gmailImportRepo.listImportCandidatesWithJobContextForUser(user.id, {}),
  ]);

  const emailReports: DashboardEmailBreachReport[] = [];
  const breachDomains = new Set<string>();
  const uniqueBreachNames = new Set<string>();
  let totalBreachCount = 0;
  let emailsExposedCount = 0;

  for (const scan of scans) {
    const raw = parseBreachesJson(scan.breaches);
    if (raw.length === 0) continue;

    emailsExposedCount += 1;
    totalBreachCount += raw.length;

    const breaches: DashboardBreachRow[] = raw.map((b) => {
      if (b.Name) uniqueBreachNames.add(b.Name);
      if (b.Domain) breachDomains.add(normalizeDomain(b.Domain));
      return {
        name: b.Name,
        domain: b.Domain,
        breachDate: b.BreachDate,
        dataClasses: b.DataClasses,
        severity: breachSeverityFromDataClasses(b.DataClasses),
      };
    });

    emailReports.push({ email: scan.email, breaches });
  }

  const accounts: DashboardBreachAccountRow[] = candidates.map((c) => {
    const providerDomain = c.providerDomain?.trim() || null;
    const isBreachedService =
      providerDomain !== null &&
      [...breachDomains].some((d) => domainsMatch(providerDomain, d));

    return {
      id: c.id,
      providerName: c.provider?.trim() || c.title,
      sourceEmail: c.importJob.gmailConnector?.gmailAddress ?? c.importJob.profileEmailItem?.title ?? null,
      providerDomain,
      isBreachedService,
    };
  });

  return {
    totalAccountCount: candidates.length,
    totalBreachCount,
    emailsExposedCount,
    uniqueBreachCount: uniqueBreachNames.size,
    emailReports,
    accounts,
  };
}
