import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { logError, sendOpsAlert } from "@/lib/observability";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({
      ok: true,
      service: "lmx-sovereign-wallet",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    await sendOpsAlert("healthcheck_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    logError("healthcheck_failed", { error: error instanceof Error ? error.message : String(error) });
    return NextResponse.json(
      {
        ok: false,
        service: "lmx-sovereign-wallet",
        timestamp: new Date().toISOString(),
      },
      { status: 503 },
    );
  }
}
