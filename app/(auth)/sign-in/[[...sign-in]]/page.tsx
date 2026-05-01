"use client";

import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <SignIn
      appearance={{ elements: { rootBox: "mx-auto" } }}
      routing="path"
      path="/sign-in"
      signUpUrl="/sign-up"
      forceRedirectUrl="/search"
      fallbackRedirectUrl="/search"
    />
  );
}
