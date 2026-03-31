import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { enforceRateLimit } from "@/lib/rate-limit";
import { reviewImportCandidatesSchema } from "@/lib/validations/import";
import { reviewImportCandidates } from "@/server/services/import-approval.service";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = enforceRateLimit(`import-review:${userId}`, 60 * 1000, 20);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED", message: "Too many review actions. Please retry shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = reviewImportCandidatesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Validation failed",
        details: parsed.error.flatten(),
        issues: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }

  const result = await reviewImportCandidates(userId, parsed.data);
  if (!result.ok) {
    const status =
      result.code === "USER_NOT_FOUND"
        ? 404
        : result.code === "EMAIL_ITEM_INVALID"
          ? 400
          : 422;
    return NextResponse.json({ error: result.code }, { status });
  }

  return NextResponse.json({
    approvedVaultItemIds: result.approvedItemIds,
    rejectedCount: result.rejectedCount,
    skippedCount: result.skippedCount,
  });
}
