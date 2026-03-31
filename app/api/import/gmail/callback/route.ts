import { auth, currentUser } from "@clerk/nextjs/server";
import { google } from "googleapis";
import { NextRequest, NextResponse } from "next/server";

import { profileFromClerkUser } from "@/lib/clerk-profile";
import { env } from "@/lib/env";
import { createGmailOAuth2Client } from "@/lib/gmail-oauth";
import * as gmailImportRepo from "@/server/repositories/gmail-import.repository";
import { ensureUserAndRootLMXIdentity } from "@/server/services/identity-bootstrap.service";

const STATE_COOKIE = "gmail_oauth_state";

function appBaseUrl(): string {
  const explicit = env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");
  if (explicit) return explicit;
  return "http://localhost:3000";
}

export async function GET(request: NextRequest) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.redirect(new URL("/sign-in", request.url));
  }

  const cookieState = request.cookies.get(STATE_COOKIE)?.value;
  const url = new URL(request.url);
  const state = url.searchParams.get("state");
  const code = url.searchParams.get("code");
  const oauthError = url.searchParams.get("error");

  const redirectBase = appBaseUrl();
  const vaultUrl = new URL("/vault", redirectBase);

  if (oauthError) {
    vaultUrl.searchParams.set("gmail_error", oauthError);
    return NextResponse.redirect(vaultUrl);
  }

  if (!code || !state || !cookieState || state !== cookieState) {
    vaultUrl.searchParams.set("gmail_error", "invalid_oauth_state");
    const res = NextResponse.redirect(vaultUrl);
    res.cookies.delete(STATE_COOKIE);
    return res;
  }

  const clerkUser = await currentUser();
  const { user } = await ensureUserAndRootLMXIdentity(userId, profileFromClerkUser(clerkUser));

  const oauth2 = createGmailOAuth2Client();
  let tokens;
  try {
    const tr = await oauth2.getToken(code);
    tokens = tr.tokens;
  } catch {
    vaultUrl.searchParams.set("gmail_error", "token_exchange_failed");
    const res = NextResponse.redirect(vaultUrl);
    res.cookies.delete(STATE_COOKIE);
    return res;
  }

  oauth2.setCredentials(tokens);

  const gmail = google.gmail({ version: "v1", auth: oauth2 });
  let gmailAddress: string | undefined;
  try {
    const profile = await gmail.users.getProfile({ userId: "me" });
    gmailAddress = profile.data.emailAddress ?? undefined;
  } catch {
    vaultUrl.searchParams.set("gmail_error", "profile_failed");
    const res = NextResponse.redirect(vaultUrl);
    res.cookies.delete(STATE_COOKIE);
    return res;
  }

  if (!gmailAddress) {
    vaultUrl.searchParams.set("gmail_error", "no_email");
    const res = NextResponse.redirect(vaultUrl);
    res.cookies.delete(STATE_COOKIE);
    return res;
  }

  let refreshToken = tokens.refresh_token ?? null;
  const existingConnector = await gmailImportRepo.findGmailConnectorByUserAndAddress(user.id, gmailAddress);
  if (!refreshToken && existingConnector?.refreshToken) {
    refreshToken = existingConnector.refreshToken;
  }

  if (!refreshToken) {
    vaultUrl.searchParams.set("gmail_error", "no_refresh_token");
    const res = NextResponse.redirect(vaultUrl);
    res.cookies.delete(STATE_COOKIE);
    return res;
  }

  const scopeStr = Array.isArray(tokens.scope) ? tokens.scope.join(" ") : (tokens.scope ?? null);

  await gmailImportRepo.upsertGmailConnectorForUser(user.id, {
    gmailAddress,
    refreshToken,
    accessToken: tokens.access_token ?? null,
    accessTokenExpiresAt: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
    scopes: scopeStr,
  });

  vaultUrl.searchParams.set("gmail_connected", "1");
  const res = NextResponse.redirect(vaultUrl);
  res.cookies.delete(STATE_COOKIE);
  return res;
}
