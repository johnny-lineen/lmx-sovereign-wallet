"use client";

import dynamic from "next/dynamic";
import { useMemo, useState } from "react";

import { buildVaultForceGraphModel } from "@/components/graph/build-vault-force-graph-model";
import { LANDING_DEMO_GRAPH_PAYLOAD } from "@/lib/landing-demo-graph-payload";
import { cn } from "@/lib/utils";

const VaultKnowledgeGraphCanvas = dynamic(
  () => import("@/components/graph/vault-knowledge-graph-canvas").then((m) => m.VaultKnowledgeGraphCanvas),
  {
    ssr: false,
    loading: () => <div className="h-full min-h-[360px] w-full animate-pulse bg-[#0c0c0f]" />,
  },
);

const emptyHighlight = new Set<string>();

export function LandingDemoGraph({ className }: { className?: string }) {
  const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);

  const graphData = useMemo(
    () =>
      buildVaultForceGraphModel({
        nodes: LANDING_DEMO_GRAPH_PAYLOAD.nodes,
        edges: LANDING_DEMO_GRAPH_PAYLOAD.edges,
        anchorEmailNodeId: LANDING_DEMO_GRAPH_PAYLOAD.overview.anchorEmailNodeId,
        showDerivedLinks: false,
      }),
    [],
  );

  return (
    <div className={cn("space-y-2", className)}>
      <p className="text-center text-xs text-slate-500 sm:text-left">
        Illustrative vault graph — sign in to map your own data.
      </p>
      <div
        className={cn(
          "overflow-hidden rounded-xl border border-white/[0.08] bg-[#0c0c0f]",
          "min-h-[360px] h-[400px] sm:h-[460px] lg:h-[500px]",
        )}
      >
        <VaultKnowledgeGraphCanvas
          graphData={graphData}
          layoutKey="landing-demo"
          selectedId={null}
          hoveredNodeId={hoveredNodeId}
          onHoverNode={setHoveredNodeId}
          onSelectId={() => {}}
          highlightIds={emptyHighlight}
          dimUnrelated={false}
          insightDimActive={false}
          insightHighlightIds={emptyHighlight}
          showAllLinkLabels={false}
        />
      </div>
    </div>
  );
}
