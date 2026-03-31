import { z } from "zod";

export const actionStatusSchema = z.enum(["todo", "in_progress", "done", "skipped"]);

export const updateActionStatusSchema = z.object({
  status: actionStatusSchema,
});

export type UpdateActionStatusInput = z.infer<typeof updateActionStatusSchema>;
