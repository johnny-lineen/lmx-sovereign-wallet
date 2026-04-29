/**
 * JSON shape returned by `GET /api/graph` (mirrors server graph service output).
 */
export type GraphMetadataPreview = {
  status: string;
  summary?: string;
  metadata?: Record<string, unknown>;
  provenance?: {
    source: string;
    confidence: number | null;
    evidenceSummary?: string;
    limitedEvidence?: boolean;
  };
};

export type GraphNodePayload = {
  id: string;
  label: string;
  type: string;
  provider: string | null;
  /** Always includes `status`; adds summary/metadata samples when useful. */
  metadataPreview: GraphMetadataPreview;
  /** Vault rows merged into this canonical node (1 = none merged). */
  mergeGroupSize: number;
  /** Present when item was imported from a public footprint audit run. */
  importedFromAuditRunId?: string | null;
};

export type GraphEdgePayload = {
  id: string;
  source: string;
  target: string;
  label: string;
};

export type GraphPayload = {
  overview: {
    totalNodes: number;
    totalEdges: number;
    accountCount: number;
    subscriptionCount: number;
    emailCount: number;
    distinctProviders: number;
    highFragmentationClusters: {
      provider: string;
      emailCount: number;
      accountLikeNodeCount: number;
    }[];
    /** Primary email vault node id for graph centering; null if no emails. */
    anchorEmailNodeId: string | null;
  };
  nodes: GraphNodePayload[];
  edges: GraphEdgePayload[];
};
