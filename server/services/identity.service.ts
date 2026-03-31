import type { IdentityUpdateInput } from "@/lib/validations/identity";
import * as identityRepo from "@/server/repositories/identity.repository";
import * as userRepo from "@/server/repositories/user.repository";

export type IdentityDTO = {
  id: string;
  displayName: string | null;
  summary: string | null;
  isRoot: boolean;
  createdAt: string;
  updatedAt: string;
};

export function identityRowToDTO(row: {
  id: string;
  displayName: string | null;
  summary: string | null;
  isRoot: boolean;
  createdAt: Date;
  updatedAt: Date;
}): IdentityDTO {
  return {
    id: row.id,
    displayName: row.displayName,
    summary: row.summary,
    isRoot: row.isRoot,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function getRootIdentityForClerkUser(clerkUserId: string): Promise<IdentityDTO | null> {
  const user = await userRepo.findUserByClerkId(clerkUserId);
  if (!user) return null;

  const identity = await identityRepo.findRootIdentityByUserId(user.id);
  if (!identity) return null;

  return identityRowToDTO(identity);
}

export async function updateRootIdentityForClerkUser(
  clerkUserId: string,
  input: IdentityUpdateInput,
): Promise<{ ok: true; identity: IdentityDTO } | { ok: false; code: "NOT_FOUND" }> {
  const user = await userRepo.findUserByClerkId(clerkUserId);
  if (!user) return { ok: false, code: "NOT_FOUND" };

  const root = await identityRepo.findRootIdentityByUserId(user.id);
  if (!root) return { ok: false, code: "NOT_FOUND" };

  const displayName =
    input.displayName === undefined ? undefined : input.displayName === null ? null : input.displayName || null;
  const summary =
    input.summary === undefined ? undefined : input.summary === null ? null : input.summary || null;

  const updated = await identityRepo.updateIdentityForUser(root.id, user.id, {
    ...(displayName !== undefined && { displayName }),
    ...(summary !== undefined && { summary }),
  });

  if (!updated) return { ok: false, code: "NOT_FOUND" };

  return { ok: true, identity: identityRowToDTO(updated) };
}
