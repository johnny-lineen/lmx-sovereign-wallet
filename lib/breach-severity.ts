export type BreachSeverity = "high" | "medium" | "low";

function normalizeDataClass(value: string): string {
  return value.trim().toLowerCase();
}

function hasDataClass(dataClasses: string[], ...targets: string[]): boolean {
  const normalized = new Set(dataClasses.map(normalizeDataClass));
  return targets.some((t) => normalized.has(normalizeDataClass(t)));
}

export function breachSeverityFromDataClasses(dataClasses: string[]): BreachSeverity {
  if (hasDataClass(dataClasses, "Passwords", "SSN")) {
    return "high";
  }
  if (hasDataClass(dataClasses, "Email addresses", "Phone numbers")) {
    return "medium";
  }
  return "low";
}

export function breachSeverityClass(severity: BreachSeverity): string {
  switch (severity) {
    case "high":
      return "border-destructive/25 bg-destructive/10 text-red-300";
    case "medium":
      return "border-amber-500/30 bg-amber-500/10 text-amber-200";
    default:
      return "border-white/[0.08] bg-white/[0.04] text-slate-400";
  }
}
