/** Dispatched when something meaningful happened and a feedback prompt may be appropriate. */
export const FEEDBACK_NUDGE_REQUEST_EVENT = "lmx:feedback-nudge-request";

export type FeedbackNudgeReason = "route" | "action";

export function dispatchFeedbackNudgeRequest(reason: FeedbackNudgeReason = "action"): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(FEEDBACK_NUDGE_REQUEST_EVENT, { detail: reason }));
}

const SNOOZE_KEY = "lmx_feedback_nudge_snooze_until";

export function getFeedbackNudgeSnoozeUntil(): number {
  if (typeof window === "undefined") return 0;
  const raw = window.sessionStorage.getItem(SNOOZE_KEY);
  if (!raw) return 0;
  const n = Number(raw);
  return Number.isFinite(n) ? n : 0;
}

export function snoozeFeedbackNudge(msFromNow: number): void {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(SNOOZE_KEY, String(Date.now() + msFromNow));
}
