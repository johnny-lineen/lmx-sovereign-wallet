import type {
  GraphEdgePayload,
  GraphMetadataPreview,
  GraphNodePayload,
  GraphPayload,
} from "@/lib/graph-payload";
import { vaultItemMergeGroupKey } from "@/lib/entity-unify";
import type { VaultItemDTO } from "@/server/services/vault.service";
import { getVaultLibraryForClerkUser } from "@/server/services/vault.service";
import * as userRepo from "@/server/repositories/user.repository";

const SUMMARY_PREVIEW_MAX = 160;
const METADATA_STRING_MAX = 80;
const METADATA_MAX_KEYS = 4;

function truncate(str: string, max: number): string {
  if (str.length <= max) return str;
  return `${str.slice(0, max - 1)}…`;
}

function humanizeRelationType(relationType: string): string {
  return relationType
    .split("_")
    .map((w) => (w.length ? w.charAt(0).toUpperCase() + w.slice(1) : w))
    .join(" ");
}

function metadataPreviewFromItem(item: VaultItemDTO): GraphMetadataPreview {
  const preview: GraphMetadataPreview = { status: item.status };

  if (item.summary?.trim()) {
    preview.summary = truncate(item.summary.trim(), SUMMARY_PREVIEW_MAX);
  }

  const raw = item.metadata;
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    const metadata = raw as Record<string, unknown>;
    const sourceRaw = metadata.source;
    const confidenceRaw = metadata.confidence;
    const subjectRaw = metadata.subject;
    const senderRaw = metadata.sender;
    const source =
      typeof sourceRaw === "string" && sourceRaw.trim().length > 0
        ? truncate(sourceRaw.trim(), METADATA_STRING_MAX)
        : "manual_or_unknown";
    const confidence =
      typeof confidenceRaw === "number" && Number.isFinite(confidenceRaw)
        ? Math.max(0, Math.min(1, Number(confidenceRaw.toFixed(2))))
        : null;
    const evidenceSummaryParts: string[] = [];
    if (typeof senderRaw === "string" && senderRaw.trim().length > 0) {
      evidenceSummaryParts.push(`Sender: ${truncate(senderRaw.trim(), METADATA_STRING_MAX)}`);
    }
    if (typeof subjectRaw === "string" && subjectRaw.trim().length > 0) {
      evidenceSummaryParts.push(`Subject: ${truncate(subjectRaw.trim(), METADATA_STRING_MAX)}`);
    }
    preview.provenance = {
      source,
      confidence,
      evidenceSummary: evidenceSummaryParts.length > 0 ? evidenceSummaryParts.join(" | ") : undefined,
      limitedEvidence: evidenceSummaryParts.length === 0 && confidence === null,
    };

    const sample: Record<string, unknown> = {};
    let n = 0;
    for (const [k, v] of Object.entries(metadata)) {
      if (n >= METADATA_MAX_KEYS) break;
      if (typeof v === "string") {
        sample[k] = v.length > METADATA_STRING_MAX ? `${v.slice(0, METADATA_STRING_MAX - 1)}…` : v;
      } else if (typeof v === "number" || typeof v === "boolean") {
        sample[k] = v;
      } else if (v === null) {
        sample[k] = null;
      } else {
        sample[k] = "[…]";
      }
      n += 1;
    }
    if (Object.keys(sample).length > 0) {
      preview.metadata = sample;
    }
  }

  return preview;
}

function itemToNode(item: VaultItemDTO, mergeGroupSize = 1): GraphNodePayload {
  const metadataPreview = metadataPreviewFromItem(item);
  return {
    id: item.id,
    label: item.title,
    type: item.type,
    provider: item.provider,
    metadataPreview,
    mergeGroupSize,
  };
}

function graphNodeMatchesNormalizedEmail(n: GraphNodePayload, normalized: string): boolean {
  if (n.type !== "email") return false;
  if (n.label.trim().toLowerCase() === normalized) return true;
  const meta = n.metadataPreview.metadata;
  if (meta && typeof meta.email === "string" && meta.email.trim().toLowerCase() === normalized) {
    return true;
  }
  return false;
}

function resolveAnchorEmailNodeId(
  nodes: GraphNodePayload[],
  edges: GraphEdgePayload[],
  userEmailNormalized: string | null,
): string | null {
  const emails = nodes.filter((n) => n.type === "email");
  if (emails.length === 0) return null;

  if (userEmailNormalized) {
    const match = emails.find((n) => graphNodeMatchesNormalizedEmail(n, userEmailNormalized));
    if (match) return match.id;
  }

  const degree = new Map<string, number>();
  for (const e of edges) {
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }

  let bestId = emails[0]!.id;
  let bestD = -1;
  for (const n of emails) {
    const d = degree.get(n.id) ?? 0;
    if (d > bestD) {
      bestD = d;
      bestId = n.id;
    }
  }
  return bestId;
}

function buildOverview(nodes: GraphNodePayload[], edges: GraphEdgePayload[]) {
  const accountLike = nodes.filter((n) => n.type === "account" || n.type === "subscription");
  const emails = nodes.filter((n) => n.type === "email");
  const distinctProviders = new Set(
    accountLike
      .map((n) => n.provider?.trim().toLowerCase())
      .filter((p): p is string => Boolean(p)),
  ).size;

  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const emailAdj = new Map<string, Set<string>>();
  const accountAdj = new Map<string, Set<string>>();
  for (const e of edges) {
    const a = nodeById.get(e.source);
    const b = nodeById.get(e.target);
    if (!a || !b) continue;
    if (a.type === "email" && (b.type === "account" || b.type === "subscription")) {
      const provider = (b.provider ?? b.label).trim();
      if (!emailAdj.has(provider)) emailAdj.set(provider, new Set());
      if (!accountAdj.has(provider)) accountAdj.set(provider, new Set());
      emailAdj.get(provider)!.add(a.id);
      accountAdj.get(provider)!.add(b.id);
    } else if (b.type === "email" && (a.type === "account" || a.type === "subscription")) {
      const provider = (a.provider ?? a.label).trim();
      if (!emailAdj.has(provider)) emailAdj.set(provider, new Set());
      if (!accountAdj.has(provider)) accountAdj.set(provider, new Set());
      emailAdj.get(provider)!.add(b.id);
      accountAdj.get(provider)!.add(a.id);
    }
  }

  const highFragmentationClusters = [...emailAdj.entries()]
    .filter(([, emailIds]) => emailIds.size >= 2)
    .map(([provider, emailIds]) => ({
      provider,
      emailCount: emailIds.size,
      accountLikeNodeCount: accountAdj.get(provider)?.size ?? 0,
    }))
    .sort((a, b) => b.emailCount - a.emailCount || b.accountLikeNodeCount - a.accountLikeNodeCount)
    .slice(0, 8);

  return {
    totalNodes: nodes.length,
    totalEdges: edges.length,
    accountCount: nodes.filter((n) => n.type === "account").length,
    subscriptionCount: nodes.filter((n) => n.type === "subscription").length,
    emailCount: emails.length,
    distinctProviders,
    highFragmentationClusters,
  };
}

/**
 * Collapses duplicate vault rows (e.g. two "Uber" account items) into one node and remaps edges
 * so a single entity connects all related emails.
 */
function collapseDuplicateEntityNodes(
  items: VaultItemDTO[],
  edges: GraphEdgePayload[],
): { nodes: GraphNodePayload[]; edges: GraphEdgePayload[] } {
  const byKey = new Map<string, VaultItemDTO[]>();
  for (const item of items) {
    const k = vaultItemMergeGroupKey(item);
    const list = byKey.get(k);
    if (list) list.push(item);
    else byKey.set(k, [item]);
  }

  const canonicalIdByItemId = new Map<string, string>();
  for (const group of byKey.values()) {
    const canonical = group.slice().sort((a, b) => a.id.localeCompare(b.id))[0]!;
    for (const item of group) {
      canonicalIdByItemId.set(item.id, canonical.id);
    }
  }

  const nodes: GraphNodePayload[] = [];
  for (const group of byKey.values()) {
    const canonical = group.slice().sort((a, b) => a.id.localeCompare(b.id))[0]!;
    nodes.push(itemToNode(canonical, group.length));
  }

  const edgeDedup = new Map<string, GraphEdgePayload>();
  for (const e of edges) {
    const src = canonicalIdByItemId.get(e.source) ?? e.source;
    const tgt = canonicalIdByItemId.get(e.target) ?? e.target;
    if (src === tgt) continue;
    const dedupKey = `${src}\0${tgt}\0${e.label}`;
    if (!edgeDedup.has(dedupKey)) {
      edgeDedup.set(dedupKey, { ...e, id: e.id, source: src, target: tgt, label: e.label });
    }
  }

  return { nodes, edges: [...edgeDedup.values()] };
}

export async function getGraphPayloadForClerkUser(clerkUserId: string): Promise<GraphPayload | null> {
  const library = await getVaultLibraryForClerkUser(clerkUserId);
  if (!library) return null;

  const user = await userRepo.findUserByClerkId(clerkUserId);
  const userEmailNorm = user?.email?.trim().toLowerCase() ?? null;

  const itemIds = new Set(library.items.map((i) => i.id));
  const rawEdges: GraphEdgePayload[] = library.relationships
    .filter((r) => itemIds.has(r.fromItemId) && itemIds.has(r.toItemId))
    .map((r) => ({
      id: r.id,
      source: r.fromItemId,
      target: r.toItemId,
      label: humanizeRelationType(r.relationType),
    }));

  const collapsed = collapseDuplicateEntityNodes(library.items, rawEdges);
  const anchorEmailNodeId = resolveAnchorEmailNodeId(
    collapsed.nodes,
    collapsed.edges,
    userEmailNorm,
  );
  const overview = buildOverview(collapsed.nodes, collapsed.edges);
  return {
    overview: { ...overview, anchorEmailNodeId },
    nodes: collapsed.nodes,
    edges: collapsed.edges,
  };
}
