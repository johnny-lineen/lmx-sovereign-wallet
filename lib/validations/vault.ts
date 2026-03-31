import { z } from "zod";

/** Mirrors `VaultItemType` in `prisma/schema.prisma`. */
export const vaultItemTypeSchema = z.enum([
  "email",
  "account",
  "subscription",
  "social_account",
  "device",
  "file_reference",
  "payment_method_reference",
  "credential_reference",
  "identity_profile",
  "custom",
]);

/** Mirrors `VaultItemStatus` in `prisma/schema.prisma`. */
export const vaultItemStatusSchema = z.enum([
  "active",
  "inactive",
  "unknown",
  "compromised",
  "archived",
]);

/** Arbitrary JSON object/array/primitive for Prisma `Json` fields. */
export const vaultMetadataSchema = z.union([
  z.record(z.string(), z.unknown()),
  z.array(z.unknown()),
  z.string(),
  z.number(),
  z.boolean(),
  z.null(),
]);

export const createVaultItemSchema = z.object({
  type: vaultItemTypeSchema,
  name: z.string().trim().min(1, "Name is required").max(500, "Name is too long"),
  description: z
    .string()
    .trim()
    .max(10_000, "Description is too long")
    .optional()
    .nullable(),
  provider: z.string().trim().max(200, "Provider is too long").optional().nullable(),
  status: vaultItemStatusSchema.optional(),
  metadata: vaultMetadataSchema.optional().nullable(),
  identityId: z.string().uuid().optional().nullable(),
});

export type CreateVaultItemInput = z.infer<typeof createVaultItemSchema>;

export const updateVaultItemSchema = z.object({
  type: vaultItemTypeSchema.optional(),
  name: z.string().trim().min(1, "Name is required").max(500, "Name is too long").optional(),
  description: z
    .string()
    .trim()
    .max(10_000, "Description is too long")
    .optional()
    .nullable(),
  provider: z.string().trim().max(200, "Provider is too long").optional().nullable(),
  status: vaultItemStatusSchema.optional(),
  metadata: vaultMetadataSchema.optional().nullable(),
  identityId: z.string().uuid().optional().nullable(),
});

export type UpdateVaultItemInput = z.infer<typeof updateVaultItemSchema>;

export const listVaultItemsSchema = z.object({
  type: vaultItemTypeSchema.optional(),
  status: vaultItemStatusSchema.optional(),
});

export type ListVaultItemsInput = z.infer<typeof listVaultItemsSchema>;

export const vaultItemIdParamSchema = z.object({
  id: z.string().uuid(),
});

export type VaultItemIdParam = z.infer<typeof vaultItemIdParamSchema>;
