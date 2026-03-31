"use client";

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
  forceNodeFill,
  forceNodeRadius,
  truncateGraphLabel,
} from "./vault-graph-force-palette";

export type FGNode = GraphNodePayload & {
  id: string;
  val: number;
  x?: number;
  y?: number;
};

export type FGLink = {
  id: string;
  source: string;
  target: string;
  label: string;
  /** Derived layout-only ties: shared hub, or soft anchor so all emails stay in one tight cloud. */
  kind?: "vault" | "cohesion" | "cohesionGlobal";
};

function isDerivedCohesionLink(l: FGLink): boolean {
  return l.kind === "cohesion" || l.kind === "cohesionGlobal";
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
  /** When true, nodes/links outside highlightIds are dimmed. */
  dimUnrelated: boolean;
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
    // d3-force typings expect numeric distance; per-link accessors are supported at runtime.
    const link = fg.d3Force("link") as {
      distance?: (arg: number | ((l: FGLink) => number)) => unknown;
      strength?: (arg: number | ((l: FGLink) => number)) => unknown;
    } | null;
    if (link?.distance && link?.strength) {
      link.distance((l: FGLink) => {
        if (l.kind === "cohesionGlobal") return 26;
        if (l.kind === "cohesion") return 12;
        return 44;
      });
      link.strength((l: FGLink) => {
        if (l.kind === "cohesionGlobal") return 0.38;
        if (l.kind === "cohesion") return 0.72;
        return 0.54;
      });
    }
    const charge = fg.d3Force("charge") as {
      strength?: (arg: number | ((n: FGNode) => number)) => unknown;
    } | null;
    if (charge?.strength) {
      charge.strength((n: FGNode) => (n.type === "email" ? -8 : -74));
    }
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
        fgRef.current?.zoomToFit(400, 72, (n) => Boolean(n.id));
      },
    }),
    [],
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
      const r = forceNodeRadius(node.type);
      const dim = dimUnrelated && highlightIds.size > 0 && !highlightIds.has(node.id);
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
    [dimUnrelated, highlightIds, shouldDrawLabel, selectedId, hoveredNodeId],
  );

  const nodePointerAreaPaint = useCallback((node: FGNode, color: string, ctx: CanvasRenderingContext2D) => {
    if (node.x === undefined || node.y === undefined) return;
    const r = forceNodeRadius(node.type) + 6;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(node.x, node.y, r, 0, 2 * Math.PI, false);
    ctx.fill();
  }, []);

  const linkColor = useCallback(
    (link: object) => {
      const l = link as FGLink & { source: unknown; target: unknown };
      const base = isDerivedCohesionLink(l) ? "rgba(95, 105, 130, 0.12)" : FORCE_GRAPH_LINK_DIM;
      const a = endpointId(l.source as string);
      const b = endpointId(l.target as string);
      if (!dimUnrelated || highlightIds.size === 0) return base;
      const hi = highlightIds.has(a) && highlightIds.has(b);
      if (hi) return isDerivedCohesionLink(l) ? "rgba(150, 165, 195, 0.28)" : FORCE_GRAPH_LINK_HI;
      return "rgba(80, 88, 110, 0.09)";
    },
    [dimUnrelated, highlightIds],
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
      const l = link as FGLink & { source: unknown; target: unknown };
      const w = isDerivedCohesionLink(l) ? 0.28 : 0.55;
      const hiW = isDerivedCohesionLink(l) ? 0.55 : 1.25;
      const a = endpointId(l.source as string);
      const b = endpointId(l.target as string);
      if (!dimUnrelated || highlightIds.size === 0) return w;
      const hi = highlightIds.has(a) && highlightIds.has(b);
      return hi ? hiW : 0.35;
    },
    [dimUnrelated, highlightIds],
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
        d3VelocityDecay={0.28}
        d3AlphaDecay={0.022}
        warmupTicks={64}
        cooldownTicks={420}
        onEngineStop={() => {
          if (!hasFittedRef.current) {
            hasFittedRef.current = true;
            fgRef.current?.zoomToFit(600, 88, (n) => Boolean(n.id));
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
