import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { checkBreachesMany, type HibpBreach } from "@/server/services/hibp.service";
import * as userRepo from "@/server/repositories/user.repository";

export type BreachScanAddressResult = {
  email: string;
  breachCount: number;
  breaches: HibpBreach[];
};

export type RunBreachScanResult =
  | { ok: true; results: BreachScanAddressResult[] }
  | { ok: false; error: "user_not_found"; status: 404 };

export async function runBreachScan(
  clerkUserId: string,
  emails: string[],
): Promise<RunBreachScanResult> {
  const user = await userRepo.findUserByClerkId(clerkUserId);
  if (!user) {
    return { ok: false, error: "user_not_found", status: 404 };
  }

  const normalized = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  if (normalized.length === 0) {
    return { ok: true, results: [] };
  }

  const breachByEmail = await checkBreachesMany(normalized);
  const scannedAt = new Date();
  const results: BreachScanAddressResult[] = [];

  for (const email of normalized) {
    const breaches = breachByEmail.get(email) ?? [];
    const breachesJson = breaches as unknown as Prisma.InputJsonValue;

    await prisma.breachScan.upsert({
      where: { userId_email: { userId: user.id, email } },
      create: {
        userId: user.id,
        email,
        breaches: breachesJson,
        scannedAt,
      },
      update: {
        breaches: breachesJson,
        scannedAt,
      },
    });

    results.push({
      email,
      breachCount: breaches.length,
      breaches,
    });
  }

  return { ok: true, results };
}
