import type { FeedbackTheme, Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";

export async function createProductFeedback(input: {
  userId: string;
  theme: FeedbackTheme;
  surface: string;
  message: string | null;
  rating: number | null;
  metadata: Prisma.InputJsonValue | null;
}) {
  return prisma.productFeedback.create({
    data: {
      userId: input.userId,
      theme: input.theme,
      surface: input.surface,
      message: input.message,
      rating: input.rating,
      metadata: input.metadata ?? undefined,
    },
    select: { id: true },
  });
}

export async function listRecentProductFeedbackWithUser(limit: number) {
  return prisma.productFeedback.findMany({
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      theme: true,
      surface: true,
      message: true,
      rating: true,
      metadata: true,
      createdAt: true,
      user: { select: { email: true, clerkUserId: true } },
    },
  });
}

export async function countProductFeedbackByThemeSince(since: Date) {
  return prisma.productFeedback.groupBy({
    by: ["theme"],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
  });
}

export async function countProductFeedbackBySurfaceSince(since: Date) {
  return prisma.productFeedback.groupBy({
    by: ["surface"],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
  });
}

export async function countProductFeedbackSince(since: Date) {
  return prisma.productFeedback.count({
    where: { createdAt: { gte: since } },
  });
}
