"use client";

import { SignUp } from "@clerk/nextjs";
import { useSearchParams } from "next/navigation";

export default function SignUpPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email")?.trim();

  return (
    <SignUp
      appearance={{ elements: { rootBox: "mx-auto" } }}
      routing="path"
      path="/sign-up"
      signInUrl="/sign-in"
      forceRedirectUrl="/search"
      fallbackRedirectUrl="/search"
      initialValues={email ? { emailAddress: email } : undefined}
    />
  );
}
