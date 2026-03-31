import { inferEmailProviderFromAddress } from "@/lib/infer-email-provider";
import { profileEmailSchema } from "@/lib/validations/import";
import type { VaultItemListRow } from "@/server/repositories/vault.repository";
import * as userRepo from "@/server/repositories/user.repository";
import * as vaultRepo from "@/server/repositories/vault.repository";

export type VaultItemDTO = {
  id: string;
  type: string;
  status: string;
  title: string;
  summary: string | null;
  provider: string | null;
  metadata: unknown;
  createdAt: string;
};

export type VaultRelationshipDTO = {
  id: string;
  relationType: string;
  fromItemId: string;
  toItemId: string;
  fromTitle: string;
  toTitle: string;
  fromType: string;
  toType: string;
  metadata: unknown;
};

export type VaultLibraryDTO = {
  items: VaultItemDTO[];
  relationships: VaultRelationshipDTO[];
};

function itemRowToDTO(row: VaultItemListRow): VaultItemDTO {
  return {
    id: row.id,
    type: row.type,
    status: row.status,
    title: row.title,
    summary: row.summary,
    provider: row.provider,
    metadata: row.metadata,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function countVaultItemsForClerkUser(clerkUserId: string): Promise<number> {
  const user = await userRepo.findUserByClerkId(clerkUserId);
  if (!user) return 0;
  return vaultRepo.countVaultItemsByUserId(user.id);
}

export async function getVaultLibraryForClerkUser(clerkUserId: string): Promise<VaultLibraryDTO | null> {
  const user = await userRepo.findUserByClerkId(clerkUserId);
  if (!user) return null;

  const [items, relationships] = await Promise.all([
    vaultRepo.listVaultItemsForUser(user.id),
    vaultRepo.listVaultRelationshipsForUser(user.id),
  ]);

  return {
    items: items.map(itemRowToDTO),
    relationships: relationships.map((r) => ({
      id: r.id,
      relationType: r.relationType,
      fromItemId: r.fromItemId,
      toItemId: r.toItemId,
      fromTitle: r.fromItem.title,
      toTitle: r.toItem.title,
      fromType: r.fromItem.type,
      toType: r.toItem.type,
      metadata: r.metadata,
    })),
  };
}

function vaultItemMatchesNormalizedEmail(row: VaultItemListRow, normalizedTarget: string): boolean {
  if (row.type !== "email") return false;
  if (row.title.trim().toLowerCase() === normalizedTarget) return true;
  const m = row.metadata;
  if (m && typeof m === "object" && !Array.isArray(m)) {
    const e = (m as Record<string, unknown>).email;
    if (typeof e === "string" && e.trim().toLowerCase() === normalizedTarget) return true;
  }
  return false;
}

export type EnsureEmailVaultItemResult =
  | { ok: false; code: "USER_NOT_FOUND" | "INVALID_EMAIL" }
  | { ok: true; vaultItemId: string; created: boolean; normalizedEmail: string };

/**
 * Finds an existing `email` vault item for the same address (title or metadata.email),
 * or creates one with inferred provider metadata. Scoped to the Clerk user.
 */
export async function ensureEmailVaultItemForClerkUser(
  clerkUserId: string,
  rawEmail: string,
): Promise<EnsureEmailVaultItemResult> {
  const parsed = profileEmailSchema.safeParse(rawEmail);
  if (!parsed.success) return { ok: false, code: "INVALID_EMAIL" };

  const normalizedEmail = parsed.data.trim().toLowerCase();
  const user = await userRepo.findUserByClerkId(clerkUserId);
  if (!user) return { ok: false, code: "USER_NOT_FOUND" };

  const emailItems = await vaultRepo.listVaultItemsByTypeForUser(user.id, "email");
  const existing = emailItems.find((row) => vaultItemMatchesNormalizedEmail(row, normalizedEmail));
  if (existing) {
    return { ok: true, vaultItemId: existing.id, created: false, normalizedEmail };
  }

  const { key, label } = inferEmailProviderFromAddress(normalizedEmail);
  const created = await vaultRepo.createVaultItemForUser(user.id, {
    type: "email",
    title: normalizedEmail,
    summary: null,
    provider: label,
    metadata: {
      email: normalizedEmail,
      inferredProvider: key,
    },
  });

  return { ok: true, vaultItemId: created.id, created: true, normalizedEmail };
}
