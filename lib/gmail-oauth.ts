import { google } from "googleapis";
import { env } from "@/lib/env";

export const GMAIL_READONLY_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";

export function getGmailOAuthConfig(): { clientId: string; clientSecret: string; redirectUri: string } | null {
  const clientId = env.GOOGLE_GMAIL_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_GMAIL_CLIENT_SECRET?.trim();
  const redirectUri = env.GOOGLE_GMAIL_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) return null;
  return { clientId, clientSecret, redirectUri };
}

export function createGmailOAuth2Client() {
  const cfg = getGmailOAuthConfig();
  if (!cfg) throw new Error("Gmail OAuth is not configured (missing GOOGLE_GMAIL_* env vars).");
  return new google.auth.OAuth2(cfg.clientId, cfg.clientSecret, cfg.redirectUri);
}

export function buildGmailAuthorizeUrl(state: string): string {
  const oauth2 = createGmailOAuth2Client();
  return oauth2.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: [GMAIL_READONLY_SCOPE],
    state,
  });
}
