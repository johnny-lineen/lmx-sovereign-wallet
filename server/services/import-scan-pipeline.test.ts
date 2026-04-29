import assert from "node:assert/strict";
import test from "node:test";

import { importCandidateMergeGroupKey } from "@/lib/entity-unify";
import {
  aggregateImportCandidatesFromMessages,
  type GmailMessageMeta,
} from "@/server/services/import-candidate-extraction.service";
import {
  buildImportRowsFromExtracted,
  buildRelationPlanForExtracted,
  confidenceFromExtractedCandidate,
  importMinCandidateConfidence,
  IMPORT_EXTRACTOR_VERSION,
} from "@/server/services/import-scan-pipeline";

test("confidenceFromExtractedCandidate returns a bounded 0–1 value", () => {
  const extracted = aggregateImportCandidatesFromMessages([
    {
      messageId: "m1",
      subject: "Your order receipt",
      snippet: "Thank you for your purchase. Receipt attached.",
      fromRaw: "Amazon <no-reply@amazon.com>",
      fromEmail: "no-reply@amazon.com",
      fromDomain: "amazon.com",
    },
  ]);
  assert.ok(extracted.length >= 1);
  const c = confidenceFromExtractedCandidate(extracted[0]!);
  assert.ok(c >= 0.32 && c <= 0.99);
});

test("buildRelationPlanForExtracted links subscription to account for same domain", () => {
  const plan = buildRelationPlanForExtracted([
    {
      signal: "welcome_account",
      suggestedType: "account",
      title: "Acme",
      provider: "Acme",
      providerDomain: "acme.com",
      evidence: {},
      dedupeKey: "acme.com::account",
    },
    {
      signal: "subscription_renewal",
      suggestedType: "subscription",
      title: "Acme",
      provider: "Acme",
      providerDomain: "acme.com",
      evidence: {},
      dedupeKey: "acme.com::subscription",
    },
  ]);
  assert.equal(plan.length, 1);
  assert.equal(plan[0]!.relationType, "belongs_to");
  assert.equal(plan[0]!.fromDedupeKey, "acme.com::subscription");
  assert.equal(plan[0]!.toDedupeKey, "acme.com::account");
});

test("buildImportRowsFromExtracted adds confidence and extractor metadata", () => {
  const extracted = aggregateImportCandidatesFromMessages([
    {
      messageId: "a",
      subject: "Reset your password",
      snippet: "We received a request to reset your password.",
      fromRaw: "Uber <uber@uber.com>",
      fromEmail: "uber@uber.com",
      fromDomain: "uber.com",
    },
    {
      messageId: "b",
      subject: "Your Uber trip receipt",
      snippet: "Thanks for riding with Uber. Here is your receipt.",
      fromRaw: "Uber Receipts <receipts@uber.com>",
      fromEmail: "receipts@uber.com",
      fromDomain: "uber.com",
    },
  ]);
  assert.ok(extracted.length >= 1);
  const { rows, stats, relationPlan } = buildImportRowsFromExtracted({
    userId: "user-1",
    importJobId: "job-1",
    extracted,
    messagesFetched: 2,
  });
  assert.ok(rows.length >= 1);
  assert.equal(stats.messagesFetched, 2);
  assert.ok(stats.providersSeen >= 1);
  const ev = rows[0]!.evidence as Record<string, unknown>;
  assert.equal(ev.source, "gmail-scan-aggregated");
  assert.equal(ev.extractorVersion, IMPORT_EXTRACTOR_VERSION);
  assert.ok(typeof ev.confidence === "number");
  assert.ok(Array.isArray(ev.sampleMessageIds));
  assert.ok(relationPlan.length >= 0);
});

test("aggregateImportCandidatesFromMessages skips personal-mail senders", () => {
  const out = aggregateImportCandidatesFromMessages([
    {
      messageId: "x",
      subject: "Hello",
      snippet: "Newsletter",
      fromRaw: "Friend <a@gmail.com>",
      fromEmail: "a@gmail.com",
      fromDomain: "gmail.com",
    },
  ]);
  assert.deepEqual(out, []);
});

test("importCandidateMergeGroupKey prefers providerDomain over title", () => {
  const a = importCandidateMergeGroupKey({
    id: "1",
    suggestedType: "account",
    title: "Netflix",
    providerDomain: "netflix.com",
  });
  const b = importCandidateMergeGroupKey({
    id: "2",
    suggestedType: "account",
    title: "Different Title",
    providerDomain: "netflix.com",
  });
  assert.equal(a, b);
});

test("GmailMessageMeta fixtures produce stable domain-based dedupe keys", () => {
  const metas: GmailMessageMeta[] = [
    {
      messageId: "1",
      subject: "Payment receipt",
      snippet: "Your payment was successful. Amount paid $9.99",
      fromRaw: "Spotify <no-reply@spotify.com>",
      fromEmail: "no-reply@spotify.com",
      fromDomain: "spotify.com",
    },
  ];
  const extracted = aggregateImportCandidatesFromMessages(metas);
  assert.ok(extracted.length >= 1);
  assert.ok(extracted.every((e) => e.dedupeKey.includes("spotify.com")));
});

test("importMinCandidateConfidence defaults to 0.28 when unset", () => {
  const prev = process.env.IMPORT_MIN_CANDIDATE_CONFIDENCE;
  delete process.env.IMPORT_MIN_CANDIDATE_CONFIDENCE;
  try {
    assert.equal(importMinCandidateConfidence(), 0.28);
  } finally {
    if (prev === undefined) {
      delete process.env.IMPORT_MIN_CANDIDATE_CONFIDENCE;
    } else {
      process.env.IMPORT_MIN_CANDIDATE_CONFIDENCE = prev;
    }
  }
});

test("subscription renewal signals emit subscription candidate with relaxed threshold", () => {
  const metas: GmailMessageMeta[] = [
    {
      messageId: "s1",
      subject: "Your monthly billing update",
      snippet: "Your plan renews on April 30. You will be charged to your payment method on file.",
      fromRaw: "Canva Billing <billing@canva.com>",
      fromEmail: "billing@canva.com",
      fromDomain: "canva.com",
    },
  ];
  const extracted = aggregateImportCandidatesFromMessages(metas);
  assert.ok(extracted.some((candidate) => candidate.suggestedType === "subscription"));
});
