import type { GraphEdgePayload, GraphNodePayload } from "@/lib/graph-payload";
import { computeGraphLayoutTargets, computeUndirectedDegrees } from "@/lib/graph-layout";

import { forceNodeVal } from "./vault-graph-force-palette";
import type { FGLink, FGNode } from "./vault-knowledge-graph-canvas";

/**
 * Adds short, deduped edges between emails that share the same non-email neighbor so the force
 * simulation pulls related mail into one intertwined region instead of isolated hub-and-spoke rings.
 */
function appendCohesionEmailLinks(nodes: FGNode[], vaultLinks: FGLink[]): FGLink[] {
  const emailIds = new Set(nodes.filter((n) => n.type === "email").map((n) => n.id));
  if (emailIds.size < 2) return vaultLinks;

  const adj = new Map<string, Set<string>>();
  const touch = (a: string, b: string) => {
    if (a === b) return;
    if (!adj.has(a)) adj.set(a, new Set());
    if (!adj.has(b)) adj.set(b, new Set());
    adj.get(a)!.add(b);
    adj.get(b)!.add(a);
  };
  for (const e of vaultLinks) {
    touch(e.source, e.target);
  }

  const pairSeen = new Set<string>();
  const extra: FGLink[] = [];

  for (const n of nodes) {
    if (n.type === "email") continue;
    const nb = adj.get(n.id);
    if (!nb) continue;
    const emails = [...nb].filter((id) => emailIds.has(id)).sort();
    if (emails.length < 2) continue;
    for (let i = 0; i < emails.length - 1; i++) {
      const a = emails[i]!;
      const b = emails[i + 1]!;
      const key = a < b ? `${a}\0${b}` : `${b}\0${a}`;
      if (pairSeen.has(key)) continue;
      pairSeen.add(key);
      extra.push({
        id: `__cohesion__${key}`,
        source: a,
        target: b,
        label: "",
        kind: "cohesion",
      });
    }
  }

  return [...vaultLinks, ...extra];
}

function resolveAnchorForFiltered(
  payloadAnchor: string | null | undefined,
  emailNodes: GraphNodePayload[],
  degree: Map<string, number>,
): string | null {
  if (payloadAnchor && emailNodes.some((n) => n.id === payloadAnchor)) return payloadAnchor;
  if (emailNodes.length === 0) return null;
  let best = emailNodes[0]!.id;
  let bestD = -1;
  for (const n of emailNodes) {
    const d = degree.get(n.id) ?? 0;
    if (d > bestD) {
      bestD = d;
      best = n.id;
    }
  }
  return best;
}

export function buildVaultForceGraphModel(params: {
  nodes: GraphNodePayload[];
  edges: GraphEdgePayload[];
  anchorEmailNodeId: string | null;
  showDerivedLinks: boolean;
}): { nodes: FGNode[]; links: FGLink[] } {
  const { nodes: filteredNodes, edges: filteredEdges, anchorEmailNodeId, showDerivedLinks } = params;

  const nodeIds = new Set(filteredNodes.map((n) => n.id));
  const degree = computeUndirectedDegrees(nodeIds, filteredEdges);
  const emails = filteredNodes.filter((n) => n.type === "email");
  const anchorId = resolveAnchorForFiltered(anchorEmailNodeId, emails, degree);
  const layout = computeGraphLayoutTargets(filteredNodes, filteredEdges, anchorId);

  const nodes: FGNode[] = filteredNodes.map((n) => {
    const d = degree.get(n.id) ?? 0;
    const t = layout.get(n.id) ?? { tx: 0, ty: 0 };
    const isAnchor = anchorId === n.id;
    return {
      ...n,
      id: n.id,
      mergeGroupSize: n.mergeGroupSize ?? 1,
      graphDegree: d,
      val: forceNodeVal(n.type, d),
      layoutTx: t.tx,
      layoutTy: t.ty,
      isLayoutAnchor: isAnchor,
      ...(isAnchor ? { fx: 0, fy: 0 } : {}),
    };
  });

  const vaultLinks: FGLink[] = filteredEdges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    label: e.label,
    kind: "vault" as const,
  }));
  let links = appendCohesionEmailLinks(nodes, vaultLinks);
  if (!showDerivedLinks) {
    links = links.filter((l) => l.kind === "vault");
  }
  return { nodes, links };
}
