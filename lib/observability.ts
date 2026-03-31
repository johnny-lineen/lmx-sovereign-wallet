export function logInfo(event: string, payload: Record<string, unknown>) {
  console.info(JSON.stringify({ level: "info", event, ts: new Date().toISOString(), ...payload }));
}

export function logError(event: string, payload: Record<string, unknown>) {
  console.error(JSON.stringify({ level: "error", event, ts: new Date().toISOString(), ...payload }));
}

export async function sendOpsAlert(event: string, payload: Record<string, unknown>) {
  const webhook = process.env.OPS_ALERT_WEBHOOK_URL?.trim();
  if (!webhook) return;
  try {
    await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ event, ts: new Date().toISOString(), payload }),
    });
  } catch {
    // Alerts must never fail request paths.
  }
}
