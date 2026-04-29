import type { Prisma, PublicAuditCandidateStatus, PublicAuditRunStatus } from "@prisma/client";

import { prisma } from "@/lib/prisma";

const runSelect = {
  id: true,
  userId: true,
  fullName: true,
  submittedEmail: true,
  usernamesJson: true,
  locationHint: true,
  websiteHint: true,
  notes: true,
  status: true,
  totalCandidates: true,
  importedCount: true,
  reviewCount: true,
  errorMessage: true,
  metadata: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PublicAuditRunSelect;

export type PublicAuditRunRow = Prisma.PublicAuditRunGetPayload<{ select: typeof runSelect }>;

const candidateSelect = {
  id: true,
  auditRunId: true,
  userId: true,
  sourceType: true,
  sourceName: true,
  proposedVaultType: true,
  title: true,
  url: true,
  snippet: true,
  matchedIdentifier: true,
  confidenceScore: true,
  confidenceBand: true,
  status: true,
  rawData: true,
  createdVaultItemId: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.PublicAuditCandidateSelect;

export type PublicAuditCandidateRow = Prisma.PublicAuditCandidateGetPayload<{ select: typeof candidateSelect }>;

export async function createPublicAuditRun(
  userId: string,
  data: {
    fullName: string;
    submittedEmail: string;
    usernamesJson: Prisma.InputJsonValue | typeof Prisma.JsonNull;
    locationHint: string | null;
    websiteHint: string | null;
    notes: string | null;
    metadata?: Prisma.InputJsonValue;
  },
): Promise<{ id: string }> {
  return prisma.publicAuditRun.create({
    data: {
      userId,
      fullName: data.fullName,
      submittedEmail: data.submittedEmail,
      usernamesJson: data.usernamesJson,
      locationHint: data.locationHint,
      websiteHint: data.websiteHint,
      notes: data.notes,
      status: "queued",
      ...(data.metadata !== undefined ? { metadata: data.metadata } : {}),
    },
    select: { id: true },
  });
}

export async function updatePublicAuditRun(
  userId: string,
  runId: string,
  data: Prisma.PublicAuditRunUpdateInput,
): Promise<boolean> {
  const r = await prisma.publicAuditRun.updateMany({
    where: { id: runId, userId },
    data,
  });
  return r.count > 0;
}

export async function findPublicAuditRunForUser(
  userId: string,
  runId: string,
): Promise<PublicAuditRunRow | null> {
  return prisma.publicAuditRun.findFirst({
    where: { id: runId, userId },
    select: runSelect,
  });
}

export async function listPublicAuditRunsForUser(
  userId: string,
  limit: number,
): Promise<PublicAuditRunRow[]> {
  return prisma.publicAuditRun.findMany({
    where: { userId },
    select: runSelect,
    orderBy: { createdAt: "desc" },
    take: limit,
  });
}

export async function createPublicAuditCandidates(
  rows: Prisma.PublicAuditCandidateCreateManyInput[],
): Promise<number> {
  if (rows.length === 0) return 0;
  const r = await prisma.publicAuditCandidate.createMany({ data: rows });
  return r.count;
}

export async function listPublicAuditCandidatesForRun(
  userId: string,
  auditRunId: string,
  filters?: { status?: PublicAuditCandidateStatus },
): Promise<PublicAuditCandidateRow[]> {
  return prisma.publicAuditCandidate.findMany({
    where: {
      userId,
      auditRunId,
      ...(filters?.status !== undefined && { status: filters.status }),
    },
    select: candidateSelect,
    orderBy: [{ confidenceBand: "asc" }, { createdAt: "asc" }],
  });
}

export async function listPendingPublicAuditCandidatesForUser(userId: string): Promise<
  (PublicAuditCandidateRow & { auditRun: { id: string; createdAt: Date; status: PublicAuditRunStatus } })[]
> {
  return prisma.publicAuditCandidate.findMany({
    where: { userId, status: "pending" },
    select: {
      id: true,
      auditRunId: true,
      userId: true,
      sourceType: true,
      sourceName: true,
      proposedVaultType: true,
      title: true,
      url: true,
      snippet: true,
      matchedIdentifier: true,
      confidenceScore: true,
      confidenceBand: true,
      status: true,
      rawData: true,
      createdVaultItemId: true,
      createdAt: true,
      updatedAt: true,
      auditRun: { select: { id: true, createdAt: true, status: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });
}

export async function findPublicAuditCandidatesForUserByIds(
  userId: string,
  ids: string[],
  statuses: PublicAuditCandidateStatus[],
): Promise<PublicAuditCandidateRow[]> {
  if (ids.length === 0) return [];
  return prisma.publicAuditCandidate.findMany({
    where: { userId, id: { in: ids }, status: { in: statuses } },
    select: candidateSelect,
  });
}

export async function updatePublicAuditCandidate(
  userId: string,
  candidateId: string,
  data: Prisma.PublicAuditCandidateUpdateInput,
): Promise<boolean> {
  const r = await prisma.publicAuditCandidate.updateMany({
    where: { id: candidateId, userId },
    data,
  });
  return r.count > 0;
}

export async function countPublicAuditCandidatesByRunAndStatus(
  userId: string,
  auditRunId: string,
  status: PublicAuditCandidateStatus,
): Promise<number> {
  return prisma.publicAuditCandidate.count({
    where: { userId, auditRunId, status },
  });
}
