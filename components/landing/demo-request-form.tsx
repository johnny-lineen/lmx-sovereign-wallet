"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Lock } from "lucide-react";

import { buttonVariants } from "@/components/ui/button-variants";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type DemoRequestFormProps = {
  /** When false, omit title and subtitle (e.g. when the parent section already shows them). */
  showFormHeader?: boolean;
  /** Visual treatment for dark landing sections. */
  surface?: "default" | "deep";
  onSubmitted?: () => void;
};

const footprintGoalOptions = [
  { value: "privacy", label: "Privacy" },
  { value: "security", label: "Security" },
  { value: "accounts", label: "Accounts" },
  { value: "data_exposure", label: "Data exposure" },
  { value: "just_curious", label: "Just curious" },
] as const;

const accountEstimateOptions = [
  { value: "range_0_25", label: "0-25" },
  { value: "range_25_75", label: "25-75" },
  { value: "range_75_plus", label: "75+" },
] as const;

export function DemoRequestForm({ showFormHeader = true, surface = "default", onSubmitted }: DemoRequestFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [digitalFootprintGoal, setDigitalFootprintGoal] = useState<(typeof footprintGoalOptions)[number]["value"]>("privacy");
  const [accountCountEstimate, setAccountCountEstimate] = useState<(typeof accountEstimateOptions)[number]["value"]>("range_25_75");
  const [usefulnessNotes, setUsefulnessNotes] = useState("");
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
          body: JSON.stringify({
            email: email.trim(),
            digitalFootprintGoal,
            accountCountEstimate,
            usefulnessNotes: usefulnessNotes.trim(),
            source: "landing_modal",
          }),
        });
        const data = (await res.json()) as { ok?: boolean; error?: string; signUpUrl?: string };
        if (!res.ok || !data.ok) {
          setStatus("error");
          setErrorMessage(data.error ?? "Something went wrong. Try again.");
          return;
        }
        setStatus("success");
        onSubmitted?.();
        router.push(data.signUpUrl ?? "/sign-up");
      } catch {
        setStatus("error");
        setErrorMessage("Network error. Check your connection and try again.");
      }
    },
    [accountCountEstimate, digitalFootprintGoal, email, onSubmitted, router, usefulnessNotes],
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
          Success. Taking you to secure email verification.
        </p>
      ) : (
        <form onSubmit={onSubmit} className="flex w-full flex-col gap-3">
          {showFormHeader ? (
            <div className="space-y-1">
              <label htmlFor="demo-email" className={cn("text-sm font-medium", deep ? "text-slate-100" : "text-foreground")}>
                Become a demo user
              </label>
              <p className={cn("text-xs leading-relaxed", deep ? "text-slate-500" : "text-muted-foreground")}>
                30-second setup. We verify your email, then drop you into Search/Scan.
              </p>
            </div>
          ) : null}
          <div className={cn("space-y-2 rounded-xl p-3 backdrop-blur-sm", deep ? "border border-white/10 bg-white/[0.04]" : "border border-border/70 bg-card/60 shadow-sm shadow-black/5")}>
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
                "h-11 min-h-11 border border-white/10 bg-transparent px-3 text-sm shadow-none focus-visible:ring-2",
                deep
                  ? "text-slate-100 placeholder:text-slate-500"
                  : "text-foreground placeholder:text-muted-foreground/65 dark:bg-transparent",
              )}
            />
            <label htmlFor="demo-goal" className={cn("block text-left text-xs font-medium", deep ? "text-slate-300" : "text-muted-foreground")}>
              What do you want to understand about your digital footprint?
            </label>
            <select
              id="demo-goal"
              name="digitalFootprintGoal"
              value={digitalFootprintGoal}
              onChange={(event) => setDigitalFootprintGoal(event.target.value as (typeof footprintGoalOptions)[number]["value"])}
              disabled={status === "loading"}
              className={cn(
                "h-10 w-full rounded-lg border border-white/10 bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                deep ? "text-slate-100" : "text-foreground",
              )}
            >
              {footprintGoalOptions.map((option) => (
                <option key={option.value} value={option.value} className="bg-[#0a0e14] text-slate-100">
                  {option.label}
                </option>
              ))}
            </select>
            <label
              htmlFor="demo-account-estimate"
              className={cn("block text-left text-xs font-medium", deep ? "text-slate-300" : "text-muted-foreground")}
            >
              How many online accounts do you think you have?
            </label>
            <select
              id="demo-account-estimate"
              name="accountCountEstimate"
              value={accountCountEstimate}
              onChange={(event) => setAccountCountEstimate(event.target.value as (typeof accountEstimateOptions)[number]["value"])}
              disabled={status === "loading"}
              className={cn(
                "h-10 w-full rounded-lg border border-white/10 bg-transparent px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
                deep ? "text-slate-100" : "text-foreground",
              )}
            >
              {accountEstimateOptions.map((option) => (
                <option key={option.value} value={option.value} className="bg-[#0a0e14] text-slate-100">
                  {option.label}
                </option>
              ))}
            </select>
            <label
              htmlFor="demo-notes"
              className={cn("block text-left text-xs font-medium", deep ? "text-slate-300" : "text-muted-foreground")}
            >
              What would make this useful to you?
            </label>
            <Textarea
              id="demo-notes"
              name="usefulnessNotes"
              maxLength={500}
              placeholder="Optional: one sentence is enough."
              value={usefulnessNotes}
              onChange={(event) => setUsefulnessNotes(event.target.value)}
              disabled={status === "loading"}
              className={cn(
                "min-h-20 resize-y border border-white/10 bg-transparent text-sm focus-visible:ring-2",
                deep ? "text-slate-100 placeholder:text-slate-500" : "text-foreground placeholder:text-muted-foreground/65",
              )}
            />
            <button
              type="submit"
              disabled={status === "loading"}
              className={cn(
                buttonVariants({ variant: "default", size: "default" }),
                "h-11 w-full shrink-0 rounded-lg px-5 text-sm font-medium",
                deep &&
                  "border-0 bg-gradient-to-br from-cyan-400 via-cyan-500 to-teal-600 font-semibold text-black hover:opacity-95",
              )}
            >
              {status === "loading" ? "Submitting..." : "Continue to verify email"}
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
