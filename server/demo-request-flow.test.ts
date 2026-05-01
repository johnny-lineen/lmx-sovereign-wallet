import assert from "node:assert/strict";
import test from "node:test";

import { buildDemoSignUpUrl } from "@/lib/demo-request";
import { demoRequestBodySchema } from "@/lib/validations/demo-request";
import { normalizeClerkEmails } from "@/server/services/demo-request.service";

test("demoRequestBodySchema accepts expected short intake payload", () => {
  const parsed = demoRequestBodySchema.parse({
    email: "demo@example.com",
    digitalFootprintGoal: "security",
    accountCountEstimate: "range_25_75",
    usefulnessNotes: "Show likely account takeover risk first.",
    source: "landing_modal",
  });
  assert.equal(parsed.email, "demo@example.com");
  assert.equal(parsed.digitalFootprintGoal, "security");
});

test("demoRequestBodySchema rejects invalid question values", () => {
  const parsed = demoRequestBodySchema.safeParse({
    email: "demo@example.com",
    digitalFootprintGoal: "other",
    accountCountEstimate: "range_25_75",
  });
  assert.equal(parsed.success, false);
});

test("normalizeClerkEmails lowercases, trims, and de-duplicates", () => {
  const normalized = normalizeClerkEmails([
    " Demo@Example.com ",
    "demo@example.com",
    "SECOND@example.com",
    " ",
  ]);
  assert.deepEqual(normalized, ["demo@example.com", "second@example.com"]);
});

test("buildDemoSignUpUrl encodes email and source query params", () => {
  const url = buildDemoSignUpUrl({
    email: "hello+demo@example.com",
    source: "landing_modal",
  });
  assert.equal(url, "/sign-up?email=hello%2Bdemo%40example.com&source=landing_modal");
});
