import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";
import { z } from "zod";

import { clampLandingAgentMessage, runLandingAgentQuery } from "@/lib/landing-agent";
import { logError } from "@/lib/observability";
import { enforceRateLimit } from "@/lib/rate-limit";

const bodySchema = z.object({
  message: z.string().min(1).max(600),
});

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = request.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  return "unknown";
}

const WINDOW_MS = 60 * 60 * 1000;
const MAX_PER_WINDOW = 30;

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

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid message";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  const key = `landing-agent:${clientKey(request)}`;
  const limit = enforceRateLimit(key, WINDOW_MS, MAX_PER_WINDOW);
  if (!limit.allowed) {
    return NextResponse.json(
      { ok: false, error: `Too many questions. Try again in ${limit.retryAfterSeconds}s.` },
      { status: 429 },
    );
  }

  const message = clampLandingAgentMessage(parsed.data.message);
  if (!message) {
    return NextResponse.json({ ok: false, error: "Message is empty" }, { status: 400 });
  }

  try {
    const payload = await runLandingAgentQuery(message);
    return NextResponse.json(payload);
  } catch (error) {
    logError("landing_agent_query_failed", {
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json({ ok: false, error: "Something went wrong." }, { status: 500 });
  }
}
