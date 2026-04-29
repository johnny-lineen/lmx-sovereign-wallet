import assert from "node:assert/strict";
import { test } from "node:test";

import { classifyLandingIntent, normalizeLandingMessage } from "@/lib/landing-agent/intents";

function intentOf(raw: string) {
  return classifyLandingIntent(normalizeLandingMessage(raw));
}

test("crypto wallet disambiguation", () => {
  assert.equal(intentOf("Is this a crypto wallet?"), "difference_vs_crypto_wallet");
  assert.equal(intentOf("Do I need a seed phrase"), "difference_vs_crypto_wallet");
});

test("password manager and VPN", () => {
  assert.equal(intentOf("What makes this different from 1Password?"), "difference_vs_password_manager");
  assert.equal(intentOf("vs lastpass"), "difference_vs_password_manager");
  assert.equal(intentOf("How is this different from a VPN?"), "difference_vs_vpn");
});

test("scan and graph", () => {
  assert.equal(intentOf("How does the scan work?"), "what_it_scans");
  assert.equal(intentOf("How is the graph built?"), "graph_explainer");
});

test("mvp and roadmap", () => {
  assert.equal(intentOf("What is in the MVP right now?"), "mvp_scope");
  assert.equal(intentOf("What is not built yet?"), "mvp_scope");
  assert.equal(intentOf("What's on the roadmap?"), "roadmap");
});

test("trust and audience", () => {
  assert.equal(intentOf("Is my data secure?"), "trust_security");
  assert.equal(intentOf("Who is this for?"), "who_is_it_for");
});

test("why and how (product)", () => {
  assert.equal(intentOf("Why do I need this?"), "why_it_matters");
  assert.equal(intentOf("How does LMX work?"), "how_it_works");
});

test("what is and access", () => {
  assert.equal(intentOf("What does this product do?"), "what_is_this");
  assert.equal(intentOf("How do I get early access?"), "access_cta");
});

test("bare wallet routes to crypto clarification", () => {
  assert.equal(intentOf("wallet"), "difference_vs_crypto_wallet");
});

test("fallback for unrelated", () => {
  assert.equal(intentOf("asdf qwer zxcv"), "fallback_general");
});
