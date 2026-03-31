import { auth } from "@clerk/nextjs/server";
import { NextRequest, NextResponse } from "next/server";

import { importCandidateListQuerySchema } from "@/lib/validations/import";
import * as gmailImportRepo from "@/server/repositories/gmail-import.repository";
import { getUnifiedImportCandidatesForUserId } from "@/server/services/import-candidate-unify.service";
import * as userRepo from "@/server/repositories/user.repository";

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await userRepo.findUserByClerkId(userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const qs = Object.fromEntries(request.nextUrl.searchParams.entries());
  const parsed = importCandidateListQuerySchema.safeParse(qs);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query", details: parsed.error.flatten() }, { status: 400 });
  }

  const { jobId, status, unified } = parsed.data;

  if (unified) {
    const groups = await getUnifiedImportCandidatesForUserId(user.id, {
      ...(jobId !== undefined && { importJobId: jobId }),
      ...(status !== undefined && { status }),
    });
    return NextResponse.json({ unified: groups });
  }

  const candidates = await gmailImportRepo.listImportCandidatesForUser(user.id, {
    ...(jobId !== undefined && { importJobId: jobId }),
    ...(status !== undefined && { status }),
  });

  return NextResponse.json({
    candidates: candidates.map((c) => ({
      id: c.id,
      importJobId: c.importJobId,
      status: c.status,
      signal: c.signal,
      suggestedType: c.suggestedType,
      title: c.title,
      provider: c.provider,
      providerDomain: c.providerDomain,
      evidence: c.evidence,
      dedupeKey: c.dedupeKey,
      createdVaultItemId: c.createdVaultItemId,
      createdAt: c.createdAt.toISOString(),
    })),
  });
}
