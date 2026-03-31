import Link from "next/link";

export default function AccessRestrictedPage() {
  return (
    <main className="mx-auto max-w-xl space-y-4 px-6 py-16">
      <h1 className="text-2xl font-semibold tracking-tight">Access restricted</h1>
      <p className="text-sm text-muted-foreground">
        This environment is currently limited to an allowlisted set of test users.
      </p>
      <p className="text-sm text-muted-foreground">
        Ask the app owner to add your Clerk user ID to <code>TEST_USER_ALLOWLIST</code>.
      </p>
      <Link href="/sign-in" className="inline-block text-sm underline underline-offset-4">
        Return to sign in
      </Link>
    </main>
  );
}
