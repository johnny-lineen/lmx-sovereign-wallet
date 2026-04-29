"use client";

import { UserButton, useUser } from "@clerk/nextjs";
import { Layers, Search } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";

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

  const placeholder = useMemo(
    () => queryModes.find((mode) => mode.key === queryMode)?.placeholder ?? "Enter value...",
    [queryMode],
  );
  const reportProgress = useMemo(() => (searchLoading ? 65 : 100), [searchLoading]);
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
    <div className="min-h-dvh bg-[#050914] text-slate-100">
      <div className="mx-auto flex w-full max-w-[1500px] items-center justify-between border-b border-white/5 px-6 py-3">
        <div className="flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-md bg-cyan-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.45)]">
            <Layers className="size-4" aria-hidden />
          </div>
          <div>
            <p className="text-lg font-bold tracking-wide text-white">LMX</p>
            <p className="-mt-1 text-[10px] uppercase tracking-[0.24em] text-slate-500">Sovereign Wallet</p>
          </div>
        </div>
        <div className="flex items-center gap-5 text-sm text-slate-300">
          {appLinks.map((item) => (
            <Link key={item.href} href={item.href} className="transition-colors hover:text-white">
              {item.label}
            </Link>
          ))}
          <UserButton />
        </div>
      </div>

      <main className="relative flex min-h-[calc(100dvh-66px)] items-center justify-center overflow-hidden px-6 py-10">
        <div className="pointer-events-none absolute inset-0 opacity-80" aria-hidden>
          <div
            className="absolute inset-0"
            style={{
              backgroundImage:
                "linear-gradient(to right, rgba(148,163,184,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.08) 1px, transparent 1px)",
              backgroundSize: "48px 48px",
            }}
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_50%_at_50%_-25%,rgba(14,165,233,0.18),transparent_58%)]" />
        </div>

        <section className="relative w-full max-w-5xl px-2 sm:px-4">
          <div className="space-y-7 text-center">
            <div className="flex items-center justify-center gap-3">
              <div className="flex size-12 items-center justify-center rounded-lg bg-cyan-500 text-black">
                <Layers className="size-5" aria-hidden />
              </div>
              <div className="text-left">
                <p className="text-4xl font-bold tracking-wide text-white">LMX</p>
                <p className="-mt-1 text-xs uppercase tracking-[0.28em] text-slate-500">Sovereign Wallet</p>
              </div>
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
                      className={[
                        "rounded-lg border px-5 py-1.5 text-sm font-semibold transition",
                        active
                          ? "border-cyan-400/70 bg-cyan-500 text-black shadow-[0_0_20px_rgba(6,182,212,0.26)]"
                          : "border-slate-700/80 bg-slate-900/70 text-slate-300 hover:border-slate-500 hover:text-white",
                      ].join(" ")}
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
                <div className="flex flex-col gap-2 rounded-2xl border border-cyan-900/45 bg-[#0a152b]/75 p-2.5 backdrop-blur-[1px] sm:flex-row">
                  <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                    placeholder={placeholder}
                    className="h-12 flex-1 rounded-xl border border-slate-700/80 bg-[#071022]/95 px-5 text-base text-slate-100 outline-none transition placeholder:text-slate-500 focus:border-cyan-500"
                  />
                  <button
                    type="submit"
                    disabled={searchLoading}
                    className="inline-flex h-12 items-center justify-center rounded-xl border border-slate-600 bg-slate-700/85 px-9 text-base font-semibold text-slate-200 transition hover:border-slate-400 hover:bg-slate-600"
                  >
                    <Search className="mr-2 size-4" aria-hidden />
                    {searchLoading ? "Searching..." : "Search"}
                  </button>
                </div>
              </form>
            ) : null}
            {searchError ? <p className="text-sm text-rose-300">{searchError}</p> : null}

            {searchLoading || report ? (
              <div className="mx-auto w-full max-w-[980px] rounded-2xl border border-cyan-900/45 bg-[#081229]/80 p-4 text-left">
                <div className="mb-3 flex items-center justify-between gap-3">
                  <p className="text-lg font-semibold text-cyan-100">Intelligence Report</p>
                  <span className="rounded border border-cyan-500/40 bg-cyan-500/10 px-2 py-0.5 text-[11px] uppercase tracking-wide text-cyan-300">
                    {queryMode}
                  </span>
                </div>
                <p className="font-mono text-sm text-slate-300">{query.trim().toLowerCase()}</p>
                <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-cyan-950/90">
                  <div
                    className={[
                      "h-full rounded-full bg-cyan-400 transition-all duration-500",
                      searchLoading ? "animate-pulse" : "",
                    ].join(" ")}
                    style={{ width: `${reportProgress}%` }}
                  />
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2 text-xs text-cyan-200/90">
                  <span>{searchLoading ? "running connectors + ingestion pipelines" : "complete"}</span>
                  <span>
                    {report?.reviewCount ?? pendingResultIds.length} pending review
                  </span>
                </div>
                {report ? (
                  <div className="mt-2 flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
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
              <div className="mx-auto w-full max-w-[980px] rounded-2xl border border-cyan-900/45 bg-[#081229]/80 p-4 text-left">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm text-cyan-100/80">
                    Detailed intelligence: <span className="font-semibold text-cyan-200">{results.length}</span> candidate
                    row(s)
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedCandidateIds(new Set(pendingResultIds))}
                      disabled={reviewLoading || !hasPendingResults}
                      className="rounded-md border border-slate-600 bg-slate-800/80 px-2 py-1 text-[11px] font-semibold text-slate-200 transition disabled:cursor-not-allowed disabled:opacity-50 hover:border-slate-400 hover:bg-slate-700"
                    >
                      Select all
                    </button>
                    <button
                      type="button"
                      onClick={() => void onReviewCandidates("reject")}
                      disabled={reviewLoading || pendingSelectedIds.length === 0}
                      className="rounded-md border border-slate-600 bg-slate-700/85 px-3 py-1 text-xs font-semibold text-slate-200 transition disabled:cursor-not-allowed disabled:opacity-50 hover:border-slate-400 hover:bg-slate-600"
                    >
                      Disapprove selected
                    </button>
                    <button
                      type="button"
                      onClick={() => void onReviewCandidates("accept")}
                      disabled={reviewLoading || pendingSelectedIds.length === 0}
                      className="rounded-md border border-cyan-500/50 bg-cyan-500/20 px-3 py-1 text-xs font-semibold text-cyan-100 transition disabled:cursor-not-allowed disabled:opacity-50 hover:bg-cyan-500/30"
                    >
                      Approve + Push to Vault
                    </button>
                    {showViewInVault ? (
                      <Link
                        href="/vault"
                        className="rounded-md border border-emerald-500/60 bg-emerald-500/15 px-3 py-1 text-xs font-semibold text-emerald-200 transition hover:bg-emerald-500/25"
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
                  <div className="space-y-4">
                    {pipelines.map((section) => (
                      <div key={section.id}>
                        <p className="mb-2 text-xs uppercase tracking-wide text-cyan-300">
                          {section.label} ({section.candidates.length})
                        </p>
                        <div className="grid gap-2 sm:grid-cols-2">
                          {section.candidates.map((item) => (
                            <div key={item.id} className="rounded-xl border border-slate-700/70 bg-[#060f20]/85 p-3">
                              <label className="mb-1 inline-flex items-center gap-2 text-xs text-slate-300">
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
                                  className="size-4 rounded border-slate-600 bg-slate-800 accent-cyan-500"
                                />
                                {item.status === "pending" ? "Select" : "Reviewed"}
                              </label>
                              <p className="text-sm font-semibold text-white">{item.title}</p>
                              <p className="mt-1 text-xs text-slate-300">
                                {item.proposedVaultType.replaceAll("_", " ")} · {item.status} · {item.sourceName}
                              </p>
                              <p className="mt-1 text-xs text-slate-400">
                                {item.confidenceBand} ({Math.round(item.confidenceScore * 100)}%)
                              </p>
                              {item.snippet ? (
                                <p className="mt-1 text-xs text-slate-400 line-clamp-2">{item.snippet}</p>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-slate-300">
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
