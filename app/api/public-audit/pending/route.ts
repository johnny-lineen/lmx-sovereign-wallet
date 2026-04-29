import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import * as publicAuditRepo from "@/server/repositories/public-audit.repository";
import { publicAuditCandidateToDTO } from "@/server/services/public-audit.service";
import * as userRepo from "@/server/repositories/user.repository";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await userRepo.findUserByClerkId(userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const latestRun = (await publicAuditRepo.listPublicAuditRunsForUser(user.id, 1))[0] ?? null;
  if (!latestRun) {
    return NextResponse.json({ candidates: [] });
  }
  const latestPending = await publicAuditRepo.listPublicAuditCandidatesForRun(user.id, latestRun.id, {
    status: "pending",
  });
  return NextResponse.json({
    candidates: latestPending.map((r) => ({
      ...publicAuditCandidateToDTO(r),
      auditRun: {
        id: latestRun.id,
        createdAt: latestRun.createdAt.toISOString(),
        status: latestRun.status,
      },
    })),
  });
}
