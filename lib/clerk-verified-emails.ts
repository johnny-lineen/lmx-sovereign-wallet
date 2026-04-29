/**
 * Emails the signed-in user has verified with Clerk (server-side user object).
 */
export function verifiedEmailSetFromClerkUser(user: {
  emailAddresses?: { emailAddress: string; verification: { status: string } | null }[];
} | null): Set<string> {
  const out = new Set<string>();
  if (!user?.emailAddresses?.length) return out;
  for (const ea of user.emailAddresses) {
    if (ea.verification?.status === "verified") {
      out.add(ea.emailAddress.trim().toLowerCase());
    }
  }
  return out;
}

export function isEmailVerifiedForClerkUser(
  user: Parameters<typeof verifiedEmailSetFromClerkUser>[0],
  normalizedEmail: string,
): boolean {
  return verifiedEmailSetFromClerkUser(user).has(normalizedEmail.trim().toLowerCase());
}
