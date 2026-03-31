/**
 * Muted colors for force-graph nodes on a dark canvas (Obsidian-adjacent).
 */
export const FORCE_GRAPH_BG = "#0c0c0f";
export const FORCE_GRAPH_LINK_DIM = "rgba(110, 120, 145, 0.18)";
export const FORCE_GRAPH_LINK_HI = "rgba(185, 195, 220, 0.45)";

const TYPE_CUSTOM = "#718096";

const TYPE_FILL: Record<string, string> = {
  email: "#5b9bd5",
  account: "#9f7aea",
  social_account: "#ed64a6",
  subscription: "#d69e2e",
  device: "#48bb78",
  file_reference: "#a0aec0",
  payment_method_reference: "#38b2ac",
  credential_reference: "#dd6b20",
  identity_profile: "#667eea",
  custom: "#718096",
};

export function forceNodeFill(type: string): string {
  return TYPE_FILL[type] ?? TYPE_CUSTOM;
}

/** Simulation mass / default size hint — keep emails lighter so they cluster instead of repelling into rings. */
export function forceNodeVal(type: string): number {
  if (type === "email") return 5;
  if (type === "account" || type === "social_account" || type === "identity_profile") return 12;
  if (type === "subscription") return 7;
  return 5;
}

/** Pixel radius at scale 1 (before globalScale in canvas). */
export function forceNodeRadius(type: string): number {
  if (type === "email") return 10;
  if (type === "account" || type === "social_account" || type === "identity_profile") return 7.5;
  if (type === "subscription") return 6;
  return 5;
}

export function truncateGraphLabel(label: string, max: number): string {
  const t = label.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}
