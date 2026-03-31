import type { GraphExplainRequest } from "@/lib/validations/graph-explain";
import { logError, logInfo } from "@/lib/observability";
import { enforceRateLimit } from "@/lib/rate-limit";

const MAX_REQUESTS_PER_HOUR = 40;
const MAX_PROMPT_CHARS = 2200;
const MODEL_TIMEOUT_MS = 5000;
const DEFAULT_MODEL = "gpt-4o-mini";

function fallbackExplanation(input: GraphExplainRequest): string {
  const node = input.node;
  const connectionCount = input.connections.length;
  const providerText = node.provider ? `Provider: ${node.provider}.` : "Provider unknown.";
  const confidenceText =
    node.metadataPreview.provenance?.confidence != null
      ? `Confidence is ${Math.round(node.metadataPreview.provenance.confidence * 100)}%.`
      : "Confidence is not available.";
  const evidenceText =
    node.metadataPreview.provenance?.evidenceSummary ??
    (node.metadataPreview.provenance?.limitedEvidence
      ? "Evidence is limited for this node."
      : "No explicit evidence summary was stored.");
  return `${node.label} is a ${node.type.replaceAll("_", " ")} node in your vault graph. ${providerText} It currently has ${connectionCount} visible relationship(s). ${confidenceText} ${evidenceText}`;
}

function composePrompt(input: GraphExplainRequest): string {
  const connections = input.connections
    .map((c) => `${c.direction === "out" ? "outgoing" : "incoming"} ${c.relation} -> ${c.otherLabel}`)
    .join("; ");
  const confidence =
    input.node.metadataPreview.provenance?.confidence != null
      ? `${Math.round(input.node.metadataPreview.provenance.confidence * 100)}%`
      : "n/a";
  const evidence = input.node.metadataPreview.provenance?.evidenceSummary ?? "n/a";
  return [
    "Explain this graph node for a non-technical user in 2-3 short sentences.",
    "Do not invent facts. Use only supplied details.",
    `Node: ${input.node.label}`,
    `Type: ${input.node.type}`,
    `Provider: ${input.node.provider ?? "unknown"}`,
    `Status: ${input.node.metadataPreview.status}`,
    `Confidence: ${confidence}`,
    `Evidence: ${evidence}`,
    `Connections: ${connections || "none"}`,
  ].join("\n");
}

export async function generateGraphNodeExplanation(
  userId: string,
  input: GraphExplainRequest,
): Promise<{ explanation: string; fallback: boolean }> {
  const fallback = fallbackExplanation(input);
  const limit = enforceRateLimit(`graph-explain:${userId}`, 60 * 60 * 1000, MAX_REQUESTS_PER_HOUR);
  if (!limit.allowed) {
    logInfo("graph_explain_rate_limited", { userId, retryAfterSeconds: limit.retryAfterSeconds });
    return { explanation: fallback, fallback: true };
  }

  const apiKey = process.env.OPENAI_API_KEY ?? "";
  if (!apiKey.trim()) {
    return { explanation: fallback, fallback: true };
  }

  const prompt = composePrompt(input);
  if (prompt.length > MAX_PROMPT_CHARS) {
    return { explanation: fallback, fallback: true };
  }

  const timeoutSignal = AbortSignal.timeout(MODEL_TIMEOUT_MS);
  const model = process.env.GRAPH_EXPLAIN_MODEL?.trim() || DEFAULT_MODEL;
  const endpoint = process.env.GRAPH_EXPLAIN_API_URL?.trim() || "https://api.openai.com/v1/chat/completions";

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      signal: timeoutSignal,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.2,
        max_tokens: 180,
        messages: [
          { role: "system", content: "You explain identity graph findings clearly and conservatively." },
          { role: "user", content: prompt },
        ],
      }),
    });
    if (!res.ok) return { explanation: fallback, fallback: true };
    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    const safe = content && content.length > 0 ? content : fallback;

    logInfo("graph_explain_audit", {
      userId,
      fallback: !content,
      model,
      promptTokens: data.usage?.prompt_tokens ?? null,
      completionTokens: data.usage?.completion_tokens ?? null,
    });
    return { explanation: safe, fallback: !content };
  } catch (error) {
    logError("graph_explain_failed", {
      userId,
      model,
      error: error instanceof Error ? error.message : String(error),
    });
    return { explanation: fallback, fallback: true };
  }
}
