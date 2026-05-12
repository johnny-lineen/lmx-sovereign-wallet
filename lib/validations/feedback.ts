import { z } from "zod";

export const FEEDBACK_THEME_ORDER = [
  "confusion",
  "perceived_value",
  "trust",
  "insight_quality",
  "expectations",
  "funnel_dropoff",
] as const;

export const feedbackThemeSchema = z.enum(FEEDBACK_THEME_ORDER);

const metadataSchema = z
  .object({
    pathname: z.string().max(512).optional(),
    funnelStep: z.string().max(120).optional(),
    insightId: z.string().uuid().optional(),
    publicAuditRunId: z.string().uuid().optional(),
    importJobId: z.string().uuid().optional(),
    reportStatus: z.string().max(64).optional(),
    expectedSources: z.array(z.string().max(200)).max(50).optional(),
    agentQuerySnippet: z.string().max(500).optional(),
  })
  .strict()
  .optional();

export const productFeedbackBodySchema = z.object({
  theme: feedbackThemeSchema,
  surface: z.string().trim().min(1).max(64),
  message: z.string().trim().max(2000).optional(),
  rating: z.union([z.literal(-1), z.literal(0), z.literal(1)]).optional(),
  metadata: metadataSchema,
});

export type ProductFeedbackBody = z.infer<typeof productFeedbackBodySchema>;

export const FEEDBACK_THEME_LABELS: Record<z.infer<typeof feedbackThemeSchema>, string> = {
  confusion: "Where I was confused",
  perceived_value: "Where I see value",
  trust: "Trust with real data",
  insight_quality: "Insights / answers usefulness",
  expectations: "What I expect next",
  funnel_dropoff: "Onboarding or scan flow",
};
