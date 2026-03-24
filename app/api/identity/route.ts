import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { profileFromClerkUser } from "@/lib/clerk-profile";
import { identityUpdateSchema } from "@/lib/validations/identity";
import * as identityService from "@/server/services/identity.service";
import { ensureUserWithRootIdentity } from "@/server/services/user-bootstrap.service";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clerkUser = await currentUser();
  await ensureUserWithRootIdentity(userId, profileFromClerkUser(clerkUser));

  const identity = await identityService.getRootIdentityForClerkUser(userId);
  if (!identity) {
    return NextResponse.json({ error: "Identity not found" }, { status: 404 });
  }

  return NextResponse.json({ identity });
}

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clerkUser = await currentUser();
  await ensureUserWithRootIdentity(userId, profileFromClerkUser(clerkUser));

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = identityUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", details: parsed.error.flatten() },
      { status: 400 },
    );
  }

  const result = await identityService.updateRootIdentityForClerkUser(userId, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: "Identity not found" }, { status: 404 });
  }

  return NextResponse.json({ identity: result.identity });
}
