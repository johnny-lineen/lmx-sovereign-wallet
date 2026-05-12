import { auth } from "@clerk/nextjs/server";
import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

import { productFeedbackBodySchema } from "@/lib/validations/feedback";
import { recordProductFeedback } from "@/server/services/feedback.service";

/**
 * Authenticated product feedback. Rate limiting: consider Upstash / edge middleware for production.
 */
export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = productFeedbackBodySchema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request payload";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  try {
    const result = await recordProductFeedback(userId, parsed.data);
    if (!result.ok) {
      return NextResponse.json({ ok: false, error: "User not found" }, { status: result.status });
    }
    return NextResponse.json({ ok: true, id: result.id });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021") {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Feedback table is missing. Apply migrations: npx prisma migrate deploy (with DATABASE_URL set, same as the app).",
        },
        { status: 503 },
      );
    }
    throw e;
  }
}
