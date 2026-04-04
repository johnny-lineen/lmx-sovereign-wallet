import { z } from "zod";

export const graphExplainRequestSchema = z.object({
  node: z.object({
    id: z.string().min(1).max(128),
    label: z.string().min(1).max(200),
    type: z.string().min(1).max(64),
    provider: z.string().max(120).nullable(),
    metadataPreview: z.object({
      status: z.string().max(64),
      summary: z.string().max(600).optional(),
      provenance: z
        .object({
          source: z.string().max(120),
          confidence: z.number().min(0).max(1).nullable(),
          evidenceSummary: z.string().max(600).optional(),
          limitedEvidence: z.boolean().optional(),
        })
        .optional(),
    }),
    mergeGroupSize: z.number().int().min(1).max(9999).optional(),
  }),
  connections: z
    .array(
      z.object({
        otherLabel: z.string().min(1).max(180),
        relation: z.string().min(1).max(120),
        direction: z.enum(["out", "in"]),
      }),
    )
    .max(12),
});

export type GraphExplainRequest = z.infer<typeof graphExplainRequestSchema>;
