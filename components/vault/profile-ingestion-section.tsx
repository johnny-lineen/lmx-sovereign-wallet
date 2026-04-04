"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_REVIEW_CANDIDATE_IDS, profileEmailSchema } from "@/lib/validations/import";
import { dispatchVaultDataChanged } from "@/lib/vault-changed-event";
import { cn } from "@/lib/utils";
const SESSION_PENDING_GMAIL_EMAIL = "lmx_pending_gmail_oauth_email";

type GmailConnector = {
  id: string;
  gmailAddress: string;
  scopes: string | null;
  createdAt: string;
  updatedAt: string;
};

type ImportJobRow = {
  id: string;
  status: string;
  startedAt: string;
  completedAt: string | null;
  errorMessage: string | null;
  metadata: unknown;
  profileEmailItemId: string | null;
  gmailConnector: { id: string; gmailAddress: string };
  candidateCount: number;
};

type UnifiedImportCandidateMember = {
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
  members: UnifiedImportCandidateMember[];
};

type CandidateGroup = "accounts" | "subscriptions" | "security_activity";

function groupForCandidate(signal: string, suggestedType: string): CandidateGroup {
  if (
    signal === "password_reset" ||
    signal === "security_alert" ||
    signal === "account_activity"
  ) {
    return "security_activity";
  }
  if (suggestedType === "subscription" || signal === "subscription_renewal") {
    return "subscriptions";
  }
  return "accounts";
}

const GROUP_LABEL: Record<CandidateGroup, string> = {
  accounts: "Accounts",
  subscriptions: "Subscriptions",
  "security_activity": "Security / activity",
};

const GROUP_ORDER: CandidateGroup[] = ["accounts", "subscriptions", "security_activity"];

const selectClass =
  "h-8 w-full min-w-0 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none transition-colors focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-input/30";

function formatJobStatus(status: string): string {
  return status.replaceAll("_", " ");
}

function evidenceSubject(evidence: unknown): string | null {
  if (!evidence || typeof evidence !== "object") return null;
  const s = (evidence as Record<string, unknown>).subject;
  return typeof s === "string" ? s : null;
}

function evidenceConfidenceLabel(evidence: unknown): string | null {
  if (!evidence || typeof evidence !== "object") return null;
  const c = (evidence as Record<string, unknown>).confidence;
  if (typeof c !== "number" || !Number.isFinite(c)) return null;
  return `${Math.round(Math.max(0, Math.min(1, c)) * 100)}% conf.`;
}

function groupForUnifiedGroup(group: UnifiedImportCandidateGroup): CandidateGroup {
  const m = group.members.find((x) => x.status === "pending") ?? group.members[0];
  if (!m) return "accounts";
  return groupForCandidate(m.signal, m.suggestedType);
}

export function ProfileIngestionSection() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);
  const [connectors, setConnectors] = useState<GmailConnector[] | null>(null);
  const [connectorsError, setConnectorsError] = useState<string | null>(null);
  const [jobs, setJobs] = useState<ImportJobRow[] | null>(null);
  const [jobsError, setJobsError] = useState<string | null>(null);

  const [profileEmail, setProfileEmail] = useState("");
  const [emailFieldError, setEmailFieldError] = useState<string | null>(null);
  const [resolvedVaultItemId, setResolvedVaultItemId] = useState<string | null>(null);
  const [boundNormalizedEmail, setBoundNormalizedEmail] = useState<string | null>(null);

  const [connectorId, setConnectorId] = useState<string>("");

  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [unifiedGroups, setUnifiedGroups] = useState<UnifiedImportCandidateGroup[] | null>(null);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);
  const [scanDebugOpen, setScanDebugOpen] = useState(false);

  const [scanLoading, setScanLoading] = useState(false);
  const [connectLoading, setConnectLoading] = useState(false);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const normalizedInputEmail = useMemo(() => {
    const r = profileEmailSchema.safeParse(profileEmail);
    return r.success ? r.data.trim().toLowerCase() : null;
  }, [profileEmail]);

  const clearOAuthParams = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    params.delete("gmail_connected");
    params.delete("gmail_error");
    const q = params.toString();
    router.replace(q ? `/vault?${q}` : "/vault", { scroll: false });
  }, [router, searchParams]);

  const ensureAnchorForEmail = useCallback(async (email: string) => {
    const res = await fetch("/api/vault/email-anchor", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
    });
    if (!res.ok) return false;
    const data = (await res.json()) as {
      vaultItemId?: string;
      normalizedEmail?: string;
    };
    if (typeof data.vaultItemId !== "string" || typeof data.normalizedEmail !== "string") return false;
    setResolvedVaultItemId(data.vaultItemId);
    setBoundNormalizedEmail(data.normalizedEmail);
    return true;
  }, []);

  useEffect(() => {
    const connected = searchParams.get("gmail_connected");
    const err = searchParams.get("gmail_error");
    const pending = sessionStorage.getItem(SESSION_PENDING_GMAIL_EMAIL);

    if (connected === "1") {
      setBanner({ kind: "ok", text: "Gmail connected. Continue with scan and review (step 3)." });
      if (pending) {
        sessionStorage.removeItem(SESSION_PENDING_GMAIL_EMAIL);
        setProfileEmail(pending);
        void ensureAnchorForEmail(pending).then((ok) => {
          if (!ok) setBanner({ kind: "err", text: "Could not restore profile email anchor. Re-enter your email." });
        });
      }
      clearOAuthParams();
    } else if (err) {
      setBanner({
        kind: "err",
        text: `Gmail connection failed (${err.replaceAll("_", " ")}). Try again or check OAuth configuration.`,
      });
      if (pending) {
        sessionStorage.removeItem(SESSION_PENDING_GMAIL_EMAIL);
        setProfileEmail(pending);
        void ensureAnchorForEmail(pending);
      }
      clearOAuthParams();
    }
  }, [searchParams, clearOAuthParams, ensureAnchorForEmail]);

  useEffect(() => {
    if (!boundNormalizedEmail) return;
    if (normalizedInputEmail === null || normalizedInputEmail !== boundNormalizedEmail) {
      setResolvedVaultItemId(null);
      setBoundNormalizedEmail(null);
    }
  }, [normalizedInputEmail, boundNormalizedEmail]);

  const loadConnectors = useCallback(async () => {
    setConnectorsError(null);
    try {
      const res = await fetch("/api/import/gmail", { credentials: "same-origin" });
      if (!res.ok) {
        setConnectorsError(res.status === 401 ? "Sign in required." : "Could not load Gmail connectors.");
        setConnectors([]);
        return;
      }
      const data = (await res.json()) as { connectors?: GmailConnector[] };
      const list = data.connectors ?? [];
      setConnectors(list);
      setConnectorId((prev) => {
        if (prev && list.some((c) => c.id === prev)) return prev;
        return list[0]?.id ?? "";
      });
    } catch {
      setConnectorsError("Could not load Gmail connectors.");
      setConnectors([]);
    }
  }, []);

  const loadJobs = useCallback(async () => {
    setJobsError(null);
    try {
      const res = await fetch("/api/import/jobs", { credentials: "same-origin" });
      if (!res.ok) {
        setJobsError(res.status === 401 ? "Sign in required." : "Could not load import jobs.");
        setJobs([]);
        return;
      }
      const data = (await res.json()) as { jobs?: ImportJobRow[] };
      setJobs(data.jobs ?? []);
    } catch {
      setJobsError("Could not load import jobs.");
      setJobs([]);
    }
  }, []);

  const loadCandidates = useCallback(async (jobId: string) => {
    setCandidatesError(null);
    setUnifiedGroups(null);
    try {
      const qs = new URLSearchParams({ jobId, status: "pending", unified: "1" });
      const res = await fetch(`/api/import/candidates?${qs}`, { credentials: "same-origin" });
      if (!res.ok) {
        setCandidatesError("Could not load import candidates.");
        setUnifiedGroups([]);
        return;
      }
      const data = (await res.json()) as { unified?: UnifiedImportCandidateGroup[] };
      setUnifiedGroups(data.unified ?? []);
    } catch {
      setCandidatesError("Could not load import candidates.");
      setUnifiedGroups([]);
    }
  }, []);

  useEffect(() => {
    void loadConnectors();
    void loadJobs();
  }, [loadConnectors, loadJobs]);

  useEffect(() => {
    if (!jobs?.length) {
      setActiveJobId(null);
      return;
    }
    setActiveJobId((prev) => {
      if (prev && jobs.some((j) => j.id === prev)) return prev;
      const completed = jobs.find((j) => j.status === "completed");
      return completed?.id ?? jobs[0]!.id;
    });
  }, [jobs]);

  useEffect(() => {
    if (!activeJobId) {
      setUnifiedGroups(null);
      return;
    }
    void loadCandidates(activeJobId);
  }, [activeJobId, loadCandidates]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [activeJobId, unifiedGroups]);

  const groupedUnified = useMemo(() => {
    if (!unifiedGroups?.length) return null as Map<CandidateGroup, UnifiedImportCandidateGroup[]> | null;
    const map = new Map<CandidateGroup, UnifiedImportCandidateGroup[]>();
    for (const g of GROUP_ORDER) map.set(g, []);
    for (const ug of unifiedGroups) {
      const g = groupForUnifiedGroup(ug);
      map.get(g)!.push(ug);
    }
    return map;
  }, [unifiedGroups]);

  const pendingSelectedIds = useMemo(() => {
    if (!unifiedGroups) return [];
    const pending = new Set(
      unifiedGroups.flatMap((ug) => ug.members.filter((m) => m.status === "pending").map((m) => m.id)),
    );
    return [...selectedIds].filter((id) => pending.has(id));
  }, [unifiedGroups, selectedIds]);
  const hasRunningJob = useMemo(() => (jobs ?? []).some((j) => j.status === "running" || j.status === "queued"), [jobs]);

  const toggleId = (id: string, pending: boolean) => {
    if (!pending) return;
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllPendingInGroup = (groups: UnifiedImportCandidateGroup[]) => {
    const pending = groups.flatMap((ug) => ug.members.filter((m) => m.status === "pending").map((m) => m.id));
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const id of pending) next.add(id);
      return next;
    });
  };

  const clearSelection = () => setSelectedIds(new Set());

  const validateEmailField = (): string | null => {
    const r = profileEmailSchema.safeParse(profileEmail);
    if (!r.success) {
      const msg = r.error.issues[0]?.message ?? "Enter a valid email address.";
      return msg;
    }
    return null;
  };

  const onConnectGmail = async () => {
    const err = validateEmailField();
    if (err) {
      setEmailFieldError(err);
      return;
    }
    setEmailFieldError(null);
    setConnectLoading(true);
    setBanner(null);
    try {
      const res = await fetch("/api/vault/email-anchor", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: profileEmail }),
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

      if (!res.ok) {
        setBanner({
          kind: "err",
          text:
            typeof body.error === "string"
              ? `Could not save profile email (${body.error}).`
              : "Could not save profile email.",
        });
        return;
      }

      const normalizedEmail = typeof body.normalizedEmail === "string" ? body.normalizedEmail : null;
      const vaultItemId = typeof body.vaultItemId === "string" ? body.vaultItemId : null;
      if (!normalizedEmail || !vaultItemId) {
        setBanner({ kind: "err", text: "Unexpected response from server." });
        return;
      }

      sessionStorage.setItem(SESSION_PENDING_GMAIL_EMAIL, normalizedEmail);
      setResolvedVaultItemId(vaultItemId);
      setBoundNormalizedEmail(normalizedEmail);
      setProfileEmail(normalizedEmail);
      router.refresh();
      dispatchVaultDataChanged();
      window.location.href = "/api/import/gmail/authorize";
    } catch {
      setBanner({ kind: "err", text: "Could not reach server. Check your connection." });
    } finally {
      setConnectLoading(false);
    }
  };

  const onScanInbox = async () => {
    if (!connectorId) return;
    const err = validateEmailField();
    if (err) {
      setEmailFieldError(err);
      return;
    }
    setEmailFieldError(null);

    setScanLoading(true);
    setBanner(null);
    try {
      const res = await fetch("/api/import/jobs", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gmailConnectorId: connectorId,
          profileEmail: profileEmail.trim(),
        }),
      });
      const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;

      if (!res.ok) {
        if (body.error === "IMPORT_COOLDOWN") {
          const retryAfter =
            typeof body.retryAfterSeconds === "number" && Number.isFinite(body.retryAfterSeconds)
              ? Math.max(1, Math.round(body.retryAfterSeconds))
              : null;
          setBanner({
            kind: "err",
            text: retryAfter
              ? `Scan cooldown active. Try again in about ${retryAfter}s.`
              : "Scan cooldown active. Please wait briefly before trying again.",
          });
          return;
        }
        const msg =
          typeof body.message === "string"
            ? body.message
            : typeof body.error === "string"
              ? body.error
              : "Scan failed.";
        setBanner({ kind: "err", text: msg });
        return;
      }

      const jobId = typeof body.jobId === "string" ? body.jobId : null;
      const inserted =
        typeof body.insertedCandidates === "number" ? body.insertedCandidates : 0;
      const scanned =
        typeof body.messagesScanned === "number" ? body.messagesScanned : 0;
      const anchorId = typeof body.profileEmailItemId === "string" ? body.profileEmailItemId : null;

      if (anchorId && normalizedInputEmail) {
        setResolvedVaultItemId(anchorId);
        setBoundNormalizedEmail(normalizedInputEmail);
      }

      setBanner({
        kind: "ok",
        text: `Scan finished: ${inserted} new candidate(s) from ${scanned} message(s). Review below.`,
      });

      await loadJobs();
      if (jobId) {
        setActiveJobId(jobId);
        await loadCandidates(jobId);
      }
      router.refresh();
      dispatchVaultDataChanged();
    } catch {
      setBanner({ kind: "err", text: "Scan failed (network error)." });
    } finally {
      setScanLoading(false);
    }
  };

  const onReview = async (action: "approve" | "reject") => {
    if (pendingSelectedIds.length === 0) return;
    const activeJob = jobs?.find((j) => j.id === activeJobId) ?? null;
    const anchorRaw = resolvedVaultItemId ?? activeJob?.profileEmailItemId ?? "";
    const anchorVaultItemId = anchorRaw.trim();

    if (action === "approve") {
      if (!anchorVaultItemId) {
        setBanner({
          kind: "err",
          text: "Profile email anchor missing. Enter your email and run a scan (or connect Gmail) first.",
        });
        return;
      }
    }

    setReviewLoading(true);
    setBanner(null);
    try {
      const ids = pendingSelectedIds.map((id) => id.trim());
      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += MAX_REVIEW_CANDIDATE_IDS) {
        chunks.push(ids.slice(i, i + MAX_REVIEW_CANDIDATE_IDS));
      }

      let approvedTotal = 0;
      let rejectedTotal = 0;
      let skippedTotal = 0;

      for (const chunk of chunks) {
        const res = await fetch("/api/import/candidates/review", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            action === "approve"
              ? {
                  action: "approve" as const,
                  candidateIds: chunk,
                  emailVaultItemId: anchorVaultItemId,
                }
              : {
                  action: "reject" as const,
                  candidateIds: chunk,
                },
          ),
        });

        if (!res.ok) {
          const errBody = (await res.json().catch(() => ({}))) as {
            error?: string;
            details?: { fieldErrors?: Record<string, string[]>; formErrors?: string[] };
            issues?: { path?: string; message?: string }[];
          };
          const detailMsg = (() => {
            const iss0 = errBody.issues?.[0]?.message;
            if (iss0) return ` — ${iss0}`;
            const fe = errBody.details?.fieldErrors;
            if (!fe) return "";
            const first = Object.entries(fe).find(([, v]) => v?.length);
            if (!first) return "";
            return ` — ${first[0]}: ${first[1]![0]}`;
          })();
          const code = typeof errBody.error === "string" ? errBody.error : "";
          const friendly =
            code === "EMAIL_ITEM_INVALID"
              ? "Could not find your profile email vault item, or it is not an email item. Re-enter your email in step 1 and run a scan again."
              : code === "NO_CANDIDATES"
                ? "No pending candidates matched your selection (they may have already been reviewed). Refresh and try again."
                : code === "USER_NOT_FOUND"
                  ? "Your account was not found. Try signing in again."
                  : null;
          const base = friendly ?? (code || "Review failed.");
          setBanner({
            kind: "err",
            text: friendly ? base : `${base}${detailMsg}`,
          });
          return;
        }

        const data = (await res.json()) as {
          approvedVaultItemIds?: string[];
          rejectedCount?: number;
          skippedCount?: number;
        };
        if (action === "approve") {
          approvedTotal += data.approvedVaultItemIds?.length ?? 0;
          skippedTotal += data.skippedCount ?? 0;
        } else {
          rejectedTotal += data.rejectedCount ?? chunk.length;
          skippedTotal += data.skippedCount ?? 0;
        }
      }

      if (action === "approve") {
        setBanner({
          kind: "ok",
          text:
            skippedTotal > 0
              ? `Approved ${approvedTotal} item(s) into your vault. Skipped ${skippedTotal} already-reviewed row(s).`
              : `Approved ${approvedTotal} item(s) into your vault.`,
        });
      } else {
        setBanner({
          kind: "ok",
          text:
            skippedTotal > 0
              ? `Rejected ${rejectedTotal} candidate(s). Skipped ${skippedTotal} already-reviewed row(s).`
              : `Rejected ${rejectedTotal} candidate(s).`,
        });
      }

      clearSelection();
      if (activeJobId) await loadCandidates(activeJobId);
      await loadJobs();
      router.refresh();
      dispatchVaultDataChanged();
    } catch {
      setBanner({ kind: "err", text: "Review failed (network error)." });
    } finally {
      setReviewLoading(false);
    }
  };

  const scanDisabled =
    scanLoading || !connectorId || normalizedInputEmail === null || connectLoading || hasRunningJob;

  const connectDisabled = connectLoading || scanLoading;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Profile ingestion</CardTitle>
        <CardDescription>
          Three quick steps: add your profile email, connect Gmail, then scan and approve suggested services.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <ol className="list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>
            <span className="text-foreground">Enter your email</span> — we create or reuse a matching vault item as
            the anchor for imports.
          </li>
          <li>
            <span className="text-foreground">Connect Gmail</span> — OAuth access for the mailbox you want to scan.
          </li>
          <li>
            <span className="text-foreground">Scan and review</span> — pull candidates from recent mail, then approve or
            reject; approved items link to your profile email.
          </li>
        </ol>

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
            <Label htmlFor="profile-email-input">Step 1 — Profile email</Label>
            <Input
              id="profile-email-input"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={profileEmail}
              onChange={(e) => {
                setProfileEmail(e.target.value);
                if (emailFieldError) setEmailFieldError(null);
              }}
              aria-invalid={Boolean(emailFieldError)}
            />
            {emailFieldError ? <p className="text-xs text-destructive">{emailFieldError}</p> : null}
            {resolvedVaultItemId && boundNormalizedEmail ? (
              <p className="text-xs text-muted-foreground">
                Anchor vault item is set for <span className="font-mono">{boundNormalizedEmail}</span>.
              </p>
            ) : null}
          </div>

          <div className="space-y-2">
            <Label htmlFor="gmail-connector">Gmail connector (step 2)</Label>
            {connectorsError ? (
              <p className="text-sm text-destructive">{connectorsError}</p>
            ) : connectors === null ? (
              <p className="text-sm text-muted-foreground">Loading connectors…</p>
            ) : connectors.length === 0 ? (
              <p className="text-sm text-muted-foreground">No Gmail accounts connected yet. Use Connect Gmail.</p>
            ) : (
              <select
                id="gmail-connector"
                className={selectClass}
                value={connectorId}
                onChange={(e) => setConnectorId(e.target.value)}
              >
                {connectors.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.gmailAddress}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={connectDisabled || normalizedInputEmail === null}
            onClick={() => void onConnectGmail()}
          >
            {connectLoading ? "Preparing…" : "Connect Gmail"}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={scanDisabled}
            onClick={() => void onScanInbox()}
          >
            {scanLoading ? "Scanning…" : "Scan inbox"}
          </Button>
        </div>
        {hasRunningJob ? (
          <p className="text-xs text-muted-foreground">
            A scan job is already in progress. Wait for it to complete before starting another run.
          </p>
        ) : null}

        <div className="space-y-2">
          <h4 className="text-sm font-medium">Recent import jobs</h4>
          {jobsError ? (
            <p className="text-sm text-destructive">{jobsError}</p>
          ) : jobs === null ? (
            <p className="text-sm text-muted-foreground">Loading jobs…</p>
          ) : jobs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No jobs yet. Run a scan to create one.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg ring-1 ring-foreground/10">
              <table className="w-full min-w-[520px] border-collapse text-left text-sm">
                <thead className="border-b border-border bg-muted/30">
                  <tr>
                    <th className="px-3 py-2 font-medium">Started</th>
                    <th className="px-3 py-2 font-medium">Mailbox</th>
                    <th className="px-3 py-2 font-medium">Status</th>
                    <th className="px-3 py-2 font-medium">Candidates</th>
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((j) => {
                    const active = j.id === activeJobId;
                    return (
                      <tr
                        key={j.id}
                        className={cn(
                          "cursor-pointer border-b border-border/60 last:border-0",
                          active ? "bg-muted/40" : "hover:bg-muted/20",
                        )}
                        onClick={() => setActiveJobId(j.id)}
                      >
                        <td className="px-3 py-2 text-muted-foreground">
                          {new Date(j.startedAt).toLocaleString()}
                        </td>
                        <td className="px-3 py-2">{j.gmailConnector.gmailAddress}</td>
                        <td className="px-3 py-2">
                          <span className="rounded-md bg-muted px-1.5 py-0.5 font-mono text-xs uppercase">
                            {formatJobStatus(j.status)}
                          </span>
                          {j.status === "failed" && j.errorMessage ? (
                            <span className="mt-1 block text-xs text-destructive">{j.errorMessage}</span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2">{j.candidateCount}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
          {activeJobId && jobs?.some((j) => j.id === activeJobId) ? (
            <div className="space-y-2">
              <button
                type="button"
                className="text-xs font-medium text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                onClick={() => setScanDebugOpen((v) => !v)}
              >
                {scanDebugOpen ? "Hide scan debug" : "Show scan debug"}
              </button>
              {scanDebugOpen ? (
                <pre className="max-h-64 overflow-auto rounded-lg border border-border/60 bg-muted/20 p-3 font-mono text-[10px] leading-relaxed text-muted-foreground">
                  {JSON.stringify(
                    jobs.find((j) => j.id === activeJobId)?.metadata ?? {},
                    null,
                    2,
                  )}
                </pre>
              ) : null}
            </div>
          ) : null}
        </div>

        <div className="space-y-3">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <div>
              <h4 className="text-sm font-medium">Step 3 — Import candidates</h4>
              <p className="text-xs text-muted-foreground">
                Grouped by provider domain where possible. Select pending rows, then approve (links to your profile
                email) or reject.
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={reviewLoading || pendingSelectedIds.length === 0}
                onClick={() => void onReview("reject")}
              >
                Reject selected
              </Button>
              <Button
                type="button"
                size="sm"
                disabled={reviewLoading || pendingSelectedIds.length === 0}
                onClick={() => void onReview("approve")}
              >
                Approve selected
              </Button>
            </div>
          </div>

          {candidatesError ? (
            <p className="text-sm text-destructive">{candidatesError}</p>
          ) : !activeJobId ? (
            <p className="text-sm text-muted-foreground">Select a job to view candidates.</p>
          ) : unifiedGroups === null ? (
            <p className="text-sm text-muted-foreground">Loading candidates…</p>
          ) : unifiedGroups.length === 0 ? (
            <p className="text-sm text-muted-foreground">No candidates for this job.</p>
          ) : (
            <div className="space-y-6">
              {GROUP_ORDER.map((group) => {
                const groups = groupedUnified?.get(group) ?? [];
                if (groups.length === 0) return null;
                const memberCount = groups.reduce((n, ug) => n + ug.members.length, 0);
                return (
                  <div key={group} className="space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h5 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                        {GROUP_LABEL[group]}
                        <span className="ml-2 font-normal">
                          ({groups.length} group{groups.length === 1 ? "" : "s"}, {memberCount} row
                          {memberCount === 1 ? "" : "s"})
                        </span>
                      </h5>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        className="text-muted-foreground"
                        onClick={() => selectAllPendingInGroup(groups)}
                      >
                        Select all pending
                      </Button>
                    </div>
                    <ul className="space-y-3">
                      {groups.map((ug) => (
                        <li
                          key={ug.unificationKey}
                          className="space-y-2 rounded-lg border border-border/60 bg-muted/10 p-3"
                        >
                          <div className="flex flex-wrap items-baseline gap-2 border-b border-border/40 pb-2">
                            <span className="font-medium leading-snug">{ug.title}</span>
                            {ug.provider ? (
                              <span className="text-xs text-muted-foreground">{ug.provider}</span>
                            ) : null}
                            {ug.sourceEmails.length > 0 ? (
                              <span className="text-[10px] text-muted-foreground">
                                · {ug.sourceEmails.join(", ")}
                              </span>
                            ) : null}
                          </div>
                          <ul className="space-y-2">
                            {ug.members.map((c) => {
                              const pending = c.status === "pending";
                              const subj = evidenceSubject(c.evidence);
                              const summary =
                                typeof c.evidence === "object" &&
                                c.evidence !== null &&
                                typeof (c.evidence as Record<string, unknown>).summary === "string"
                                  ? ((c.evidence as Record<string, unknown>).summary as string)
                                  : null;
                              const conf = evidenceConfidenceLabel(c.evidence);
                              const checked = selectedIds.has(c.id);
                              return (
                                <li
                                  key={c.id}
                                  className={cn(
                                    "flex gap-3 rounded-md border border-transparent bg-background/40 p-2",
                                    !pending && "opacity-70",
                                  )}
                                >
                                  <input
                                    type="checkbox"
                                    className="mt-1 size-4 shrink-0 rounded border-input"
                                    checked={checked}
                                    disabled={!pending || reviewLoading}
                                    onChange={() => toggleId(c.id, pending)}
                                    aria-label={`Select ${c.title}`}
                                  />
                                  <div className="min-w-0 flex-1 space-y-1">
                                    <div className="flex flex-wrap items-baseline gap-2">
                                      <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] uppercase text-muted-foreground">
                                        {c.status}
                                      </span>
                                      <span className="text-xs text-muted-foreground">
                                        {c.signal.replaceAll("_", " ")} ·{" "}
                                        {c.suggestedType.replaceAll("_", " ")}
                                        {c.providerDomain ? ` · ${c.providerDomain}` : ""}
                                        {conf ? ` · ${conf}` : ""}
                                      </span>
                                    </div>
                                    {summary ? (
                                      <p className="text-xs leading-relaxed text-muted-foreground line-clamp-3">
                                        {summary}
                                      </p>
                                    ) : subj ? (
                                      <p className="text-xs leading-relaxed text-muted-foreground line-clamp-2">
                                        {subj}
                                      </p>
                                    ) : null}
                                  </div>
                                </li>
                              );
                            })}
                          </ul>
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
