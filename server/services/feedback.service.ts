import type { Prisma } from "@prisma/client";

import type { ProductFeedbackBody } from "@/lib/validations/feedback";
import * as feedbackRepo from "@/server/repositories/feedback.repository";
import * as userRepo from "@/server/repositories/user.repository";

export type RecordProductFeedbackResult =
  | { ok: true; id: string }
  | { ok: false; error: "user_not_found"; status: 404 };

export async function recordProductFeedback(
  clerkUserId: string,
  body: ProductFeedbackBody,
): Promise<RecordProductFeedbackResult> {
  const user = await userRepo.findUserByClerkId(clerkUserId);
  if (!user) {
    return { ok: false, error: "user_not_found", status: 404 };
  }

  const message = body.message?.trim() ? body.message.trim() : null;
  const rating = body.rating === undefined ? null : body.rating;
  const metadata = (body.metadata ?? null) as Prisma.InputJsonValue | null;

  const row = await feedbackRepo.createProductFeedback({
    userId: user.id,
    theme: body.theme,
    surface: body.surface,
    message,
    rating,
    metadata,
  });

  return { ok: true, id: row.id };
}
