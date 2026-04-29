"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  pipelineLabel,
  type PublicAuditPipelineId,
} from "@/lib/public-audit-pipelines";
import { dispatchVaultDataChanged } from "@/lib/vault-changed-event";
import { cn } from "@/lib/utils";

type RunRow = {
  id: string;
  status: string;
  totalCandidates: number;
  importedCount: number;
  reviewCount: number;
  errorMessage: string | null;
  submittedEmail: string;
  fullName: string;
  createdAt: string;
  metadata?: unknown;
};

type CandidateRow = {
  id: string;
  title: string;
  sourceName: string;
  sourceType: string;
  proposedVaultType: string;
  confidenceBand: string;
  confidenceScore: number;
  status: string;
  snippet: string | null;
  url: string | null;
  createdVaultItemId: string | null;
};

type PipelineSection = { id: string; label: string; candidates: CandidateRow[] };

function readPipelineSummary(metadata: unknown): {
  pipelines: Record<string, { count: number; error?: boolean; skipped?: string }>;
  completedAt?: string;
} | null {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const raw = (metadata as Record<string, unknown>).pipelineSummary;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const pipelines = (raw as Record<string, unknown>).pipelines;
  if (!pipelines || typeof pipelines !== "object" || Array.isArray(pipelines)) return null;
  return { pipelines: pipelines as Record<string, { count: number; error?: boolean; skipped?: string }> };
}

const AUDIT_POLL_INTERVAL_MS = 2500;

const STAGES = [
  "Verifying identifiers",
  "Searching public web signals",
  "Matching profiles",
  "Checking exposure sources",
  "Building vault objects",
  "Linking relationships",
  "Updating graph preview",
] as const;

function formatStatus(s: string) {
  return s.replaceAll("_", " ");
}

function sourceChipTone(name: string) {
  const key = name.toLowerCase();
  if (key.includes("github")) return "border-cyan-400/50 text-cyan-200";
  if (key.includes("spotify")) return "border-emerald-400/45 text-emerald-200";
  if (key.includes("microsoft")) return "border-sky-400/45 text-sky-200";
  if (key.includes("amazon")) return "border-amber-400/45 text-amber-200";
  return "border-cyan-300/40 text-cyan-100";
}

function titleInitial(title: string) {
  const first = title.trim().charAt(0);
  return first ? first.toUpperCase() : "?";
}

export function VaultPublicAuditTab({ highlightRunId }: { highlightRunId: string | null }) {
  const router = useRouter();
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [runs, setRuns] = useState<RunRow[] | null>(null);
  const [runsError, setRunsError] = useState<string | null>(null);
  const [loadingRuns, setLoadingRuns] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [activeRunId, setActiveRunId] = useState<string | null>(null);
  const [detailCandidates, setDetailCandidates] = useState<CandidateRow[] | null>(null);
  const [detailPipelines, setDetailPipelines] = useState<PipelineSection[] | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [usernames, setUsernames] = useState("");
  const [cityState, setCityState] = useState("");
  const [website, setWebsite] = useState("");
  const [notes, setNotes] = useState("");
  const [consentSelf, setConsentSelf] = useState(false);
  const [consentPublic, setConsentPublic] = useState(false);
  const [consentApprox, setConsentApprox] = useState(false);

  const [selectedAuditIds, setSelectedAuditIds] = useState<Set<string>>(() => new Set());
  const [reviewLoading, setReviewLoading] = useState(false);
  const [resolvedEmailVaultId, setResolvedEmailVaultId] = useState<string | null>(null);

  const loadRuns = useCallback(async () => {
    setRunsError(null);
    try {
      const res = await fetch("/api/public-audit/runs?limit=15", { credentials: "same-origin" });
      if (!res.ok) {
        setRunsError(res.status === 401 ? "Sign in required." : "Could not load audit runs.");
        setRuns([]);
        return;
      }
      const data = (await res.json()) as { runs?: RunRow[] };
      setRuns(data.runs ?? []);
    } catch {
      setRunsError("Could not load audit runs.");
      setRuns([]);
    } finally {
      setLoadingRuns(false);
    }
  }, []);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  const activeRun = useMemo(() => runs?.find((r) => r.id === activeRunId) ?? null, [runs, activeRunId]);

  useEffect(() => {
    if (!runs?.length) {
      setActiveRunId(null);
      return;
    }
    setActiveRunId((prev) => {
      if (prev && runs.some((r) => r.id === prev)) return prev;
      // Only apply URL highlight as an initial selection; don't keep overriding user/new-run selection.
      if (highlightRunId && runs.some((r) => r.id === highlightRunId)) return highlightRunId;
      return runs[0]!.id;
    });
  }, [runs, highlightRunId]);

  const loadDetail = useCallback(async (runId: string, opts?: { allowTransientNotFound?: boolean }) => {
    setDetailLoading(true);
    setDetailError(null);
    try {
      const res = await fetch(`/api/public-audit/runs/${runId}`, { credentials: "same-origin" });
      if (!res.ok) {
        if (res.status === 404) {
          if (opts?.allowTransientNotFound) {
            return false;
          }
          setDetailError("Run detail not found for this account. Select another run or refresh runs.");
        } else if (res.status === 401) {
          setDetailError("Sign in required.");
        } else {
          setDetailError("Could not load run detail.");
        }
        setDetailCandidates([]);
        setDetailPipelines(null);
        return false;
      }
      const data = (await res.json()) as { candidates?: CandidateRow[]; pipelines?: PipelineSection[] };
      setDetailCandidates(data.candidates ?? []);
      setDetailPipelines(data.pipelines ?? null);
      return true;
    } catch {
      setDetailError("Could not load run detail.");
      setDetailCandidates([]);
      setDetailPipelines(null);
      return false;
    } finally {
      setDetailLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!activeRunId) {
      setDetailCandidates(null);
      setDetailPipelines(null);
      return;
    }
    void loadDetail(activeRunId, { allowTransientNotFound: true });
  }, [activeRunId, loadDetail]);

  useEffect(() => {
    if (!activeRunId) return;
    if (activeRun?.status !== "queued" && activeRun?.status !== "running") return;

    const handle = setInterval(() => {
      void loadRuns();
      void loadDetail(activeRunId, { allowTransientNotFound: true });
    }, AUDIT_POLL_INTERVAL_MS);

    return () => clearInterval(handle);
  }, [activeRunId, activeRun?.status, loadRuns, loadDetail]);

  useEffect(() => {
    if (!activeRunId || !activeRun) return;
    if (activeRun.status === "queued" || activeRun.status === "running") return;
    // Terminal states need one final authoritative detail load.
    void loadDetail(activeRunId);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- activeRun identity churns each poll; status is the signal
  }, [activeRunId, activeRun?.status, loadDetail]);

  useEffect(() => {
    setSelectedAuditIds(new Set());
  }, [activeRunId, detailCandidates, detailPipelines]);

  const pipelineSections = useMemo((): PipelineSection[] => {
    if (detailPipelines && detailPipelines.length > 0) return detailPipelines;
    if (detailCandidates?.length) {
      return [{ id: "other", label: "Results", candidates: detailCandidates }];
    }
    return [];
  }, [detailPipelines, detailCandidates]);

  const pipelineSummary = useMemo(() => readPipelineSummary(activeRun?.metadata), [activeRun?.metadata]);

  const pendingAudit = useMemo(() => {
    if (!detailCandidates) return [];
    return detailCandidates.filter((c) => c.status === "pending");
  }, [detailCandidates]);

  const ensureEmailAnchor = useCallback(async () => {
    const res = await fetch("/api/vault/email-anchor", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { vaultItemId?: string };
    return typeof data.vaultItemId === "string" ? data.vaultItemId : null;
  }, [email]);

  const onSubmitAudit = async () => {
    setBanner(null);
    if (!consentSelf || !consentPublic || !consentApprox) {
      setBanner({ kind: "err", text: "Confirm all consent checkboxes before running the audit." });
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/public-audit/runs", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName,
          email,
          usernames: usernames.trim() || undefined,
          cityState: cityState.trim() || undefined,
          website: website.trim() || undefined,
          notes: notes.trim() || undefined,
          consent: {
            selfScanAcknowledged: true,
            publicSourcesAcknowledged: true,
            approximateMatchesAcknowledged: true,
          },
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { runId?: string; error?: string };
      if (!res.ok) {
        const msg =
          body.error === "EMAIL_NOT_VERIFIED"
            ? "That email is not verified on your Clerk account. Use a verified address or verify it in settings."
            : typeof body.error === "string"
              ? body.error
              : "Audit failed to start.";
        setBanner({ kind: "err", text: msg });
        return;
      }
      const id = typeof body.runId === "string" ? body.runId : null;
      setBanner({
        kind: "ok",
        text: "Audit queued and running in the background. Results will appear below as soon as ingestion finishes.",
      });
      await loadRuns();
      if (id) {
        setActiveRunId(id);
        await loadDetail(id, { allowTransientNotFound: true });
        const anchor = await ensureEmailAnchor();
        if (anchor) setResolvedEmailVaultId(anchor);
      }
      router.refresh();
      dispatchVaultDataChanged();
      void fetch("/api/insights", { method: "POST", credentials: "same-origin" });
    } catch {
      setBanner({ kind: "err", text: "Network error while running audit." });
    } finally {
      setSubmitting(false);
    }
  };

  const toggleAuditSelect = (id: string) => {
    setSelectedAuditIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const onReviewAudit = async (action: "accept" | "reject" | "ignore") => {
    const ids = [...selectedAuditIds].filter((id) => pendingAudit.some((c) => c.id === id));
    if (ids.length === 0) return;

    let emailVaultItemId = resolvedEmailVaultId;
    if (action === "accept" && !emailVaultItemId) {
      emailVaultItemId = await ensureEmailAnchor();
      if (emailVaultItemId) setResolvedEmailVaultId(emailVaultItemId);
    }
    if (action === "accept" && !emailVaultItemId) {
      setBanner({
        kind: "err",
        text: "Could not resolve your email vault anchor. Re-enter the same email used for the audit.",
      });
      return;
    }

    setReviewLoading(true);
    setBanner(null);
    try {
      const res = await fetch("/api/public-audit/candidates/review", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          action === "accept"
            ? { action: "accept", candidateIds: ids, emailVaultItemId }
            : { action, candidateIds: ids },
        ),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setBanner({
          kind: "err",
          text: err.error === "EMAIL_ITEM_INVALID" ? "Email vault item missing or invalid." : "Review failed.",
        });
        return;
      }
      const data = (await res.json()) as { importedVaultItemIds?: string[] };
      setBanner({
        kind: "ok",
        text:
          action === "accept"
            ? `Accepted ${data.importedVaultItemIds?.length ?? ids.length} match(es) into your vault.`
            : action === "reject"
              ? "Rejected selected matches."
              : "Ignored selected matches.",
      });
      setSelectedAuditIds(new Set());
      if (activeRunId) await loadDetail(activeRunId);
      await loadRuns();
      router.refresh();
      dispatchVaultDataChanged();
      void fetch("/api/insights", { method: "POST", credentials: "same-origin" });
    } catch {
      setBanner({ kind: "err", text: "Review failed (network)." });
    } finally {
      setReviewLoading(false);
    }
  };

  const stageIndex = useMemo(() => {
    if (!activeRun) return 0;
    if (activeRun.status === "failed") return STAGES.length;
    if (activeRun.status === "queued" || activeRun.status === "running") {
      return Math.min(2, STAGES.length - 1);
    }
    return STAGES.length;
  }, [activeRun]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Public footprint audit</CardTitle>
          <CardDescription>
            Discover public signals tied to your <strong>verified</strong> identity and convert findings into vault
            items. Results are inferred and confidence-scored — not absolute truth.
          </CardDescription>
          {activeRun ? (
            <p className="text-xs text-muted-foreground">
              Last viewed run:{" "}
              <span className="font-mono text-foreground">{formatStatus(activeRun.status)}</span> ·{" "}
              {new Date(activeRun.createdAt).toLocaleString()}
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-muted-foreground">
            <strong className="text-foreground">Safety:</strong> only use this on your own identity. We use public or
            approved sources (e.g. Have I Been Pwned when configured). Matches may be approximate.
          </div>

          {banner ? (
            <div
              role="status"
              className={cn(
                "rounded-lg border px-3 py-2 text-sm",
                banner.kind === "ok"
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100"
                  : "border-destructive/40 bg-destructive/10 text-destructive",
              )}
            >
              {banner.text}
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="audit-full-name">Full name</Label>
              <Input
                id="audit-full-name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                autoComplete="name"
                placeholder="Jordan Doe"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="audit-email">Email (must be verified on your account)</Label>
              <Input
                id="audit-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                placeholder="you@verified.com"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="audit-usernames">Usernames (optional, comma or line separated)</Label>
              <Textarea
                id="audit-usernames"
                value={usernames}
                onChange={(e) => setUsernames(e.target.value)}
                rows={2}
                placeholder="github_handle, @socialhandle"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="audit-loc">City / state (optional)</Label>
              <Input
                id="audit-loc"
                value={cityState}
                onChange={(e) => setCityState(e.target.value)}
                placeholder="Austin, TX"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="audit-web">Personal website or domain (optional)</Label>
              <Input
                id="audit-web"
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="example.com"
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="audit-notes">Notes (optional)</Label>
              <Textarea
                id="audit-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
                placeholder="Anything else that helps disambiguate your public profiles?"
              />
            </div>
          </div>

          <div className="space-y-2 rounded-lg border border-border/60 bg-muted/20 p-3 text-sm">
            <label className="flex cursor-pointer gap-2">
              <input type="checkbox" checked={consentSelf} onChange={(e) => setConsentSelf(e.target.checked)} />
              <span>I am scanning my own identity only.</span>
            </label>
            <label className="flex cursor-pointer gap-2">
              <input type="checkbox" checked={consentPublic} onChange={(e) => setConsentPublic(e.target.checked)} />
              <span>I understand only public or approved sources are used.</span>
            </label>
            <label className="flex cursor-pointer gap-2">
              <input type="checkbox" checked={consentApprox} onChange={(e) => setConsentApprox(e.target.checked)} />
              <span>Results may include approximate or possible matches.</span>
            </label>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button type="button" disabled={submitting} onClick={() => { void onSubmitAudit(); }}>
              {submitting ? "Running audit…" : "Run audit"}
            </Button>
            <Button
              type="button"
              variant="outline"
              nativeButton={false}
              render={<Link href={activeRunId ? `/graph?highlightAudit=${activeRunId}` : "/graph"} />}
            >
              {activeRunId ? "Open graph (highlight run)" : "Open graph"}
            </Button>
            <Button
              type="button"
              variant="outline"
              nativeButton={false}
              render={<Link href="/vault?tab=review" />}
            >
              Review queue
            </Button>
          </div>
        </CardContent>
      </Card>

      {activeRun && (activeRun.status === "running" || activeRun.status === "queued") ? (
        <Card className="border-cyan-400/35 bg-slate-950/80">
          <CardHeader>
            <CardTitle className="text-base text-cyan-50">Scan progress</CardTitle>
            <CardDescription className="text-cyan-100/70">
              Stages shown for orientation; processing may complete in one request.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="list-decimal space-y-1 pl-5 text-sm text-cyan-100/75">
              {STAGES.map((label, i) => (
                <li key={label} className={i < stageIndex ? "text-cyan-50" : ""}>
                  {label}
                  {i === stageIndex && activeRun.status === "running" ? " · scanning…" : null}
                </li>
              ))}
            </ol>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Previous audit runs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {runsError ? <p className="text-sm text-destructive">{runsError}</p> : null}
          {loadingRuns ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !runs?.length ? (
            <p className="text-sm text-muted-foreground">No runs yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg ring-1 ring-foreground/10">
              <table className="w-full min-w-[640px] border-collapse text-left text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="px-3 py-2 font-medium">Started</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Imported</th>
                    <th className="px-3 py-2 font-medium">Review</th>
                    <th className="px-3 py-2 font-medium">Email</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => {
                    const sel = r.id === activeRunId;
                    return (
                      <tr
                        key={r.id}
                        className={cn(
                          "cursor-pointer border-b border-border/60 last:border-0",
                          sel ? "bg-muted/40" : "hover:bg-muted/20",
                        )}
                        onClick={() => setActiveRunId(r.id)}
                      >
                        <td className="px-3 py-2 text-muted-foreground">{new Date(r.createdAt).toLocaleString()}</td>
                        <td className="px-3 py-2 font-mono text-xs uppercase">{formatStatus(r.status)}</td>
                        <td className="px-3 py-2">{r.importedCount}</td>
                        <td className="px-3 py-2">{r.reviewCount}</td>
                        <td className="px-3 py-2 font-mono text-xs">{r.submittedEmail}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {activeRun?.status === "failed" && activeRun.errorMessage ? (
            <p className="text-sm text-destructive">{activeRun.errorMessage}</p>
          ) : null}
        </CardContent>
      </Card>

      {activeRunId ? (
        <Card className="border-cyan-400/35 bg-slate-950/80">
          <CardHeader>
            <CardTitle className="text-base text-cyan-50">Intelligence report</CardTitle>
            <CardDescription className="text-cyan-100/70">
              High-confidence matches may already be in your vault. Pending rows need your decision.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {detailError ? <p className="text-sm text-destructive">{detailError}</p> : null}
            {activeRun ? (
              <div className="rounded-xl border border-cyan-400/45 bg-slate-900/85 px-4 py-3">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs uppercase tracking-wide text-cyan-100/80">
                  <span>Intel hits: <strong className="text-cyan-50">{activeRun.importedCount}</strong></span>
                  <span>Review needed: <strong className="text-cyan-50">{activeRun.reviewCount}</strong></span>
                  <span>Total signals: <strong className="text-cyan-50">{activeRun.totalCandidates}</strong></span>
                  <span className="text-cyan-300">{activeRun.status === "running" ? "scanning…" : formatStatus(activeRun.status)}</span>
                </div>
              </div>
            ) : null}

            {activeRun ? (
              <div className="flex flex-wrap gap-4 text-sm text-cyan-100/70">
                <span>
                  Candidates: <strong className="text-cyan-50">{activeRun.totalCandidates}</strong>
                </span>
                <span>
                  In vault: <strong className="text-cyan-50">{activeRun.importedCount}</strong>
                </span>
                <span>
                  Pending review: <strong className="text-cyan-50">{activeRun.reviewCount}</strong>
                </span>
              </div>
            ) : null}

            {detailLoading ? (
              <p className="text-sm text-muted-foreground">Loading candidates…</p>
            ) : activeRun && (activeRun.status === "queued" || activeRun.status === "running") ? (
              <p className="text-sm text-muted-foreground">
                Scan is still running. Candidates will appear automatically as ingestion completes.
              </p>
            ) : !detailCandidates?.length ? (
              <p className="text-sm text-muted-foreground">No candidates for this run.</p>
            ) : (
              <>
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={reviewLoading || selectedAuditIds.size === 0}
                    onClick={() => void onReviewAudit("ignore")}
                  >
                    Ignore selected
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={reviewLoading || selectedAuditIds.size === 0}
                    onClick={() => void onReviewAudit("reject")}
                  >
                    Reject selected
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    disabled={reviewLoading || selectedAuditIds.size === 0}
                    onClick={() => void onReviewAudit("accept")}
                  >
                    Accept selected
                  </Button>
                </div>
                {pipelineSummary?.pipelines && Object.keys(pipelineSummary.pipelines).length > 0 ? (
                  <div className="flex flex-wrap gap-2 border-b border-cyan-300/30 pb-3">
                    <span className="w-full text-xs font-medium text-cyan-100">Ingestion pipelines</span>
                    {Object.entries(pipelineSummary.pipelines).map(([id, entry]) => (
                      <span
                        key={id}
                        className="rounded-md border border-cyan-400/35 bg-slate-900/85 px-2 py-1 text-xs text-cyan-100/80"
                      >
                        <span className="text-cyan-50">{pipelineLabel(id as PublicAuditPipelineId)}</span>
                        {": "}
                        {entry.count}
                        {entry.skipped === "no_api_key" ? " · HIBP API key not set" : ""}
                        {entry.error ? " · source error" : ""}
                      </span>
                    ))}
                  </div>
                ) : null}
                <div className="space-y-6">
                  {pipelineSections.map((section) => (
                    <div key={section.id} className="space-y-2">
                      <h3 className="text-sm font-medium text-cyan-50">
                        {section.label}
                        <span className="ml-2 font-normal text-cyan-100/70">
                          ({section.candidates.length})
                        </span>
                      </h3>
                      <ul className="grid gap-3 sm:grid-cols-2">
                        {section.candidates.map((c) => {
                          const isPending = c.status === "pending";
                          const checked = selectedAuditIds.has(c.id);
                          return (
                            <li
                              key={c.id}
                              className={cn(
                                "flex gap-3 rounded-xl border border-cyan-400/35 bg-slate-900/90 p-3 shadow-[0_0_0_1px_rgba(56,189,248,0.08)]",
                                !isPending && "opacity-85",
                              )}
                            >
                              <input
                                type="checkbox"
                                className="mt-1 size-4 shrink-0 rounded border-input"
                                checked={checked}
                                disabled={!isPending || reviewLoading}
                                onChange={() => toggleAuditSelect(c.id)}
                                aria-label={`Select ${c.title}`}
                              />
                              <div className="min-w-0 flex-1 space-y-1">
                                <div className="flex flex-wrap items-start gap-2">
                                  <span className="inline-flex size-9 items-center justify-center rounded-md border border-cyan-300/35 bg-slate-800/90 text-sm font-semibold text-cyan-100">
                                    {titleInitial(c.title)}
                                  </span>
                                  <div className="min-w-0 flex-1">
                                    <div className="truncate font-medium leading-snug text-cyan-50">{c.title}</div>
                                  </div>
                                  <span className="rounded border border-cyan-300/35 bg-slate-800/80 px-1.5 py-0.5 font-mono text-[10px] uppercase text-cyan-200/85">
                                    {c.status.replaceAll("_", " ")}
                                  </span>
                                </div>
                                <p className="text-xs text-cyan-100/70">
                                  <span
                                    className={cn(
                                      "mr-1 inline-flex rounded border px-1.5 py-0.5 text-[10px] uppercase",
                                      sourceChipTone(c.sourceName),
                                    )}
                                  >
                                    {c.sourceName}
                                  </span>
                                  {c.proposedVaultType.replaceAll("_", " ")} · {c.confidenceBand} (
                                  {Math.round(c.confidenceScore * 100)}%)
                                </p>
                                {c.snippet ? (
                                  <p className="text-xs leading-relaxed text-cyan-100/65 line-clamp-3">
                                    {c.snippet}
                                  </p>
                                ) : null}
                                {c.url ? (
                                  <a
                                    href={c.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-xs text-sky-600 underline-offset-2 hover:underline dark:text-sky-400"
                                  >
                                    {c.url}
                                  </a>
                                ) : null}
                              </div>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  ))}
                </div>
              </>
            )}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
