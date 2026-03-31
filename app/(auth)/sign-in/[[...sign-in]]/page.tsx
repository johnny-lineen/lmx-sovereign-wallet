"use client";

import { SignIn } from "@clerk/nextjs";
import { useEffect } from "react";

export default function SignInPage() {
  useEffect(() => {
    // #region agent log
    fetch("http://127.0.0.1:7499/ingest/f0394224-84a1-4c5e-8e0f-f979a5e0980c", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "059c1b" },
      body: JSON.stringify({
        sessionId: "059c1b",
        runId: "signin-diag-2",
        hypothesisId: "H2",
        location: "app/(auth)/sign-in/[[...sign-in]]/page.tsx:mounted",
        message: "sign-in page mounted in browser",
        data: {
          hasClerkRoot: Boolean(document.querySelector("[data-clerk-element='root']")),
          hasAnyIframe: document.querySelectorAll("iframe").length,
          bodyChildCount: document.body.children.length,
        },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion
  }, []);

  return (
    <SignIn
      appearance={{ elements: { rootBox: "mx-auto" } }}
      routing="path"
      path="/sign-in"
      signUpUrl="/sign-up"
      fallbackRedirectUrl="/dashboard"
    />
  );
}
