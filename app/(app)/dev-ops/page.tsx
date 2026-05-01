import { auth, currentUser } from "@clerk/nextjs/server";
import { notFound } from "next/navigation";

import { AppPageHeader } from "@/components/app-page-header";
import { DevOpsDashboard } from "@/components/dev-ops/dev-ops-dashboard";
import { getDevOpsDemoMetrics } from "@/server/services/dev-ops.service";

export const dynamic = "force-dynamic";

export default async function DevOpsPage() {
  const { userId } = await auth();
  if (!userId) {
    return null;
  }

  const user = await currentUser();
  const emails = (user?.emailAddresses ?? []).map((entry) => entry.emailAddress.toLowerCase());
  if (!emails.includes("jlineen06@gmail.com")) {
    notFound();
  }

  const metrics = await getDevOpsDemoMetrics();

  return (
    <div className="space-y-6">
      <AppPageHeader
        title="Dev ops"
        description="Developer home base: KPIs, signup trends, funnel segmentation, intake activity, and pointers to runtime logs."
      />

      <DevOpsDashboard metrics={metrics} />
    </div>
  );
}
