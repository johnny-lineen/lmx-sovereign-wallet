import { cache } from "react";

import type { LMXIdentity, User } from "@prisma/client";

import type { ClerkProfile } from "@/lib/clerk-profile";
import { prisma } from "@/lib/prisma";
import * as identityRepo from "@/server/repositories/identity.repository";
import * as userRepo from "@/server/repositories/user.repository";

/** Fields synced from the auth provider (Clerk) into our `User` row. */
export type AuthProviderProfile = ClerkProfile;

export type BootstrappedUserIdentity = {
  user: User;
  lmxIdentity: LMXIdentity;
};

/**
 * Ensures a `User` row exists for the authenticated account and that they have one root `LMXIdentity`.
 * Idempotent: repeated calls only refresh profile fields on upsert and return existing root identity.
 */
async function ensureUserAndRootLMXIdentityImpl(
  authProviderUserId: string,
  profile: AuthProviderProfile,
): Promise<BootstrappedUserIdentity> {
  const user = await userRepo.upsertUserByClerkId(authProviderUserId, {
    email: profile.email,
    name: profile.name,
    imageUrl: profile.imageUrl,
  });

  const existingRoot = await identityRepo.findRootIdentityByUserId(user.id);
  if (existingRoot) {
    return { user, lmxIdentity: existingRoot };
  }

  const lmxIdentity = await prisma.$transaction(async (tx) => {
    const concurrent = await tx.lMXIdentity.findFirst({
      where: { userId: user.id, isRoot: true },
    });
    if (concurrent) return concurrent;

    return tx.lMXIdentity.create({
      data: {
        userId: user.id,
        isRoot: true,
        displayName: profile.name,
        summary: null,
      },
    });
  });

  return { user, lmxIdentity };
}

/**
 * Per-request memoization for React Server Components and handlers that call bootstrap multiple times
 * in the same render pass.
 */
export const ensureUserAndRootLMXIdentity = cache(ensureUserAndRootLMXIdentityImpl);
