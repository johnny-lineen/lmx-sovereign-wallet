import assert from "node:assert/strict";
import { test } from "node:test";

import {
  buildIdentityContext,
  evaluateIdentityMatch,
} from "@/server/services/public-audit-adapters/identity-match";
import type { RawPublicAuditCandidate } from "@/server/services/public-audit-adapters/breach-adapter";
import { applyBalancedQualityPass } from "@/server/services/public-audit-quality";

function candidate(overrides: Partial<RawPublicAuditCandidate>): RawPublicAuditCandidate {
  return {
    sourceType: "public_search_adapter",
    sourceName: "SerpAPI Google",
    proposedVaultType: "custom",
    title: "Candidate",
    url: null,
    snippet: null,
    matchedIdentifier: null,
    confidenceBand: "medium",
    confidenceScore: 0.5,
    auditKind: "search",
    rawData: { provider: "serpapi", identity: { score: 0.4 } },
    ...overrides,
  };
}

test("identity matcher rejects unrelated same-name result without anchors", () => {
  const context = buildIdentityContext({
    fullName: "John Smith",
    submittedEmail: "john.smith@acme.com",
    usernames: ["johnsmith"],
    websiteHint: "https://johnsmith.dev",
    locationHint: "Austin TX",
  });
  const result = evaluateIdentityMatch({
    context,
    text: "John Smith is an American singer and actor with a new movie release.",
    url: "https://en.wikipedia.org/wiki/John_Smith",
  });

  assert.equal(result.allowBalancedQueue, false);
  assert.equal(result.allowHighConfidence, false);
  assert.equal(result.hardSignals.length, 0);
});

test("identity matcher allows user-linked profile result", () => {
  const context = buildIdentityContext({
    fullName: "John Smith",
    submittedEmail: "john.smith@acme.com",
    usernames: ["johnsmith"],
    websiteHint: "https://johnsmith.dev",
    locationHint: "Austin TX",
  });
  const result = evaluateIdentityMatch({
    context,
    text: "John Smith (@johnsmith) founder at Acme. Contact: john.smith@acme.com",
    url: "https://x.com/johnsmith",
  });

  assert.equal(result.allowBalancedQueue, true);
  assert.equal(result.allowHighConfidence, true);
  assert.ok(result.hardSignals.length >= 1);
});

test("quality pass caps medium candidates per source", () => {
  const medium = Array.from({ length: 30 }, (_, i) =>
    candidate({
      title: `Result ${i}`,
      confidenceBand: "medium",
      confidenceScore: 0.6 + i * 0.001,
      sourceType: "public_search_adapter",
      rawData: { provider: "serpapi", identity: { score: i / 100 } },
    }),
  );
  const high = candidate({
    title: "High confidence",
    confidenceBand: "high",
    confidenceScore: 0.88,
    sourceType: "public_search_adapter",
  });
  const filtered = applyBalancedQualityPass([high, ...medium]);

  const fromSearch = filtered.filter((c) => c.sourceType === "public_search_adapter");
  const highCount = fromSearch.filter((c) => c.confidenceBand === "high").length;
  const mediumCount = fromSearch.filter((c) => c.confidenceBand === "medium").length;

  assert.equal(highCount, 1);
  assert.equal(mediumCount, 12);
});
