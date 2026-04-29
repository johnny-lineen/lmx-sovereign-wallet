import type { Prisma, VaultItemType } from "@prisma/client";

import { buildPipelineSummaryPayload } from "@/lib/public-audit-pipelines";
import { logError, logInfo } from "@/lib/observability";
import { prisma } from "@/lib/prisma";
import * as publicAuditRepo from "@/server/repositories/public-audit.repository";
import type { RawPublicAuditCandidate } from "@/server/services/public-audit-adapters/breach-adapter";
import { getPublicAuditConnectors } from "@/server/services/public-audit-connectors";
import { GmailScanError } from "@/server/services/gmail-inbox-scan.shared";
import { importPublicAuditCandidate } from "@/server/services/public-audit-import.service";
import { applyBalancedQualityPass } from "@/server/services/public-audit-quality";

function allowNameInferenceForRun(): boolean {
  return process.env.PUBLIC_AUDIT_ENABLE_NAME_INFERENCE?.trim() === "1";
}

function normalizeCandidateUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url.trim());
    parsed.hash = "";
    return parsed.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function keepOnlyCorroboratedGeneratedCandidates(
  generated: RawPublicAuditCandidate[],
  corroboratedUrls: Set<string>,
): RawPublicAuditCandidate[] {
  if (generated.length === 0) return generated;
  if (corroboratedUrls.size === 0) return [];
  return generated.filter((candidate) => {
    const normalized = normalizeCandidateUrl(candidate.url);
    return normalized ? corroboratedUrls.has(normalized) : false;
  });
}

function baselineCandidatesFromSubmittedInput(input: {
  fullName: string;
  submittedEmail: string;
  usernames: string[];
  websiteHint: string | null;
  locationHint?: string | null;
}): RawPublicAuditCandidate[] {
  const candidates: RawPublicAuditCandidate[] = [
    {
      sourceType: "input_identity_adapter",
      sourceName: "Submitted identity",
      proposedVaultType: "identity_profile",
      title: `Identity profile: ${input.fullName.trim()}`,
      snippet: "Baseline candidate built from your submitted and verified audit inputs.",
      matchedIdentifier: input.submittedEmail,
      confidenceBand: "medium",
      confidenceScore: 0.62,
      auditKind: "profile",
      rawData: { provider: "submitted_input", baseline: true },
    },
  ];

  const uniqueHandles = [...new Set(input.usernames.map((u) => u.trim()).filter((u) => u.length > 0))].slice(0, 8);
  for (const handle of uniqueHandles) {
    candidates.push({
      sourceType: "input_profile_adapter",
      sourceName: "Submitted handle",
      proposedVaultType: "social_account",
      title: `Self-reported handle: ${handle}`,
      snippet: "Review this handle candidate and accept if it belongs to you.",
      matchedIdentifier: handle,
      confidenceBand: "medium",
      confidenceScore: 0.58,
      auditKind: "profile",
      rawData: { provider: "submitted_input", baseline: true },
    });
  }

  const website = input.websiteHint?.trim();
  if (website) {
    const normalizedUrl = website.startsWith("http://") || website.startsWith("https://")
      ? website
      : `https://${website}`;
    candidates.push({
      sourceType: "input_website_adapter",
      sourceName: "Submitted website",
      proposedVaultType: "identity_profile",
      title: `Self-reported website: ${website}`,
      url: normalizedUrl,
      snippet: "Site/domain candidate from your submitted audit form.",
      matchedIdentifier: website,
      confidenceBand: "medium",
      confidenceScore: 0.57,
      auditKind: "search",
      rawData: { provider: "submitted_input", baseline: true },
    });
  }

  const emailDomain = input.submittedEmail.split("@")[1]?.trim().toLowerCase();
  if (emailDomain) {
    candidates.push({
      sourceType: "input_email_domain_adapter",
      sourceName: "Submitted email domain",
      proposedVaultType: "custom",
      title: `Email-domain footprint: ${emailDomain}`,
      snippet: "Domain-based candidate inferred from submitted and verified email.",
      matchedIdentifier: emailDomain,
      confidenceBand: "low",
      confidenceScore: 0.41,
      auditKind: "search",
      rawData: { provider: "submitted_input", baseline: true, inferredFrom: "email_domain" },
    });
  }

  const location = input.locationHint?.trim();
  if (location) {
    candidates.push({
      sourceType: "input_location_search_adapter",
      sourceName: "Submitted location hint",
      proposedVaultType: "custom",
      title: `Name/location search seed: ${input.fullName.trim()} · ${location}`,
      snippet: "Location-assisted seed candidate to improve manual review coverage.",
      matchedIdentifier: `${input.fullName.trim()} ${location}`,
      confidenceBand: "low",
      confidenceScore: 0.39,
      auditKind: "search",
      rawData: { provider: "submitted_input", baseline: true, inferredFrom: "location_hint" },
    });
  }

  return candidates;
}

function rawToCreateData(
  runId: string,
  userId: string,
  r: RawPublicAuditCandidate,
): Prisma.PublicAuditCandidateUncheckedCreateInput {
  return {
    auditRunId: runId,
    userId,
    sourceType: r.sourceType,
    sourceName: r.sourceName,
    proposedVaultType: r.proposedVaultType as VaultItemType,
    title: r.title,
    url: r.url ?? null,
    snippet: r.snippet ?? null,
    matchedIdentifier: r.matchedIdentifier ?? null,
    confidenceScore: r.confidenceScore,
    confidenceBand: r.confidenceBand,
    status: "pending",
    rawData: {
      ...(typeof r.rawData === "object" && r.rawData !== null ? (r.rawData as object) : {}),
      auditKind: r.auditKind,
    } as Prisma.InputJsonValue,
  };
}

async function refreshRunAggregates(userId: string, runId: string) {
  const [total, imported, pending] = await Promise.all([
    prisma.publicAuditCandidate.count({ where: { userId, auditRunId: runId } }),
    prisma.publicAuditCandidate.count({
      where: {
        userId,
        auditRunId: runId,
        status: { in: ["auto_imported", "linked_existing", "accepted"] },
      },
    }),
    prisma.publicAuditCandidate.count({
      where: { userId, auditRunId: runId, status: "pending" },
    }),
  ]);

  const nextStatus =
    pending > 0 ? ("awaiting_review" as const) : ("completed" as const);

  await prisma.publicAuditRun.updateMany({
    where: { id: runId, userId },
    data: {
      totalCandidates: total,
      importedCount: imported,
      reviewCount: pending,
      status: nextStatus,
    },
  });
}

export async function executePublicAuditRun(
  userId: string,
  runId: string,
  emailVaultItemId: string,
): Promise<void> {
  const run = await publicAuditRepo.findPublicAuditRunForUser(userId, runId);
  if (!run) return;
  if (run.status === "completed" || run.status === "awaiting_review" || run.status === "failed") {
    logInfo("public_audit_run_execution_skipped_terminal", { userId, runId, status: run.status });
    return;
  }

  await publicAuditRepo.updatePublicAuditRun(userId, runId, { status: "running", errorMessage: null });

  try {
    const usernames: string[] = Array.isArray(run.usernamesJson)
      ? (run.usernamesJson as unknown[]).filter((x): x is string => typeof x === "string")
      : typeof run.usernamesJson === "string"
        ? [run.usernamesJson]
        : [];

    const normalizedEmail = run.submittedEmail.trim().toLowerCase();
    const hibpSkippedReason = process.env.HIBP_API_KEY?.trim() ? undefined : ("no_api_key" as const);
    const connectorRows: Record<string, RawPublicAuditCandidate[]> = {};
    const providerErrors: string[] = [];
    let gmailDiagnostics: Record<string, unknown> = {
      status: "ok",
      code: "ok",
      strictEmailMatch: true,
      submittedEmail: normalizedEmail,
    };

    const connectors = getPublicAuditConnectors(allowNameInferenceForRun());
    for (const connector of connectors) {
      if (!connector.enabled()) continue;
      try {
        const rows = await connector.fetch({
          userId,
          runId,
          fullName: run.fullName,
          submittedEmail: normalizedEmail,
          usernames,
          locationHint: run.locationHint,
          websiteHint: run.websiteHint,
        });
        connectorRows[connector.id] = rows;
        if (connector.id === "gmail") {
          gmailDiagnostics = {
            ...gmailDiagnostics,
            code: rows.length > 0 ? "ok" : "scan_empty",
            status: rows.length > 0 ? "ok" : "scan_empty",
            candidatesDetected: rows.length,
          };
        }
      } catch (error) {
        providerErrors.push(connector.id);
        if (connector.id === "gmail") {
          const scanError = error instanceof GmailScanError ? error : null;
          const maybeInvalidGrant =
            scanError?.code === "gmail_reauth_required" ||
            (error instanceof Error ? error.message : String(error)).toLowerCase().includes("invalid_grant");
          const gmailErrorCode =
            scanError?.code === "no_matching_connector"
              ? "email_mismatch"
              : scanError?.code === "no_connector"
                ? "no_connector"
                : scanError?.code === "connector_secret_missing"
                  ? "connector_secret_missing"
                  : maybeInvalidGrant
                    ? "token_invalid"
                    : "gmail_api_error";
          gmailDiagnostics = {
            ...gmailDiagnostics,
            status: "error",
            code: gmailErrorCode,
            message: scanError?.message ?? (error instanceof Error ? error.message : String(error)),
            connectorAddress: scanError?.connectorAddress ?? null,
          };
          if (maybeInvalidGrant) {
            await publicAuditRepo.updatePublicAuditRun(userId, runId, {
              errorMessage: "Gmail token expired. Reconnect Gmail to restore inbox-backed audit signals.",
            });
          }
        }
        logError("public_audit_provider_fetch_failed", {
          provider: connector.id,
          runId,
          userId,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }
    const serpRaw = connectorRows.serpapi ?? [];
    const breachRaw = connectorRows.hibp ?? [];
    const gmailRaw = connectorRows.gmail ?? [];
    let usernameSurfaceRaw = connectorRows.username_surface ?? [];
    let nameInferenceRaw = connectorRows.name_inference ?? [];
    const usernameCheckRaw = connectorRows.username_check ?? [];
    const peopleSocialRaw = connectorRows.people_social ?? [];
    const emailIntelRaw = connectorRows.email_intel ?? [];
    const serpCorroboratedUrls = new Set(
      serpRaw.map((candidate) => normalizeCandidateUrl(candidate.url)).filter((u): u is string => Boolean(u)),
    );
    usernameSurfaceRaw = keepOnlyCorroboratedGeneratedCandidates(usernameSurfaceRaw, serpCorroboratedUrls);
    nameInferenceRaw = keepOnlyCorroboratedGeneratedCandidates(nameInferenceRaw, serpCorroboratedUrls);
    const providerCandidatesRaw = [
      ...serpRaw,
      ...breachRaw,
      ...gmailRaw,
      ...usernameSurfaceRaw,
      ...nameInferenceRaw,
      ...usernameCheckRaw,
      ...peopleSocialRaw,
      ...emailIntelRaw,
    ];
    const providerCandidates = applyBalancedQualityPass(providerCandidatesRaw);
    const baseline = baselineCandidatesFromSubmittedInput({
      fullName: run.fullName,
      submittedEmail: normalizedEmail,
      usernames,
      websiteHint: run.websiteHint,
      locationHint: run.locationHint,
    });
    const combined = providerCandidates.length > 0 ? providerCandidates : baseline;
    if (combined.length === 0) {
      // Final guardrail for valid runs: ensure at least one candidate is available to review.
      combined.push({
        sourceType: "input_identity_adapter",
        sourceName: "Submitted identity",
        proposedVaultType: "identity_profile",
        title: `Identity profile: ${run.fullName.trim() || "Unknown"}`,
        snippet: "Fallback candidate generated after provider failure.",
        matchedIdentifier: normalizedEmail,
        confidenceBand: "medium",
        confidenceScore: 0.51,
        auditKind: "profile",
        rawData: { provider: "submitted_input", emergencyFallback: true },
      });
    }
    if (providerErrors.length > 0 || providerCandidates.length === 0) {
      await publicAuditRepo.updatePublicAuditRun(userId, runId, {
        errorMessage:
          providerCandidates.length > 0
            ? null
            : "Provider results were empty/unavailable; run continued with baseline submitted-identity candidates.",
      });
    }

    logInfo("public_audit_provider_summary", {
      userId,
      runId,
      serpCandidates: serpRaw.length,
      breachCandidates: breachRaw.length,
      gmailCandidates: gmailRaw.length,
      usernameSurfaceCandidates: usernameSurfaceRaw.length,
      nameInferenceCandidates: nameInferenceRaw.length,
      usernameCheckCandidates: usernameCheckRaw.length,
      peopleSocialCandidates: peopleSocialRaw.length,
      emailIntelCandidates: emailIntelRaw.length,
      providerErrors,
      baselineUsed: providerCandidates.length === 0,
      hibpSkippedNoApiKey: hibpSkippedReason === "no_api_key",
      gmailDiagnostics,
    });

    await prisma.$transaction(
      async (tx) => {
        for (const r of combined) {
          const created = await tx.publicAuditCandidate.create({
            data: rawToCreateData(runId, userId, r),
          });

          if (r.confidenceBand === "high") {
            const result = await importPublicAuditCandidate(
              tx,
              userId,
              {
                id: created.id,
                proposedVaultType: created.proposedVaultType,
                title: created.title,
                sourceType: created.sourceType,
                sourceName: created.sourceName,
                url: created.url,
                snippet: created.snippet,
                matchedIdentifier: created.matchedIdentifier,
                confidenceScore: created.confidenceScore,
                confidenceBand: created.confidenceBand,
                rawData: created.rawData,
              },
              emailVaultItemId,
              runId,
            );
            await tx.publicAuditCandidate.update({
              where: { id: created.id },
              data: {
                status: result.status,
                createdVaultItemId: result.vaultItemId,
              },
            });
          }
        }
      },
      { maxWait: 20_000, timeout: 120_000 },
    );

    await refreshRunAggregates(userId, runId);

    const pipelineSummary = buildPipelineSummaryPayload({
      candidates: combined,
      providerErrors,
      hibpSkippedReason,
    });
    const existingMeta =
      run.metadata != null && typeof run.metadata === "object" && !Array.isArray(run.metadata)
        ? { ...(run.metadata as Record<string, unknown>) }
        : {};
    await publicAuditRepo.updatePublicAuditRun(userId, runId, {
      metadata: { ...existingMeta, pipelineSummary, gmailDiagnostics } as Prisma.InputJsonValue,
    });

    logInfo("public_audit_run_execution_completed", { userId, runId, createdCandidates: combined.length });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Audit failed";
    logError("public_audit_run_execution_failed", { userId, runId, error: message });
    await publicAuditRepo.updatePublicAuditRun(userId, runId, {
      status: "failed",
      errorMessage: message,
    });
  }
}
