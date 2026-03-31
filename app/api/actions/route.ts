import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { syncAdvisoryActionsForClerkUser } from "@/server/services/action.service";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const actions = await syncAdvisoryActionsForClerkUser(userId);
  if (!actions) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  return NextResponse.json({
    actions,
    focus: {
      strategy: "top_security_actions",
      limit: 5,
      count: actions.length,
    },
  });
}
