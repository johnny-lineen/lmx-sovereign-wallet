import { auth, currentUser } from "@clerk/nextjs/server";
import { after, NextRequest, NextResponse } from "next/server";

import { profileFromClerkUser } from "@/lib/clerk-profile";
import { logInfo } from "@/lib/observability";
import { enforceRateLimit } from "@/lib/rate-limit";
import {
  createPublicAuditRunBodySchema,
  publicAuditRunListQuerySchema,
} from "@/lib/validations/public-audit";
import { ensureUserAndRootLMXIdentity } from "@/server/services/identity-bootstrap.service";
import {
  createPublicAuditRunForClerkUser,
  executePublicAuditRunDetached,
  listPublicAuditRunsForClerkUser,
} from "@/server/services/public-audit.service";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const clerkUser = await currentUser();
  if (clerkUser) {
    await ensureUserAndRootLMXIdentity(userId, profileFromClerkUser(clerkUser));
  }

  const qs = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = publicAuditRunListQuerySchema.safeParse(qs);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten() }, { status: 400 });
  }

  const runs = await listPublicAuditRunsForClerkUser(userId, parsed.data.limit);
  if (!runs) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ runs });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  const limit = enforceRateLimit(`public-audit-runs:${userId ?? "anon"}`, 60 * 1000, 6);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED", message: "Too many audit requests. Please retry shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clerkUser = await currentUser();
  if (!clerkUser) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  await ensureUserAndRootLMXIdentity(userId, profileFromClerkUser(clerkUser));

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = createPublicAuditRunBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const result = await createPublicAuditRunForClerkUser(userId, parsed.data, clerkUser);
  if (!result.ok) {
    const status =
      result.code === "USER_NOT_FOUND"
        ? 404
        : result.code === "EMAIL_NOT_VERIFIED"
          ? 403
          : 400;
    return NextResponse.json({ error: result.code }, { status });
  }

  after(async () => {
    logInfo("public_audit_run_execution_enqueued", {
      runId: result.runId,
      internalUserId: result.internalUserId,
    });
    await executePublicAuditRunDetached(result.internalUserId, result.runId, result.emailVaultItemId);
  });

  return NextResponse.json({ runId: result.runId });
}
