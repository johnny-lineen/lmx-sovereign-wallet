import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { clearTemporaryVaultDataForClerkUser } from "@/server/services/testing-reset.service";

const REQUIRED_CONFIRMATION = "DELETE_TEMP_VAULT_DATA";
const clearVaultBodySchema = z.object({
  confirm: z.string().trim().min(1),
});

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not Found" }, { status: 404 });
  }

  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = clearVaultBodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  if (parsed.data.confirm !== REQUIRED_CONFIRMATION) {
    return NextResponse.json(
      { error: "CONFIRMATION_REQUIRED", message: "Invalid confirmation token." },
      { status: 400 },
    );
  }

  let result;
  try {
    result = await clearTemporaryVaultDataForClerkUser(userId);
  } catch {
    return NextResponse.json({ error: "RESET_FAILED" }, { status: 500 });
  }

  if (!result.ok) {
    return NextResponse.json({ error: result.code }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
