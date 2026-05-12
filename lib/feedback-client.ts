import type { ProductFeedbackBody } from "@/lib/validations/feedback";

export type SubmitProductFeedbackResult =
  | { ok: true; id: string }
  | { ok: false; error: string; status?: number };

/** POST /api/feedback (Clerk session cookies). */
export async function submitProductFeedback(body: ProductFeedbackBody): Promise<SubmitProductFeedbackResult> {
  const res = await fetch("/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "same-origin",
  });

  let json: unknown;
  try {
    json = await res.json();
  } catch {
    return { ok: false, error: "Invalid response", status: res.status };
  }

  if (!res.ok || typeof json !== "object" || json === null) {
    const err = typeof json === "object" && json !== null && "error" in json && typeof (json as { error: unknown }).error === "string"
      ? (json as { error: string }).error
      : "Request failed";
    return { ok: false, error: err, status: res.status };
  }

  const o = json as { ok?: unknown; id?: unknown; error?: unknown };
  if (o.ok === true && typeof o.id === "string") {
    return { ok: true, id: o.id };
  }
  return { ok: false, error: typeof o.error === "string" ? o.error : "Request failed", status: res.status };
}

/** Fire-and-forget funnel telemetry (errors ignored). */
export function recordFunnelFeedback(body: ProductFeedbackBody): void {
  void submitProductFeedback(body).catch(() => {});
}
