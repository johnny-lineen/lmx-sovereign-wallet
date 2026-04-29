import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { profileFromClerkUser } from "@/lib/clerk-profile";
import { profileEmailAnchorBodySchema } from "@/lib/validations/import";
import { ensureUserAndRootLMXIdentity } from "@/server/services/identity-bootstrap.service";
import * as vaultService from "@/server/services/vault.service";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const clerkUser = await currentUser();
  if (clerkUser) {
    await ensureUserAndRootLMXIdentity(userId, profileFromClerkUser(clerkUser));
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = profileEmailAnchorBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const result = await vaultService.ensureEmailVaultItemForClerkUser(userId, parsed.data.email);
  if (!result.ok) {
    const status = result.code === "USER_NOT_FOUND" ? 404 : 400;
    return NextResponse.json({ error: result.code }, { status });
  }

  return NextResponse.json({
    vaultItemId: result.vaultItemId,
    created: result.created,
    normalizedEmail: result.normalizedEmail,
  });
}
