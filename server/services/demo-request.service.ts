import { logInfo } from "@/lib/observability";
import type { DemoRequestBody } from "@/lib/validations/demo-request";
import * as demoRequestRepo from "@/server/repositories/demo-request.repository";

const footprintGoalLabels: Record<DemoRequestBody["digitalFootprintGoal"], string> = {
  privacy: "Privacy",
  security: "Security",
  accounts: "Accounts",
  data_exposure: "Data exposure",
  just_curious: "Just curious",
};

const accountEstimateLabels: Record<DemoRequestBody["accountCountEstimate"], string> = {
  range_0_25: "0-25",
  range_25_75: "25-75",
  range_75_plus: "75+",
};

export async function submitDemoRequest(input: DemoRequestBody) {
  const email = input.email.trim().toLowerCase();
  const source = input.source.trim().toLowerCase() || "landing_modal";
  const usefulnessNotes = input.usefulnessNotes.trim();

  const saved = await demoRequestRepo.upsertDemoWaitlistEntry({
    email,
    digitalFootprintGoal: input.digitalFootprintGoal,
    accountCountEstimate: input.accountCountEstimate,
    usefulnessNotes: usefulnessNotes.length > 0 ? usefulnessNotes : null,
    source,
  });

  const webhook = process.env.DEMO_REQUEST_WEBHOOK_URL?.trim();
  const payload = {
    event: "demo_request",
    ts: new Date().toISOString(),
    email,
    digitalFootprintGoal: footprintGoalLabels[input.digitalFootprintGoal],
    accountCountEstimate: accountEstimateLabels[input.accountCountEstimate],
    usefulnessNotes: usefulnessNotes.length > 0 ? usefulnessNotes : null,
    source,
  };

  if (webhook) {
    try {
      await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    } catch {
      logInfo("demo_request_webhook_failed", { email, source });
    }
  } else {
    logInfo("demo_request", payload);
  }

  return saved;
}

export async function linkDemoRequestsToClerkUser(input: {
  clerkUserId: string;
  clerkEmails: string[];
}) {
  const normalizedEmails = normalizeClerkEmails(input.clerkEmails);
  return demoRequestRepo.linkDemoWaitlistEntriesByEmails({
    emails: normalizedEmails,
    clerkUserId: input.clerkUserId,
  });
}

export function normalizeClerkEmails(emails: string[]) {
  return Array.from(
    new Set(
      emails
        .map((email) => email.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}
