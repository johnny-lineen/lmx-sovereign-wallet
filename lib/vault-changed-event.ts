import { dispatchFeedbackNudgeRequest } from "@/lib/feedback-nudge";

/** Dispatched after vault-affecting actions (e.g. import approvals) so open UIs can refetch. */
export const VAULT_DATA_CHANGED_EVENT = "lmx:vault-data-changed";

let vaultFeedbackNudgeTimeout: number | null = null;

function scheduleDeferredFeedbackNudgeFromVault() {
  if (typeof window === "undefined") return;
  if (vaultFeedbackNudgeTimeout) clearTimeout(vaultFeedbackNudgeTimeout);
  vaultFeedbackNudgeTimeout = window.setTimeout(() => {
    vaultFeedbackNudgeTimeout = null;
    dispatchFeedbackNudgeRequest("action");
  }, 2500);
}

export function dispatchVaultDataChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(VAULT_DATA_CHANGED_EVENT));
  scheduleDeferredFeedbackNudgeFromVault();
}
