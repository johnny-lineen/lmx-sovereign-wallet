import { cache } from "react";

import type { ClerkProfile } from "@/lib/clerk-profile";
import { prisma } from "@/lib/prisma";
import * as identityRepo from "@/server/repositories/identity.repository";
import * as userRepo from "@/server/repositories/user.repository";

export type { ClerkProfile };

/**
 * Idempotent: upserts `User` by Clerk id and ensures exactly one root `LMXIdentity`.
 * Cached per request so layouts and RSC children do not repeat work.
 */
export const ensureUserWithRootIdentity = cache(async (clerkUserId: string, profile: ClerkProfile) => {
  const user = await userRepo.upsertUserByClerkId(clerkUserId, {
    email: profile.email,
    name: profile.name,
    imageUrl: profile.imageUrl,
  });

  const existing = await identityRepo.findRootIdentityByUserId(user.id);
  if (existing) {
    return { user, rootIdentity: existing };
  }

  const rootIdentity = await prisma.$transaction(async (tx) => {
    const again = await tx.lMXIdentity.findFirst({
      where: { userId: user.id, isRoot: true },
    });
    if (again) return again;

    return tx.lMXIdentity.create({
      data: {
        userId: user.id,
        isRoot: true,
        displayName: profile.name,
        summary: null,
      },
    });
  });

  return { user, rootIdentity };
});
