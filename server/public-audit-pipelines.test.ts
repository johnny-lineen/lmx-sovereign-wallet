import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildPipelineSummaryPayload,
  groupCandidatesByPipeline,
  pipelineIdFromSourceType,
  pipelineLabel,
} from "@/lib/public-audit-pipelines";

test("pipelineIdFromSourceType maps known adapters", () => {
  assert.equal(pipelineIdFromSourceType("breach_adapter"), "breaches");
  assert.equal(pipelineIdFromSourceType("gmail_inbox_adapter"), "emails");
  assert.equal(pipelineIdFromSourceType("public_search_adapter"), "signals");
  assert.equal(pipelineIdFromSourceType("input_identity_adapter"), "signals");
  assert.equal(pipelineIdFromSourceType("username_check_adapter"), "accounts");
  assert.equal(pipelineIdFromSourceType("unknown_adapter"), "other");
});

test("pipelineLabel returns readable titles", () => {
  assert.equal(pipelineLabel("breaches"), "Breaches");
  assert.equal(pipelineLabel("emails"), "Emails");
});

test("groupCandidatesByPipeline preserves order and skips empty", () => {
  const grouped = groupCandidatesByPipeline([
    { sourceType: "breach_adapter" },
    { sourceType: "gmail_inbox_adapter" },
    { sourceType: "breach_adapter" },
  ]);
  assert.equal(grouped.length, 2);
  assert.equal(grouped[0]!.id, "breaches");
  assert.equal(grouped[0]!.candidates.length, 2);
  assert.equal(grouped[1]!.id, "emails");
  assert.equal(grouped[1]!.candidates.length, 1);
});

test("buildPipelineSummaryPayload records HIBP skip and provider errors", () => {
  const summary = buildPipelineSummaryPayload({
    candidates: [{ sourceType: "public_search_adapter" }],
    providerErrors: ["serpapi"],
    hibpSkippedReason: "no_api_key",
  });
  assert.equal(summary.pipelines.signals?.count, 1);
  assert.equal(summary.pipelines.signals?.error, true);
  assert.equal(summary.pipelines.breaches?.skipped, "no_api_key");
  assert.equal(summary.pipelines.breaches?.count, 0);
});

test("buildPipelineSummaryPayload marks gmail pipeline errors with zero count when empty", () => {
  const summary = buildPipelineSummaryPayload({
    candidates: [],
    providerErrors: ["gmail"],
  });
  assert.equal(summary.pipelines.emails?.error, true);
  assert.equal(summary.pipelines.emails?.count, 0);
});
