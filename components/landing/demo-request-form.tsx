"use client";

import { useCallback, useState } from "react";

import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function DemoRequestForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const onSubmit = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      setStatus("loading");
      setErrorMessage("");
      try {
        const res = await fetch("/api/demo-request", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email: email.trim() }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string };
        if (!res.ok || !data.ok) {
          setStatus("error");
          setErrorMessage(data.error ?? "Something went wrong. Try again.");
          return;
        }
        setStatus("success");
        setEmail("");
      } catch {
        setStatus("error");
        setErrorMessage("Network error. Check your connection and try again.");
      }
    },
    [email],
  );

  return (
    <div
      data-slot="landing-demo-request"
      className="mx-auto flex w-full max-w-xl flex-col items-center"
    >
      {status === "success" ? (
        <p
          className={cn(
            "w-full max-w-md rounded-full border border-border/70 bg-card/70 px-4 py-3 text-center text-sm text-foreground backdrop-blur-sm",
          )}
        >
          Thanks — we&apos;ll be in touch soon.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex w-full flex-col items-center gap-2">
          <div className="flex w-full flex-row flex-wrap items-center justify-center gap-x-3 gap-y-2">
            <label
              htmlFor="demo-email"
              className="shrink-0 text-[11px] font-medium uppercase tracking-widest text-muted-foreground"
            >
              Become a demo user
            </label>
            <div
              className={cn(
                "flex w-full max-w-[min(100%,17.5rem)] flex-col gap-1.5 rounded-full border border-border/60 bg-card/50 py-1 pl-3 pr-1 backdrop-blur-sm sm:max-w-none sm:w-auto sm:min-w-0 sm:flex-row sm:items-center sm:gap-0 sm:py-0.5 sm:pl-3.5",
              )}
            >
              <Input
                id="demo-email"
                name="email"
                type="email"
                autoComplete="email"
                required
                placeholder="you@company.com"
                value={email}
                onChange={(ev) => setEmail(ev.target.value)}
                disabled={status === "loading"}
                className={cn(
                  "h-8 min-h-8 border-0 bg-transparent px-1 text-sm text-foreground shadow-none",
                  "placeholder:text-muted-foreground/70",
                  "focus-visible:ring-0 dark:bg-transparent",
                  "sm:h-8 sm:min-w-[12rem] sm:max-w-[14rem] sm:flex-1 sm:px-0",
                )}
              />
              <button
                type="submit"
                disabled={status === "loading"}
                className={cn(
                  buttonVariants({ variant: "default", size: "sm" }),
                  "h-8 w-full shrink-0 rounded-full px-4 text-xs font-medium sm:w-auto",
                )}
              >
                {status === "loading" ? "Sending…" : "Request demo"}
              </button>
            </div>
          </div>
          {status === "error" && errorMessage ? (
            <p className="text-center text-xs text-destructive" role="alert">
              {errorMessage}
            </p>
          ) : null}
        </form>
      )}
    </div>
  );
}
