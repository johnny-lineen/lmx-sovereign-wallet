"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { MAX_REVIEW_CANDIDATE_IDS } from "@/lib/validations/import";
import { dispatchVaultDataChanged } from "@/lib/vault-changed-event";
import { cn } from "@/lib/utils";

type UnifiedMember = {
  id: string;
  importJobId: string;
  status: string;
  signal: string;
  suggestedType: string;
  title: string;
  provider: string | null;
  providerDomain: string | null;
  evidence: unknown;
};

type UnifiedGroup = {
  unificationKey: string;
  suggestedType: string;
  title: string;
  provider: string | null;
  members: UnifiedMember[];
};

type PublicPending = {
  id: string;
  title: string;
  sourceName: string;
  proposedVaultType: string;
  confidenceBand: string;
  snippet: string | null;
  auditRun: { id: string; createdAt: string; status: string };
};

export function VaultReviewQueueTab() {
  const router = useRouter();
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [gmailGroups, setGmailGroups] = useState<UnifiedGroup[] | null>(null);
  const [gmailLoading, setGmailLoading] = useState(true);
  const [gmailError, setGmailError] = useState<string | null>(null);
  const [gmailSelected, setGmailSelected] = useState<Set<string>>(() => new Set());

  const [publicList, setPublicList] = useState<PublicPending[] | null>(null);
  const [publicLoading, setPublicLoading] = useState(true);
  const [publicError, setPublicError] = useState<string | null>(null);
  const [publicSelected, setPublicSelected] = useState<Set<string>>(() => new Set());

  const [profileEmail, setProfileEmail] = useState("");
  const [resolvedVaultId, setResolvedVaultId] = useState<string | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);

  const loadGmail = useCallback(async () => {
    setGmailError(null);
    setGmailLoading(true);
    try {
      const res = await fetch("/api/import/candidates?status=pending&unified=1", { credentials: "same-origin" });
      if (!res.ok) {
        setGmailError("Could not load Gmail import candidates.");
        setGmailGroups([]);
        return;
      }
      const data = (await res.json()) as { unified?: UnifiedGroup[] };
      setGmailGroups(data.unified ?? []);
    } catch {
      setGmailError("Could not load Gmail import candidates.");
      setGmailGroups([]);
    } finally {
      setGmailLoading(false);
    }
  }, []);

  const loadPublic = useCallback(async () => {
    setPublicError(null);
    setPublicLoading(true);
    try {
      const res = await fetch("/api/public-audit/pending", { credentials: "same-origin" });
      if (!res.ok) {
        setPublicError("Could not load public audit candidates.");
        setPublicList([]);
        return;
      }
      const data = (await res.json()) as { candidates?: PublicPending[] };
      setPublicList(data.candidates ?? []);
    } catch {
      setPublicError("Could not load public audit candidates.");
      setPublicList([]);
    } finally {
      setPublicLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadGmail();
    void loadPublic();
  }, [loadGmail, loadPublic]);

  const gmailPendingIds = useMemo(() => {
    if (!gmailGroups) return [];
    const s = new Set<string>();
    for (const g of gmailGroups) {
      for (const m of g.members) {
        if (m.status === "pending") s.add(m.id);
      }
    }
    return [...s];
  }, [gmailGroups]);

  useEffect(() => {
    setGmailSelected(new Set());
  }, [gmailGroups]);

  useEffect(() => {
    setPublicSelected(new Set());
  }, [publicList]);

  const ensureAnchor = useCallback(async () => {
    const res = await fetch("/api/vault/email-anchor", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: profileEmail }),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { vaultItemId?: string };
    return typeof data.vaultItemId === "string" ? data.vaultItemId : null;
  }, [profileEmail]);

  const onGmailReview = async (action: "approve" | "reject") => {
    const pendingSelected = [...gmailSelected].filter((id) => gmailPendingIds.includes(id));
    if (pendingSelected.length === 0) return;

    let anchor = resolvedVaultId;
    if (action === "approve") {
      anchor = anchor ?? (await ensureAnchor());
      if (anchor) setResolvedVaultId(anchor);
      if (!anchor) {
        setBanner({
          kind: "err",
          text: "Enter the profile email used for Gmail import and ensure it matches your vault anchor.",
        });
        return;
      }
    }

    setReviewLoading(true);
    setBanner(null);
    try {
      const chunks: string[][] = [];
      for (let i = 0; i < pendingSelected.length; i += MAX_REVIEW_CANDIDATE_IDS) {
        chunks.push(pendingSelected.slice(i, i + MAX_REVIEW_CANDIDATE_IDS));
      }
      let n = 0;
      for (const chunk of chunks) {
        const res = await fetch("/api/import/candidates/review", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            action === "approve"
              ? { action: "approve", candidateIds: chunk, emailVaultItemId: anchor }
              : { action: "reject", candidateIds: chunk },
          ),
        });
        if (!res.ok) {
          setBanner({ kind: "err", text: "Gmail review failed." });
          return;
        }
        const data = (await res.json()) as { approvedVaultItemIds?: string[] };
        n += action === "approve" ? (data.approvedVaultItemIds?.length ?? 0) : chunk.length;
      }
      setBanner({
        kind: "ok",
        text: action === "approve" ? `Approved ${n} Gmail candidate row(s).` : `Rejected ${n} Gmail candidate row(s).`,
      });
      setGmailSelected(new Set());
      await loadGmail();
      router.refresh();
      dispatchVaultDataChanged();
      void fetch("/api/insights", { method: "POST", credentials: "same-origin" });
    } catch {
      setBanner({ kind: "err", text: "Gmail review failed (network)." });
    } finally {
      setReviewLoading(false);
    }
  };

  const onPublicReview = async (action: "accept" | "reject" | "ignore") => {
    const ids = [...publicSelected].filter((id) => publicList?.some((c) => c.id === id));
    if (ids.length === 0) return;

    let anchor = resolvedVaultId;
    if (action === "accept") {
      anchor = anchor ?? (await ensureAnchor());
      if (anchor) setResolvedVaultId(anchor);
      if (!anchor) {
        setBanner({ kind: "err", text: "Enter your profile email to anchor accepted public-audit items." });
        return;
      }
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
            ? { action: "accept", candidateIds: ids, emailVaultItemId: anchor }
            : { action, candidateIds: ids },
        ),
      });
      if (!res.ok) {
        setBanner({ kind: "err", text: "Public audit review failed." });
        return;
      }
      setBanner({
        kind: "ok",
        text:
          action === "accept"
            ? "Accepted selected public audit matches."
            : action === "reject"
              ? "Rejected selected public audit matches."
              : "Ignored selected public audit matches.",
      });
      setPublicSelected(new Set());
      await loadPublic();
      router.refresh();
      dispatchVaultDataChanged();
      void fetch("/api/insights", { method: "POST", credentials: "same-origin" });
    } catch {
      setBanner({ kind: "err", text: "Public audit review failed (network)." });
    } finally {
      setReviewLoading(false);
    }
  };

  const toggleGmail = (id: string, pending: boolean) => {
    if (!pending) return;
    setGmailSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const togglePublic = (id: string) => {
    setPublicSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Review queue</CardTitle>
          <CardDescription>
            Pending Gmail import rows and public footprint candidates in one place. Approve actions need your{" "}
            <strong>profile email</strong> vault anchor (same as Email scan).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="rq-profile-email">Profile email (for approvals)</Label>
              <Input
                id="rq-profile-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={profileEmail}
                onChange={(e) => setProfileEmail(e.target.value)}
              />
              {resolvedVaultId ? (
                <p className="text-xs text-muted-foreground">Anchor vault item resolved for this session.</p>
              ) : null}
            </div>
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
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Gmail import — pending</CardTitle>
          <CardDescription>Unified groups across recent scans (same as Email scan step 3).</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {gmailError ? <p className="text-sm text-destructive">{gmailError}</p> : null}
          {gmailLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !gmailGroups?.length ? (
            <p className="text-sm text-muted-foreground">No pending Gmail candidates.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={reviewLoading || gmailSelected.size === 0}
                  onClick={() => void onGmailReview("reject")}
                >
                  Reject selected
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={reviewLoading || gmailSelected.size === 0}
                  onClick={() => void onGmailReview("approve")}
                >
                  Approve selected
                </Button>
              </div>
              <ul className="space-y-3">
                {gmailGroups.map((g) => (
                  <li key={g.unificationKey} className="rounded-lg border border-border/60 bg-muted/10 p-3">
                    <div className="mb-2 font-medium">{g.title}</div>
                    <ul className="space-y-2">
                      {g.members.map((m) => {
                        const pending = m.status === "pending";
                        return (
                          <li key={m.id} className="flex gap-2 text-sm">
                            <input
                              type="checkbox"
                              className="mt-0.5 size-4 shrink-0 rounded border-input"
                              checked={gmailSelected.has(m.id)}
                              disabled={!pending || reviewLoading}
                              onChange={() => toggleGmail(m.id, pending)}
                              aria-label={m.title}
                            />
                            <div className="text-muted-foreground">
                              <span className="font-mono text-[10px] uppercase">{m.status}</span> ·{" "}
                              {m.signal.replaceAll("_", " ")} · {m.suggestedType.replaceAll("_", " ")}
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </li>
                ))}
              </ul>
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Public footprint audit — pending</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {publicError ? <p className="text-sm text-destructive">{publicError}</p> : null}
          {publicLoading ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : !publicList?.length ? (
            <p className="text-sm text-muted-foreground">No pending public audit candidates.</p>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={reviewLoading || publicSelected.size === 0}
                  onClick={() => void onPublicReview("ignore")}
                >
                  Ignore selected
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={reviewLoading || publicSelected.size === 0}
                  onClick={() => void onPublicReview("reject")}
                >
                  Reject selected
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={reviewLoading || publicSelected.size === 0}
                  onClick={() => void onPublicReview("accept")}
                >
                  Accept selected
                </Button>
              </div>
              <ul className="space-y-2">
                {publicList.map((c) => {
                  const checked = publicSelected.has(c.id);
                  return (
                    <li key={c.id} className="flex gap-3 rounded-lg border border-border/60 bg-muted/10 p-3">
                      <input
                        type="checkbox"
                        className="mt-1 size-4 shrink-0 rounded border-input"
                        checked={checked}
                        disabled={reviewLoading}
                        onChange={() => togglePublic(c.id)}
                        aria-label={c.title}
                      />
                      <div className="min-w-0 flex-1">
                        <div className="font-medium leading-snug">{c.title}</div>
                        <p className="text-xs text-muted-foreground">
                          {c.sourceName} · {c.proposedVaultType.replaceAll("_", " ")} · {c.confidenceBand}
                        </p>
                        {c.snippet ? (
                          <p className="mt-1 text-xs text-muted-foreground line-clamp-2">{c.snippet}</p>
                        ) : null}
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          Run {c.auditRun.id.slice(0, 8)}… · {new Date(c.auditRun.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
