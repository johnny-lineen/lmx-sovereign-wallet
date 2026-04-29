import { auth } from "@clerk/nextjs/server";
import { randomBytes } from "crypto";
import { NextResponse } from "next/server";

import { buildGmailAuthorizeUrl, getGmailOAuthConfig } from "@/lib/gmail-oauth";

const STATE_COOKIE = "gmail_oauth_state";
const RETURN_TO_COOKIE = "gmail_oauth_return_to";

export async function GET(request: Request) {
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
  const reqUrl = new URL(request.url);
  const returnToRaw = reqUrl.searchParams.get("returnTo");
  const returnTo =
    typeof returnToRaw === "string" && returnToRaw.startsWith("/") && !returnToRaw.startsWith("//")
      ? returnToRaw
      : "/vault";
  const res = NextResponse.redirect(url);
  res.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  res.cookies.set(RETURN_TO_COOKIE, returnTo, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return res;
}
