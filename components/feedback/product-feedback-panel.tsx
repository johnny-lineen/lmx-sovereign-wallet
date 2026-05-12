"use client";

import { MessageSquarePlus, X } from "lucide-react";
import { usePathname, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FEEDBACK_NUDGE_REQUEST_EVENT,
  getFeedbackNudgeSnoozeUntil,
  snoozeFeedbackNudge,
  type FeedbackNudgeReason,
} from "@/lib/feedback-nudge";
import { submitProductFeedback } from "@/lib/feedback-client";
import { FEEDBACK_THEME_LABELS, FEEDBACK_THEME_ORDER, type ProductFeedbackBody } from "@/lib/validations/feedback";
import { cn } from "@/lib/utils";

const NUDGE_MIN_INTERVAL_MS = 55_000;
const NUDGE_SNOOZE_MS = 8 * 60 * 1000;
const NUDGE_AFTER_NAV_MS = 720;
const NUDGE_AFTER_FEEDBACK_SUBMIT_MS = 12 * 60 * 1000;
const NUDGE_AFTER_INITIAL_LOAD_MS = 1200;

function defaultSurfaceFromPathname(pathname: string | null): string {
  if (!pathname || pathname === "/") return "other";
  const seg = pathname.replace(/^\//, "").split("/")[0] ?? "other";
  const known = new Set([
    "dashboard",
    "vault",
    "graph",
    "insights",
    "agent",
    "settings",
    "search",
    "demo",
    "access-restricted",
  ]);
  return known.has(seg) ? seg : "other";
}

export function ProductFeedbackPanel() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const surface = useMemo(() => defaultSurfaceFromPathname(pathname), [pathname]);
  const vaultQueryKey = pathname === "/vault" ? searchParams.toString() : "";
  const [open, setOpen] = useState(false);
  const [nudgeOpen, setNudgeOpen] = useState(false);
  const [theme, setTheme] = useState<ProductFeedbackBody["theme"]>("confusion");
  const [message, setMessage] = useState("");
  const [rating, setRating] = useState<-1 | 0 | 1 | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [thanks, setThanks] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastNudgeAtRef = useRef(0);
  const hasShownInitialNudgeRef = useRef(false);
  const prevPathRef = useRef<string | null>(null);
  const prevVaultQueryRef = useRef<string | null>(null);

  const tryShowNudge = useCallback(
    (_reason: FeedbackNudgeReason) => {
      if (pathname === "/dev-ops" || pathname?.startsWith("/dev-ops/")) return;
      if (open) return;
      if (thanks) return;
      const now = Date.now();
      if (now < getFeedbackNudgeSnoozeUntil()) return;
      if (now - lastNudgeAtRef.current < NUDGE_MIN_INTERVAL_MS) return;
      lastNudgeAtRef.current = now;
      setNudgeOpen(true);
    },
    [open, pathname, thanks],
  );

  useEffect(() => {
    if (pathname === "/dev-ops" || pathname?.startsWith("/dev-ops/")) return;
    if (hasShownInitialNudgeRef.current) return;
    hasShownInitialNudgeRef.current = true;
    const t = window.setTimeout(() => tryShowNudge("route"), NUDGE_AFTER_INITIAL_LOAD_MS);
    return () => window.clearTimeout(t);
  }, [pathname, tryShowNudge]);

  useEffect(() => {
    if (pathname === "/dev-ops" || pathname?.startsWith("/dev-ops/")) return;
    if (prevPathRef.current === null) {
      prevPathRef.current = pathname;
      return;
    }
    if (prevPathRef.current === pathname) return;
    prevPathRef.current = pathname;
    setNudgeOpen(false);
    const t = window.setTimeout(() => tryShowNudge("route"), NUDGE_AFTER_NAV_MS);
    return () => window.clearTimeout(t);
  }, [pathname, tryShowNudge]);

  useEffect(() => {
    if (pathname === "/dev-ops" || pathname?.startsWith("/dev-ops/")) return;
    if (pathname !== "/vault") {
      prevVaultQueryRef.current = null;
      return;
    }
    if (prevVaultQueryRef.current === null) {
      prevVaultQueryRef.current = vaultQueryKey;
      return;
    }
    if (prevVaultQueryRef.current === vaultQueryKey) return;
    prevVaultQueryRef.current = vaultQueryKey;
    setNudgeOpen(false);
    const t = window.setTimeout(() => tryShowNudge("route"), NUDGE_AFTER_NAV_MS);
    return () => window.clearTimeout(t);
  }, [pathname, vaultQueryKey, tryShowNudge]);

  useEffect(() => {
    const onRequest = (ev: Event) => {
      const e = ev as CustomEvent<FeedbackNudgeReason>;
      tryShowNudge(e.detail ?? "action");
    };
    window.addEventListener(FEEDBACK_NUDGE_REQUEST_EVENT, onRequest);
    return () => window.removeEventListener(FEEDBACK_NUDGE_REQUEST_EVENT, onRequest);
  }, [tryShowNudge]);

  useEffect(() => {
    if (open) setNudgeOpen(false);
  }, [open]);

  const resetForm = useCallback(() => {
    setMessage("");
    setRating(null);
    setError(null);
  }, []);

  const handleSubmit = useCallback(async () => {
    setSubmitting(true);
    setError(null);
    const body: ProductFeedbackBody = {
      theme,
      surface,
      ...(message.trim() ? { message: message.trim() } : {}),
      ...(rating !== null ? { rating } : {}),
      metadata: pathname ? { pathname } : undefined,
    };
    const result = await submitProductFeedback(body);
    setSubmitting(false);
    if (!result.ok) {
      setError(result.error);
      return;
    }
    setThanks(true);
    snoozeFeedbackNudge(NUDGE_AFTER_FEEDBACK_SUBMIT_MS);
    setNudgeOpen(false);
    resetForm();
    window.setTimeout(() => {
      setThanks(false);
      setOpen(false);
    }, 2200);
  }, [message, pathname, rating, resetForm, surface, theme]);

  if (pathname === "/dev-ops" || pathname?.startsWith("/dev-ops/")) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex max-w-[min(100vw-2rem,22rem)] flex-col items-end gap-2">
      {nudgeOpen ? (
        <div
          role="region"
          aria-label="Feedback prompt"
          className={cn(
            "pointer-events-auto w-full rounded-xl border border-cyan-500/35 bg-[#0a0d12]/95 p-3 text-slate-200 shadow-[0_0_32px_-10px_rgba(34,211,238,0.35)] backdrop-blur-md",
          )}
        >
          <div className="flex items-start gap-2">
            <p className="min-w-0 flex-1 text-sm leading-snug text-slate-100">
              <span className="font-medium text-white">Give us feedback</span>
              <span className="text-slate-400"> - what is working, or what is confusing?</span>
            </p>
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              className="size-7 shrink-0 text-slate-400 hover:text-white"
              aria-label="Dismiss feedback prompt"
              onClick={() => {
                snoozeFeedbackNudge(NUDGE_SNOOZE_MS);
                setNudgeOpen(false);
              }}
            >
              <X className="size-3.5" aria-hidden />
            </Button>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              className="bg-cyan-600/90 text-white hover:bg-cyan-500/90"
              onClick={() => {
                setNudgeOpen(false);
                setOpen(true);
              }}
            >
              Open feedback
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-slate-400 hover:text-slate-200"
              onClick={() => {
                snoozeFeedbackNudge(NUDGE_SNOOZE_MS);
                setNudgeOpen(false);
              }}
            >
              Not now
            </Button>
          </div>
        </div>
      ) : null}
      {open ? (
        <Card
          className={cn(
            "pointer-events-auto w-full border-white/[0.1] bg-[#0a0d12]/95 text-slate-200 shadow-[0_0_40px_-12px_rgba(34,211,238,0.25)] backdrop-blur-md",
          )}
        >
          <CardHeader className="space-y-1 pb-2">
            <CardTitle className="text-base text-white">Product feedback</CardTitle>
            <CardDescription className="text-xs text-slate-400">
              Surface: <span className="font-mono text-cyan-300/90">{surface}</span>
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 pt-0">
            {thanks ? (
              <p className="py-4 text-center text-sm font-medium text-emerald-300/95">Thanks — we read every note.</p>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="fb-theme" className="text-xs text-slate-400">
                    Topic
                  </Label>
                  <select
                    id="fb-theme"
                    value={theme}
                    onChange={(e) => setTheme(e.target.value as ProductFeedbackBody["theme"])}
                    className="h-9 w-full rounded-lg border border-white/[0.1] bg-black/40 px-2 text-sm text-white outline-none focus-visible:ring-2 focus-visible:ring-cyan-500/40"
                  >
                    {FEEDBACK_THEME_ORDER.map((key) => (
                      <option key={key} value={key}>
                        {FEEDBACK_THEME_LABELS[key]}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <span className="text-xs text-slate-400">Optional rating</span>
                  <div className="flex gap-1">
                    {(
                      [
                        { v: -1 as const, label: "Down" },
                        { v: 0 as const, label: "Neutral" },
                        { v: 1 as const, label: "Up" },
                      ] as const
                    ).map(({ v, label }) => (
                      <Button
                        key={v}
                        type="button"
                        size="sm"
                        variant={rating === v ? "default" : "outline"}
                        className={cn(
                          "flex-1 text-xs",
                          rating === v && "border-cyan-500/40 bg-cyan-500/15 text-cyan-100",
                        )}
                        onClick={() => setRating((prev) => (prev === v ? null : v))}
                      >
                        {label}
                      </Button>
                    ))}
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="fb-msg" className="text-xs text-slate-400">
                    Details (optional)
                  </Label>
                  <Textarea
                    id="fb-msg"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="What happened? What would help?"
                    className="min-h-[88px] resize-none bg-black/30 text-sm"
                    maxLength={2000}
                  />
                </div>
                {error ? <p className="text-xs text-rose-400/90">{error}</p> : null}
                <div className="flex gap-2 pt-1">
                  <Button type="button" variant="ghost" size="sm" className="flex-1" onClick={() => setOpen(false)}>
                    Close
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    className="flex-1 bg-cyan-600/90 text-white hover:bg-cyan-500/90"
                    disabled={submitting}
                    onClick={() => void handleSubmit()}
                  >
                    {submitting ? "Sending…" : "Send"}
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}

      <Button
        type="button"
        size="icon"
        aria-label="Open product feedback"
        className={cn(
          "pointer-events-auto size-12 rounded-full border border-cyan-500/30 bg-[#0a0d12]/95 text-cyan-300 shadow-[0_0_28px_-6px_rgba(34,211,238,0.45)] backdrop-blur-md hover:bg-cyan-500/10",
          open && "ring-2 ring-cyan-400/40",
        )}
        onClick={() => {
          setOpen((o) => !o);
          if (open) setThanks(false);
          setNudgeOpen(false);
        }}
      >
        <MessageSquarePlus className="size-5" aria-hidden />
      </Button>
    </div>
  );
}
