/** Dispatched after vault-affecting actions (e.g. import approvals) so open UIs can refetch. */
export const VAULT_DATA_CHANGED_EVENT = "lmx:vault-data-changed";

export function dispatchVaultDataChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(VAULT_DATA_CHANGED_EVENT));
}
