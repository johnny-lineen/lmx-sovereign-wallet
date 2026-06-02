import { profileEmailSchema } from "@/lib/validations/import";
import { z } from "zod";

export const SCAN_WIZARD_STORAGE_KEY = "lmx_scan_wizard_config";

export const AGE_RANGE_OPTIONS = [
  { id: "18-24", label: "18–24" },
  { id: "25-34", label: "25–34" },
  { id: "35-44", label: "35–44" },
  { id: "45-54", label: "45–54" },
  { id: "55-64", label: "55–64" },
  { id: "65+", label: "65+" },
] as const;

export type AgeRangeId = (typeof AGE_RANGE_OPTIONS)[number]["id"];

export type ScanWizardConfig = {
  primaryEmail: string;
  aliasEmails: string[];
  firstName: string;
  lastName: string;
  cityState: string;
  ageRange: AgeRangeId | null;
  scans: {
    breachExposure: boolean;
    dataBrokerProfiles: boolean;
    accountFootprint: boolean;
  };
};

export const defaultScanWizardConfig = (): ScanWizardConfig => ({
  primaryEmail: "",
  aliasEmails: [],
  firstName: "",
  lastName: "",
  cityState: "",
  ageRange: null,
  scans: {
    breachExposure: true,
    dataBrokerProfiles: true,
    accountFootprint: true,
  },
});

const emailStepSchema = z.object({
  primaryEmail: profileEmailSchema,
  aliasEmails: z.array(profileEmailSchema),
});

const identityStepSchema = z.object({
  firstName: z.string().trim().min(1, "First name is required"),
  lastName: z.string().trim().min(1, "Last name is required"),
  cityState: z.string().trim().min(2, "City and state are required"),
  ageRange: z.enum(["18-24", "25-34", "35-44", "45-54", "55-64", "65+"]),
});

export function validateEmailStep(config: Pick<ScanWizardConfig, "primaryEmail" | "aliasEmails">) {
  const parsed = emailStepSchema.safeParse(config);
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Invalid email" };
  }
  const primary = parsed.data.primaryEmail.toLowerCase();
  const dupAlias = parsed.data.aliasEmails.some((e) => e.toLowerCase() === primary);
  if (dupAlias) {
    return { ok: false as const, error: "Aliases must differ from your primary email" };
  }
  return { ok: true as const };
}

export function validateIdentityStep(
  config: Pick<ScanWizardConfig, "firstName" | "lastName" | "cityState" | "ageRange">,
) {
  if (!config.ageRange) {
    return { ok: false as const, error: "Select an age range" };
  }
  const parsed = identityStepSchema.safeParse({ ...config, ageRange: config.ageRange });
  if (!parsed.success) {
    return { ok: false as const, error: parsed.error.issues[0]?.message ?? "Complete all identity fields" };
  }
  return { ok: true as const };
}

export function validateConfigStep(config: Pick<ScanWizardConfig, "scans">) {
  const anyEnabled = Object.values(config.scans).some(Boolean);
  if (!anyEnabled) {
    return { ok: false as const, error: "Enable at least one scan type" };
  }
  return { ok: true as const };
}

export function saveScanWizardConfig(config: ScanWizardConfig) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SCAN_WIZARD_STORAGE_KEY, JSON.stringify(config));
}

export function loadScanWizardConfig(): ScanWizardConfig | null {
  if (typeof window === "undefined") return null;
  const raw = window.sessionStorage.getItem(SCAN_WIZARD_STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as ScanWizardConfig;
  } catch {
    return null;
  }
}
