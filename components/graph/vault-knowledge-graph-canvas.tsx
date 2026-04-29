"use client";

import { forceCollide, forceX, forceY } from "d3-force-3d";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState,
} from "react";
import ForceGraph2D, { type ForceGraphMethods, type GraphData } from "react-force-graph-2d";

import type { GraphNodePayload } from "@/lib/graph-payload";

import {
  FORCE_GRAPH_BG,
  FORCE_GRAPH_LINK_DIM,
  FORCE_GRAPH_LINK_HI,
  FORCE_GRAPH_LINK_HOVER,
  forceNodeFill,
  forceNodeRadius,
  truncateGraphLabel,
} from "./vault-graph-force-palette";

export type FGNode = GraphNodePayload & {
  id: string;
  val: number;
  graphDegree: number;
  layoutTx: number;
  layoutTy: number;
  isLayoutAnchor?: boolean;
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
};

export type FGLink = {
  id: string;
  source: string;
  target: string;
  label: string;
  /** Derived layout-only ties between emails that share a neighbor. */
  kind?: "vault" | "cohesion";
};

function isDerivedCohesionLink(l: FGLink): boolean {
  return l.kind === "cohesion";
}

export type KnowledgeGraphHandle = {
  centerOnNode: (id: string) => void;
  zoomToFit: () => void;
};

type Props = {
  graphData: GraphData<FGNode, FGLink>;
  layoutKey: string;
  selectedId: string | null;
  hoveredNodeId: string | null;
  onHoverNode: (id: string | null) => void;
  onSelectId: (id: string | null) => void;
  highlightIds: Set<string>;
  /** When true, nodes/links outside highlightIds are dimmed (selection / hover). */
  dimUnrelated: boolean;
  /** When true, dim nodes not in insightHighlightIds. */
  insightDimActive: boolean;
  insightHighlightIds: Set<string>;
  showAllLinkLabels: boolean;
};

function endpointId(
  id: string | number | { id?: string | number },
): string {
  if (typeof id === "object" && id !== null && "id" in id && id.id !== undefined) {
    return String(id.id);
  }
  return String(id);
}

const LABEL_ZOOM_EMAIL = 0.28;
const LABEL_ZOOM_OTHER = 0.85;

const VaultKnowledgeGraphCanvasInner = forwardRef<KnowledgeGraphHandle, Props>(function VaultKnowledgeGraphCanvas(
  {
    graphData,
    layoutKey,
    selectedId,
    hoveredNodeId,
    onHoverNode,
    onSelectId,
    highlightIds,
    dimUnrelated,
    insightDimActive,
    insightHighlightIds,
    showAllLinkLabels,
  },
  ref,
) {
  const fgRef = useRef<ForceGraphMethods<FGNode, FGLink> | undefined>(undefined);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [dims, setDims] = useState({ width: 800, height: 600 });
  const dataRef = useRef(graphData);
  const hasFittedRef = useRef(false);
  const layoutKeyRef = useRef(layoutKey);
  const [hoveredLinkId, setHoveredLinkId] = useState<string | null>(null);

  useEffect(() => {
    dataRef.current = graphData;
  }, [graphData]);

  useEffect(() => {
    if (layoutKeyRef.current !== layoutKey) {
      layoutKeyRef.current = layoutKey;
      hasFittedRef.current = false;
    }
  }, [layoutKey]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      setDims({ width: el.clientWidth, height: el.clientHeight });
    });
    ro.observe(el);
    setDims({ width: el.clientWidth, height: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;

    const link = fg.d3Force("link") as {
      distance?: (arg: number | ((l: FGLink) => number)) => unknown;
      strength?: (arg: number | ((l: FGLink) => number)) => unknown;
    } | null;
    if (link?.distance && link?.strength) {
      link.distance((l: FGLink) => (l.kind === "cohesion" ? 22 : 62));
      link.strength((l: FGLink) => (l.kind === "cohesion" ? 0.45 : 0.38));
    }

    const charge = fg.d3Force("charge") as {
      strength?: (arg: number | ((n: FGNode) => number)) => unknown;
    } | null;
    if (charge?.strength) {
      charge.strength((n: FGNode) => (n.type === "email" ? -28 : -92));
    }

    const collide = forceCollide((n: FGNode) => forceNodeRadius(n.type, n.graphDegree) + 26);
    collide.strength(0.92);
    collide.iterations(3);
    fg.d3Force("collide", collide);

    const xForce = forceX((n: FGNode) => n.layoutTx ?? 0);
    xForce.strength((n: FGNode) => (n.isLayoutAnchor ? 0 : 0.28));
    fg.d3Force("x", xForce);

    const yForce = forceY((n: FGNode) => n.layoutTy ?? 0);
    yForce.strength((n: FGNode) => (n.isLayoutAnchor ? 0 : 0.28));
    fg.d3Force("y", yForce);
  }, [graphData.nodes.length, dims.width, dims.height]);

  useImperativeHandle(
    ref,
    () => ({
      centerOnNode: (id: string) => {
        const fg = fgRef.current;
        const node = dataRef.current.nodes.find((n) => n.id === id);
        if (!fg || !node || node.x === undefined || node.y === undefined) return;
        fg.centerAt(node.x, node.y, 450);
        fg.zoom(2.4, 450);
      },
      zoomToFit: () => {
        fgRef.current?.zoomToFit(400, 120, (n) => Boolean(n.id));
      },
    }),
    [],
  );

  const nodeDimPredicate = useCallback(
    (nodeId: string) => {
      const insightOn = insightDimActive && insightHighlightIds.size > 0;
      if (insightOn) return !insightHighlightIds.has(nodeId);
      if (dimUnrelated && highlightIds.size > 0) return !highlightIds.has(nodeId);
      return false;
    },
    [insightDimActive, insightHighlightIds, dimUnrelated, highlightIds],
  );

  const linkHiPredicate = useCallback(
    (a: string, b: string) => {
      const insightOn = insightDimActive && insightHighlightIds.size > 0;
      if (insightOn) return insightHighlightIds.has(a) && insightHighlightIds.has(b);
      if (dimUnrelated && highlightIds.size > 0) return highlightIds.has(a) && highlightIds.has(b);
      return false;
    },
    [insightDimActive, insightHighlightIds, dimUnrelated, highlightIds],
  );

  const shouldDrawLabel = useCallback(
    (node: FGNode, globalScale: number) => {
      if (node.id === selectedId || node.id === hoveredNodeId) return true;
      if (node.type === "email") return globalScale >= LABEL_ZOOM_EMAIL;
      return globalScale >= LABEL_ZOOM_OTHER;
    },
    [selectedId, hoveredNodeId],
  );

  const nodeCanvasObject = useCallback(
    (node: FGNode, ctx: CanvasRenderingContext2D, globalScale: number) => {
      if (node.x === undefined || node.y === undefined) return;
      const r = forceNodeRadius(node.type, node.graphDegree);
      const dim = nodeDimPredicate(node.id);
      const fill = forceNodeFill(node.type);

      ctx.save();
      ctx.globalAlpha = dim ? 0.2 : 1;

      ctx.beginPath();
      ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
      ctx.fillStyle = fill;
      ctx.fill();

      if (node.id === selectedId) {
        ctx.lineWidth = 2 / globalScale;
        ctx.strokeStyle = "rgba(255,255,255,0.85)";
        ctx.stroke();
      } else if (node.id === hoveredNodeId) {
        ctx.lineWidth = 1.5 / globalScale;
        ctx.strokeStyle = "rgba(255,255,255,0.5)";
        ctx.stroke();
      }

      if (shouldDrawLabel(node, globalScale)) {
        const fontSize = Math.max(10, 11 / globalScale);
        ctx.font = `${fontSize}px ui-sans-serif, system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillStyle = dim ? "rgba(160,165,180,0.35)" : "rgba(200,205,220,0.82)";
        const text = truncateGraphLabel(node.label, node.type === "email" ? 36 : 28);
        ctx.fillText(text, node.x, node.y + r + 3 / globalScale);
      }

      ctx.restore();
    },
    [nodeDimPredicate, shouldDrawLabel, selectedId, hoveredNodeId],
  );

  const nodePointerAreaPaint = useCallback((node: FGNode, color: string, ctx: CanvasRenderingContext2D) => {
    if (node.x === undefined || node.y === undefined) return;
    const r = forceNodeRadius(node.type, node.graphDegree) + 6;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
    ctx.fill();
  }, []);

  const linkColor = useCallback(
    (link: object) => {
      const l = link as FGLink & { source: unknown; target: unknown; id?: string };
      const id = String(l.id ?? "");
      if (hoveredLinkId && id === hoveredLinkId) {
        return isDerivedCohesionLink(l) ? "rgba(170, 185, 215, 0.45)" : FORCE_GRAPH_LINK_HOVER;
      }
      const base = isDerivedCohesionLink(l) ? "rgba(95, 105, 130, 0.1)" : FORCE_GRAPH_LINK_DIM;
      const a = endpointId(l.source as string);
      const b = endpointId(l.target as string);
      const anyDim = (insightDimActive && insightHighlightIds.size > 0) || (dimUnrelated && highlightIds.size > 0);
      if (!anyDim) return base;
      const hi = linkHiPredicate(a, b);
      if (hi) return isDerivedCohesionLink(l) ? "rgba(150, 165, 195, 0.28)" : FORCE_GRAPH_LINK_HI;
      return "rgba(70, 78, 100, 0.07)";
    },
    [hoveredLinkId, insightDimActive, insightHighlightIds, dimUnrelated, highlightIds, linkHiPredicate],
  );

  const linkLabel = useCallback(
    (link: object) => {
      const l = link as FGLink & { id?: string };
      const id = String(l.id ?? "");
      if (showAllLinkLabels) return l.label;
      if (hoveredLinkId && id === hoveredLinkId) return l.label;
      return "";
    },
    [showAllLinkLabels, hoveredLinkId],
  );

  const linkWidth = useCallback(
    (link: object) => {
      const l = link as FGLink & { source: unknown; target: unknown; id?: string };
      const id = String(l.id ?? "");
      const w = isDerivedCohesionLink(l) ? 0.22 : 0.32;
      const hiW = isDerivedCohesionLink(l) ? 0.48 : 1.35;
      const hoverW = isDerivedCohesionLink(l) ? 0.65 : 1.65;
      if (hoveredLinkId && id === hoveredLinkId) return hoverW;
      const a = endpointId(l.source as string);
      const b = endpointId(l.target as string);
      const anyDim = (insightDimActive && insightHighlightIds.size > 0) || (dimUnrelated && highlightIds.size > 0);
      if (!anyDim) return w;
      const hi = linkHiPredicate(a, b);
      return hi ? hiW : 0.28;
    },
    [hoveredLinkId, insightDimActive, insightHighlightIds, dimUnrelated, highlightIds, linkHiPredicate],
  );

  if (graphData.nodes.length === 0) {
    return (
      <div ref={containerRef} className="relative h-full min-h-[420px] w-full bg-[#0c0c0f]" />
    );
  }

  return (
    <div ref={containerRef} className="relative h-full min-h-[420px] w-full min-w-0 bg-[#0c0c0f]">
      <ForceGraph2D
        ref={fgRef}
        width={dims.width}
        height={dims.height}
        graphData={graphData}
        backgroundColor={FORCE_GRAPH_BG}
        nodeRelSize={4}
        nodeVal="val"
        nodeCanvasObjectMode={() => "replace"}
        nodeCanvasObject={nodeCanvasObject}
        nodePointerAreaPaint={nodePointerAreaPaint}
        linkColor={linkColor}
        linkWidth={linkWidth}
        linkLabel={linkLabel}
        onLinkHover={(link) => {
          const l = link as (FGLink & { id?: string }) | null;
          setHoveredLinkId(l?.id != null ? String(l.id) : null);
        }}
        linkLineDash={(link) => (isDerivedCohesionLink(link as FGLink) ? [3, 5] : null)}
        d3VelocityDecay={0.38}
        d3AlphaDecay={0.028}
        warmupTicks={96}
        cooldownTicks={640}
        onEngineStop={() => {
          if (!hasFittedRef.current) {
            hasFittedRef.current = true;
            fgRef.current?.zoomToFit(600, 120, (n) => Boolean(n.id));
          }
        }}
        onNodeClick={(node) => {
          onSelectId(node.id === selectedId ? null : String(node.id));
        }}
        onNodeHover={(node) => {
          onHoverNode(node ? String(node.id) : null);
        }}
        onBackgroundClick={() => {
          onSelectId(null);
          onHoverNode(null);
        }}
        enableNodeDrag={true}
        minZoom={0.25}
        maxZoom={8}
      />
    </div>
  );
});

VaultKnowledgeGraphCanvasInner.displayName = "VaultKnowledgeGraphCanvas";

export const VaultKnowledgeGraphCanvas = VaultKnowledgeGraphCanvasInner;
