import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { updateActionStatusSchema } from "@/lib/validations/action";
import { updateActionStatusForClerkUser } from "@/server/services/action.service";

type RouteContext = { params: Promise<{ id: string }> };

const actionIdSchema = z.string().min(4).max(128);

export async function PATCH(request: Request, context: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const idParsed = actionIdSchema.safeParse(id);
  if (!idParsed.success) {
    return NextResponse.json({ error: "Invalid action id" }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateActionStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const result = await updateActionStatusForClerkUser(userId, idParsed.data, parsed.data.status);
  if (result === "USER_NOT_FOUND") return NextResponse.json({ error: result }, { status: 404 });
  if (result === "NOT_FOUND") return NextResponse.json({ error: result }, { status: 404 });
  return NextResponse.json({ ok: true });
}
