/** Update contact email and operator name before production / store submission. */
export const LEGAL_CONFIG = {
  productName: "LMX Sovereign Wallet",
  operatorName: "LMX Sovereign Wallet",
  contactEmail:
    process.env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim() || "support@lmxsovereign.com",
  effectiveDate: "May 21, 2026",
} as const;

export const LEGAL_ROUTES = {
  privacy: "/privacy",
  terms: "/terms",
} as const;
