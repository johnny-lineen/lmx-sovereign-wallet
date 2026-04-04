import Link from "next/link";

import { buttonVariants } from "@/components/ui/button-variants";
import { cn } from "@/lib/utils";

export default function AccessRestrictedPage() {
  return (
    <main className="relative min-h-dvh bg-background px-6 py-16 text-foreground">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,var(--accent),transparent)]"
        aria-hidden
      />
      <div className="relative mx-auto max-w-xl space-y-6">
        <div className="space-y-2">
          <p className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
            LMX Sovereign Wallet
          </p>
          <h1 className="font-heading text-2xl font-semibold tracking-tight">Access restricted</h1>
        </div>
        <p className="text-sm text-muted-foreground">
          This environment is currently limited to an allowlisted set of test users.
        </p>
        <p className="text-sm text-muted-foreground">
          Ask the app owner to add your Clerk user ID to{" "}
          <code className="rounded-md bg-muted px-1.5 py-0.5 text-xs text-foreground">TEST_USER_ALLOWLIST</code>
          .
        </p>
        <Link href="/sign-in" className={cn(buttonVariants({ size: "default" }), "inline-flex w-fit")}>
          Return to sign in
        </Link>
      </div>
    </main>
  );
}
