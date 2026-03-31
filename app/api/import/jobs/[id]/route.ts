import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getImportJobDetailDTO } from "@/server/services/import-job.service";
import { z } from "zod";

type RouteContext = { params: Promise<{ id: string }> };

const jobIdParamSchema = z.string().uuid();

export async function GET(_request: Request, context: RouteContext) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;
  const idParsed = jobIdParamSchema.safeParse(id);
  if (!idParsed.success) {
    return NextResponse.json({ error: "Invalid job id" }, { status: 400 });
  }

  const detail = await getImportJobDetailDTO(userId, idParsed.data);
  if (!detail) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(detail);
}
