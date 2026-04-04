import type { GraphEdgePayload, GraphNodePayload } from "@/lib/graph-payload";

/** Email ring — distance from anchor to secondary inboxes. */
const R1 = 145;
/** Base radius for first hop of non-email nodes from center. */
const R2_BASE = 245;
const HOP_RADIUS_STEP = 42;

/** Deterministic pseudo-random in [0, 1) from id + salt. */
export function layoutJitterUnit(id: string, salt: string): number {
  let h = 0;
  const s = `${id}\0${salt}`;
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i);
  }
  return (h >>> 0) / 0xffff_ffff;
}

export function computeUndirectedDegrees(
  nodeIds: Set<string>,
  vaultEdges: GraphEdgePayload[],
): Map<string, number> {
  const degree = new Map<string, number>();
  for (const id of nodeIds) degree.set(id, 0);
  for (const e of vaultEdges) {
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) continue;
    degree.set(e.source, (degree.get(e.source) ?? 0) + 1);
    degree.set(e.target, (degree.get(e.target) ?? 0) + 1);
  }
  return degree;
}

function bfsHopsFromAnchor(
  anchorId: string,
  nodeIds: Set<string>,
  vaultEdges: GraphEdgePayload[],
): Map<string, number> {
  const hop = new Map<string, number>();
  const adj = new Map<string, string[]>();
  for (const e of vaultEdges) {
    if (!nodeIds.has(e.source) || !nodeIds.has(e.target)) continue;
    if (!adj.has(e.source)) adj.set(e.source, []);
    if (!adj.has(e.target)) adj.set(e.target, []);
    adj.get(e.source)!.push(e.target);
    adj.get(e.target)!.push(e.source);
  }
  const q: string[] = [anchorId];
  hop.set(anchorId, 0);
  let qi = 0;
  while (qi < q.length) {
    const u = q[qi++]!;
    const h = hop.get(u)!;
    for (const v of adj.get(u) ?? []) {
      if (!hop.has(v)) {
        hop.set(v, h + 1);
        q.push(v);
      }
    }
  }
  return hop;
}

/**
 * Target (tx, ty) in graph coordinates (origin = identity anchor).
 * Non-email nodes are spread along an arc within each provider wedge so they do not stack.
 */
export function computeGraphLayoutTargets(
  nodes: GraphNodePayload[],
  vaultEdges: GraphEdgePayload[],
  anchorId: string | null,
): Map<string, { tx: number; ty: number }> {
  const byId = new Map(nodes.map((n) => [n.id, n]));
  const idSet = new Set(nodes.map((n) => n.id));
  const targets = new Map<string, { tx: number; ty: number }>();

  const emails = nodes
    .filter((n) => n.type === "email")
    .slice()
    .sort((a, b) => a.label.localeCompare(b.label));

  const effectiveAnchor =
    anchorId && byId.get(anchorId)?.type === "email"
      ? anchorId
      : emails.length > 0
        ? emails[0]!.id
        : null;

  const hop =
    effectiveAnchor !== null ? bfsHopsFromAnchor(effectiveAnchor, idSet, vaultEdges) : new Map<string, number>();

  const providers = [
    ...new Set(nodes.map((n) => (n.provider?.trim() ? n.provider.trim().toLowerCase() : "unknown"))),
  ].sort();
  const nProv = Math.max(providers.length, 1);
  const sectorWidth = (2 * Math.PI) / nProv;
  const sectorIndex = new Map(providers.map((p, i) => [p, i]));

  const otherEmails = effectiveAnchor ? emails.filter((e) => e.id !== effectiveAnchor) : emails;

  const nonEmailByProvider = new Map<string, GraphNodePayload[]>();
  for (const n of nodes) {
    if (n.type === "email") continue;
    if (effectiveAnchor && n.id === effectiveAnchor) continue;
    const prov = n.provider?.trim() ? n.provider.trim().toLowerCase() : "unknown";
    if (!nonEmailByProvider.has(prov)) nonEmailByProvider.set(prov, []);
    nonEmailByProvider.get(prov)!.push(n);
  }
  for (const list of nonEmailByProvider.values()) {
    list.sort((a, b) => a.id.localeCompare(b.id));
  }
  const indexInProvider = new Map<string, number>();
  for (const list of nonEmailByProvider.values()) {
    list.forEach((n, i) => indexInProvider.set(n.id, i));
  }

  for (const n of nodes) {
    if (effectiveAnchor && n.id === effectiveAnchor) {
      targets.set(n.id, { tx: 0, ty: 0 });
      continue;
    }

    if (n.type === "email") {
      const idx = Math.max(0, otherEmails.findIndex((e) => e.id === n.id));
      const count = Math.max(otherEmails.length, 1);
      const ang = (idx / count) * 2 * Math.PI - Math.PI / 2;
      const jx = (layoutJitterUnit(n.id, "ex") - 0.5) * 22;
      const jy = (layoutJitterUnit(n.id, "ey") - 0.5) * 22;
      targets.set(n.id, { tx: Math.cos(ang) * R1 + jx, ty: Math.sin(ang) * R1 + jy });
      continue;
    }

    const prov = n.provider?.trim() ? n.provider.trim().toLowerCase() : "unknown";
    const si = sectorIndex.get(prov) ?? 0;
    const sectorStart = si * sectorWidth - Math.PI / 2;
    const list = nonEmailByProvider.get(prov) ?? [n];
    const groupSize = list.length;
    const idx = indexInProvider.get(n.id) ?? 0;
    const slotT = groupSize <= 1 ? 0.5 : (idx + 0.5) / groupSize;
    const edgeMargin = 0.12;
    const angle =
      sectorStart + sectorWidth * (edgeMargin + slotT * (1 - 2 * edgeMargin)) +
      (layoutJitterUnit(n.id, "a") - 0.5) * sectorWidth * 0.08;

    const h = hop.get(n.id) ?? 8;
    const radius = R2_BASE + Math.min(h, 7) * HOP_RADIUS_STEP;
    const jitterR = (layoutJitterUnit(n.id, "r") - 0.5) * 52;
    const rr = radius + jitterR;
    targets.set(n.id, { tx: Math.cos(angle) * rr, ty: Math.sin(angle) * rr });
  }

  return targets;
}
