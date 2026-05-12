import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { OpsisSearchHome } from "@/components/search/opsis-search-home";
import { profileFromClerkUser } from "@/lib/clerk-profile";
import { linkDemoRequestsToClerkUser } from "@/server/services/demo-request.service";
import { ensureUserAndRootLMXIdentity } from "@/server/services/identity-bootstrap.service";

export default async function SearchPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const clerkUser = await currentUser();
  await linkDemoRequestsToClerkUser({
    clerkUserId: userId,
    clerkEmails: (clerkUser?.emailAddresses ?? []).map((address) => address.emailAddress),
  });
  await ensureUserAndRootLMXIdentity(userId, profileFromClerkUser(clerkUser));

  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#05070a]" aria-hidden />}>
      <OpsisSearchHome />
    </Suspense>
  );
}
