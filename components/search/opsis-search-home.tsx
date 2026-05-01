"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { Layers, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";

const landingCta = cn(
  "inline-flex items-center justify-center font-bold uppercase tracking-wide text-black transition-[transform,box-shadow]",
  "bg-gradient-to-br from-cyan-400 via-cyan-500 to-teal-600",
  "shadow-[0_0_32px_-4px_rgba(34,211,238,0.45)] hover:shadow-[0_0_40px_-2px_rgba(34,211,238,0.55)] motion-safe:hover:scale-[1.02]",
);
import { MAX_PUBLIC_AUDIT_REVIEW_IDS } from "@/lib/validations/public-audit";

const queryModes = [
  { key: "username", label: "Username", placeholder: "Enter username..." },
  { key: "email", label: "Email", placeholder: "Enter email..." },
  { key: "domain", label: "Domain", placeholder: "Enter domain..." },
] as const;

const appLinks = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/vault", label: "Vault" },
  { href: "/graph", label: "Graph" },
  { href: "/insights", label: "Insights" },
] as const;

type QueryModeKey = (typeof queryModes)[number]["key"];
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
};
type PipelineSection = { id: string; label: string; candidates: SearchCandidate[] };
type RunDetail = {
  run: SearchReport;
  candidates: SearchCandidate[];
  pipelines: PipelineSection[];
};
const POLL_INTERVAL_MS = 2200;

function isRunActivelyScanning(status: string | undefined): boolean {
  return status === "queued" || status === "running";
}

function scanPhaseLabel(searchLoading: boolean, report: SearchReport | null): string {
  if (searchLoading) return "Starting scan…";
  if (!report) return "";
  switch (report.status) {
    case "queued":
      return "Queued — preparing connectors";
    case "running":
      return "Scanning public sources & ingestion";
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
  const [queryMode, setQueryMode] = useState<QueryModeKey>("username");
  const [query, setQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [report, setReport] = useState<SearchReport | null>(null);
  const [pipelines, setPipelines] = useState<PipelineSection[]>([]);
  const [results, setResults] = useState<SearchCandidate[]>([]);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<Set<string>>(() => new Set());
  const [reviewLoading, setReviewLoading] = useState(false);
  const [reviewBanner, setReviewBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [resolvedEmailVaultItemId, setResolvedEmailVaultItemId] = useState<string | null>(null);
  const [showViewInVault, setShowViewInVault] = useState(false);
  const [scanBarPct, setScanBarPct] = useState(0);

  const placeholder = useMemo(
    () => queryModes.find((mode) => mode.key === queryMode)?.placeholder ?? "Enter value...",
    [queryMode],
  );
  const pendingResultIds = useMemo(() => results.filter((x) => x.status === "pending").map((x) => x.id), [results]);
  const pendingSelectedIds = useMemo(
    () => [...selectedCandidateIds].filter((id) => pendingResultIds.includes(id)),
    [pendingResultIds, selectedCandidateIds],
  );
  const hasPendingResults = pendingResultIds.length > 0;
  const signedInEmail = useMemo(() => {
    return user?.primaryEmailAddress?.emailAddress?.trim().toLowerCase() ?? null;
  }, [user]);
  const reportRunRef = useMemo(() => {
    if (!report) return null;
    const maybeRunId = typeof report.runId === "string" ? report.runId : null;
    if (maybeRunId) return maybeRunId;
    const maybeId = typeof report.id === "string" ? report.id : null;
    return maybeId;
  }, [report]);
  const showSearchControls = !searchLoading && !report;
  const runScanning = Boolean(report && isRunActivelyScanning(report.status));
  const scanUiBusy = searchLoading || runScanning;
  const resultCount = report?.reviewCount ?? pendingResultIds.length;
  const resultsSummaryRight = useMemo(() => {
    if (scanUiBusy && results.length === 0) return { mode: "pending" as const };
    return { mode: "count" as const, value: resultCount };
  }, [scanUiBusy, results.length, resultCount]);

  const onReviewCandidates = useCallback(
    async (action: "accept" | "reject") => {
      if (pendingSelectedIds.length === 0) return;
      if (action === "accept" && !resolvedEmailVaultItemId) {
        setReviewBanner({
          kind: "err",
          text: "Email anchor missing. Run search again or reconnect Gmail.",
        });
        return;
      }
      setReviewLoading(true);
      setReviewBanner(null);
      try {
        const chunks: string[][] = [];
        for (let i = 0; i < pendingSelectedIds.length; i += MAX_PUBLIC_AUDIT_REVIEW_IDS) {
          chunks.push(pendingSelectedIds.slice(i, i + MAX_PUBLIC_AUDIT_REVIEW_IDS));
        }
        let approved = 0;
        let duplicates = 0;
        let rejected = 0;
        for (const chunk of chunks) {
          const res = await fetch("/api/public-audit/candidates/review", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(
              action === "accept"
                ? { action: "accept", candidateIds: chunk, emailVaultItemId: resolvedEmailVaultItemId }
                : { action: "reject", candidateIds: chunk },
            ),
          });
          if (!res.ok) {
            setReviewBanner({ kind: "err", text: "Candidate review failed. Try again." });
            return;
          }
          const body = (await res.json()) as {
            importedVaultItemIds?: string[];
            addedToVaultCount?: number;
            duplicatesFoundCount?: number;
            processed?: number;
          };
          if (action === "accept") {
            approved += body.addedToVaultCount ?? body.importedVaultItemIds?.length ?? 0;
            duplicates += body.duplicatesFoundCount ?? 0;
          }
          else rejected += body.processed ?? chunk.length;
        }
        if (action === "accept") {
          setReviewBanner({
            kind: "ok",
            text: `Approved ${pendingSelectedIds.length} candidate(s): ${approved} added to vault, ${duplicates} duplicates found.`,
          });
          setShowViewInVault(pendingSelectedIds.length > 0);
        } else {
          setReviewBanner({ kind: "ok", text: `Disapproved ${rejected} candidate(s).` });
        }
        setSelectedCandidateIds(new Set());
        if (activeRunId) {
          const detailRes = await fetch(`/api/public-audit/runs/${activeRunId}?candidateStatus=pending`, {
            credentials: "same-origin",
          });
          if (detailRes.ok) {
            const detail = (await detailRes.json()) as RunDetail;
            setReport(detail.run);
            setResults(detail.candidates ?? []);
            setPipelines(detail.pipelines ?? []);
          }
        }
      } catch {
        setReviewBanner({ kind: "err", text: "Candidate review failed (network)." });
      } finally {
        setReviewLoading(false);
      }
    },
    [activeRunId, pendingSelectedIds, resolvedEmailVaultItemId],
  );

  useEffect(() => {
    if (query.trim()) return;
    if (!signedInEmail) return;
    setQuery(signedInEmail);
  }, [query, signedInEmail]);

  useEffect(() => {
    if (searchLoading) {
      const id = window.setInterval(() => {
        setScanBarPct((p) => Math.min(34, p + 1.35));
      }, 125);
      return () => window.clearInterval(id);
    }
    if (!report) return;
    const st = report.status;
    if (st === "queued" || st === "running") {
      const id = window.setInterval(() => {
        setScanBarPct((p) => {
          const cap = st === "queued" ? 78 : 91;
          const floor = st === "queued" ? 24 : 38;
          if (p >= cap) return p;
          const next = p < floor ? floor : p + Math.max(0.22, (cap - p) * 0.055);
          return Math.min(cap, next);
        });
      }, 230);
      return () => window.clearInterval(id);
    }
    setScanBarPct(100);
  }, [searchLoading, report?.status, activeRunId]);

  useEffect(() => {
    if (!activeRunId) return;
    const handle = window.setInterval(async () => {
      const res = await fetch(`/api/public-audit/runs/${activeRunId}?candidateStatus=pending`, {
        credentials: "same-origin",
      });
      if (!res.ok) return;
      const body = (await res.json()) as RunDetail;
      setReport(body.run);
      setResults(body.candidates ?? []);
      setPipelines(body.pipelines ?? []);
      if (body.run.status !== "queued" && body.run.status !== "running") {
        window.clearInterval(handle);
      }
    }, POLL_INTERVAL_MS);
    return () => window.clearInterval(handle);
  }, [activeRunId]);

  const onSearch = async () => {
    const q = query.trim();
    if (!q) {
      setSearchError("Enter a value before searching.");
      return;
    }
    const normalizedQuery =
      queryMode === "username"
        ? q.replace(/^@+/, "").toLowerCase()
        : queryMode === "domain"
          ? q.toLowerCase().replace(/^https?:\/\//, "").replace(/\/.*$/, "")
          : q.toLowerCase();
    setQuery(normalizedQuery);
    setSearchError(null);
    try {
      setSearchLoading(true);
      setScanBarPct(4);
      setReport(null);
      setPipelines([]);
      setResults([]);
      setSelectedCandidateIds(new Set());
      setShowViewInVault(false);
      const userFullName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || "Unknown User";
      const email = signedInEmail ?? "";
      if (!email) {
        setSearchError("Your account needs a verified email before running search.");
        return;
      }
      const anchorRes = await fetch("/api/vault/email-anchor", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      if (anchorRes.ok) {
        const anchorBody = (await anchorRes.json().catch(() => ({}))) as { vaultItemId?: string };
        if (anchorBody.vaultItemId) setResolvedEmailVaultItemId(anchorBody.vaultItemId);
      }
      const res = await fetch("/api/public-audit/runs", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          queryType: queryMode,
          query: normalizedQuery,
          fullName: userFullName,
          email,
          usernames: queryMode === "username" ? normalizedQuery : undefined,
          website: queryMode === "domain" ? normalizedQuery : undefined,
          notes: `Search query: ${queryMode}:${normalizedQuery}`,
          consent: {
            selfScanAcknowledged: true,
            publicSourcesAcknowledged: true,
            approximateMatchesAcknowledged: true,
          },
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { runId?: string; error?: string };
      if (!res.ok || !body.runId) {
        setSearchError(body.error ?? "Could not start search run.");
        return;
      }
      setActiveRunId(body.runId);
      const detailRes = await fetch(`/api/public-audit/runs/${body.runId}?candidateStatus=pending`, {
        credentials: "same-origin",
      });
      if (!detailRes.ok) return;
      const detail = (await detailRes.json()) as RunDetail;
      setReport(detail.run);
      setResults(detail.candidates ?? []);
      setPipelines(detail.pipelines ?? []);
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
              <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-cyan-400/95">
                Public footprint scan
              </p>
              <h1 className="text-balance font-heading text-3xl font-semibold leading-[1.08] tracking-[-0.02em] text-white sm:text-4xl">
                Search what the internet knows
              </h1>
              <p className="max-w-lg text-pretty text-sm leading-relaxed text-slate-400 sm:text-base">
                Run a scan, review surfaced matches, and push approved findings into your vault.
              </p>
            </div>

            {showSearchControls ? (
              <div className="flex flex-wrap items-center justify-center gap-2">
                {queryModes.map((mode) => {
                  const active = mode.key === queryMode;
                  return (
                    <button
                      key={mode.key}
                      type="button"
                      onClick={() => setQueryMode(mode.key)}
                      className={cn(
                        "rounded-full border px-5 py-2 text-sm font-semibold transition-colors",
                        active
                          ? "border-cyan-500/25 bg-cyan-500/10 text-cyan-200 shadow-[0_0_20px_-8px_rgba(34,211,238,0.35)]"
                          : "border-white/[0.08] bg-white/[0.04] text-slate-300 hover:border-white/[0.12] hover:text-white",
                      )}
                    >
                      {mode.label}
                    </button>
                  );
                })}
              </div>
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
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={placeholder}
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
                    {searchLoading ? "Searching…" : "Search"}
                  </button>
                </div>
              </form>
            ) : null}
            {searchError ? <p className="text-sm text-rose-300">{searchError}</p> : null}

            {searchLoading || report ? (
              <div className="mx-auto w-full max-w-[1120px] rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-4 text-left shadow-[0_0_60px_-12px_rgba(34,211,238,0.15)] backdrop-blur-sm">
                <div className="mb-3">
                  <p className="font-heading text-lg font-semibold tracking-tight text-white">Scan progress</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-slate-400">
                    Live preview: run a scan, watch ingestion progress, then inspect account matches.
                  </p>
                </div>
                <div className="rounded-xl border border-white/[0.08] bg-white/[0.03] p-2.5">
                  <p className="mb-0.5 font-mono text-[9px] font-medium uppercase tracking-[0.2em] text-slate-500">{queryMode}</p>
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
                        <span className="text-cyan-300/80">Discovering matches…</span>
                      ) : (
                        <span>
                          {resultsSummaryRight.value} pending review
                        </span>
                      )}
                    </span>
                  </div>
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
                    <span>run {reportRunRef ? reportRunRef.slice(0, 8) : "pending"}</span>
                    <span>{report.totalCandidates} total</span>
                    <span>{report.importedCount} imported</span>
                    <span>{report.reviewCount} pending</span>
                    <span>{report.status.replaceAll("_", " ")}</span>
                  </div>
                ) : null}
              </div>
            ) : null}

            {report ? (
              <div className="mx-auto w-full max-w-[980px] rounded-2xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.02] p-3.5 text-left shadow-[0_0_60px_-12px_rgba(34,211,238,0.12)] backdrop-blur-sm">
                <div className="mb-2.5 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-xs leading-snug text-slate-400">
                    Detailed intelligence:{" "}
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
