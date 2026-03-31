import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { enforceRateLimit } from "@/lib/rate-limit";
import { graphExplainRequestSchema } from "@/lib/validations/graph-explain";
import { generateGraphNodeExplanation } from "@/server/services/graph-explain.service";

export async function POST(request: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const limit = enforceRateLimit(`graph-explain-route:${userId}`, 60 * 1000, 40);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED", message: "Too many explain requests. Please retry shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = graphExplainRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const result = await generateGraphNodeExplanation(userId, parsed.data);
  return NextResponse.json(result);
}
