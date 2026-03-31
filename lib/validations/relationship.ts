import { z } from "zod";

import { vaultMetadataSchema } from "@/lib/validations/vault";

/** Mirrors `VaultRelationType` in `prisma/schema.prisma`. */
export const vaultRelationTypeSchema = z.enum([
  "uses_email",
  "owned_by",
  "linked_to",
  "pays_with",
  "recovers_with",
  "belongs_to",
  "signs_in_with",
  "duplicate_of",
  "accesses",
  "created_from",
]);

export const createVaultRelationshipSchema = z
  .object({
    fromItemId: z.string().uuid(),
    toItemId: z.string().uuid(),
    relationType: vaultRelationTypeSchema,
    metadata: vaultMetadataSchema.optional().nullable(),
  })
  .refine((value) => value.fromItemId !== value.toItemId, {
    message: "fromItemId and toItemId must be different",
    path: ["toItemId"],
  });

export type CreateVaultRelationshipInput = z.infer<typeof createVaultRelationshipSchema>;

export const listVaultRelationshipsSchema = z.object({
  fromItemId: z.string().uuid().optional(),
  toItemId: z.string().uuid().optional(),
  relationType: vaultRelationTypeSchema.optional(),
});

export type ListVaultRelationshipsInput = z.infer<typeof listVaultRelationshipsSchema>;

export const vaultRelationshipIdSchema = z.string().uuid();
