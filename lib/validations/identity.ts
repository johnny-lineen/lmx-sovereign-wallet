import { z } from "zod";

export const identityUpdateSchema = z.object({
  displayName: z
    .string()
    .trim()
    .max(120, "Display name is too long")
    .optional()
    .nullable(),
  summary: z
    .string()
    .trim()
    .max(2000, "Summary is too long")
    .optional()
    .nullable(),
});

export type IdentityUpdateInput = z.infer<typeof identityUpdateSchema>;
