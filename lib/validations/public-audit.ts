import { z } from "zod";

import { profileEmailSchema } from "@/lib/validations/import";

export const publicAuditConsentSchema = z.object({
  selfScanAcknowledged: z.literal(true),
  publicSourcesAcknowledged: z.literal(true),
  approximateMatchesAcknowledged: z.literal(true),
});

export const createPublicAuditRunBodySchema = z.object({
  queryType: z.enum(["username", "email", "domain"]).default("email"),
  query: z.string().trim().min(1).max(320),
  fullName: z.string().trim().min(1, "Full name is required").max(200),
  email: profileEmailSchema,
  usernames: z
    .string()
    .trim()
    .max(2000)
    .optional()
    .transform((s) => (s ? s : undefined)),
  cityState: z.string().trim().max(200).optional(),
  website: z.string().trim().max(500).optional(),
  notes: z.string().trim().max(2000).optional(),
  consent: publicAuditConsentSchema,
});

export type CreatePublicAuditRunBody = z.infer<typeof createPublicAuditRunBodySchema>;

export type NormalizedPublicAuditInput = {
  queryType: "username" | "email" | "domain";
  query: string;
  normalizedEmail: string;
  normalizedDomain: string | null;
  normalizedUsernames: string[];
};

function parseUsernames(raw: string | undefined): string[] {
  if (!raw?.trim()) return [];
  return raw
    .split(/[\n,;]+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0 && s.length <= 200)
    .slice(0, 50);
}

export function usernamesFromCreateBody(body: CreatePublicAuditRunBody): string[] {
  return parseUsernames(body.usernames);
}

function normalizeQueryValue(queryType: "username" | "email" | "domain", raw: string): string {
  const q = raw.trim();
  if (queryType === "email") return q.toLowerCase();
  if (queryType === "domain") return q.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "");
  return q.replace(/^@+/, "").toLowerCase();
}

export function normalizePublicAuditInput(body: CreatePublicAuditRunBody): NormalizedPublicAuditInput {
  const queryType = body.queryType;
  const query = normalizeQueryValue(queryType, body.query);
  const normalizedEmail = body.email.trim().toLowerCase();
  const bodyUsernames = usernamesFromCreateBody(body);
  const normalizedUsernames = new Set(
    bodyUsernames.map((u) => u.trim().replace(/^@+/, "").toLowerCase()).filter(Boolean),
  );
  if (queryType === "username") normalizedUsernames.add(query);

  const normalizedDomain =
    queryType === "domain"
      ? query
      : queryType === "email"
        ? query.split("@")[1]?.trim().toLowerCase() ?? null
        : normalizedEmail.split("@")[1]?.trim().toLowerCase() ?? null;

  return {
    queryType,
    query,
    normalizedEmail,
    normalizedDomain: normalizedDomain || null,
    normalizedUsernames: [...normalizedUsernames].slice(0, 50),
  };
}

export const MAX_PUBLIC_AUDIT_REVIEW_IDS = 100;

const auditCandidateIdsField = z
  .union([z.array(z.union([z.string(), z.number()])), z.string(), z.number(), z.null()])
  .transform((v) => {
    if (v == null) return [];
    const raw = Array.isArray(v) ? v : [v];
    return raw
      .filter((x) => x != null)
      .map((x) => String(x).trim())
      .filter((s) => s.length > 0 && s.length <= 128);
  })
  .pipe(z.array(z.string()).min(1).max(MAX_PUBLIC_AUDIT_REVIEW_IDS));

export const reviewPublicAuditCandidatesSchema = z
  .object({
    action: z.enum(["accept", "reject", "ignore"]),
    candidateIds: auditCandidateIdsField,
    emailVaultItemId: z.string().uuid().optional(),
  })
  .superRefine((val, ctx) => {
    if (val.action === "accept") {
      const t = (val.emailVaultItemId ?? "").trim();
      if (!t) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "emailVaultItemId is required when action is accept",
          path: ["emailVaultItemId"],
        });
      }
    }
  })
  .transform((val) => {
    if (val.action === "accept") {
      return {
        action: "accept" as const,
        candidateIds: val.candidateIds,
        emailVaultItemId: (val.emailVaultItemId ?? "").trim(),
      };
    }
    return { action: val.action, candidateIds: val.candidateIds };
  });

export type ReviewPublicAuditCandidatesInput = z.infer<typeof reviewPublicAuditCandidatesSchema>;

export const publicAuditRunListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export const publicAuditRunDetailQuerySchema = z.object({
  candidateStatus: z.enum(["pending", "auto_imported", "accepted", "rejected", "ignored", "linked_existing"]).optional(),
});
