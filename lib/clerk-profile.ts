export type ClerkProfile = {
  email: string | null;
  name: string | null;
  imageUrl: string | null;
};

type ClerkLikeUser = {
  primaryEmailAddress?: { emailAddress?: string | null } | null;
  emailAddresses?: { emailAddress?: string }[];
  fullName?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  imageUrl?: string | null;
} | null;

export function profileFromClerkUser(user: ClerkLikeUser): ClerkProfile {
  if (!user) {
    return { email: null, name: null, imageUrl: null };
  }
  const fromParts = [user.firstName, user.lastName].filter(Boolean).join(" ").trim();
  return {
    email:
      user.primaryEmailAddress?.emailAddress ?? user.emailAddresses?.[0]?.emailAddress ?? null,
    name: user.fullName?.trim() || fromParts || null,
    imageUrl: user.imageUrl ?? null,
  };
}
