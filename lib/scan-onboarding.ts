export const SCAN_ONBOARDING_KEYS = {
  emailScan: "lmx_onboarding.scan.email",
  publicAudit: "lmx_onboarding.scan.public_audit",
  reviewQueue: "lmx_onboarding.scan.review_queue",
} as const;

export type ScanOnboardingKey =
  (typeof SCAN_ONBOARDING_KEYS)[keyof typeof SCAN_ONBOARDING_KEYS];

function hasWindow() {
  return typeof window !== "undefined";
}

export function shouldShowScanOnboardingHint(key: ScanOnboardingKey): boolean {
  if (!hasWindow()) return false;
  return window.localStorage.getItem(key) !== "done";
}

export function markScanOnboardingHintDone(key: ScanOnboardingKey) {
  if (!hasWindow()) return;
  window.localStorage.setItem(key, "done");
}

/** Fired on `window` after `resetAllScanOnboardingHints()` so open Vault tabs can re-show hints. */
export const SCAN_ONBOARDING_RESET_EVENT = "lmx_scan_onboarding_reset";

export function resetAllScanOnboardingHints() {
  if (!hasWindow()) return;
  for (const key of Object.values(SCAN_ONBOARDING_KEYS)) {
    window.localStorage.removeItem(key);
  }
  window.dispatchEvent(new Event(SCAN_ONBOARDING_RESET_EVENT));
}
