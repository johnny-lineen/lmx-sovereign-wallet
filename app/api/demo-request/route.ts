import { NextResponse } from "next/server";
import { z } from "zod";

import { logInfo } from "@/lib/observability";
import { profileEmailSchema } from "@/lib/validations/import";

const bodySchema = z.object({
  email: profileEmailSchema.max(320),
});

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid email";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  const { email } = parsed.data;
  const webhook = process.env.DEMO_REQUEST_WEBHOOK_URL?.trim();
  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event: "demo_request",
          ts: new Date().toISOString(),
          email,
        }),
      });
    } catch {
      // Still acknowledge to the user; log for follow-up.
      logInfo("demo_request_webhook_failed", { email });
    }
  } else {
    logInfo("demo_request", { email });
  }

  return NextResponse.json({ ok: true });
}
