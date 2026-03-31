"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { z } from "zod";
import { ChevronLeft, ChevronRight, Info, Maximize2, RotateCcw, Sparkles, Tags, X } from "lucide-react";

import type { GraphEdgePayload, GraphNodePayload, GraphPayload } from "@/lib/graph-payload";
import { VAULT_DATA_CHANGED_EVENT } from "@/lib/vault-changed-event";
import { vaultItemTypeSchema } from "@/lib/validations/vault";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";

import { forceNodeFill, forceNodeVal } from "./vault-graph-force-palette";
import type { FGLink, FGNode, KnowledgeGraphHandle } from "./vault-knowledge-graph-canvas";
import { humanizeVaultType } from "./vault-graph-theme";

const VaultKnowledgeGraphCanvas = dynamic(
  () => import("./vault-knowledge-graph-canvas").then((m) => m.VaultKnowledgeGraphCanvas),
  {
    ssr: false,
    loading: () => <div className="h-full min-h-[420px] w-full animate-pulse bg-[#0c0c0f]" />,
  },
);

const VAULT_ITEM_TYPES = Object.values(vaultItemTypeSchema.def.entries) as z.infer<
  typeof vaultItemTypeSchema
>[];

const detailPanelClass =
  "rounded-xl border border-zinc-700/70 bg-zinc-950/95 text-zinc-100 shadow-2xl backdrop-blur-md";

const floatingBarClass =
  "flex items-center gap-0.5 rounded-full border border-zinc-700/60 bg-zinc-950/90 px-0.5 py-0.5 shadow-lg backdrop-blur-md";

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

function pairKeyUndirected(a: string, b: string): string {
  return a < b ? `${a}\0${b}` : `${b}\0${a}`;
}

/**
 * Soft star from one median email so every inbox node shares a common anchor and stays in a tight cloud.
 */
function appendGlobalEmailAnchorLinks(nodes: FGNode[], links: FGLink[]): FGLink[] {
  const emails = nodes.filter((n) => n.type === "email").map((n) => n.id).sort();
  if (emails.length < 2) return links;

  const seen = new Set<string>();
  for (const l of links) {
    seen.add(pairKeyUndirected(l.source, l.target));
  }

  const center = emails[Math.floor(emails.length / 2)]!;
  const extra: FGLink[] = [];
  for (const id of emails) {
    if (id === center) continue;
    const key = pairKeyUndirected(id, center);
    if (seen.has(key)) continue;
    seen.add(key);
    const a = id < center ? id : center;
    const b = id < center ? center : id;
    extra.push({
      id: `__cohesionGlobal__${key}`,
      source: a,
      target: b,
      label: "",
      kind: "cohesionGlobal",
    });
  }
  return [...links, ...extra];
}

function jitterGraphSeeds(nodes: FGNode[]) {
  for (const n of nodes) {
    if (n.type === "email") {
      n.x = (Math.random() - 0.5) * 36;
      n.y = (Math.random() - 0.5) * 36;
    } else {
      n.x = (Math.random() - 0.5) * 72;
      n.y = (Math.random() - 0.5) * 72;
    }
  }
}

function neighborIdSet(selectedId: string | null, edges: GraphEdgePayload[]): Set<string> {
  const s = new Set<string>();
  if (!selectedId) return s;
  for (const e of edges) {
    if (e.source === selectedId) s.add(e.target);
    if (e.target === selectedId) s.add(e.source);
  }
  return s;
}

function SelectedNodeFloatingPanel({
  node,
  connections,
  aiExplanation,
  aiExplanationLoading,
  aiExplanationError,
  onClose,
}: {
  node: GraphNodePayload;
  connections: { edgeId: string; otherLabel: string; relation: string; direction: "out" | "in" }[];
  aiExplanation: string | null;
  aiExplanationLoading: boolean;
  aiExplanationError: string | null;
  onClose: () => void;
}) {
  const meta = node.metadataPreview;
  const hasFieldSample = meta.metadata !== undefined && Object.keys(meta.metadata).length > 0;

  return (
    <div
      className={cn(
        "flex w-[min(22rem,calc(100vw-2rem))] max-w-md flex-col overflow-hidden",
        detailPanelClass,
      )}
    >
      <div className="flex items-start justify-between gap-2 border-b border-zinc-800 px-3 py-2.5">
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold leading-snug text-zinc-50">{node.label}</h2>
          <p className="text-xs text-zinc-400">{humanizeVaultType(node.type)}</p>
        </div>
        <Button
          type="button"
          size="icon-xs"
          variant="ghost"
          className="shrink-0 text-zinc-400 hover:text-zinc-100"
          onClick={onClose}
          title="Close"
        >
          <X className="size-3.5" />
          <span className="sr-only">Close</span>
        </Button>
      </div>
      <div className="max-h-[min(60vh,calc(100dvh-10rem))] space-y-3 overflow-y-auto px-3 py-3 text-sm text-zinc-200">
        <section className="space-y-1">
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Provider</h3>
          <p className="text-zinc-200/90">{node.provider ?? "—"}</p>
        </section>
        <Separator className="bg-zinc-800" />
        <section className="space-y-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Metadata</h3>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs text-zinc-500">Status</dt>
              <dd>{meta.status}</dd>
            </div>
            {meta.summary ? (
              <div>
                <dt className="text-xs text-zinc-500">Summary</dt>
                <dd className="leading-relaxed text-zinc-400">{meta.summary}</dd>
              </div>
            ) : null}
            {hasFieldSample ? (
              <div>
                <dt className="text-xs text-zinc-500">Fields</dt>
                <dd>
                  <pre className="max-h-32 overflow-auto rounded-lg bg-zinc-900/80 p-2 font-mono text-[11px] leading-relaxed text-zinc-300">
                    {JSON.stringify(meta.metadata, null, 2)}
                  </pre>
                </dd>
              </div>
            ) : null}
            {!meta.summary && !hasFieldSample ? (
              <p className="text-xs text-zinc-500">No summary or custom fields.</p>
            ) : null}
          </dl>
        </section>
        <Separator className="bg-zinc-800" />
        <section className="space-y-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">Why this exists</h3>
          <dl className="space-y-2 text-sm">
            <div>
              <dt className="text-xs text-zinc-500">Source</dt>
              <dd className="font-mono text-xs">{meta.provenance?.source ?? "manual_or_unknown"}</dd>
            </div>
            <div>
              <dt className="text-xs text-zinc-500">Confidence</dt>
              <dd>
                {meta.provenance?.confidence != null
                  ? `${Math.round(meta.provenance.confidence * 100)}%`
                  : "Not available"}
              </dd>
            </div>
            {meta.provenance?.evidenceSummary ? (
              <div>
                <dt className="text-xs text-zinc-500">Evidence</dt>
                <dd className="text-xs leading-relaxed text-zinc-400">{meta.provenance.evidenceSummary}</dd>
              </div>
            ) : null}
            {meta.provenance?.limitedEvidence ? (
              <p className="text-xs text-amber-300/90">
                Limited evidence available for this node. Review metadata and relationships manually.
              </p>
            ) : null}
          </dl>
        </section>
        <Separator className="bg-zinc-800" />
        <section className="space-y-2">
          <h3 className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            <Sparkles className="size-3" />
            AI explanation
          </h3>
          {aiExplanationLoading ? (
            <p className="text-xs text-zinc-500">Generating explanation...</p>
          ) : aiExplanation ? (
            <p className="text-xs leading-relaxed text-zinc-300">{aiExplanation}</p>
          ) : aiExplanationError ? (
            <p className="text-xs text-amber-300/90">{aiExplanationError}</p>
          ) : (
            <p className="text-xs text-zinc-500">Using deterministic details only for now.</p>
          )}
          <p className="text-[11px] text-zinc-500">
            Generated text is assistive. Deterministic graph data remains the source of truth.
          </p>
        </section>
        <Separator className="bg-zinc-800" />
        <section className="space-y-2">
          <h3 className="text-[10px] font-semibold uppercase tracking-wide text-zinc-500">
            Connected nodes
          </h3>
          {connections.length === 0 ? (
            <p className="text-xs text-zinc-500">No relationships for this item.</p>
          ) : (
            <ul className="space-y-1.5">
              {connections.map((c) => (
                <li
                  key={c.edgeId}
                  className="flex gap-2 rounded-lg border border-zinc-800 bg-zinc-900/50 px-2 py-1.5 text-xs leading-snug"
                >
                  <span className="shrink-0 font-mono text-zinc-500" aria-hidden>
                    {c.direction === "out" ? "→" : "←"}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="font-medium text-zinc-100">{c.otherLabel}</span>
                    <span className="block text-zinc-500">{c.relation}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

function GraphToolbar({
  graphRef,
  onResetSelection,
  showAllLinkLabels,
  onToggleLinkLabels,
  showDerivedLinks,
  onToggleDerivedLinks,
}: {
  graphRef: React.RefObject<KnowledgeGraphHandle | null>;
  onResetSelection: () => void;
  showAllLinkLabels: boolean;
  onToggleLinkLabels: () => void;
  showDerivedLinks: boolean;
  onToggleDerivedLinks: () => void;
}) {
  return (
    <div className={cn(floatingBarClass)}>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="size-8 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50"
        onClick={() => graphRef.current?.zoomToFit()}
        title="Fit graph"
      >
        <Maximize2 className="size-3.5" />
      </Button>
      <Button
        type="button"
        size="icon-sm"
        variant="ghost"
        className="size-8 text-zinc-300 hover:bg-zinc-800 hover:text-zinc-50"
        onClick={onResetSelection}
        title="Clear selection & fit"
      >
        <RotateCcw className="size-3.5" />
      </Button>
      <Separator orientation="vertical" className="mx-0.5 h-5 bg-zinc-700" />
      <Button
        type="button"
        size="sm"
        variant={showAllLinkLabels ? "secondary" : "ghost"}
        className="h-8 gap-1 px-2 text-xs font-medium text-zinc-300"
        onClick={onToggleLinkLabels}
        title={showAllLinkLabels ? "Hide link labels" : "Show link labels (hover still works)"}
      >
        <Tags className="size-3.5" />
        Links
      </Button>
      <Button
        type="button"
        size="sm"
        variant={showDerivedLinks ? "secondary" : "ghost"}
        className="h-8 px-2 text-xs font-medium text-zinc-300"
        onClick={onToggleDerivedLinks}
        title="Toggle layout helper links (dashed)"
      >
        Layout
      </Button>
    </div>
  );
}

function GraphLegend() {
  const legendTypes = ["email", "account", "social_account", "subscription", "identity_profile"] as const;
  return (
    <div className="pointer-events-auto w-[min(20rem,calc(100vw-1.5rem))] space-y-2 rounded-xl border border-zinc-700/70 bg-zinc-950/95 p-3 shadow-xl backdrop-blur-md">
      <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-zinc-400">
        <Info className="size-3.5" />
        How to read this graph
      </div>
      <div className="space-y-1.5 text-xs text-zinc-300">
        {legendTypes.map((type) => (
          <div key={type} className="flex items-center gap-2">
            <span className="size-2.5 rounded-full" style={{ backgroundColor: forceNodeFill(type) }} />
            <span>{humanizeVaultType(type)}</span>
          </div>
        ))}
      </div>
      <Separator className="bg-zinc-800" />
      <div className="space-y-1 text-[11px] text-zinc-400">
        <p>Solid lines are real vault relationships.</p>
        <p>Dashed lines are layout helpers so related email clusters stay readable.</p>
        <p>Hover links, or use the Links toggle, to view relationship labels.</p>
      </div>
    </div>
  );
}

function GraphWorkspace({
  payload,
  typeFilter,
  onTypeFilterChange,
  providerFilter,
  onProviderFilterChange,
  providerOptions,
  search,
  onSearchChange,
  selectedId,
  onSelectId,
  selectedNode,
  connectionSummary,
  aiExplanation,
  aiExplanationLoading,
  aiExplanationError,
  emptyVault,
}: {
  payload: GraphPayload;
  typeFilter: "all" | z.infer<typeof vaultItemTypeSchema>;
  onTypeFilterChange: (v: "all" | z.infer<typeof vaultItemTypeSchema>) => void;
  providerFilter: string;
  onProviderFilterChange: (v: string) => void;
  providerOptions: string[];
  search: string;
  onSearchChange: (v: string) => void;
  selectedId: string | null;
  onSelectId: (id: string | null) => void;
  selectedNode: GraphNodePayload | null;
  connectionSummary: {
    edgeId: string;
    otherLabel: string;
    relation: string;
    direction: "out" | "in";
  }[];
  aiExplanation: string | null;
  aiExplanationLoading: boolean;
  aiExplanationError: string | null;
  emptyVault: boolean;
}) {
  const graphRef = useRef<KnowledgeGraphHandle | null>(null);
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(() => payload.nodes.length < 18);
  const [showAllLinkLabels, setShowAllLinkLabels] = useState(false);
  const [showDerivedLinks, setShowDerivedLinks] = useState(true);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    const nodesFiltered = payload.nodes.filter((n) => {
      if (typeFilter !== "all" && n.type !== typeFilter) return false;
      if (providerFilter && (n.provider ?? "").toLowerCase() !== providerFilter.toLowerCase()) return false;
      if (q && !n.label.toLowerCase().includes(q)) return false;
      return true;
    });
    const ids = new Set(nodesFiltered.map((n) => n.id));
    const edgesFiltered = payload.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
    return { nodesFiltered, edgesFiltered };
  }, [payload, typeFilter, providerFilter, search]);

  const layoutKey = useMemo(() => {
    if (emptyVault) return "empty";
    const ids = filtered.nodesFiltered.map((n) => n.id).sort().join("\0");
    return `${typeFilter}\0${search}\0${ids}`;
  }, [emptyVault, filtered.nodesFiltered, typeFilter, search]);

  const graphData = useMemo(() => {
    const nodes: FGNode[] = filtered.nodesFiltered.map((n) => ({
      ...n,
      id: n.id,
      val: forceNodeVal(n.type),
    }));
    jitterGraphSeeds(nodes);
    const vaultLinks: FGLink[] = filtered.edgesFiltered.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      label: e.label,
      kind: "vault",
    }));
    const allLinks = appendGlobalEmailAnchorLinks(nodes, appendCohesionEmailLinks(nodes, vaultLinks));
    const links = showDerivedLinks ? allLinks : allLinks.filter((l) => l.kind === "vault");
    return { nodes, links };
  }, [filtered, showDerivedLinks]);

  const highlightIds = useMemo(() => {
    const s = new Set<string>();
    const focusId = selectedId ?? hoveredNodeId;
    if (!focusId) return s;
    s.add(focusId);
    for (const id of neighborIdSet(focusId, filtered.edgesFiltered)) s.add(id);
    return s;
  }, [selectedId, hoveredNodeId, filtered.edgesFiltered]);

  const dimUnrelated = highlightIds.size > 0;

  const handleSearchKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key !== "Enter") return;
      const list = filtered.nodesFiltered;
      if (list.length === 0) return;
      const q = search.trim().toLowerCase();
      const exact = list.find((n) => n.label.toLowerCase() === q);
      const pick = exact ?? list[0]!;
      onSelectId(pick.id);
      requestAnimationFrame(() => {
        graphRef.current?.centerOnNode(pick.id);
      });
    },
    [filtered.nodesFiltered, onSelectId, search],
  );

  const resetView = useCallback(() => {
    onSelectId(null);
    setHoveredNodeId(null);
    requestAnimationFrame(() => graphRef.current?.zoomToFit());
  }, [onSelectId]);

  return (
    <div className="relative h-full min-h-0 w-full bg-[#0c0c0f]">
      {!emptyVault ? (
        <VaultKnowledgeGraphCanvas
          ref={graphRef}
          graphData={graphData}
          layoutKey={layoutKey}
          selectedId={selectedId}
          hoveredNodeId={hoveredNodeId}
          onHoverNode={setHoveredNodeId}
          onSelectId={onSelectId}
          highlightIds={highlightIds}
          dimUnrelated={dimUnrelated}
          showAllLinkLabels={showAllLinkLabels}
        />
      ) : null}

      <div className="pointer-events-none absolute inset-0 flex flex-col">
        <div className="pointer-events-auto flex shrink-0 items-start justify-between gap-2 p-2 sm:p-3">
          <div className="flex flex-col gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="w-fit gap-1 rounded-full border-zinc-700 bg-zinc-950/90 text-zinc-200 backdrop-blur-md hover:bg-zinc-900"
              onClick={() => setFiltersOpen((v) => !v)}
            >
              {filtersOpen ? (
                <ChevronLeft className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
              Filters
            </Button>
            {filtersOpen ? (
              <div
                className={cn(
                  "w-[min(18rem,calc(100vw-1.5rem))] space-y-3 rounded-xl border border-zinc-700/70 bg-zinc-950/95 p-3 shadow-xl backdrop-blur-md",
                )}
              >
                <div className="space-y-1.5">
                  <Label htmlFor="graph-type-filter" className="text-xs text-zinc-400">
                    Item type
                  </Label>
                  <select
                    id="graph-type-filter"
                    value={typeFilter}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "all") onTypeFilterChange("all");
                      else onTypeFilterChange(v as z.infer<typeof vaultItemTypeSchema>);
                    }}
                    className={cn(
                      "h-8 w-full rounded-lg border border-zinc-700 bg-zinc-900/80 px-2.5 text-sm text-zinc-100 outline-none",
                      "focus-visible:border-sky-500/60 focus-visible:ring-2 focus-visible:ring-sky-500/30",
                    )}
                  >
                    <option value="all">All types</option>
                    {VAULT_ITEM_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {humanizeVaultType(t)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="graph-search" className="text-xs text-zinc-400">
                    Search — Enter to focus
                  </Label>
                  <Input
                    id="graph-search"
                    placeholder="Filter or jump to node…"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    onKeyDown={handleSearchKeyDown}
                    autoComplete="off"
                    className="h-8 border-zinc-700 bg-zinc-900/80 text-zinc-100 placeholder:text-zinc-600"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="graph-provider-filter" className="text-xs text-zinc-400">
                    Provider
                  </Label>
                  <select
                    id="graph-provider-filter"
                    value={providerFilter}
                    onChange={(e) => onProviderFilterChange(e.target.value)}
                    className={cn(
                      "h-8 w-full rounded-lg border border-zinc-700 bg-zinc-900/80 px-2.5 text-sm text-zinc-100 outline-none",
                      "focus-visible:border-sky-500/60 focus-visible:ring-2 focus-visible:ring-sky-500/30",
                    )}
                  >
                    <option value="">All providers</option>
                    {providerOptions.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="rounded-md border border-zinc-800 bg-zinc-900/60 px-2 py-1.5 text-[11px] text-zinc-400">
                  Tip: press Enter in search to jump to a matching node.
                </div>
              </div>
            ) : null}
            <GraphLegend />
          </div>

          <div className="flex max-h-[calc(100%-0.5rem)] flex-col items-end gap-2 overflow-y-auto">
            <GraphToolbar
              graphRef={graphRef}
              onResetSelection={resetView}
              showAllLinkLabels={showAllLinkLabels}
              onToggleLinkLabels={() => setShowAllLinkLabels((v) => !v)}
              showDerivedLinks={showDerivedLinks}
              onToggleDerivedLinks={() => setShowDerivedLinks((v) => !v)}
            />
            {selectedNode ? (
              <div className="pointer-events-auto">
                <SelectedNodeFloatingPanel
                  node={selectedNode}
                  connections={connectionSummary}
                  aiExplanation={aiExplanation}
                  aiExplanationLoading={aiExplanationLoading}
                  aiExplanationError={aiExplanationError}
                  onClose={() => onSelectId(null)}
                />
              </div>
            ) : null}
          </div>
        </div>

        {emptyVault ? (
          <div className="pointer-events-auto mt-auto flex justify-center p-6">
            <div
              className={cn(
                "max-w-xl space-y-3 px-4 py-4 text-center text-sm text-zinc-300",
                "rounded-xl border border-zinc-800 bg-zinc-950/90 backdrop-blur-md",
              )}
            >
              <p className="text-sm font-medium text-zinc-100">Your graph appears after a quick ingestion flow.</p>
              <p className="text-xs text-zinc-400">
                Add your email anchor, connect Gmail, scan, then approve candidates. Approved items become nodes and relationships here.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-2">
                <Button size="sm" nativeButton={false} render={<Link href="/vault" />}>
                  Go to Vault ingestion
                </Button>
                <Button size="sm" variant="outline" nativeButton={false} render={<Link href="/dashboard" />}>
                  Open dashboard
                </Button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function GraphPageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col bg-[#08080a] text-zinc-100">{children}</div>
  );
}

export function VaultGraphView() {
  const [payload, setPayload] = useState<GraphPayload | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState<"all" | z.infer<typeof vaultItemTypeSchema>>("all");
  const [providerFilter, setProviderFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [aiExplanation, setAiExplanation] = useState<string | null>(null);
  const [aiExplanationError, setAiExplanationError] = useState<string | null>(null);
  const [aiExplanationLoading, setAiExplanationLoading] = useState(false);

  const loadGraph = useCallback(async (quiet?: boolean) => {
    if (!quiet) {
      setLoading(true);
      setLoadError(null);
    }
    try {
      const res = await fetch("/api/graph", { credentials: "same-origin" });
      if (!res.ok) {
        if (!quiet) {
          setLoadError(
            res.status === 401 ? "You need to be signed in to view the graph." : "Could not load graph.",
          );
          setPayload(null);
        }
        return;
      }
      const data = (await res.json()) as GraphPayload;
      setPayload({
        overview: data.overview ?? {
          totalNodes: 0,
          totalEdges: 0,
          accountCount: 0,
          subscriptionCount: 0,
          emailCount: 0,
          distinctProviders: 0,
          highFragmentationClusters: [],
        },
        nodes: data.nodes ?? [],
        edges: data.edges ?? [],
      });
      if (quiet) setLoadError(null);
    } catch {
      if (!quiet) setLoadError("Could not load graph.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGraph();
  }, [loadGraph]);

  useEffect(() => {
    const onVaultChanged = () => {
      void loadGraph(true);
    };
    window.addEventListener(VAULT_DATA_CHANGED_EVENT, onVaultChanged);
    return () => window.removeEventListener(VAULT_DATA_CHANGED_EVENT, onVaultChanged);
  }, [loadGraph]);

  const selectedNode = useMemo(() => {
    if (!payload || !selectedId) return null;
    return payload.nodes.find((n) => n.id === selectedId) ?? null;
  }, [payload, selectedId]);

  const connectionSummary = useMemo(() => {
    if (!payload || !selectedId) return [];
    return payload.edges
      .filter((e) => e.source === selectedId || e.target === selectedId)
      .map((e) => {
        const outgoing = e.source === selectedId;
        const otherId = outgoing ? e.target : e.source;
        const other = payload.nodes.find((n) => n.id === otherId);
        return {
          edgeId: e.id,
          otherLabel: other?.label ?? otherId,
          relation: e.label,
          direction: outgoing ? ("out" as const) : ("in" as const),
        };
      })
      .sort((a, b) => {
        const rank = (d: "out" | "in") => (d === "out" ? 0 : 1);
        const byDir = rank(a.direction) - rank(b.direction);
        if (byDir !== 0) return byDir;
        return a.otherLabel.localeCompare(b.otherLabel);
      });
  }, [payload, selectedId]);

  useEffect(() => {
    if (!selectedNode) {
      setAiExplanation(null);
      setAiExplanationError(null);
      setAiExplanationLoading(false);
      return;
    }

    const ctrl = new AbortController();
    setAiExplanation(null);
    setAiExplanationError(null);
    setAiExplanationLoading(true);

    fetch("/api/graph/explain", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      signal: ctrl.signal,
      body: JSON.stringify({
        node: selectedNode,
        connections: connectionSummary.slice(0, 8),
      }),
    })
      .then(async (res) => {
        const data = (await res.json().catch(() => ({}))) as { explanation?: string; error?: string };
        if (!res.ok) {
          setAiExplanationError(data.error ?? "AI explanation unavailable. Showing deterministic details.");
          return;
        }
        if (typeof data.explanation === "string" && data.explanation.trim().length > 0) {
          setAiExplanation(data.explanation.trim());
          return;
        }
        setAiExplanationError("AI explanation unavailable. Showing deterministic details.");
      })
      .catch((error: unknown) => {
        if (error instanceof Error && error.name === "AbortError") return;
        setAiExplanationError("AI explanation request failed. Showing deterministic details.");
      })
      .finally(() => {
        setAiExplanationLoading(false);
      });

    return () => ctrl.abort();
  }, [selectedNode, connectionSummary]);

  const visibleIds = useMemo(() => {
    if (!payload) return new Set<string>();
    const q = search.trim().toLowerCase();
    return new Set(
      payload.nodes
        .filter((n) => {
          if (typeFilter !== "all" && n.type !== typeFilter) return false;
          if (providerFilter && (n.provider ?? "").toLowerCase() !== providerFilter.toLowerCase()) return false;
          if (q && !n.label.toLowerCase().includes(q)) return false;
          return true;
        })
        .map((n) => n.id),
    );
  }, [payload, typeFilter, providerFilter, search]);

  const providerOptions = useMemo(() => {
    if (!payload) return [];
    return [...new Set(payload.nodes.map((n) => n.provider?.trim()).filter((p): p is string => Boolean(p)))].sort(
      (a, b) => a.localeCompare(b),
    );
  }, [payload]);

  useEffect(() => {
    if (selectedId && !visibleIds.has(selectedId)) {
      setSelectedId(null);
    }
  }, [selectedId, visibleIds]);

  if (loading) {
    return (
      <GraphPageShell>
        <div className="flex flex-1 flex-col gap-4 p-6">
          <Skeleton className="h-8 w-64 bg-zinc-800" />
          <Skeleton className="min-h-0 flex-1 rounded-none bg-zinc-900" />
        </div>
      </GraphPageShell>
    );
  }

  if (loadError) {
    return (
      <GraphPageShell>
        <div className="flex flex-1 items-center justify-center p-6">
          <Card className="max-w-md border-red-900/40 bg-zinc-950">
            <CardHeader>
              <CardTitle className="text-zinc-100">Graph unavailable</CardTitle>
              <CardDescription className="text-zinc-400">{loadError}</CardDescription>
            </CardHeader>
          </Card>
        </div>
      </GraphPageShell>
    );
  }

  if (!payload) {
    return null;
  }

  const emptyVault = payload.nodes.length === 0;

  return (
    <GraphPageShell>
      <div className="flex flex-col gap-2 border-b border-zinc-800/70 bg-zinc-950/90 px-3 py-2 text-xs text-zinc-300">
        <div className="flex flex-wrap items-center gap-3">
          <span>Nodes: {payload.overview.totalNodes}</span>
          <span>Edges: {payload.overview.totalEdges}</span>
          <span>Accounts: {payload.overview.accountCount}</span>
          <span>Subscriptions: {payload.overview.subscriptionCount}</span>
          <span>Emails: {payload.overview.emailCount}</span>
          <span>Providers: {payload.overview.distinctProviders}</span>
        </div>
        {payload.overview.highFragmentationClusters.length > 0 ? (
          <div className="truncate text-zinc-400">
            Fragmented providers:{" "}
            {payload.overview.highFragmentationClusters
              .slice(0, 3)
              .map((c) => `${c.provider} (${c.emailCount} emails)`)
              .join(" · ")}
          </div>
        ) : null}
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <GraphWorkspace
          payload={payload}
          typeFilter={typeFilter}
          onTypeFilterChange={setTypeFilter}
          providerFilter={providerFilter}
          onProviderFilterChange={setProviderFilter}
          providerOptions={providerOptions}
          search={search}
          onSearchChange={setSearch}
          selectedId={selectedId}
          onSelectId={setSelectedId}
          selectedNode={selectedNode}
          connectionSummary={connectionSummary}
          aiExplanation={aiExplanation}
          aiExplanationLoading={aiExplanationLoading}
          aiExplanationError={aiExplanationError}
          emptyVault={emptyVault}
        />
      </div>
    </GraphPageShell>
  );
}
