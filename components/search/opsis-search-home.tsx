"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { Layers, Search } from "lucide-react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { recordFunnelFeedback } from "@/lib/feedback-client";
import { SESSION_PENDING_GMAIL_EMAIL } from "@/lib/gmail-import-session";
import { MAX_REVIEW_CANDIDATE_IDS, profileEmailSchema } from "@/lib/validations/import";
import { cn } from "@/lib/utils";

const landingCta = cn(
  "inline-flex items-center justify-center font-bold uppercase tracking-wide text-black transition-[transform,box-shadow]",
  "bg-gradient-to-br from-cyan-400 via-cyan-500 to-teal-600",
  "shadow-[0_0_32px_-4px_rgba(34,211,238,0.45)] hover:shadow-[0_0_40px_-2px_rgba(34,211,238,0.55)] motion-safe:hover:scale-[1.02]",
);

const appLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/vault", label: "Vault" },
  { href: "/graph", label: "Graph" },
  { href: "/insights", label: "Insights" },
] as const;

type SearchCandidate = {
  id: string;
  title: string;
  proposedVaultType: string;
  status: string;
  sourceName: string;
  confidenceBand: string;
  confidenceScore: number;
  snippet?: string | null;
};

type SearchReport = {
  runId?: string;
  id?: string;
  status: string;
  totalCandidates: number;
  importedCount: number;
  reviewCount: number;
  metadata?: {
    exposureNarrative?: {
      headline?: string;
      highlights?: string[];
      riskBadges?: string[];
    } | null;
  } | null;
};

type PipelineSection = { id: string; label: string; candidates: SearchCandidate[] };

type UnifiedImportMember = {
  id: string;
  importJobId: string;
  status: string;
  signal: string;
  suggestedType: string;
  title: string;
  provider: string | null;
  providerDomain: string | null;
  evidence: unknown;
  dedupeKey: string;
  createdVaultItemId: string | null;
  createdAt: string;
  sourceEmail: string | null;
};

type UnifiedImportCandidateGroup = {
  unificationKey: string;
  suggestedType: string;
  title: string;
  provider: string | null;
  sourceEmails: string[];
  members: UnifiedImportMember[];
};

type ImportScanMeta = {
  jobId: string;
  detected: number;
  inserted: number;
  messagesScanned: number;
};

function evidenceSnippet(ev: unknown): string | null {
  if (!ev || typeof ev !== "object") return null;
  const o = ev as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof o.subject === "string" && o.subject.trim()) parts.push(o.subject.trim());
  const rawDomains = o.rawSenderDomains;
  const sender =
    typeof o.sender === "string"
      ? o.sender
      : Array.isArray(rawDomains) && typeof rawDomains[0] === "string"
        ? rawDomains[0]
        : null;
  if (sender?.trim()) parts.push(sender.trim());
  return parts.length ? parts.join(" · ") : null;
}

function confidenceFromImportSignal(signal: string): { band: string; score: number } {
  const s = signal.toLowerCase();
  if (s.includes("strong") || s.includes("high")) return { band: "high", score: 0.82 };
  if (s.includes("weak") || s.includes("low")) return { band: "low", score: 0.48 };
  return { band: "medium", score: 0.72 };
}

function pipelineBucketForSuggestedType(suggestedType: string): { id: string; label: string } {
  if (suggestedType === "subscription") return { id: "subscriptions", label: "Subscriptions" };
  if (suggestedType === "account") return { id: "accounts", label: "Accounts" };
  return { id: "other", label: "Other" };
}

function mapUnifiedImportToView(
  unified: UnifiedImportCandidateGroup[],
  jobId: string,
  stats: Pick<ImportScanMeta, "detected" | "inserted">,
): { results: SearchCandidate[]; pipelines: PipelineSection[]; report: SearchReport } {
  const results: SearchCandidate[] = [];
  const byPipeline = new Map<string, { label: string; list: SearchCandidate[] }>();

  for (const g of unified) {
    for (const m of g.members) {
      const { band, score } = confidenceFromImportSignal(m.signal);
      const sourceName = m.provider?.trim() || m.providerDomain?.trim() || "Gmail inbox";
      const c: SearchCandidate = {
        id: m.id,
        title: g.title || m.title,
        proposedVaultType: m.suggestedType,
        status: m.status,
        sourceName,
        confidenceBand: band,
        confidenceScore: score,
        snippet: evidenceSnippet(m.evidence),
      };
      results.push(c);
      const pl = pipelineBucketForSuggestedType(m.suggestedType);
      const prev = byPipeline.get(pl.id);
      if (prev) prev.list.push(c);
      else byPipeline.set(pl.id, { label: pl.label, list: [c] });
    }
  }

  const order = ["accounts", "subscriptions", "other"];
  const pipelines: PipelineSection[] = [];
  for (const id of order) {
    const bucket = byPipeline.get(id);
    if (bucket?.list.length) {
      pipelines.push({ id, label: bucket.label, candidates: bucket.list });
    }
  }

  const reviewCount = results.filter((r) => r.status === "pending").length;
  const report: SearchReport = {
    runId: jobId,
    id: jobId,
    status: reviewCount > 0 ? "awaiting_review" : "completed",
    totalCandidates: stats.detected,
    importedCount: 0,
    reviewCount,
    metadata: null,
  };

  return { results, pipelines, report };
}

function scanPhaseLabel(searchLoading: boolean, report: SearchReport | null): string {
  if (searchLoading) return "Scanning inbox…";
  if (!report) return "";
  switch (report.status) {
    case "awaiting_review":
      return "Scan complete — awaiting your review";
    case "completed":
      return "Complete";
    case "failed":
      return "Run finished with errors";
    default:
      return report.status.replaceAll("_", " ");
  }
}

export function OpsisSearchHome() {
  const { user } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [report, setReport] = useState<SearchReport | null>(null);
  const [pipelines, setPipelines] = useState<PipelineSection[]>([]);
  const [results, setResults] = useState<SearchCandidate[]>([]);
  const [importScanMeta, setImportScanMeta] = useState<ImportScanMeta | null>(null);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(() => new Set());
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewBanner, setReviewBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [resolvedEmailVaultItemId, setResolvedEmailVaultItemId] = useState<string | null>(null);
  const [showViewInVault, setShowViewInVault] = useState(false);
  const [scanBarPct, setScanBarPct] = useState(0);
  const [showNeedsGmailConnect, setShowNeedsGmailConnect] = useState(false);
  const [gmailOAuthBanner, setGmailOAuthBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [connectLoading, setConnectLoading] = useState(false);
  const [scanNotice, setScanNotice] = useState<string | null>(null);
  const abandonFiredJobIdRef = useRef<string | null>(null);

  const signedInEmail = useMemo(() => {
    return user?.primaryEmailAddress?.emailAddress?.trim().toLowerCase() ?? null;
  }, [user]);

  const reportJobRef = useMemo(() => {
    if (!report) return null;
    const maybeRunId = typeof report.runId === "string" ? report.runId : null;
    if (maybeRunId) return maybeRunId;
    const maybeId = typeof report.id === "string" ? report.id : null;
    return maybeId;
  }, [report]);

  const pendingResultIds = useMemo(() => results.filter((x) => x.status === "pending").map((x) => x.id), [results]);
  const pendingSelectedIds = useMemo(
    () => [...selectedCandidateIds].filter((id) => pendingResultIds.includes(id)),
    [pendingResultIds, selectedCandidateIds],
  );
  const hasPendingResults = pendingResultIds.length > 0;

  const showSearchControls = !searchLoading && !report;
  const scanUiBusy = searchLoading;
  const resultCount = report?.reviewCount ?? pendingResultIds.length;
  const resultsSummaryRight = useMemo(() => {
    if (scanUiBusy && results.length === 0) return { mode: "pending" as const };
    return { mode: "count" as const, value: resultCount };
  }, [scanUiBusy, results.length, resultCount]);
  const exposureNarrative = report?.metadata?.exposureNarrative ?? null;

  const refreshImportView = useCallback(async (meta: ImportScanMeta) => {
    /** Omit jobId so rows skipped as user-level dedupes on this run still surface older pending imports. */
    const params = new URLSearchParams({ unified: "true", status: "pending" });
    const res = await fetch(`/api/import/candidates?${params.toString()}`, { credentials: "same-origin" });
    if (!res.ok) return;
    const data = (await res.json()) as { unified?: UnifiedImportCandidateGroup[] };
    const unified = data.unified ?? [];
    const { results: nextResults, pipelines: nextPipelines, report: nextReport } = mapUnifiedImportToView(
      unified,
      meta.jobId,
      { detected: meta.detected, inserted: meta.inserted },
    );
    setResults(nextResults);
    setPipelines(nextPipelines);
    setReport(nextReport);
  }, []);

  useEffect(() => {
    if (query.trim()) return;
    if (!signedInEmail) return;
    setQuery(signedInEmail);
  }, [query, signedInEmail]);

  useEffect(() => {
    const connected = searchParams.get("gmail_connected");
    const err = searchParams.get("gmail_error");
    if (connected) {
      setGmailOAuthBanner({
        kind: "ok",
        text: "Gmail connected. Run scan to pull inbox candidates.",
      });
      const pending = sessionStorage.getItem(SESSION_PENDING_GMAIL_EMAIL);
      if (pending) {
        setQuery(pending);
        sessionStorage.removeItem(SESSION_PENDING_GMAIL_EMAIL);
      }
      router.replace("/search", { scroll: false });
      return;
    }
    if (err) {
      setGmailOAuthBanner({
        kind: "err",
        text: `Gmail connection failed (${err.replaceAll("_", " ")}). Try again or check OAuth configuration.`,
      });
      sessionStorage.removeItem(SESSION_PENDING_GMAIL_EMAIL);
      router.replace("/search", { scroll: false });
    }
  }, [searchParams, router]);

  useEffect(() => {
    if (searchLoading) {
      const id = window.setInterval(() => {
        setScanBarPct((p) => Math.min(88, p + 2.4));
      }, 120);
      return () => window.clearInterval(id);
    }
    if (!report) return;
    setScanBarPct(100);
  }, [searchLoading, report]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== "hidden") return;
      const jobId = reportJobRef;
      if (!jobId) return;
      if (report?.status !== "awaiting_review") return;
      if (pendingResultIds.length === 0) return;
      if (selectedCandidateIds.size > 0) return;
      if (abandonFiredJobIdRef.current === jobId) return;
      abandonFiredJobIdRef.current = jobId;
      recordFunnelFeedback({
        theme: "funnel_dropoff",
        surface: "search",
        metadata: {
          pathname: "/search",
          funnelStep: "review_tab_hidden_pending",
          importJobId: jobId,
        },
      });
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [report?.status, reportJobRef, pendingResultIds.length, selectedCandidateIds.size]);

  const onConnectGmail = useCallback(async () => {
    const parsed = profileEmailSchema.safeParse(query.trim());
    if (!parsed.success) {
      setSearchError(parsed.error.issues[0]?.message ?? "Enter a valid email address.");
      return;
    }
    const normalizedEmail = parsed.data.trim().toLowerCase();
    setSearchError(null);
    setConnectLoading(true);
    setGmailOAuthBanner(null);
    try {
      const anchorRes = await fetch("/api/vault/email-anchor", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      const anchorBody = (await anchorRes.json().catch(() => ({}))) as Record<string, unknown>;
      if (!anchorRes.ok) {
        setSearchError(
          typeof anchorBody.error === "string" ? `Could not save profile email (${anchorBody.error}).` : "Could not save profile email.",
        );
        return;
      }
      const vaultItemId = typeof anchorBody.vaultItemId === "string" ? anchorBody.vaultItemId : null;
      const norm = typeof anchorBody.normalizedEmail === "string" ? anchorBody.normalizedEmail : normalizedEmail;
      if (vaultItemId) setResolvedEmailVaultItemId(vaultItemId);
      setQuery(norm);
      sessionStorage.setItem(SESSION_PENDING_GMAIL_EMAIL, norm);
      window.location.href = "/api/import/gmail/authorize?returnTo=/search";
    } catch {
      setSearchError("Could not reach server. Check your connection.");
    } finally {
      setConnectLoading(false);
    }
  }, [query]);

  const onReviewCandidates = useCallback(
    async (action: "accept" | "reject") => {
      if (pendingSelectedIds.length === 0) return;
      if (action === "accept" && !resolvedEmailVaultItemId) {
        setReviewBanner({
          kind: "err",
          text: "Email anchor missing. Run scan again or reconnect Gmail.",
        });
        return;
      }
      if (!importScanMeta) {
        setReviewBanner({ kind: "err", text: "Scan session missing. Run scan again." });
        return;
      }
      setReviewLoading(true);
      setReviewBanner(null);
      try {
        const chunks: string[][] = [];
        for (let i = 0; i < pendingSelectedIds.length; i += MAX_REVIEW_CANDIDATE_IDS) {
          chunks.push(pendingSelectedIds.slice(i, i + MAX_REVIEW_CANDIDATE_IDS));
        }
        let approved = 0;
        let rejected = 0;
        let skipped = 0;
        for (const chunk of chunks) {
          const res = await fetch("/api/import/candidates/review", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              action === "accept"
                ? { action: "approve", candidateIds: chunk, emailVaultItemId: resolvedEmailVaultItemId }
                : { action: "reject", candidateIds: chunk },
            ),
          });
          if (!res.ok) {
            setReviewBanner({ kind: "err", text: "Candidate review failed. Try again." });
            return;
          }
          const body = (await res.json()) as {
            approvedVaultItemIds?: string[];
            rejectedCount?: number;
            skippedCount?: number;
          };
          if (action === "accept") {
            approved += body.approvedVaultItemIds?.length ?? 0;
            skipped += body.skippedCount ?? 0;
          } else {
            rejected += body.rejectedCount ?? chunk.length;
          }
        }
        if (action === "accept") {
          setReviewBanner({
            kind: "ok",
            text: `Approved ${pendingSelectedIds.length} row(s): ${approved} added to vault${skipped ? `, ${skipped} skipped` : ""}.`,
          });
          setShowViewInVault(pendingSelectedIds.length > 0);
        } else {
          setReviewBanner({ kind: "ok", text: `Rejected ${rejected} candidate row(s).` });
        }
        setSelectedCandidateIds(new Set());
        await refreshImportView(importScanMeta);
      } catch {
        setReviewBanner({ kind: "err", text: "Candidate review failed (network)." });
      } finally {
        setReviewLoading(false);
      }
    },
    [importScanMeta, pendingSelectedIds, refreshImportView, resolvedEmailVaultItemId],
  );

  const onSearch = async () => {
    const parsed = profileEmailSchema.safeParse(query.trim());
    if (!parsed.success) {
      setSearchError(parsed.error.issues[0]?.message ?? "Enter a valid email address.");
      return;
    }
    const normalizedEmail = parsed.data.trim().toLowerCase();
    setQuery(normalizedEmail);
    setSearchError(null);
    setShowNeedsGmailConnect(false);
    setGmailOAuthBanner(null);
    setSearchLoading(true);
    setScanBarPct(6);
    setReport(null);
    setPipelines([]);
    setResults([]);
    setImportScanMeta(null);
    setSelectedCandidateIds(new Set());
    setShowViewInVault(false);
    setScanNotice(null);
    abandonFiredJobIdRef.current = null;

    try {
      const anchorRes = await fetch("/api/vault/email-anchor", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: normalizedEmail }),
      });
      if (anchorRes.ok) {
        const anchorBody = (await anchorRes.json().catch(() => ({}))) as { vaultItemId?: string };
        if (anchorBody.vaultItemId) setResolvedEmailVaultItemId(anchorBody.vaultItemId);
      }

      const gmailRes = await fetch("/api/import/gmail", { credentials: "same-origin" });
      if (!gmailRes.ok) {
        setSearchError(gmailRes.status === 401 ? "Sign in required." : "Could not load Gmail connectors.");
        return;
      }
      const gmailData = (await gmailRes.json()) as { connectors?: { id: string; gmailAddress: string }[] };
      const connectors = gmailData.connectors ?? [];
      const connector = connectors.find((c) => c.gmailAddress.trim().toLowerCase() === normalizedEmail);
      if (!connector) {
        setShowNeedsGmailConnect(true);
        setSearchError(null);
        return;
      }

      const jobRes = await fetch("/api/import/jobs", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gmailConnectorId: connector.id,
          profileEmail: normalizedEmail,
        }),
      });
      const jobBody = (await jobRes.json().catch(() => ({}))) as Record<string, unknown>;

      if (!jobRes.ok) {
        const code = typeof jobBody.error === "string" ? jobBody.error : "";
        const message = typeof jobBody.message === "string" ? jobBody.message : null;
        if (code === "IMPORT_COOLDOWN") {
          const retryAfter =
            typeof jobBody.retryAfterSeconds === "number" && Number.isFinite(jobBody.retryAfterSeconds)
              ? Math.max(1, Math.round(jobBody.retryAfterSeconds))
              : null;
          setSearchError(
            retryAfter ? `Scan cooldown active. Try again in about ${retryAfter}s.` : "Scan cooldown active. Please wait briefly before trying again.",
          );
          return;
        }
        if (code === "GMAIL_REAUTH_REQUIRED") {
          setSearchError("Gmail connection expired. Use Connect Gmail below, then scan again.");
          setShowNeedsGmailConnect(true);
          return;
        }
        setSearchError(message ?? code ?? "Scan failed.");
        return;
      }

      const jobId = typeof jobBody.jobId === "string" ? jobBody.jobId : null;
      if (!jobId) {
        setSearchError("Unexpected response from server.");
        return;
      }

      const detected = typeof jobBody.detectedCandidates === "number" ? jobBody.detectedCandidates : 0;
      const inserted = typeof jobBody.insertedCandidates === "number" ? jobBody.insertedCandidates : 0;
      const messagesScanned = typeof jobBody.messagesScanned === "number" ? jobBody.messagesScanned : 0;
      const meta: ImportScanMeta = { jobId, detected, inserted, messagesScanned };
      setImportScanMeta(meta);

      if (inserted === 0 && detected > 0) {
        setScanNotice(
          `This run matched ${detected} service signal(s), but none were added as new rows (they already exist as pending or approved for your account). Showing any existing pending imports below.`,
        );
      } else if (inserted === 0 && detected === 0 && messagesScanned > 0) {
        setScanNotice(
          `Scanned ${messagesScanned} message(s) in the last 540 days. No account/subscription candidates met the detector thresholds (transactional subject/snippet patterns from non-personal senders).`,
        );
      }

      const params = new URLSearchParams({ unified: "true", status: "pending" });
      const candRes = await fetch(`/api/import/candidates?${params.toString()}`, { credentials: "same-origin" });
      if (!candRes.ok) {
        setSearchError("Scan finished but candidates could not be loaded.");
        return;
      }
      const candData = (await candRes.json()) as { unified?: UnifiedImportCandidateGroup[] };
      const unified = candData.unified ?? [];
      const { results: nextResults, pipelines: nextPipelines, report: nextReport } = mapUnifiedImportToView(
        unified,
        jobId,
        { detected, inserted },
      );
      setResults(nextResults);
      setPipelines(nextPipelines);
      setReport(nextReport);

      recordFunnelFeedback({
        theme: "expectations",
        surface: "search",
        metadata: {
          pathname: "/search",
          funnelStep: "scan_started",
          importJobId: jobId,
        },
      });
    } catch {
      setSearchError("Search failed. Try again.");
    } finally {
      setSearchLoading(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col bg-[#05070a] text-slate-200">
      <header className="sticky top-0 z-50 shrink-0 border-b border-white/[0.06] bg-[#05070a]/85 backdrop-blur-md supports-[backdrop-filter]:bg-[#05070a]/75">
        <div className="mx-auto flex h-12 w-full max-w-6xl items-center justify-between gap-3 px-5 sm:h-14 sm:px-8 lg:px-12">
          <Link href="/search" className="group flex min-w-0 items-center gap-2.5">
            <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 transition-colors group-hover:border-cyan-400/35">
              <Layers className="size-4" aria-hidden />
            </span>
            <span className="truncate font-mono text-sm font-bold tracking-tight text-white sm:text-[0.9375rem]">LMX</span>
          </Link>
          <div className="flex min-w-0 flex-1 items-center justify-end gap-3 sm:gap-5">
            <nav
              className="min-w-0 flex-1 overflow-x-auto [-webkit-overflow-scrolling:touch] [scrollbar-width:none] sm:flex-initial sm:overflow-visible [&::-webkit-scrollbar]:hidden"
              aria-label="App"
            >
              <div className="flex items-center justify-end gap-4 whitespace-nowrap pr-1 text-xs font-medium text-slate-400 sm:text-sm">
                {appLinks.map((item) => (
                  <Link key={item.href} href={item.href} className="transition-colors hover:text-white">
                    {item.label}
                  </Link>
                ))}
              </div>
            </nav>
            <span className="shrink-0">
              <UserButton />
            </span>
          </div>
        </div>
      </header>

      <main className="relative flex flex-1 flex-col items-center justify-center overflow-hidden px-5 py-10 sm:px-8 lg:px-12">
        <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
          <div
            className="absolute inset-0 opacity-[0.12]"
            style={{
              backgroundImage: `linear-gradient(to right, rgba(148, 163, 184, 0.12) 1px, transparent 1px),
                  linear-gradient(to bottom, rgba(148, 163, 184, 0.12) 1px, transparent 1px)`,
              backgroundSize: "44px 44px",
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-20%,rgba(34,211,238,0.12),transparent_55%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_45%_at_80%_60%,rgba(139,92,246,0.06),transparent_50%)]" />
        </div>

        <section className="relative z-10 w-full max-w-5xl px-0 sm:px-2">
          <div className="space-y-7 text-center">
            <div className="mx-auto flex max-w-xl flex-col items-center gap-3 lg:max-w-none">
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-cyan-400/95">Inbox scan</p>
              <h1 className="text-balance font-heading text-3xl font-semibold leading-[1.08] tracking-[-0.02em] text-white sm:text-4xl">
                See what your mailbox implies
              </h1>
              <p className="max-w-lg text-pretty text-sm leading-relaxed text-slate-400 sm:text-base">
                Connect Gmail, scan recent mail for services and subscriptions, then approve what belongs in your vault.
              </p>
            </div>

            {gmailOAuthBanner ? (
              <p
                className={cn(
                  "mx-auto max-w-xl text-sm",
                  gmailOAuthBanner.kind === "ok" ? "text-emerald-300" : "text-rose-300",
                )}
              >
                {gmailOAuthBanner.text}
              </p>
            ) : null}

            {showSearchControls ? (
              <form
                className="mx-auto w-full max-w-[980px]"
                onSubmit={(event) => {
                  event.preventDefault();
                  void onSearch();
                }}
              >
                <div className="flex flex-col gap-2 rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-2.5 shadow-[0_0_60px_-12px_rgba(34,211,238,0.12)] backdrop-blur-sm sm:flex-row sm:items-stretch">
                  <input
                    type="email"
                    autoComplete="email"
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder="you@example.com"
                    className="h-12 flex-1 rounded-xl border border-white/[0.08] bg-white/[0.04] px-5 text-base text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-500/40 focus:ring-1 focus:ring-cyan-400/25"
                  />
                  <button
                    type="submit"
                    disabled={searchLoading}
                    className={cn(
                      "inline-flex h-12 min-w-[10.5rem] shrink-0 items-center justify-center gap-2 rounded-full px-8 text-sm disabled:pointer-events-none disabled:opacity-60",
                      landingCta,
                    )}
                  >
                    <Search className="size-4 shrink-0" aria-hidden />
                    {searchLoading ? "Scanning…" : "Scan inbox"}
                  </button>
                </div>
              </form>
            ) : null}

            {showNeedsGmailConnect && !report ? (
              <div className="mx-auto max-w-xl space-y-3 rounded-xl border border-cyan-500/20 bg-cyan-500/5 px-4 py-3 text-left text-sm text-slate-200">
                <p className="text-slate-300">
                  No Gmail connector for <span className="font-mono text-cyan-200/90">{query.trim().toLowerCase()}</span>. Connect
                  OAuth read-only access for that mailbox, then run the scan again.
                </p>
                <button
                  type="button"
                  disabled={connectLoading}
                  onClick={() => void onConnectGmail()}
                  className={cn(
                    "inline-flex w-full items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-semibold disabled:opacity-60 sm:w-auto",
                    landingCta,
                  )}
                >
                  {connectLoading ? "Preparing…" : "Connect Gmail"}
                </button>
              </div>
            ) : null}

            {searchError ? <p className="text-sm text-rose-300">{searchError}</p> : null}

            {searchLoading || report ? (
              <div className="mx-auto w-full max-w-[1120px] rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-4 text-left shadow-[0_0_60px_-12px_rgba(34,211,238,0.15)] backdrop-blur-sm">
                <div className="mb-3">
                  <p className="font-heading text-lg font-semibold tracking-tight text-white">Scan progress</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
                    Live preview: inbox messages are analyzed for account and subscription signals you can promote to the vault.
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5">
                  <p className="mb-0.5 font-mono text-[9px] font-medium uppercase tracking-[0.2em] text-slate-500">email</p>
                  <p className="rounded-md border border-white/[0.08] bg-[#05070a]/80 px-2.5 py-1.5 font-mono text-xs tracking-wide text-cyan-100/90">
                    {query.trim().toLowerCase()}
                  </p>
                  <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
                    <div
                      className={cn(
                        "h-full rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.35)]",
                        "transition-[width] duration-[850ms] ease-[cubic-bezier(0.22,1,0.36,1)]",
                        scanUiBusy ? "motion-safe:animate-pulse" : "",
                      )}
                      style={{ width: `${Math.round(scanBarPct)}%` }}
                    />
                  </div>
                  <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-[11px] leading-snug text-slate-400">
                    <span>{scanPhaseLabel(searchLoading, report)}</span>
                    <span className="text-right">
                      {resultsSummaryRight.mode === "pending" ? (
                        <span className="max-w-[min(20rem,55vw)] text-cyan-300/85">
                          Fetching message metadata in batches — large mailboxes can take a few minutes.
                        </span>
                      ) : (
                        <span>
                          {resultsSummaryRight.value} pending review
                        </span>
                      )}
                    </span>
                  </div>
                  {searchLoading ? (
                    <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                      The page stays on this screen until the server finishes listing and reading Gmail (up to thousands of
                      recent messages). This is normal; it is not frozen.
                    </p>
                  ) : null}
                </div>

                {results.length > 0 ? (
                  <div className="mt-3 grid gap-2.5 md:grid-cols-3">
                    {results.slice(0, 3).map((item) => (
                      <div key={item.id} className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-3">
                        <p className="mb-1.5 font-mono text-[9px] font-medium uppercase tracking-[0.18em] text-slate-500">
                          {item.sourceName}
                        </p>
                        <p className="text-sm font-medium leading-snug tracking-tight text-white">{item.title}</p>
                        <div className="mt-2 space-y-0.5 text-[11px] leading-relaxed text-slate-400">
                          <p>{item.proposedVaultType.replaceAll("_", " ").toLowerCase()}</p>
                          <p>{Math.round(item.confidenceScore * 100)}% confidence</p>
                          <p>{item.status.replaceAll("_", " ")}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}

                {report ? (
                  <div className="mt-2.5 flex flex-wrap items-center gap-3 text-[10px] font-normal tracking-wide text-slate-500">
                    <span>job {reportJobRef ? reportJobRef.slice(0, 8) : "pending"}</span>
                    <span>{report.totalCandidates} detected</span>
                    <span>{report.importedCount} imported</span>
                    <span>{report.reviewCount} pending</span>
                    <span>{report.status.replaceAll("_", " ")}</span>
                    {importScanMeta ? <span>{importScanMeta.messagesScanned} messages scanned</span> : null}
                  </div>
                ) : null}
                {exposureNarrative ? (
                  <div className="mt-3 rounded-lg border border-amber-300/20 bg-amber-300/5 p-2.5">
                    <p className="text-xs font-medium text-amber-100/95">
                      {exposureNarrative.headline ?? "Exposure signals were detected."}
                    </p>
                    {Array.isArray(exposureNarrative.highlights) && exposureNarrative.highlights.length > 0 ? (
                      <p className="mt-1 text-[11px] text-amber-100/75">
                        {exposureNarrative.highlights.slice(0, 4).join(" · ")}
                      </p>
                    ) : null}
                    {Array.isArray(exposureNarrative.riskBadges) && exposureNarrative.riskBadges.length > 0 ? (
                      <div className="mt-1.5 flex flex-wrap gap-1.5">
                        {exposureNarrative.riskBadges.map((badge) => (
                          <span
                            key={badge}
                            className="rounded-full border border-rose-300/25 bg-rose-400/10 px-2 py-0.5 text-[10px] uppercase tracking-wide text-rose-200/90"
                          >
                            {badge.replaceAll("_", " ")}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ) : null}

            {report ? (
              <div className="mx-auto w-full max-w-[980px] rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-3.5 text-left shadow-[0_0_60px_-12px_rgba(34,211,238,0.12)] backdrop-blur-sm">
                {scanNotice ? (
                  <p className="mb-3 rounded-lg border border-amber-400/20 bg-amber-400/5 px-3 py-2 text-xs leading-relaxed text-amber-50/95">
                    {scanNotice}
                  </p>
                ) : null}
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs leading-snug text-slate-400">
                    Inbox candidates:{" "}
                    {scanUiBusy && results.length === 0 ? (
                      <span className="font-medium text-cyan-300/80">collecting candidate rows…</span>
                    ) : (
                      <>
                        <span className="font-medium text-white">{results.length}</span> candidate row(s)
                      </>
                    )}
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      type="button"
                      onClick={() => setSelectedCandidateIds(new Set(pendingResultIds))}
                      disabled={reviewLoading || !hasPendingResults}
                      className="rounded-md border border-white/[0.1] bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-slate-200 transition disabled:cursor-not-allowed disabled:opacity-50 hover:border-white/[0.14] hover:bg-white/[0.08]"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => void onReviewCandidates("reject")}
                      disabled={reviewLoading || pendingSelectedIds.length === 0}
                      className="rounded-md border border-white/[0.1] bg-white/[0.05] px-2 py-0.5 text-[10px] font-medium text-slate-200 transition disabled:cursor-not-allowed disabled:opacity-50 hover:border-white/[0.14] hover:bg-white/[0.08]"
                    >
                      Disapprove selected
                    </button>
                    <button
                      type="button"
                      onClick={() => void onReviewCandidates("accept")}
                      disabled={reviewLoading || pendingSelectedIds.length === 0}
                      className="rounded-md border border-cyan-500/30 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-100 transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-cyan-500/18"
                    >
                      Approve + Push to Vault
                    </button>
                    {showViewInVault ? (
                      <Link
                        href="/vault"
                        className="rounded border border-emerald-500/50 bg-emerald-500/12 px-2 py-0.5 text-[10px] font-medium tracking-wide text-emerald-200/95 transition hover:bg-emerald-500/22"
                      >
                        View in vault
                      </Link>
                    ) : null}
                  </div>
                </div>
                {reviewBanner ? (
                  <p className={reviewBanner.kind === "ok" ? "mb-3 text-xs text-emerald-300" : "mb-3 text-xs text-rose-300"}>
                    {reviewBanner.text}
                  </p>
                ) : null}
                {pipelines.length > 0 ? (
                  <div className="space-y-3">
                    {pipelines.map((section) => (
                      <div key={section.id}>
                        <p className="mb-1.5 font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
                          {section.label} ({section.candidates.length})
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {section.candidates.map((item) => (
                            <div key={item.id} className="rounded-lg border border-white/[0.08] bg-white/[0.03] p-2.5">
                              <label className="mb-0.5 inline-flex items-center gap-1.5 text-[10px] text-slate-400">
                                <input
                                  type="checkbox"
                                  checked={selectedCandidateIds.has(item.id)}
                                  disabled={item.status !== "pending" || reviewLoading}
                                  onChange={() => {
                                    if (item.status !== "pending") return;
                                    setSelectedCandidateIds((prev) => {
                                      const next = new Set(prev);
                                      if (next.has(item.id)) next.delete(item.id);
                                      else next.add(item.id);
                                      return next;
                                    });
                                  }}
                                  className="size-3.5 rounded border-slate-600 bg-slate-800 accent-cyan-500"
                                />
                                {item.status === "pending" ? "Select" : "Reviewed"}
                              </label>
                              <p className="text-xs font-medium leading-snug tracking-tight text-white/95">{item.title}</p>
                              <p className="mt-0.5 text-[10px] font-normal leading-relaxed tracking-wide text-slate-400">
                                {item.proposedVaultType.replaceAll("_", " ")} · {item.status} · {item.sourceName}
                              </p>
                              <p className="mt-0.5 text-[10px] text-slate-500">
                                {item.confidenceBand} ({Math.round(item.confidenceScore * 100)}%)
                              </p>
                              {item.snippet ? (
                                <p className="mt-0.5 text-[10px] font-normal leading-relaxed text-slate-500 line-clamp-2">
                                  {item.snippet}
                                </p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs font-normal leading-relaxed tracking-wide text-slate-400">
                    No pending candidates to review. Approved candidates are already routed to vault.
                  </p>
                )}
              </div>
            ) : null}
          </div>
        </section>
      </main>
    </div>
  );
}
