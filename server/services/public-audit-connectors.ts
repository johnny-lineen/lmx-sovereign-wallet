import type { RawPublicAuditCandidate } from "@/server/services/public-audit-adapters/breach-adapter";
import { fetchBreachCandidatesForEmail } from "@/server/services/public-audit-adapters/breach-adapter";
import { fetchEmailIntelCandidates } from "@/server/services/public-audit-adapters/email-intel-adapter";
import { fetchGmailInboxAuditCandidates } from "@/server/services/public-audit-adapters/gmail-inbox-adapter";
import { fetchNameInferenceCandidates } from "@/server/services/public-audit-adapters/name-inference-adapter";
import { fetchPeopleSocialCandidates } from "@/server/services/public-audit-adapters/people-social-adapter";
import { fetchSerpCandidates } from "@/server/services/public-audit-adapters/serpapi-adapter";
import { fetchUsernameCheckCandidates } from "@/server/services/public-audit-adapters/username-check-adapter";
import { fetchUsernameSurfaceCandidates } from "@/server/services/public-audit-adapters/username-surface-adapter";

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
  fetch: (ctx: PublicAuditConnectorContext) => Promise<RawPublicAuditCandidate[]>;
};

function alwaysEnabled() {
  return true;
}

export function getPublicAuditConnectors(enableNameInference: boolean): PublicAuditConnector[] {
  return [
    {
      id: "serpapi",
      enabled: alwaysEnabled,
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
      fetch: (ctx) => fetchBreachCandidatesForEmail(ctx.submittedEmail),
    },
    {
      id: "gmail",
      enabled: alwaysEnabled,
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
      fetch: (ctx) => fetchUsernameSurfaceCandidates({ fullName: ctx.fullName, usernames: ctx.usernames }),
    },
    {
      id: "username_check",
      enabled: alwaysEnabled,
      fetch: (ctx) => fetchUsernameCheckCandidates({ fullName: ctx.fullName, usernames: ctx.usernames }),
    },
    {
      id: "people_social",
      enabled: alwaysEnabled,
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
      fetch: (ctx) => fetchEmailIntelCandidates({ submittedEmail: ctx.submittedEmail, websiteHint: ctx.websiteHint }),
    },
    {
      id: "name_inference",
      enabled: () => enableNameInference,
      fetch: (ctx) => fetchNameInferenceCandidates({ fullName: ctx.fullName }),
    },
  ];
}
