import { auth, currentUser } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { profileFromClerkUser } from "@/lib/clerk-profile";
import { logInfo } from "@/lib/observability";
import { publicAuditRunDetailQuerySchema } from "@/lib/validations/public-audit";
import { ensureUserAndRootLMXIdentity } from "@/server/services/identity-bootstrap.service";
import { getPublicAuditRunDetailForClerkUser } from "@/server/services/public-audit.service";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(request: NextRequest, context: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const clerkUser = await currentUser();
  if (clerkUser) {
    await ensureUserAndRootLMXIdentity(userId, profileFromClerkUser(clerkUser));
  }

  const { id } = await context.params;
  const qs = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = publicAuditRunDetailQuerySchema.safeParse(qs);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten() }, { status: 400 });
  }

  const detail = await getPublicAuditRunDetailForClerkUser(
    userId,
    id,
    parsed.data.candidateStatus,
  );
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  logInfo("public_audit_run_detail_loaded", {
    clerkUserId: userId,
    runId: detail.run.id,
    runStatus: detail.run.status,
    totalCandidates: detail.run.totalCandidates,
    reviewCount: detail.run.reviewCount,
    importedCount: detail.run.importedCount,
    candidateCount: detail.candidates.length,
  });

  return NextResponse.json(detail);
}
