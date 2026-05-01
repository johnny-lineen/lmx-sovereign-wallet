import { NextResponse } from "next/server";

import { buildDemoSignUpUrl } from "@/lib/demo-request";
import { demoRequestBodySchema } from "@/lib/validations/demo-request";
import { submitDemoRequest } from "@/server/services/demo-request.service";

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = demoRequestBodySchema.safeParse(json);
  if (!parsed.success) {
    const message = parsed.error.issues[0]?.message ?? "Invalid request payload";
    return NextResponse.json({ ok: false, error: message }, { status: 400 });
  }

  const saved = await submitDemoRequest(parsed.data);
  return NextResponse.json({ ok: true, signUpUrl: buildDemoSignUpUrl(saved) });
}
