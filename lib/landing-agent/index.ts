import { composeLandingAnswer } from "@/lib/landing-agent/compose";
import { classifyLandingIntent, messageSuggestsSignIn, normalizeLandingMessage } from "@/lib/landing-agent/intents";
import { LANDING_AGENT_KNOWLEDGE } from "@/lib/landing-agent/knowledge";
import { buildFactsBlockForIntent } from "@/lib/landing-agent/model-context";
import { polishLandingAnswerWithOpenAI } from "@/lib/landing-agent/openai-reply";
import { buildSuggestedPrompts } from "@/lib/landing-agent/suggestions";
import type { LandingAgentCta, LandingAgentIntent, LandingAgentPlan, LandingAgentQueryResponse } from "@/lib/landing-agent/types";

const MAX_USER_CHARS = 600;

export function clampLandingAgentMessage(raw: string): string {
  const t = raw.trim();
  if (t.length <= MAX_USER_CHARS) return t;
  return t.slice(0, MAX_USER_CHARS);
}

export function resolveLandingCta(intent: LandingAgentIntent, normalizedMessage: string): LandingAgentCta {
  if (/\b(waitlist|early access|invite|get access|join the)\b/.test(normalizedMessage)) {
    return { type: "waitlist", label: "Join the waitlist", href: "#waitlist" };
  }
  if (messageSuggestsSignIn(normalizedMessage)) {
    return { type: "sign_in", label: "Sign in", href: "/sign-in" };
  }
  if (intent === "access_cta" || intent === "roadmap" || intent === "mvp_scope") {
    return { type: "waitlist", label: "Join the waitlist", href: "#waitlist" };
  }
  if (intent === "trust_security" || intent === "who_is_it_for" || intent === "why_it_matters") {
    return { type: "waitlist", label: "Request early access", href: "#waitlist" };
  }
  if (intent === "fallback_general") {
    return { type: "waitlist", label: "Join the waitlist", href: "#waitlist" };
  }
  return { type: "none" };
}

export function buildLandingAgentPlan(rawMessage: string): LandingAgentPlan {
  const message = clampLandingAgentMessage(rawMessage);
  const normalized = normalizeLandingMessage(message);
  const intent = classifyLandingIntent(normalized);
  const deterministicAnswer = composeLandingAnswer(intent, LANDING_AGENT_KNOWLEDGE, normalized);
  const suggestedPrompts = buildSuggestedPrompts(intent, { phase: "reply" });
  const cta = resolveLandingCta(intent, normalized);
  const factsForModel = buildFactsBlockForIntent(intent, LANDING_AGENT_KNOWLEDGE);

  return {
    intent,
    suggestedPrompts,
    cta,
    userMessage: message,
    deterministicAnswer,
    factsForModel,
  };
}

export async function runLandingAgentQuery(rawMessage: string): Promise<LandingAgentQueryResponse> {
  const plan = buildLandingAgentPlan(rawMessage);
  const { answer } = await polishLandingAnswerWithOpenAI(plan);

  return {
    intent: plan.intent,
    answer,
    suggestedPrompts: plan.suggestedPrompts,
    cta: plan.cta,
  };
}
