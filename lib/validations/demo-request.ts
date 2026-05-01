import { z } from "zod";

import { profileEmailSchema } from "@/lib/validations/import";

export const demoFootprintGoalSchema = z.enum(["privacy", "security", "accounts", "data_exposure", "just_curious"]);
export const demoAccountCountEstimateSchema = z.enum(["range_0_25", "range_25_75", "range_75_plus"]);

export const demoRequestBodySchema = z.object({
  email: profileEmailSchema.max(320),
  digitalFootprintGoal: demoFootprintGoalSchema,
  accountCountEstimate: demoAccountCountEstimateSchema,
  usefulnessNotes: z.string().trim().max(500, "Please keep this response under 500 characters.").optional().default(""),
  source: z.string().trim().max(120).optional().default("landing_modal"),
});

export type DemoRequestBody = z.infer<typeof demoRequestBodySchema>;
