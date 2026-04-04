/**
 * Graph node colors / sizing on dark canvas. Types follow strict visual language; size scales with degree.
 */
export const FORCE_GRAPH_BG = "#0c0c0f";
export const FORCE_GRAPH_LINK_DIM = "rgba(120, 132, 160, 0.22)";
export const FORCE_GRAPH_LINK_HI = "rgba(200, 210, 235, 0.55)";
export const FORCE_GRAPH_LINK_HOVER = "rgba(220, 228, 250, 0.72)";

const TYPE_CUSTOM = "#718096";

const TYPE_FILL: Record<string, string> = {
  email: "#3b82f6",
  account: "#9333ea",
  social_account: "#9333ea",
  identity_profile: "#9333ea",
  subscription: "#ea580c",
  device: "#22c55e",
  file_reference: "#a0aec0",
  payment_method_reference: "#eab308",
  credential_reference: "#dd6b20",
  custom: "#718096",
};

export function forceNodeFill(type: string): string {
  return TYPE_FILL[type] ?? TYPE_CUSTOM;
}

/** Degree scaling: modest spread so hubs read larger without breaking layout. */
function degreeScale(degree: number): number {
  const s = 1 + 0.2 * Math.log1p(Math.max(0, degree));
  return Math.min(2.15, Math.max(0.92, s));
}

const BASE_VAL: Record<string, number> = {
  email: 6,
  account: 11,
  social_account: 11,
  identity_profile: 11,
  subscription: 8,
  device: 4,
  file_reference: 4,
  payment_method_reference: 3.5,
  credential_reference: 4,
  custom: 4,
};

const BASE_RADIUS: Record<string, number> = {
  email: 11,
  account: 7.5,
  social_account: 7.5,
  identity_profile: 7.5,
  subscription: 6.5,
  device: 4.8,
  file_reference: 4.5,
  payment_method_reference: 4.2,
  credential_reference: 4.5,
  custom: 4.5,
};

export function forceNodeVal(type: string, degree = 0): number {
  const b = BASE_VAL[type] ?? BASE_VAL.custom!;
  return b * degreeScale(degree);
}

export function forceNodeRadius(type: string, degree = 0): number {
  const b = BASE_RADIUS[type] ?? BASE_RADIUS.custom!;
  return b * degreeScale(degree);
}

export function truncateGraphLabel(label: string, max: number): string {
  const t = label.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, Math.max(0, max - 1))}…`;
}
