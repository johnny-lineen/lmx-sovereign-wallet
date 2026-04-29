import { logError, logInfo } from "@/lib/observability";
import type { LandingAgentPlan } from "@/lib/landing-agent/types";

const DEFAULT_MODEL = "gpt-4o-mini";
const MODEL_TIMEOUT_MS = 10_000;
const MAX_COMPLETION_TOKENS = 480;

function buildSystemPrompt(plan: LandingAgentPlan): string {
  return [
    "You are the public voice of LMX Sovereign Wallet on the marketing site.",
    "Rewrite the visitor's question into a clear answer for a smart non-expert.",
    "",
    "Hard rules:",
    "1) Use ONLY the information in FACTS below. Do not invent features, integrations, certifications, legal guarantees, roadmap dates, or partnerships.",
    "2) Stay aligned with INTERNAL_BRIEFING: same claims and boundaries; you may tighten wording and flow but must not contradict or expand scope beyond FACTS.",
    "3) Output exactly three paragraphs separated by a single blank line: (1) direct answer (2) framing (3) why it matters.",
    "4) Tone: sharp, premium, founder-quality; no generic assistant filler (no 'Great question', 'I'd be happy to').",
    "5) If the visitor asks for something not covered in FACTS, say you do not have that level of detail here and point them to the waitlist or Sign in only as described in FACTS / INTERNAL_BRIEFING.",
    "",
    `Classified topic (for your orientation only, not as extra facts): ${plan.intent.replace(/_/g, " ")}`,
    "",
    "### FACTS",
    plan.factsForModel.trim(),
    "",
    "### INTERNAL_BRIEFING (ground truth; do not contradict)",
    plan.deterministicAnswer.trim(),
  ].join("\n");
}

export type PolishLandingAnswerResult = {
  answer: string;
  usedModel: boolean;
};

/**
 * When OPENAI_API_KEY is set, rewrites the deterministic briefing using FACTS.
 * Otherwise returns the briefing unchanged.
 */
export async function polishLandingAnswerWithOpenAI(plan: LandingAgentPlan): Promise<PolishLandingAnswerResult> {
  const fallback = plan.deterministicAnswer;
  const apiKey = process.env.OPENAI_API_KEY?.trim() ?? "";
  if (!apiKey) {
    return { answer: fallback, usedModel: false };
  }

  const model = process.env.LANDING_AGENT_OPENAI_MODEL?.trim() || DEFAULT_MODEL;
  const endpoint = process.env.LANDING_AGENT_OPENAI_API_URL?.trim() || "https://api.openai.com/v1/chat/completions";

  try {
    const res = await fetch(endpoint, {
      method: "POST",
      signal: AbortSignal.timeout(MODEL_TIMEOUT_MS),
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        temperature: 0.22,
        max_tokens: MAX_COMPLETION_TOKENS,
        messages: [
          { role: "system", content: buildSystemPrompt(plan) },
          { role: "user", content: plan.userMessage },
        ],
      }),
    });

    if (!res.ok) {
      logInfo("landing_agent_openai_http_error", { status: res.status, model, intent: plan.intent });
      return { answer: fallback, usedModel: false };
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[];
      usage?: { prompt_tokens?: number; completion_tokens?: number };
    };
    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) {
      return { answer: fallback, usedModel: false };
    }

    logInfo("landing_agent_openai_ok", {
      model,
      intent: plan.intent,
      promptTokens: data.usage?.prompt_tokens ?? null,
      completionTokens: data.usage?.completion_tokens ?? null,
    });
    return { answer: content, usedModel: true };
  } catch (error) {
    logError("landing_agent_openai_failed", {
      model,
      intent: plan.intent,
      error: error instanceof Error ? error.message : String(error),
    });
    return { answer: fallback, usedModel: false };
  }
}
