import { auth, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { OpsisSearchHome } from "@/components/search/opsis-search-home";
import { profileFromClerkUser } from "@/lib/clerk-profile";
import { ensureUserAndRootLMXIdentity } from "@/server/services/identity-bootstrap.service";

export default async function SearchPage() {
  const { userId } = await auth();

  if (!userId) {
    redirect("/sign-in");
  }

  const clerkUser = await currentUser();
  await ensureUserAndRootLMXIdentity(userId, profileFromClerkUser(clerkUser));

  return <OpsisSearchHome />;
}
