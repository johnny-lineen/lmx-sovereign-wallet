"use client";

import { BreachAlertBanner } from "@/components/dashboard/breach-alert-banner";
import { AlertTriangle, Check, Mail, Plus, Search, Shield } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";

import { ScanWizardShell } from "@/components/scan/scan-wizard-shell";
import {
  type ScanWizardConfig,
  defaultScanWizardConfig,
  loadScanWizardConfig,
  saveScanWizardConfig,
  validateConfigStep,
} from "@/lib/scan-wizard";
import { cn } from "@/lib/utils";

const landingCta = cn(
  "inline-flex items-center justify-center font-bold uppercase tracking-wide text-black transition-[transform,box-shadow]",
  "bg-gradient-to-br from-cyan-400 via-cyan-500 to-teal-600",
  "shadow-[0_0_32px_-4px_rgba(34,211,238,0.45)] hover:shadow-[0_0_40px_-2px_rgba(34,211,238,0.55)] motion-safe:hover:scale-[1.02]",
);

type GmailConnector = {
  id: string;
  gmailAddress: string;
  scopes: string | null;
  createdAt: string;
  updatedAt: string;
};

type ImportJobDTO = {
  id: string;
  status: string;
  metadata?: Record<string, unknown> | null;
  gmailConnector?: { id: string; gmailAddress?: string | null } | null;
};

type ProgressRow = {
  connectorId: string;
  gmailAddress: string;
  jobId: string | null;
  status: "queued" | "running" | "done";
  emailsProcessed: number;
  accountsFound: number;
  errorMessage?: string;
};

type BreachScanProgress = {
  status: "idle" | "running" | "done";
  totalBreaches: number;
  emailsExposedCount: number;
  uniqueBreachCount: number;
  errorMessage?: string;
};

function summarizeBreachResults(
  results: Array<{ email: string; breachCount: number; breaches?: Array<{ Name?: string }> }>,
): Pick<BreachScanProgress, "totalBreaches" | "emailsExposedCount" | "uniqueBreachCount"> {
  const uniqueBreachNames = new Set<string>();
  let totalBreaches = 0;
  let emailsExposedCount = 0;

  for (const row of results) {
    const count = row.breachCount ?? 0;
    totalBreaches += count;
    if (count > 0) emailsExposedCount += 1;
    for (const breach of row.breaches ?? []) {
      if (breach.Name) uniqueBreachNames.add(breach.Name);
    }
  }

  return {
    totalBreaches,
    emailsExposedCount,
    uniqueBreachCount: uniqueBreachNames.size,
  };
}

type ScanOptionKey = "accountFootprint" | "breachExposure";

const SCAN_OPTIONS: Array<{
  key: ScanOptionKey;
  title: string;
  description: string;
}> = [
  {
    key: "accountFootprint",
    title: "Inbox scan",
    description: "Extract accounts and subscriptions from email senders",
  },
  {
    key: "breachExposure",
    title: "Breach check",
    description: "Check each email against known breach databases",
  },
];

function initialsFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  const parts = local.split(/[._-]+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]![0] ?? ""}${parts[1]![0] ?? ""}`.toUpperCase();
  }
  return local.slice(0, 2).toUpperCase() || "?";
}

function metadataNumber(metadata: Record<string, unknown>, key: string): number {
  const raw = metadata[key];
  if (typeof raw === "number") return raw;
  if (typeof raw === "string") return Number.parseInt(raw, 10) || 0;
  return 0;
}

function StatusBadge({ status }: { status: ProgressRow["status"] }) {
  if (status === "done") {
    return (
      <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-300">
        done
      </span>
    );
  }
  if (status === "running") {
    return (
      <span className="rounded-md bg-sky-500/15 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-300">
        running
      </span>
    );
  }
  return (
    <span className="rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
      queued
    </span>
  );
}

function ScanOptionCard({
  title,
  description,
  checked,
  onToggle,
}: {
  title: string;
  description: string;
  checked: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl border px-4 py-3.5 text-left transition-colors",
        checked
          ? "border-cyan-500/30 bg-cyan-500/10"
          : "border-white/[0.08] bg-white/[0.03] hover:border-white/[0.12]",
      )}
    >
      <span
        className={cn(
          "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border",
          checked ? "border-cyan-400 bg-cyan-400 text-black" : "border-white/20 bg-transparent",
        )}
      >
        {checked ? <Check className="size-3" strokeWidth={3} /> : null}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-medium text-white">{title}</span>
        <span className="mt-0.5 block text-xs leading-relaxed text-slate-400">{description}</span>
      </span>
    </button>
  );
}

export function ScanWizard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [phase, setPhase] = useState<"connect" | "scanning">("connect");
  const [config, setConfig] = useState<ScanWizardConfig>(defaultScanWizardConfig);
  const [error, setError] = useState<string | null>(null);
  const [connectors, setConnectors] = useState<GmailConnector[]>([]);
  const [loadingConnectors, setLoadingConnectors] = useState(true);
  const [starting, setStarting] = useState(false);
  const [scanRows, setScanRows] = useState<ProgressRow[]>([]);
  const [polling, setPolling] = useState(false);
  const [scanStarted, setScanStarted] = useState(false);
  const [scanFinishedAt, setScanFinishedAt] = useState<number | null>(null);
  const [redirectCountdown, setRedirectCountdown] = useState<number | null>(null);
  const [breachScan, setBreachScan] = useState<BreachScanProgress>({
    status: "idle",
    totalBreaches: 0,
    emailsExposedCount: 0,
    uniqueBreachCount: 0,
  });
  const [breachScanStarted, setBreachScanStarted] = useState(false);

  const gmailConnected = searchParams.get("gmail_connected");

  const SCAN_COMPLETE_REDIRECT_SEC = 8;

  const fetchConnectors = useCallback(async () => {
    setLoadingConnectors(true);
    try {
      const res = await fetch("/api/import/gmail", { cache: "no-store" });
      if (!res.ok) throw new Error("Failed to load connected Gmail accounts.");
      const data = (await res.json()) as { connectors?: GmailConnector[] };
      setConnectors(Array.isArray(data.connectors) ? data.connectors : []);
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load Gmail accounts.");
    } finally {
      setLoadingConnectors(false);
    }
  }, []);

  useEffect(() => {
    const saved = loadScanWizardConfig();
    if (saved) setConfig(saved);
  }, []);

  useEffect(() => {
    void fetchConnectors();
  }, [fetchConnectors]);

  useEffect(() => {
    if (gmailConnected === "1") {
      void fetchConnectors();
      router.replace("/scan", { scroll: false });
    }
  }, [fetchConnectors, gmailConnected, router]);

  const patchScans = useCallback((key: ScanOptionKey, next: boolean) => {
    setConfig((prev) => ({ ...prev, scans: { ...prev.scans, [key]: next } }));
    setError(null);
  }, []);

  const onRunScan = async (): Promise<void> => {
    if (connectors.length < 1) {
      setError("Connect at least one Gmail account to run a scan.");
      return;
    }
    const configOk = validateConfigStep(config);
    if (!configOk.ok) {
      setError(configOk.error);
      return;
    }

    const connectorIds = connectors.map((c) => c.id);
    setStarting(true);
    setError(null);
    setScanFinishedAt(null);
    setRedirectCountdown(null);
    setBreachScan({ status: "idle", totalBreaches: 0, emailsExposedCount: 0, uniqueBreachCount: 0 });
    setBreachScanStarted(false);
    setScanRows(
      connectors.map((connector) => ({
        connectorId: connector.id,
        gmailAddress: connector.gmailAddress,
        jobId: null,
        status: "running",
        emailsProcessed: 0,
        accountsFound: 0,
      })),
    );
    setScanStarted(true);
    setPolling(false);
    setPhase("scanning");

    try {
      saveScanWizardConfig(config);
      const response = await fetch("/api/import/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ gmailConnectorIds: connectorIds }),
      });
      const data = (await response.json()) as {
        results?: Array<{
          connectorId: string;
          ok: boolean;
          jobId?: string;
          error?: string;
          message?: string;
        }>;
      };
      if (!response.ok || !Array.isArray(data.results)) {
        throw new Error("Failed to start Gmail scan jobs.");
      }

      const rows: ProgressRow[] = connectors.map((connector) => {
        const r = data.results?.find((x) => x.connectorId === connector.id);
        if (!r?.ok) {
          return {
            connectorId: connector.id,
            gmailAddress: connector.gmailAddress,
            jobId: null,
            status: "done",
            emailsProcessed: 0,
            accountsFound: 0,
            errorMessage: r?.message ?? r?.error ?? "Failed to start job.",
          };
        }
        return {
          connectorId: connector.id,
          gmailAddress: connector.gmailAddress,
          jobId: r.jobId ?? null,
          status: "running",
          emailsProcessed: 0,
          accountsFound: 0,
        };
      });

      setScanRows(rows);
      setPolling(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start scan.");
      setPhase("connect");
      setScanStarted(false);
      setScanRows([]);
    } finally {
      setStarting(false);
    }
  };

  useEffect(() => {
    if (!polling || scanRows.length === 0) return;

    const interval = window.setInterval(async () => {
      try {
        const res = await fetch("/api/import/jobs", { cache: "no-store" });
        if (!res.ok) return;
        const payload = (await res.json()) as { jobs?: ImportJobDTO[] };
        if (!Array.isArray(payload.jobs)) return;

        const jobsById = new Map(payload.jobs.map((job) => [job.id, job]));
        setScanRows((prev) =>
          prev.map((row) => {
            if (!row.jobId) return row;
            const job = jobsById.get(row.jobId);
            if (!job) return row;
            const metadata = (job.metadata ?? {}) as Record<string, unknown>;
            const emailsProcessed =
              metadataNumber(metadata, "messagesScanned") || metadataNumber(metadata, "messagesFetched");
            const accountsFound =
              metadataNumber(metadata, "vaultItemsCreated") ||
              metadataNumber(metadata, "candidatesInserted") ||
              metadataNumber(metadata, "candidatesDetected");
            const done = job.status === "completed" || job.status === "failed";
            const diagnostics = metadata.diagnostics as Record<string, unknown> | undefined;
            const diagCode = typeof diagnostics?.code === "string" ? diagnostics.code : null;
            const zeroHint =
              done && accountsFound === 0
                ? diagCode === "scan_empty"
                  ? "No recent messages matched the scan query."
                  : emailsProcessed > 0
                    ? "Messages scanned but no account signals met confidence thresholds."
                    : "Scan finished with no new vault items."
                : undefined;
            return {
              ...row,
              gmailAddress: job.gmailConnector?.gmailAddress ?? row.gmailAddress,
              status: done ? "done" : "running",
              emailsProcessed,
              accountsFound,
              errorMessage: row.errorMessage ?? zeroHint,
            };
          }),
        );
      } catch {
        // Ignore transient polling errors.
      }
    }, 2000);

    return () => window.clearInterval(interval);
  }, [polling, scanRows.length]);

  const inboxScanEnabled = config.scans.accountFootprint;
  const breachCheckEnabled = config.scans.breachExposure;

  const progressPct = useMemo(() => {
    const steps: boolean[] = [];
    if (inboxScanEnabled) {
      steps.push(...scanRows.map((r) => r.status === "done"));
    }
    if (breachCheckEnabled) {
      steps.push(breachScan.status === "done");
    }
    if (steps.length === 0) return scanStarted ? 100 : 0;
    const done = steps.filter(Boolean).length;
    return Math.round((done / steps.length) * 100);
  }, [breachCheckEnabled, breachScan.status, inboxScanEnabled, scanRows, scanStarted]);

  const importJobsDone = useMemo(
    () => scanRows.length > 0 && scanRows.every((row) => row.status === "done"),
    [scanRows],
  );

  const breachScanDone = !breachCheckEnabled || breachScan.status === "done";

  const allDone = importJobsDone && breachScanDone;

  useEffect(() => {
    if (!scanStarted || !importJobsDone || breachScanStarted) return;
    if (!breachCheckEnabled) return;

    const emails = [...new Set(connectors.map((c) => c.gmailAddress.trim()).filter(Boolean))];
    if (emails.length === 0) {
      setBreachScan({ status: "done", totalBreaches: 0, emailsExposedCount: 0, uniqueBreachCount: 0 });
      return;
    }

    setBreachScanStarted(true);
    setBreachScan({ status: "running", totalBreaches: 0, emailsExposedCount: 0, uniqueBreachCount: 0 });

    void (async () => {
      try {
        const res = await fetch("/api/scan/breach", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ emails }),
        });
        const data = (await res.json()) as {
          results?: Array<{
            email: string;
            breachCount: number;
            breaches?: Array<{ Name?: string }>;
          }>;
          error?: string;
          message?: string;
        };
        if (!res.ok) {
          throw new Error(data.message ?? data.error ?? "Breach check failed.");
        }
        const summary = summarizeBreachResults(data.results ?? []);
        setBreachScan({ status: "done", ...summary });
      } catch (e) {
        setBreachScan({
          status: "done",
          totalBreaches: 0,
          emailsExposedCount: 0,
          uniqueBreachCount: 0,
          errorMessage: e instanceof Error ? e.message : "Breach check failed.",
        });
      }
    })();
  }, [breachCheckEnabled, breachScanStarted, connectors, importJobsDone, scanStarted]);

  useEffect(() => {
    if (!scanStarted || !allDone || scanFinishedAt !== null) return;
    setScanFinishedAt(Date.now());
    setPolling(false);
  }, [allDone, scanFinishedAt, scanStarted]);

  useEffect(() => {
    if (scanFinishedAt === null) return;

    const redirectAt = scanFinishedAt + SCAN_COMPLETE_REDIRECT_SEC * 1000;

    const tick = () => {
      const remainingMs = redirectAt - Date.now();
      if (remainingMs <= 0) {
        setRedirectCountdown(0);
        router.push("/dashboard");
        return;
      }
      setRedirectCountdown(Math.ceil(remainingMs / 1000));
    };

    tick();
    const interval = window.setInterval(tick, 500);
    return () => window.clearInterval(interval);
  }, [router, scanFinishedAt]);

  if (phase === "scanning") {
    return (
      <div className="space-y-6 text-center sm:text-left">
        <div className="space-y-2 text-center sm:text-left">
          <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-cyan-400/95">Live scan</p>
          <h1 className="text-balance font-heading text-2xl font-semibold tracking-tight text-white sm:text-3xl">
            Scanning your footprint
          </h1>
          <p className="text-sm leading-relaxed text-slate-400">
            Running {connectors.length} {connectors.length === 1 ? "inbox" : "inboxes"} across inbox
            {breachCheckEnabled ? " and breach" : ""} pipelines.
          </p>
        </div>

        <ScanWizardShell>
          <div className="space-y-4">
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/[0.06]">
              <div
                className="h-full rounded-full bg-cyan-400 shadow-[0_0_12px_rgba(34,211,238,0.35)] transition-[width] duration-500 ease-out"
                style={{ width: `${Math.max(progressPct, scanStarted ? 8 : 0)}%` }}
              />
            </div>

            <ul className="divide-y divide-white/[0.06] rounded-xl border border-white/[0.08] bg-white/[0.03]">
              {inboxScanEnabled
                ? scanRows.map((row) => (
                    <li key={row.connectorId} className="flex items-start justify-between gap-3 px-4 py-3.5">
                      <div className="min-w-0 text-left">
                        <p className="text-sm font-medium text-white">Inbox scan — {row.gmailAddress}</p>
                        <p className="mt-0.5 text-xs text-slate-500">
                          {row.status === "done"
                            ? `${row.emailsProcessed} emails processed · ${row.accountsFound} added to vault`
                            : row.status === "running"
                              ? `${row.emailsProcessed} emails processed…`
                              : "Waiting…"}
                        </p>
                      </div>
                      <StatusBadge status={row.status} />
                    </li>
                  ))
                : null}
              {breachCheckEnabled ? (
                <li key="breach-scan" className="flex items-start justify-between gap-3 px-4 py-3.5">
                  <div className="min-w-0 text-left">
                    <p className="flex items-center gap-2 text-sm font-medium text-white">
                      {breachScan.status === "done" &&
                      !breachScan.errorMessage &&
                      breachScan.totalBreaches > 0 ? (
                        <AlertTriangle className="size-4 shrink-0 text-[#f5a898]" aria-hidden />
                      ) : null}
                      Breach check
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {breachScan.status === "done"
                        ? breachScan.errorMessage
                          ? breachScan.errorMessage
                          : breachScan.totalBreaches === 0
                            ? "No breaches found"
                            : `${breachScan.totalBreaches} breach${breachScan.totalBreaches === 1 ? "" : "es"} found`
                        : breachScan.status === "running"
                          ? "Checking breach databases…"
                          : importJobsDone
                            ? "Starting breach check…"
                            : "Waiting for inbox scans…"}
                    </p>
                  </div>
                  <StatusBadge
                    status={
                      breachScan.status === "done"
                        ? "done"
                        : breachScan.status === "running"
                          ? "running"
                          : "queued"
                    }
                  />
                </li>
              ) : null}
            </ul>

            {allDone ? (
              <div className="space-y-3 border-t border-white/[0.06] pt-4">
                {breachCheckEnabled && breachScan.totalBreaches > 0 ? (
                  <BreachAlertBanner
                    emailsExposedCount={breachScan.emailsExposedCount}
                    uniqueBreachCount={breachScan.uniqueBreachCount}
                    subtext="Your passwords and personal data may be exposed — open your dashboard to review"
                  />
                ) : null}
                <p className="text-center text-sm text-emerald-300/90">
                  All scans complete
                  {redirectCountdown !== null && redirectCountdown > 0
                    ? ` — opening dashboard in ${redirectCountdown}s`
                    : ""}
                </p>
                <button
                  type="button"
                  onClick={() => router.push("/dashboard")}
                  className={cn("h-11 w-full rounded-full text-sm", landingCta)}
                >
                  Open dashboard
                </button>
              </div>
            ) : null}
          </div>
        </ScanWizardShell>
      </div>
    );
  }

  return (
    <div className="space-y-7">
      <div className="space-y-3 text-center">
        <p className="font-mono text-[11px] font-medium uppercase tracking-[0.22em] text-cyan-400/95">Inbox scan</p>
        <h1 className="text-balance font-heading text-3xl font-semibold leading-[1.08] tracking-[-0.02em] text-white sm:text-4xl">
          See what your mailbox implies
        </h1>
        <p className="mx-auto max-w-md text-pretty text-sm leading-relaxed text-slate-400 sm:text-base">
          Connect Gmail accounts to map services and subscriptions. We only read sender and subject metadata — never
          email bodies.
        </p>
      </div>

      <ScanWizardShell>
        <div className="space-y-5 text-left">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold text-white">Connect your emails</h2>
            <p className="text-xs leading-relaxed text-slate-400">
              Add every inbox you want scanned. Each account runs as its own job.
            </p>
          </div>

          {loadingConnectors ? (
            <p className="text-sm text-slate-400">Loading connected accounts…</p>
          ) : connectors.length > 0 ? (
            <ul className="space-y-2">
              {connectors.map((connector) => (
                <li
                  key={connector.id}
                  className="flex items-center gap-3 rounded-xl border border-white/[0.08] bg-white/[0.04] px-3 py-2.5"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/25 to-teal-600/15 text-xs font-semibold text-cyan-100">
                    {initialsFromEmail(connector.gmailAddress)}
                  </span>
                  <p className="min-w-0 flex-1 truncate text-sm font-medium text-white">{connector.gmailAddress}</p>
                  <span className="shrink-0 rounded-md bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                    connected
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-xl border border-dashed border-white/[0.12] bg-white/[0.02] px-4 py-6 text-center">
              <Mail className="mx-auto size-8 text-slate-500" aria-hidden />
              <p className="mt-2 text-sm text-slate-400">No Gmail accounts connected yet.</p>
            </div>
          )}

          <button
            type="button"
            onClick={() => router.push("/api/import/gmail/authorize?returnTo=/scan")}
            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-white/[0.14] bg-white/[0.02] px-4 py-3 text-sm font-medium text-slate-300 transition-colors hover:border-cyan-500/30 hover:bg-cyan-500/5 hover:text-white"
          >
            <Plus className="size-4 text-cyan-400" />
            Add another Gmail account
          </button>

          <div className="space-y-2 border-t border-white/[0.06] pt-4">
            <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Select scans</p>
            <div className="space-y-2">
              {SCAN_OPTIONS.map(({ key, title, description }) => (
                <ScanOptionCard
                  key={key}
                  title={title}
                  description={description}
                  checked={config.scans[key]}
                  onToggle={() => patchScans(key, !config.scans[key])}
                />
              ))}
            </div>
          </div>

          <div className="flex items-start gap-2 rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-2.5 text-[11px] leading-relaxed text-slate-500">
            <Shield className="mt-0.5 size-3.5 shrink-0 text-slate-500" aria-hidden />
            <p>OAuth read-only access. Tokens stay encrypted; you can disconnect anytime from settings.</p>
          </div>

          {error ? <p className="text-sm text-rose-300">{error}</p> : null}

          {connectors.length < 1 ? (
            <button
              type="button"
              onClick={() => router.push("/api/import/gmail/authorize?returnTo=/scan")}
              className={cn("h-12 w-full rounded-full text-sm", landingCta)}
            >
              Connect Gmail
            </button>
          ) : (
            <button
              type="button"
              disabled={starting || loadingConnectors}
              onClick={() => void onRunScan()}
              className={cn("h-12 w-full rounded-full text-sm disabled:opacity-60", landingCta)}
            >
              <span className="inline-flex items-center gap-2">
                <Search className="size-4" aria-hidden />
                {starting ? "Starting…" : "Run scan"}
              </span>
            </button>
          )}
        </div>
      </ScanWizardShell>
    </div>
  );
}
