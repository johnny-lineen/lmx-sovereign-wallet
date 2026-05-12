import { logError } from "@/lib/observability";
import type { RawPublicAuditCandidate } from "@/server/services/public-audit-adapters/breach-adapter";

export type ConnectorLicenseModel = "open_source" | "free_api" | "paid" | "unknown";
export type ConnectorCostModel = "free" | "freemium" | "paid";

export type PublicAuditConnectorPolicy = {
  licenseModel: ConnectorLicenseModel;
  costModel: ConnectorCostModel;
  timeoutMs: number;
  piiSensitivity: "low" | "medium" | "high";
  allowedUse: "self_audit_only";
};

export type PublicAuditConnectorContextLike = {
  userId: string;
  runId: string;
};

export type PublicAuditConnectorLike<TCtx = unknown> = {
  id: string;
  policy: PublicAuditConnectorPolicy;
  fetch: (ctx: TCtx) => Promise<RawPublicAuditCandidate[]>;
};

export type PublicAuditConnectorDiagnostics = {
  status: "ok" | "error" | "skipped";
  candidateCount: number;
  durationMs: number;
  code?: string;
  message?: string;
};

export type PublicAuditConnectorExecutionResult = {
  rows: RawPublicAuditCandidate[];
  diagnostics: PublicAuditConnectorDiagnostics;
  error?: unknown;
};

function freeOnlyModeEnabled(): boolean {
  return process.env.PUBLIC_AUDIT_FREE_ONLY_MODE?.trim() !== "0";
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`connector_timeout_${timeoutMs}ms`));
    }, timeoutMs);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

function isConnectorFree(connector: Pick<PublicAuditConnectorLike<unknown>, "policy">): boolean {
  return connector.policy.costModel === "free";
}

export async function executeConnectorWithPolicy<TCtx extends PublicAuditConnectorContextLike>(
  connector: PublicAuditConnectorLike<TCtx>,
  ctx: TCtx,
): Promise<PublicAuditConnectorExecutionResult> {
  const startedAt = Date.now();
  if (freeOnlyModeEnabled() && !isConnectorFree(connector)) {
    return {
      rows: [],
      diagnostics: {
        status: "skipped",
        code: "not_free_connector",
        message: "Skipped because PUBLIC_AUDIT_FREE_ONLY_MODE is enabled.",
        candidateCount: 0,
        durationMs: Date.now() - startedAt,
      },
    };
  }

  try {
    const rows = await withTimeout(connector.fetch(ctx), connector.policy.timeoutMs);
    return {
      rows,
      diagnostics: {
        status: "ok",
        candidateCount: rows.length,
        durationMs: Date.now() - startedAt,
      },
    };
  } catch (error) {
    logError("public_audit_connector_execution_failed", {
      connectorId: connector.id,
      runId: ctx.runId,
      userId: ctx.userId,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      rows: [],
      diagnostics: {
        status: "error",
        code: "execution_failed",
        message: error instanceof Error ? error.message : String(error),
        candidateCount: 0,
        durationMs: Date.now() - startedAt,
      },
      error,
    };
  }
}
