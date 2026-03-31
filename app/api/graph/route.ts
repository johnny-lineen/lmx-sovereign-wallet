import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { getGraphPayloadForClerkUser } from "@/server/services/graph.service";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const payload = await getGraphPayloadForClerkUser(userId);
  if (!payload) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json(payload);
}
