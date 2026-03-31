import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { enforceRateLimit } from "@/lib/rate-limit";
import { startImportJobSchema } from "@/lib/validations/import";
import { listImportJobsDTO, runGmailImportJob } from "@/server/services/import-job.service";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const jobs = await listImportJobsDTO(userId);
  if (!jobs) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({ jobs });
}

export async function POST(request: Request) {
  const { userId } = await auth();
  const limit = enforceRateLimit(`import-jobs:${userId}`, 60 * 1000, 8);
  if (!limit.allowed) {
    return NextResponse.json(
      { error: "RATE_LIMITED", message: "Too many import requests. Please retry shortly." },
      { status: 429, headers: { "Retry-After": String(limit.retryAfterSeconds) } },
    );
  }

  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = startImportJobSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Validation failed", details: parsed.error.flatten() }, { status: 400 });
  }

  const result = await runGmailImportJob(userId, parsed.data);
  if (!result.ok) {
    const status =
      result.code === "USER_NOT_FOUND"
        ? 404
        : result.code === "IMPORT_COOLDOWN"
          ? 429
          : result.code === "CONNECTOR_NOT_FOUND" || result.code === "PROFILE_EMAIL_INVALID"
          ? 400
          : 502;
    return NextResponse.json(
      {
        error: result.code,
        message: result.code === "GMAIL_ERROR" ? "Gmail import request failed." : result.message,
        retryAfterSeconds: result.retryAfterSeconds,
      },
      { status },
    );
  }

  return NextResponse.json({
    jobId: result.jobId,
    insertedCandidates: result.insertedCandidates,
    messagesScanned: result.messagesScanned,
    profileEmailItemId: result.profileEmailItemId,
  });
}
