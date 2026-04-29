"use client";

import { useCallback, useState } from "react";
import { Lock } from "lucide-react";

import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type DemoRequestFormProps = {
  /** When false, omit title and subtitle (e.g. when the parent section already shows them). */
  showFormHeader?: boolean;
  /** Visual treatment for dark landing sections. */
  surface?: "default" | "deep";
};

export function DemoRequestForm({ showFormHeader = true, surface = "default" }: DemoRequestFormProps) {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const deep = surface === "deep";

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
    <div data-slot="landing-demo-request" className="mx-auto flex w-full max-w-md flex-col items-stretch text-center sm:items-center">
      {status === "success" ? (
        <p
          className={cn(
            "rounded-xl border px-4 py-3.5 text-sm leading-relaxed backdrop-blur-sm",
            deep
              ? "border-white/10 bg-white/[0.06] text-slate-200"
              : "border-border/70 bg-card/80 text-foreground shadow-sm shadow-black/5",
          )}
        >
          You&apos;re on the list. We&apos;ll email you when there&apos;s an update worth your time.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex w-full flex-col gap-3">
          {showFormHeader ? (
            <div className="space-y-1">
              <label htmlFor="demo-email" className={cn("text-sm font-medium", deep ? "text-slate-100" : "text-foreground")}>
                Request early access
              </label>
              <p className={cn("text-xs leading-relaxed", deep ? "text-slate-500" : "text-muted-foreground")}>
                Waitlist updates only. Unsubscribe anytime.
              </p>
            </div>
          ) : null}
          <div
            className={cn(
              "flex flex-col gap-2 rounded-xl p-2 backdrop-blur-sm sm:flex-row sm:items-center sm:gap-2 sm:p-1.5",
              deep
                ? "border border-white/10 bg-white/[0.04] shadow-none"
                : "border border-border/70 bg-card/60 shadow-sm shadow-black/5",
            )}
          >
            <Input
              id="demo-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              placeholder="name@company.com"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              disabled={status === "loading"}
              className={cn(
                "h-11 min-h-11 border-0 bg-transparent px-3 text-sm shadow-none",
                "focus-visible:ring-0 sm:h-10 sm:min-h-10 sm:flex-1 sm:px-2",
                deep
                  ? "text-slate-100 placeholder:text-slate-500"
                  : "text-foreground placeholder:text-muted-foreground/65 dark:bg-transparent",
              )}
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className={cn(
                buttonVariants({ variant: "default", size: "default" }),
                "h-11 w-full shrink-0 rounded-lg px-5 text-sm font-medium sm:h-10 sm:w-auto sm:rounded-md",
                deep &&
                  "border-0 bg-gradient-to-br from-cyan-400 via-cyan-500 to-teal-600 font-semibold text-black hover:opacity-95",
              )}
            >
              {status === "loading" ? "Submitting…" : "Join waitlist"}
            </button>
          </div>
          <p
            className={cn(
              "flex items-center justify-center gap-1.5 font-mono text-[9px] uppercase tracking-[0.14em]",
              deep ? "text-slate-500" : "text-muted-foreground/80",
            )}
          >
            <Lock className="size-2.5 shrink-0 opacity-70" aria-hidden />
            <span>HTTPS</span>
            <span className={deep ? "text-slate-600" : "text-border/70"} aria-hidden>
              ·
            </span>
            <span>TLS 1.3</span>
          </p>
          {status === "error" && errorMessage ? (
            <p className="text-center text-xs text-red-400" role="alert">
              {errorMessage}
            </p>
          ) : null}
        </form>
      )}
    </div>
  );
}
