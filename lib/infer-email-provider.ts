export type InferredProviderKey = "gmail" | "outlook" | "yahoo" | "proton" | "custom";

export function inferEmailProviderFromAddress(normalizedEmail: string): {
  key: InferredProviderKey;
  label: string;
} {
  const domain = normalizedEmail.split("@")[1]?.toLowerCase() ?? "";

  if (domain === "gmail.com" || domain === "googlemail.com") {
    return { key: "gmail", label: "Gmail" };
  }
  if (
    domain === "outlook.com" ||
    domain === "hotmail.com" ||
    domain === "live.com" ||
    domain === "msn.com"
  ) {
    return { key: "outlook", label: "Outlook" };
  }
  if (domain === "yahoo.com" || domain === "ymail.com") {
    return { key: "yahoo", label: "Yahoo" };
  }
  if (domain === "proton.me" || domain === "protonmail.com" || domain === "pm.me") {
    return { key: "proton", label: "Proton" };
  }

  return { key: "custom", label: "Custom" };
}
