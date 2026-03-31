import { Prisma, type VaultRelationship } from "@prisma/client";
import { z } from "zod";

import { listVaultRelationshipsSchema, createVaultRelationshipSchema, vaultRelationshipIdSchema } from "@/lib/validations/relationship";
import * as relationshipRepo from "@/server/repositories/relationship.repository";
import * as userRepo from "@/server/repositories/user.repository";
import * as vaultRepo from "@/server/repositories/vault.repository";

export type VaultRelationshipDTO = {
  id: string;
  fromItemId: string;
  toItemId: string;
  relationType: VaultRelationship["relationType"];
  metadata: Prisma.JsonValue | null;
  createdAt: string;
  updatedAt: string;
};

export function vaultRelationshipToDTO(row: VaultRelationship): VaultRelationshipDTO {
  return {
    id: row.id,
    fromItemId: row.fromItemId,
    toItemId: row.toItemId,
    relationType: row.relationType,
    metadata: (row.metadata ?? null) as Prisma.JsonValue | null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

type ValidationFailure = {
  ok: false;
  code: "VALIDATION_ERROR";
  issues: ReturnType<z.ZodError["flatten"]>;
};

function validationFailure(error: z.ZodError): ValidationFailure {
  return { ok: false, code: "VALIDATION_ERROR", issues: error.flatten() };
}

async function resolveInternalUserId(clerkUserId: string): Promise<string | null> {
  const user = await userRepo.findUserByClerkId(clerkUserId);
  return user?.id ?? null;
}

async function areItemsOwnedByUser(userId: string, fromItemId: string, toItemId: string): Promise<boolean> {
  const [fromItem, toItem] = await Promise.all([
    vaultRepo.findVaultItemByIdForUser(userId, fromItemId),
    vaultRepo.findVaultItemByIdForUser(userId, toItemId),
  ]);
  return Boolean(fromItem && toItem);
}

export async function createVaultRelationship(
  clerkUserId: string,
  rawInput: unknown,
): Promise<
  | { ok: true; relationship: VaultRelationshipDTO }
  | ValidationFailure
  | { ok: false; code: "USER_NOT_FOUND" }
  | { ok: false; code: "INVALID_RELATIONSHIP_ITEMS" }
> {
  const parsed = createVaultRelationshipSchema.safeParse(rawInput);
  if (!parsed.success) return validationFailure(parsed.error);

  const userId = await resolveInternalUserId(clerkUserId);
  if (!userId) return { ok: false, code: "USER_NOT_FOUND" };

  const { fromItemId, toItemId, relationType, metadata } = parsed.data;

  const ownedByUser = await areItemsOwnedByUser(userId, fromItemId, toItemId);
  if (!ownedByUser) return { ok: false, code: "INVALID_RELATIONSHIP_ITEMS" };

  const row = await relationshipRepo.createVaultRelationshipForUser(userId, {
    fromItemId,
    toItemId,
    relationType,
    metadata:
      metadata === undefined || metadata === null ? undefined : (metadata as Prisma.InputJsonValue),
  });

  return { ok: true, relationship: vaultRelationshipToDTO(row) };
}

export async function listVaultRelationships(
  clerkUserId: string,
  rawFilters: unknown = {},
): Promise<
  | { ok: true; relationships: VaultRelationshipDTO[] }
  | ValidationFailure
  | { ok: false; code: "USER_NOT_FOUND" }
> {
  const parsed = listVaultRelationshipsSchema.safeParse(rawFilters);
  if (!parsed.success) return validationFailure(parsed.error);

  const userId = await resolveInternalUserId(clerkUserId);
  if (!userId) return { ok: false, code: "USER_NOT_FOUND" };

  const rows = await relationshipRepo.listVaultRelationshipsForUser(userId, parsed.data);
  return { ok: true, relationships: rows.map(vaultRelationshipToDTO) };
}

export async function deleteVaultRelationship(
  clerkUserId: string,
  rawRelationshipId: unknown,
): Promise<
  { ok: true } | ValidationFailure | { ok: false; code: "USER_NOT_FOUND" } | { ok: false; code: "NOT_FOUND" }
> {
  const parsed = vaultRelationshipIdSchema.safeParse(rawRelationshipId);
  if (!parsed.success) return validationFailure(parsed.error);

  const userId = await resolveInternalUserId(clerkUserId);
  if (!userId) return { ok: false, code: "USER_NOT_FOUND" };

  const deleted = await relationshipRepo.deleteVaultRelationshipForUser(userId, parsed.data);
  if (!deleted) return { ok: false, code: "NOT_FOUND" };

  return { ok: true };
}
