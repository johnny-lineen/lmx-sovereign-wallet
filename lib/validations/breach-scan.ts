import { z } from "zod";

export const breachScanBodySchema = z.object({
  emails: z.array(z.string().email()).min(1).max(20),
});

export type BreachScanBody = z.infer<typeof breachScanBodySchema>;
