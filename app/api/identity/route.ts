import { auth, currentUser } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { profileFromClerkUser } from "@/lib/clerk-profile";
import { identityUpdateSchema } from "@/lib/validations/identity";
import { identityRowToDTO, updateRootIdentityForClerkUser } from "@/server/services/identity.service";
import { ensureUserAndRootLMXIdentity } from "@/server/services/identity-bootstrap.service";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clerkUser = await currentUser();
  const { lmxIdentity } = await ensureUserAndRootLMXIdentity(userId, profileFromClerkUser(clerkUser));

  return NextResponse.json({ identity: identityRowToDTO(lmxIdentity) });
}

export async function PATCH(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clerkUser = await currentUser();
  await ensureUserAndRootLMXIdentity(userId, profileFromClerkUser(clerkUser));

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

  const result = await updateRootIdentityForClerkUser(userId, parsed.data);
  if (!result.ok) {
    return NextResponse.json({ error: "Identity not found" }, { status: 404 });
  }

  return NextResponse.json({ identity: result.identity });
}
