import { auth } from "@clerk/nextjs/server";
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

import { buildGmailAuthorizeUrl, getGmailOAuthConfig } from "@/lib/gmail-oauth";

const STATE_COOKIE = "gmail_oauth_state";

export async function GET() {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!getGmailOAuthConfig()) {
    return NextResponse.json(
      { error: "Gmail import is not configured (set GOOGLE_GMAIL_CLIENT_ID, GOOGLE_GMAIL_CLIENT_SECRET, GOOGLE_GMAIL_REDIRECT_URI)." },
      { status: 503 },
    );
  }

  const state = randomBytes(16).toString("hex");
  const url = buildGmailAuthorizeUrl(state);
  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
