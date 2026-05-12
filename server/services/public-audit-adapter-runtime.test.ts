import assert from "node:assert/strict";
import { test } from "node:test";

import { executeConnectorWithPolicy } from "@/server/services/public-audit-adapter-runtime";

const baseCtx = {
  userId: "u1",
  runId: "r1",
  fullName: "Test User",
  submittedEmail: "test@example.com",
  usernames: ["testuser"],
  locationHint: null,
  websiteHint: null,
};

test("executeConnectorWithPolicy skips non-free connector by default", async () => {
  const result = await executeConnectorWithPolicy(
    {
      id: "paid_connector",
      policy: {
        allowedUse: "self_audit_only",
        licenseModel: "paid",
        costModel: "freemium",
        timeoutMs: 1000,
        piiSensitivity: "medium",
      },
      fetch: async () => [{ sourceType: "x" } as never],
    },
    baseCtx,
  );
  assert.equal(result.diagnostics.status, "skipped");
  assert.equal(result.rows.length, 0);
});

test("executeConnectorWithPolicy enforces timeout", async () => {
  const result = await executeConnectorWithPolicy(
    {
      id: "slow_connector",
      policy: {
        allowedUse: "self_audit_only",
        licenseModel: "open_source",
        costModel: "free",
        timeoutMs: 5,
        piiSensitivity: "low",
      },
      fetch: async () => {
        await new Promise((resolve) => setTimeout(resolve, 30));
        return [];
      },
    },
    baseCtx,
  );
  assert.equal(result.diagnostics.status, "error");
  assert.equal(result.rows.length, 0);
});
