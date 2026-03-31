import type {
  ImportCandidateSignal,
  ImportCandidateStatus,
  ImportJobStatus,
  Prisma,
  VaultItemType,
} from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { decryptToken, encryptToken } from "@/lib/token-crypto";

const gmailConnectorPublicSelect = {
  id: true,
  userId: true,
  gmailAddress: true,
  scopes: true,
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.GmailConnectorSelect;

export type GmailConnectorPublic = Prisma.GmailConnectorGetPayload<{
  select: typeof gmailConnectorPublicSelect;
}>;

export async function listGmailConnectorsForUser(userId: string): Promise<GmailConnectorPublic[]> {
  return prisma.gmailConnector.findMany({
    where: { userId },
    select: gmailConnectorPublicSelect,
    orderBy: { createdAt: "desc" },
  });
}

export async function findGmailConnectorByUserAndAddress(
  userId: string,
  gmailAddress: string,
): Promise<{ id: string; refreshToken: string } | null> {
  const connector = await prisma.gmailConnector.findUnique({
    where: { userId_gmailAddress: { userId, gmailAddress } },
    select: { id: true, refreshToken: true },
  });
  if (!connector) return null;
  return { ...connector, refreshToken: decryptToken(connector.refreshToken) };
}

export async function findGmailConnectorWithSecretForUser(
  userId: string,
  connectorId: string,
): Promise<Prisma.GmailConnectorGetPayload<{
  select: {
    id: true;
    userId: true;
    gmailAddress: true;
    refreshToken: true;
    accessToken: true;
    accessTokenExpiresAt: true;
    scopes: true;
  };
}> | null> {
  const connector = await prisma.gmailConnector.findFirst({
    where: { id: connectorId, userId },
    select: {
      id: true,
      userId: true,
      gmailAddress: true,
      refreshToken: true,
      accessToken: true,
      accessTokenExpiresAt: true,
      scopes: true,
    },
  });
  if (!connector) return null;
  return {
    ...connector,
    refreshToken: decryptToken(connector.refreshToken),
    accessToken: connector.accessToken ? decryptToken(connector.accessToken) : null,
  };
}

export async function upsertGmailConnectorForUser(
  userId: string,
  data: {
    gmailAddress: string;
    refreshToken: string;
    accessToken?: string | null;
    accessTokenExpiresAt?: Date | null;
    scopes?: string | null;
  },
) {
  return prisma.gmailConnector.upsert({
    where: {
      userId_gmailAddress: { userId, gmailAddress: data.gmailAddress },
    },
    create: {
      userId,
      gmailAddress: data.gmailAddress,
      refreshToken: encryptToken(data.refreshToken),
      accessToken: data.accessToken ? encryptToken(data.accessToken) : null,
      accessTokenExpiresAt: data.accessTokenExpiresAt ?? null,
      scopes: data.scopes ?? null,
    },
    update: {
      refreshToken: encryptToken(data.refreshToken),
      accessToken: data.accessToken ? encryptToken(data.accessToken) : undefined,
      accessTokenExpiresAt: data.accessTokenExpiresAt ?? undefined,
      scopes: data.scopes ?? undefined,
    },
    select: gmailConnectorPublicSelect,
  });
}

export async function updateGmailConnectorTokens(
  userId: string,
  connectorId: string,
  tokens: {
    accessToken?: string | null;
    accessTokenExpiresAt?: Date | null;
    refreshToken?: string;
  },
): Promise<void> {
  await prisma.gmailConnector.updateMany({
    where: { id: connectorId, userId },
    data: {
      ...(tokens.accessToken !== undefined && {
        accessToken: tokens.accessToken ? encryptToken(tokens.accessToken) : null,
      }),
      ...(tokens.accessTokenExpiresAt !== undefined && {
        accessTokenExpiresAt: tokens.accessTokenExpiresAt,
      }),
      ...(tokens.refreshToken !== undefined && { refreshToken: encryptToken(tokens.refreshToken) }),
    },
  });
}

export async function createImportJob(
  userId: string,
  data: {
    gmailConnectorId: string;
    profileEmailItemId?: string | null;
  },
) {
  return prisma.importJob.create({
    data: {
      userId,
      gmailConnectorId: data.gmailConnectorId,
      profileEmailItemId: data.profileEmailItemId ?? null,
      status: "queued",
    },
  });
}

export async function patchImportJob(
  userId: string,
  jobId: string,
  patch: {
    status?: ImportJobStatus;
    completedAt?: Date | null;
    errorMessage?: string | null;
    metadata?: Prisma.InputJsonValue;
  },
) {
  await prisma.importJob.updateMany({
    where: { id: jobId, userId },
    data: {
      ...(patch.status !== undefined && { status: patch.status }),
      ...(patch.completedAt !== undefined && { completedAt: patch.completedAt }),
      ...(patch.errorMessage !== undefined && { errorMessage: patch.errorMessage }),
      ...(patch.metadata !== undefined && { metadata: patch.metadata }),
    },
  });
}

export async function findImportJobForUser(userId: string, jobId: string) {
  return prisma.importJob.findFirst({
    where: { id: jobId, userId },
    include: {
      gmailConnector: { select: gmailConnectorPublicSelect },
    },
  });
}

export async function listImportJobsForUser(userId: string, take = 20) {
  return prisma.importJob.findMany({
    where: { userId },
    orderBy: { startedAt: "desc" },
    take,
    include: {
      gmailConnector: { select: { id: true, gmailAddress: true } },
      _count: { select: { candidates: true } },
    },
  });
}

export async function findMostRecentImportJobForUser(userId: string) {
  return prisma.importJob.findFirst({
    where: { userId },
    orderBy: { startedAt: "desc" },
    select: {
      id: true,
      status: true,
      startedAt: true,
      completedAt: true,
      errorMessage: true,
    },
  });
}

export type ImportCandidateCreateRow = {
  userId: string;
  importJobId: string;
  signal: ImportCandidateSignal;
  suggestedType: VaultItemType;
  title: string;
  provider: string | null;
  providerDomain: string | null;
  evidence: Prisma.InputJsonValue;
  dedupeKey: string;
};

export async function createImportCandidatesSkipDuplicates(rows: ImportCandidateCreateRow[]): Promise<number> {
  if (rows.length === 0) return 0;
  const result = await prisma.importCandidate.createMany({
    data: rows,
    skipDuplicates: true,
  });
  return result.count;
}

const candidateListSelect = {
  id: true,
  importJobId: true,
  status: true,
  signal: true,
  suggestedType: true,
  title: true,
  provider: true,
  providerDomain: true,
  evidence: true,
  dedupeKey: true,
  createdVaultItemId: true,
  createdAt: true,
} satisfies Prisma.ImportCandidateSelect;

export type ImportCandidateListRow = Prisma.ImportCandidateGetPayload<{ select: typeof candidateListSelect }>;

const importCandidateWithJobContextSelect = {
  ...candidateListSelect,
  importJob: {
    select: {
      profileEmailItem: { select: { title: true } },
      gmailConnector: { select: { gmailAddress: true } },
    },
  },
} satisfies Prisma.ImportCandidateSelect;

export type ImportCandidateWithJobContextRow = Prisma.ImportCandidateGetPayload<{
  select: typeof importCandidateWithJobContextSelect;
}>;

/** Same filters as `listImportCandidatesForUser`, plus import job context for profile / connector email. */
export async function listImportCandidatesWithJobContextForUser(
  userId: string,
  filters: { importJobId?: string; status?: ImportCandidateStatus },
): Promise<ImportCandidateWithJobContextRow[]> {
  return prisma.importCandidate.findMany({
    where: {
      userId,
      ...(filters.importJobId !== undefined && { importJobId: filters.importJobId }),
      ...(filters.status !== undefined && { status: filters.status }),
    },
    select: importCandidateWithJobContextSelect,
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function listImportCandidatesForUser(
  userId: string,
  filters: { importJobId?: string; status?: ImportCandidateStatus },
): Promise<ImportCandidateListRow[]> {
  return prisma.importCandidate.findMany({
    where: {
      userId,
      ...(filters.importJobId !== undefined && { importJobId: filters.importJobId }),
      ...(filters.status !== undefined && { status: filters.status }),
    },
    select: candidateListSelect,
    orderBy: [{ createdAt: "desc" }],
  });
}

export async function findPendingImportCandidatesForUser(
  userId: string,
  ids: string[],
): Promise<ImportCandidateListRow[]> {
  if (ids.length === 0) return [];
  return prisma.importCandidate.findMany({
    where: {
      userId,
      id: { in: ids },
      status: "pending",
    },
    select: candidateListSelect,
  });
}
