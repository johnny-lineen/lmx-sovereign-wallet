import type { DemoAccountCountEstimate, DemoFootprintGoal } from "@prisma/client";
import { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function upsertDemoWaitlistEntry(input: {
  email: string;
  digitalFootprintGoal: DemoFootprintGoal;
  accountCountEstimate: DemoAccountCountEstimate;
  usefulnessNotes: string | null;
  source: string;
}) {
  return prisma.demoWaitlistEntry.upsert({
    where: {
      email_source: {
        email: input.email,
        source: input.source,
      },
    },
    create: input,
    update: {
      digitalFootprintGoal: input.digitalFootprintGoal,
      accountCountEstimate: input.accountCountEstimate,
      usefulnessNotes: input.usefulnessNotes,
    },
    select: {
      id: true,
      email: true,
      source: true,
    },
  });
}

export async function linkDemoWaitlistEntriesByEmails(input: { emails: string[]; clerkUserId: string }) {
  if (input.emails.length === 0) return 0;
  const result = await prisma.demoWaitlistEntry.updateMany({
    where: {
      email: { in: input.emails },
      clerkUserId: null,
    },
    data: {
      clerkUserId: input.clerkUserId,
    },
  });
  return result.count;
}

export async function countDemoWaitlistEntries() {
  return prisma.demoWaitlistEntry.count();
}

export async function countDemoWaitlistEntriesLinkedToUser() {
  return prisma.demoWaitlistEntry.count({
    where: {
      clerkUserId: { not: null },
    },
  });
}

export async function groupDemoWaitlistByFootprintGoal() {
  return prisma.demoWaitlistEntry.groupBy({
    by: ["digitalFootprintGoal"],
    _count: {
      _all: true,
    },
  });
}

export async function groupDemoWaitlistByAccountEstimate() {
  return prisma.demoWaitlistEntry.groupBy({
    by: ["accountCountEstimate"],
    _count: {
      _all: true,
    },
  });
}

export async function listRecentDemoWaitlistEntries(limit = 50) {
  return prisma.demoWaitlistEntry.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      email: true,
      source: true,
      digitalFootprintGoal: true,
      accountCountEstimate: true,
      clerkUserId: true,
      usefulnessNotes: true,
      createdAt: true,
    },
  });
}

export async function groupDemoWaitlistBySource() {
  return prisma.demoWaitlistEntry.groupBy({
    by: ["source"],
    _count: { _all: true },
  });
}

export async function countDemoWaitlistCreatedBetween(startInclusive: Date, endExclusive: Date) {
  return prisma.demoWaitlistEntry.count({
    where: {
      createdAt: {
        gte: startInclusive,
        lt: endExclusive,
      },
    },
  });
}

/** UTC calendar days with signup counts (sparse — caller may fill gaps). */
export async function listDemoWaitlistDailyCountsSince(startUtc: Date) {
  const rows = await prisma.$queryRaw<{ day: Date; count: number }[]>(
    Prisma.sql`
      SELECT (timezone('UTC', "createdAt"))::date AS day,
             COUNT(*)::int AS count
      FROM "DemoWaitlistEntry"
      WHERE "createdAt" >= ${startUtc}
      GROUP BY 1
      ORDER BY 1 ASC
    `,
  );
  return rows;
}
