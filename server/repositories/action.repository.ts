import type { Prisma, UserActionPriority, UserActionStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const actionSelect = {
  id: true,
  actionKey: true,
  userId: true,
  insightId: true,
  title: true,
  description: true,
  status: true,
  priority: true,
  relatedItemIds: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
  completedAt: true,
} satisfies Prisma.UserActionSelect;

export type UserActionRow = Prisma.UserActionGetPayload<{ select: typeof actionSelect }>;

export async function upsertUserActionForUser(
  userId: string,
  actionKey: string,
  data: {
    insightId?: string | null;
    title: string;
    description: string;
    priority: UserActionPriority;
    relatedItemIds: string[];
    metadata?: Prisma.InputJsonValue;
  },
): Promise<void> {
  await prisma.userAction.upsert({
    where: {
      userId_actionKey: {
        userId,
        actionKey,
      },
    },
    update: {
      title: data.title,
      description: data.description,
      priority: data.priority,
      relatedItemIds: data.relatedItemIds,
      insightId: data.insightId ?? null,
      ...(data.metadata !== undefined && { metadata: data.metadata }),
    },
    create: {
      userId,
      actionKey,
      insightId: data.insightId ?? null,
      title: data.title,
      description: data.description,
      priority: data.priority,
      relatedItemIds: data.relatedItemIds,
      ...(data.metadata !== undefined && { metadata: data.metadata }),
    },
  });
}

export async function listUserActionsForUser(userId: string): Promise<UserActionRow[]> {
  return prisma.userAction.findMany({
    where: { userId },
    select: actionSelect,
    orderBy: [{ priority: "desc" }, { createdAt: "asc" }],
  });
}

export async function updateUserActionStatusForUser(
  userId: string,
  actionId: string,
  status: UserActionStatus,
): Promise<boolean> {
  const result = await prisma.userAction.updateMany({
    where: { id: actionId, userId },
    data: {
      status,
      completedAt: status === "done" ? new Date() : null,
    },
  });
  return result.count > 0;
}

export async function deleteUserActionsByPrefixForUser(
  userId: string,
  prefixes: string[],
  keepActionKeys: string[] = [],
): Promise<void> {
  if (prefixes.length === 0) return;
  await prisma.userAction.deleteMany({
    where: {
      userId,
      ...(keepActionKeys.length > 0 ? { actionKey: { notIn: keepActionKeys } } : {}),
      OR: prefixes.map((prefix) => ({ actionKey: { startsWith: prefix } })),
    },
  });
}
