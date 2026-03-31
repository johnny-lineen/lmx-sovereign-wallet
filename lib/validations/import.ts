import { z } from "zod";

export const profileEmailSchema = z.string().trim().email("Enter a valid email address");

export const profileEmailAnchorBodySchema = z.object({
  email: profileEmailSchema,
});

export const startImportJobSchema = z.object({
  gmailConnectorId: z.string().uuid(),
  profileEmail: profileEmailSchema,
});

export type StartImportJobInput = z.infer<typeof startImportJobSchema>;

/** Max IDs per review request; client batches larger selections to match. */
export const MAX_REVIEW_CANDIDATE_IDS = 100;

/**
 * Normalize candidate id list from JSON (always arrays from `fetch`, but be defensive).
 */
const candidateIdsField = z
  .union([
    z.array(z.union([z.string(), z.number()])),
    z.string(),
    z.number(),
    z.null(),
  ])
  .transform((v) => {
    if (v == null) return [];
    const raw = Array.isArray(v) ? v : [v];
    return raw
      .filter((x) => x != null)
      .map((x) => String(x).trim())
      .filter((s) => s.length > 0 && s.length <= 128);
  })
  .pipe(z.array(z.string()).min(1).max(MAX_REVIEW_CANDIDATE_IDS));

/**
 * Approve / reject import rows. Uses a single object + refine (not discriminatedUnion) for predictable Zod 4 parsing.
 */
export const reviewImportCandidatesSchema = z
  .object({
    action: z.enum(["approve", "reject"]),
    candidateIds: candidateIdsField,
    emailVaultItemId: z.union([z.string(), z.null()]).optional(),
  })
  .superRefine((val, ctx) => {
    if (val.action === "approve") {
      const t = (val.emailVaultItemId ?? "").trim();
      if (!t) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "emailVaultItemId is required when action is approve",
          path: ["emailVaultItemId"],
        });
      }
    }
  })
  .transform((val) => {
    if (val.action === "approve") {
      return {
        action: "approve" as const,
        candidateIds: val.candidateIds,
        emailVaultItemId: (val.emailVaultItemId ?? "").trim(),
      };
    }
    return {
      action: "reject" as const,
      candidateIds: val.candidateIds,
    };
  });

export type ReviewImportCandidatesInput = z.infer<typeof reviewImportCandidatesSchema>;

export const importCandidateListQuerySchema = z.object({
  jobId: z.string().uuid().optional(),
  status: z.enum(["pending", "approved", "rejected"]).optional(),
  /** When true, returns `unified` groups (same account/service merged) instead of a flat `candidates` list. */
  unified: z
    .enum(["1", "true", "0", "false"])
    .optional()
    .transform((v) => v === "1" || v === "true"),
});
