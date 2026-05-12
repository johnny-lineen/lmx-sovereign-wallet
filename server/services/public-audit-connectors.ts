import type { RawPublicAuditCandidate } from "@/server/services/public-audit-adapters/breach-adapter";
import { fetchBreachCandidatesForEmail } from "@/server/services/public-audit-adapters/breach-adapter";
import { fetchEmailIntelCandidates } from "@/server/services/public-audit-adapters/email-intel-adapter";
import { fetchGmailInboxAuditCandidates } from "@/server/services/public-audit-adapters/gmail-inbox-adapter";
import { fetchHoleheCandidates } from "@/server/services/public-audit-adapters/holehe-adapter";
import { fetchMaigretCandidates } from "@/server/services/public-audit-adapters/maigret-adapter";
import { fetchNameInferenceCandidates } from "@/server/services/public-audit-adapters/name-inference-adapter";
import { fetchOpenSanctionsCandidates } from "@/server/services/public-audit-adapters/open-sanctions-adapter";
import { fetchPeopleSocialCandidates } from "@/server/services/public-audit-adapters/people-social-adapter";
import { fetchSerpCandidates } from "@/server/services/public-audit-adapters/serpapi-adapter";
import { fetchUrlscanCandidates } from "@/server/services/public-audit-adapters/urlscan-adapter";
import { fetchUserScannerCandidates } from "@/server/services/public-audit-adapters/user-scanner-adapter";
import { fetchUsernameCheckCandidates } from "@/server/services/public-audit-adapters/username-check-adapter";
import { fetchUsernameSurfaceCandidates } from "@/server/services/public-audit-adapters/username-surface-adapter";
import type { PublicAuditConnectorPolicy } from "@/server/services/public-audit-adapter-runtime";

export type PublicAuditConnectorContext = {
  userId: string;
  runId: string;
  fullName: string;
  submittedEmail: string;
  usernames: string[];
  locationHint: string | null;
  websiteHint: string | null;
};

export type PublicAuditConnector = {
  id: string;
  enabled: () => boolean;
  policy: PublicAuditConnectorPolicy;
  fetch: (ctx: PublicAuditConnectorContext) => Promise<RawPublicAuditCandidate[]>;
};

function alwaysEnabled() {
  return true;
}

function policy(
  input: Pick<PublicAuditConnectorPolicy, "licenseModel" | "costModel" | "piiSensitivity"> & {
    timeoutMs?: number;
  },
): PublicAuditConnectorPolicy {
  return {
    allowedUse: "self_audit_only",
    timeoutMs: input.timeoutMs ?? 12_000,
    ...input,
  };
}

export function getPublicAuditConnectors(enableNameInference: boolean): PublicAuditConnector[] {
  return [
    {
      id: "serpapi",
      enabled: alwaysEnabled,
      policy: policy({ licenseModel: "free_api", costModel: "free", piiSensitivity: "low", timeoutMs: 45_000 }),
      fetch: (ctx) =>
        fetchSerpCandidates({
          fullName: ctx.fullName,
          submittedEmail: ctx.submittedEmail,
          usernames: ctx.usernames,
          locationHint: ctx.locationHint,
          websiteHint: ctx.websiteHint,
        }),
    },
    {
      id: "hibp",
      enabled: alwaysEnabled,
      policy: policy({ licenseModel: "free_api", costModel: "freemium", piiSensitivity: "high" }),
      fetch: (ctx) => fetchBreachCandidatesForEmail(ctx.submittedEmail),
    },
    {
      id: "gmail",
      enabled: alwaysEnabled,
      policy: policy({ licenseModel: "unknown", costModel: "free", piiSensitivity: "high" }),
      fetch: (ctx) =>
        fetchGmailInboxAuditCandidates(ctx.userId, {
          fullName: ctx.fullName,
          submittedEmail: ctx.submittedEmail,
          usernames: ctx.usernames,
          websiteHint: ctx.websiteHint,
          locationHint: ctx.locationHint,
        }),
    },
    {
      id: "username_surface",
      enabled: alwaysEnabled,
      policy: policy({ licenseModel: "open_source", costModel: "free", piiSensitivity: "low" }),
      fetch: (ctx) => fetchUsernameSurfaceCandidates({ fullName: ctx.fullName, usernames: ctx.usernames }),
    },
    {
      id: "username_check",
      enabled: alwaysEnabled,
      policy: policy({ licenseModel: "open_source", costModel: "free", piiSensitivity: "low" }),
      fetch: (ctx) => fetchUsernameCheckCandidates({ fullName: ctx.fullName, usernames: ctx.usernames }),
    },
    {
      id: "people_social",
      enabled: alwaysEnabled,
      policy: policy({ licenseModel: "open_source", costModel: "free", piiSensitivity: "low" }),
      fetch: (ctx) =>
        fetchPeopleSocialCandidates({
          fullName: ctx.fullName,
          usernames: ctx.usernames,
          submittedEmail: ctx.submittedEmail,
          websiteHint: ctx.websiteHint,
        }),
    },
    {
      id: "email_intel",
      enabled: alwaysEnabled,
      policy: policy({ licenseModel: "free_api", costModel: "freemium", piiSensitivity: "medium" }),
      fetch: (ctx) => fetchEmailIntelCandidates({ submittedEmail: ctx.submittedEmail, websiteHint: ctx.websiteHint }),
    },
    {
      id: "maigret",
      enabled: alwaysEnabled,
      policy: policy({ licenseModel: "open_source", costModel: "free", piiSensitivity: "low" }),
      fetch: (ctx) => fetchMaigretCandidates({ fullName: ctx.fullName, usernames: ctx.usernames }),
    },
    {
      id: "holehe",
      enabled: alwaysEnabled,
      policy: policy({ licenseModel: "open_source", costModel: "free", piiSensitivity: "medium" }),
      fetch: (ctx) => fetchHoleheCandidates({ submittedEmail: ctx.submittedEmail }),
    },
    {
      id: "user_scanner",
      enabled: alwaysEnabled,
      policy: policy({ licenseModel: "open_source", costModel: "free", piiSensitivity: "medium" }),
      fetch: (ctx) =>
        fetchUserScannerCandidates({
          fullName: ctx.fullName,
          submittedEmail: ctx.submittedEmail,
          usernames: ctx.usernames,
        }),
    },
    {
      id: "urlscan",
      enabled: alwaysEnabled,
      policy: policy({ licenseModel: "free_api", costModel: "free", piiSensitivity: "low" }),
      fetch: (ctx) => fetchUrlscanCandidates({ submittedEmail: ctx.submittedEmail, websiteHint: ctx.websiteHint }),
    },
    {
      id: "open_sanctions",
      enabled: alwaysEnabled,
      policy: policy({ licenseModel: "open_source", costModel: "free", piiSensitivity: "high" }),
      fetch: (ctx) => fetchOpenSanctionsCandidates({ fullName: ctx.fullName, locationHint: ctx.locationHint }),
    },
    {
      id: "name_inference",
      enabled: () => enableNameInference,
      policy: policy({ licenseModel: "open_source", costModel: "free", piiSensitivity: "low" }),
      fetch: (ctx) => fetchNameInferenceCandidates({ fullName: ctx.fullName }),
    },
  ];
}
