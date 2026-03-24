import type { Prisma, User } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function findUserByClerkId(clerkUserId: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { clerkUserId } });
}

export async function upsertUserByClerkId(
  clerkUserId: string,
  data: Pick<Prisma.UserCreateInput, "email" | "name" | "imageUrl">,
): Promise<User> {
  return prisma.user.upsert({
    where: { clerkUserId },
    create: {
      clerkUserId,
      email: data.email ?? null,
      name: data.name ?? null,
      imageUrl: data.imageUrl ?? null,
    },
    update: {
      email: data.email ?? undefined,
      name: data.name ?? undefined,
      imageUrl: data.imageUrl ?? undefined,
    },
  });
}
