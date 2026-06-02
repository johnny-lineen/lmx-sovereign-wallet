import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { enforceRateLimit } from "@/lib/rate-limit";
import { breachScanBodySchema } from "@/lib/validations/breach-scan";
import { runBreachScan } from "@/server/services/breach-scan.service";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const limit = enforceRateLimit(`scan-breach:${userId}`, 60 * 1000, 6);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED", message: "Too many breach scan requests. Please retry shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = breachScanBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const result = await runBreachScan(userId, parsed.data.emails);
  if (!result.ok) {
    return NextResponse.json({ error: "User not found" }, { status: result.status });
  }

  return NextResponse.json({ results: result.results });
}
