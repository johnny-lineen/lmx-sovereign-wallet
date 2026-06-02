import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { ScanOnboardingPage } from "@/components/scan/scan-onboarding-page";
import { profileFromClerkUser } from "@/lib/clerk-profile";
import { ensureUserAndRootLMXIdentity } from "@/server/services/identity-bootstrap.service";

export default async function ScanPage() {
  const { userId } = await auth();
  if (!userId) {
    redirect("/sign-in");
  }

  const clerkUser = await currentUser();
  await ensureUserAndRootLMXIdentity(userId, profileFromClerkUser(clerkUser));

  return (
    <Suspense fallback={<div className="min-h-dvh bg-[#05070a]" aria-hidden />}>
      <ScanOnboardingPage />
    </Suspense>
  );
}
