import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { AppShell } from "@/components/app-shell";
import { profileFromClerkUser } from "@/lib/clerk-profile";
import { ensureUserWithRootIdentity } from "@/server/services/user-bootstrap.service";

export default async function AuthenticatedAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const clerkUser = await currentUser();
  await ensureUserWithRootIdentity(userId, profileFromClerkUser(clerkUser));

  return <AppShell>{children}</AppShell>;
}
