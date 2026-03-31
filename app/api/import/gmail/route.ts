import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import * as userRepo from "@/server/repositories/user.repository";
import * as gmailImportRepo from "@/server/repositories/gmail-import.repository";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const user = await userRepo.findUserByClerkId(userId);
  if (!user) {
    return NextResponse.json({ error: "User not found" }, { status: 404 });
  }

  const connectors = await gmailImportRepo.listGmailConnectorsForUser(user.id);
  return NextResponse.json({
    connectors: connectors.map((c) => ({
      id: c.id,
      gmailAddress: c.gmailAddress,
      scopes: c.scopes,
      createdAt: c.createdAt.toISOString(),
      updatedAt: c.updatedAt.toISOString(),
    })),
  });
}
