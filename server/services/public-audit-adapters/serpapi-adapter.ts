import type { RawPublicAuditCandidate } from "@/server/services/public-audit-adapters/breach-adapter";
import {
  buildIdentityContext,
  evaluateIdentityMatch,
} from "@/server/services/public-audit-adapters/identity-match";

type FetchSerpCandidatesInput = {
  fullName: string;
  submittedEmail: string;
  usernames: string[];
  locationHint: string | null;
  websiteHint: string | null;
};

type SerpApiResult = {
  title?: string;
  link?: string;
  snippet?: string;
  /** Organic `displayed_link` or similar; used only for classification context. */
  source?: string;
};

type ExtractedSerpRow = SerpApiResult & { serpBlock: string };

type SerpApiResponse = {
  organic_results?: unknown[];
  related_questions?: unknown[];
  answer_box?: unknown;
  inline_people_also_search_for?: unknown[];
  people_also_search_for?: unknown[];
  local_results?: unknown;
  top_stories?: unknown[];
  news_results?: unknown;
  video_results?: unknown[];
  inline_videos?: unknown[];
  error?: string;
  search_metadata?: {
    status?: string;
  };
};

const SERPAPI_ENDPOINT = "https://serpapi.com/search.json";
/** More queries → more diverse SERP layouts (organic + PAA + local, etc.). */
const MAX_QUERY_COUNT = 20;
const MAX_RESULTS_PER_QUERY = 10;
/** Cap after dedupe across all queries. */
const MAX_CANDIDATES_PER_RUN = 80;

function normalizeQueryPart(v: string): string {
  return v.trim().replace(/\s+/g, " ");
}

function normalizedUsernames(usernames: string[]): string[] {
  return [...new Set(usernames.map((u) => normalizeQueryPart(u).replace(/^@+/, "").toLowerCase()).filter(Boolean))];
}

function buildQueries(input: FetchSerpCandidatesInput): string[] {
  const fullName = normalizeQueryPart(input.fullName);
  const location = input.locationHint ? normalizeQueryPart(input.locationHint) : "";
  const website = input.websiteHint ? normalizeQueryPart(input.websiteHint) : "";
  const usernames = normalizedUsernames(input.usernames);
  const firstUsername = usernames[0] ?? "";
  const email = input.submittedEmail.trim().toLowerCase();
  const [emailLocalPartRaw, emailDomainRaw] = email.split("@");
  const emailLocalPart = normalizeQueryPart(emailLocalPartRaw ?? "");
  const emailDomain = normalizeQueryPart(emailDomainRaw ?? "");

  const baseQueries = [
    `"${email}"`,
    `${fullName} "${email}"`,
    `${fullName} intext:"${email}"`,
    emailDomain ? `"${fullName}" site:${emailDomain}` : "",
    emailLocalPart ? `"${emailLocalPart}" "${fullName}"` : "",
    emailLocalPart ? `"${emailLocalPart}" site:github.com OR site:linkedin.com OR site:x.com` : "",
    emailDomain ? `"${emailDomain}" "${fullName}"` : "",
    // Keep public-web queries identity-anchored; avoid broad full-name-only lookups.
    `${fullName} ${firstUsername}`.trim(),
    firstUsername ? `${fullName} site:linkedin.com/in` : "",
    firstUsername ? `${fullName} site:x.com OR site:twitter.com` : "",
    firstUsername ? `${fullName} site:github.com` : "",
    firstUsername ? `${fullName} site:instagram.com` : "",
    firstUsername ? `${fullName} site:facebook.com` : "",
    firstUsername ? `${firstUsername} ${fullName}` : "",
    firstUsername ? `"${firstUsername}" ${fullName}` : "",
    website ? `${fullName} ${website}` : "",
    emailDomain ? `${fullName} "${emailDomain}" "people search" OR whitepages OR spokeo OR truepeoplesearch` : "",
    firstUsername ? `${fullName} ${firstUsername} reddit OR medium` : "",
    location && firstUsername ? `${fullName} ${firstUsername} ${location}` : "",
  ];

  const usernameQueries = usernames.flatMap((u) => [
    `"${u}" "${fullName}"`,
    `${u} ${fullName}`,
    `${u} site:linkedin.com/in OR site:github.com OR site:x.com OR site:instagram.com`,
  ]);

  const queries = [...baseQueries, ...usernameQueries]
    .map((q) => q.trim())
    .filter(Boolean);

  return [...new Set(queries)].slice(0, MAX_QUERY_COUNT);
}

function normalizeUrl(value: string | undefined): string | null {
  if (!value) return null;
  try {
    const u = new URL(value.trim());
    u.hash = "";
    return u.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}

function guessTitleFromUrl(value: string | null): string | null {
  if (!value) return null;
  try {
    const u = new URL(value);
    const host = u.hostname.replace(/^www\./, "");
    const path = u.pathname.replace(/^\/+/, "").split("/").slice(0, 2).join("/");
    return path ? `${host}/${path}` : host;
  } catch {
    return null;
  }
}

function tokenSet(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[^a-z0-9@._-]+/)
      .map((x) => x.trim())
      .filter((x) => x.length >= 2),
  );
}

function relevanceScore(input: FetchSerpCandidatesInput, row: ExtractedSerpRow, normalizedUrl: string | null): number {
  const haystack = `${row.title ?? ""} ${row.snippet ?? ""} ${row.source ?? ""} ${normalizedUrl ?? row.link ?? ""}`.toLowerCase();
  const tokens = tokenSet(haystack);

  const fullName = normalizeQueryPart(input.fullName).toLowerCase();
  const nameParts = fullName.split(/\s+/).filter((p) => p.length > 1);
  const email = input.submittedEmail.trim().toLowerCase();
  const [emailLocalPartRaw, emailDomainRaw] = email.split("@");
  const emailLocalPart = (emailLocalPartRaw ?? "").toLowerCase();
  const emailDomain = (emailDomainRaw ?? "").toLowerCase();
  const usernames = normalizedUsernames(input.usernames);

  let score = 0;
  if (fullName && haystack.includes(fullName)) score += 0.45;
  const matchedNameParts = nameParts.filter((p) => tokens.has(p)).length;
  score += Math.min(0.2, matchedNameParts * 0.06);
  if (email && haystack.includes(email)) score += 0.35;
  if (emailLocalPart && (tokens.has(emailLocalPart) || haystack.includes(emailLocalPart))) score += 0.12;
  if (emailDomain && haystack.includes(emailDomain)) score += 0.1;
  for (const u of usernames.slice(0, 10)) {
    if (haystack.includes(u)) score += 0.08;
  }
  return Math.min(1, score);
}

function looksLikeUnrelatedPersonCard(result: ExtractedSerpRow): boolean {
  const text = `${result.title ?? ""} ${result.snippet ?? ""}`.toLowerCase();
  return (
    text.includes("people also search for") ||
    text.includes("is an american") ||
    text.includes("american actor") ||
    text.includes("american singer") ||
    text.includes("wikipedia") ||
    text.includes("birthday")
  );
}

function classifyAuditKind(result: SerpApiResult): "profile" | "search" | "broker" {
  const text = `${result.title ?? ""} ${result.link ?? ""} ${result.source ?? ""}`.toLowerCase();
  if (
    text.includes("whitepages") ||
    text.includes("spokeo") ||
    text.includes("truepeoplesearch") ||
    text.includes("peoplefinder") ||
    text.includes("people search")
  ) {
    return "broker";
  }
  if (
    text.includes("linkedin.com/in") ||
    text.includes("x.com/") ||
    text.includes("twitter.com/") ||
    text.includes("github.com/") ||
    text.includes("instagram.com/") ||
    text.includes("facebook.com/")
  ) {
    return "profile";
  }
  return "search";
}

function confidenceForKind(kind: ReturnType<typeof classifyAuditKind>): {
  confidenceBand: RawPublicAuditCandidate["confidenceBand"];
  confidenceScore: number;
  sourceType: RawPublicAuditCandidate["sourceType"];
  proposedVaultType: RawPublicAuditCandidate["proposedVaultType"];
} {
  if (kind === "profile") {
    return {
      confidenceBand: "high",
      confidenceScore: 0.84,
      sourceType: "public_profile_adapter",
      proposedVaultType: "social_account",
    };
  }
  if (kind === "broker") {
    return {
      confidenceBand: "medium",
      confidenceScore: 0.58,
      sourceType: "broker_presence_adapter",
      proposedVaultType: "custom",
    };
  }
  return {
    confidenceBand: "low",
    confidenceScore: 0.42,
    sourceType: "public_search_adapter",
    proposedVaultType: "custom",
  };
}

function toCandidate(
  input: FetchSerpCandidatesInput,
  result: ExtractedSerpRow,
  identityContext: ReturnType<typeof buildIdentityContext>,
): RawPublicAuditCandidate | null {
  const normalizedUrl = normalizeUrl(result.link);
  const title = result.title?.trim() || guessTitleFromUrl(normalizedUrl);
  if (!title) return null;
  const kind = classifyAuditKind(result);
  const confidence = confidenceForKind(kind);
  const relevance = relevanceScore(input, result, normalizedUrl);
  const identity = evaluateIdentityMatch({
    context: identityContext,
    text: `${result.title ?? ""} ${result.snippet ?? ""} ${result.source ?? ""}`,
    url: normalizedUrl ?? result.link ?? null,
  });

  if (looksLikeUnrelatedPersonCard(result) && identity.hardSignals.length === 0) {
    return null;
  }
  if (identity.hardSignals.length === 0) {
    return null;
  }
  if (!identity.allowBalancedQueue) return null;
  if (relevance < 0.22 && identity.hardSignals.length === 0) return null;

  const adjustedScore = Math.min(
    0.99,
    confidence.confidenceScore +
      Math.min(0.12, relevance * 0.16) +
      Math.min(0.2, identity.score * 0.22),
  );
  const finalBand =
    adjustedScore >= 0.8 && identity.allowHighConfidence
      ? "high"
      : adjustedScore >= 0.5
        ? "medium"
        : "low";
  if (finalBand === "high" && !identity.allowHighConfidence) return null;
  if (finalBand === "low") return null;

  return {
    sourceType: confidence.sourceType,
    sourceName: "SerpAPI Google",
    proposedVaultType: confidence.proposedVaultType,
    title,
    url: normalizedUrl,
    snippet: result.snippet?.trim() || null,
    matchedIdentifier: normalizedUrl ?? title.slice(0, 200),
    confidenceBand: finalBand,
    confidenceScore: adjustedScore,
    auditKind: kind,
    rawData: {
      displayedSource: result.source ?? null,
      provider: "serpapi",
      serpBlock: result.serpBlock,
      relevance,
      identity: {
        hardSignals: identity.hardSignals,
        softSignals: identity.softSignals,
        score: identity.score,
        allowHighConfidence: identity.allowHighConfidence,
      },
    },
  };
}

function readString(o: Record<string, unknown>, key: string): string | undefined {
  const v = o[key];
  return typeof v === "string" && v.trim() ? v.trim() : undefined;
}

/**
 * Flatten multiple Google SERP sections into rows. SerpAPI often returns useful URLs outside
 * `organic_results` (related questions, local pack, top stories, etc.).
 */
function extractResultRows(payload: SerpApiResponse): ExtractedSerpRow[] {
  const out: ExtractedSerpRow[] = [];

  const push = (block: string, title?: string, link?: string, snippet?: string, displayed?: string) => {
    const t = title?.trim();
    if (!t) return;
    out.push({
      title: t,
      link,
      snippet,
      source: displayed,
      serpBlock: block,
    });
  };

  if (Array.isArray(payload.organic_results)) {
    for (const row of payload.organic_results) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      push(
        "organic_results",
        readString(o, "title"),
        readString(o, "link"),
        readString(o, "snippet"),
        readString(o, "displayed_link"),
      );
    }
  }

  if (Array.isArray(payload.related_questions)) {
    for (const row of payload.related_questions) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const title = readString(o, "question") ?? readString(o, "title");
      push("related_questions", title, readString(o, "link"), readString(o, "snippet"));
    }
  }

  const ab = payload.answer_box;
  if (ab && typeof ab === "object") {
    const o = ab as Record<string, unknown>;
    const title =
      readString(o, "title") ??
      readString(o, "answer") ??
      readString(o, "result") ??
      readString(o, "snippet")?.slice(0, 280);
    push("answer_box", title, readString(o, "link"), readString(o, "snippet"));
  }

  const pasf = payload.inline_people_also_search_for ?? payload.people_also_search_for;
  if (Array.isArray(pasf)) {
    for (const row of pasf) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      const title = readString(o, "search_term") ?? readString(o, "title") ?? readString(o, "name");
      push("people_also_search_for", title, readString(o, "link"), readString(o, "snippet"));
    }
  }

  const lr = payload.local_results;
  if (lr && typeof lr === "object") {
    const o = lr as Record<string, unknown>;
    const places = o.places;
    if (Array.isArray(places)) {
      for (const row of places) {
        if (!row || typeof row !== "object") continue;
        const p = row as Record<string, unknown>;
        const snippet = [readString(p, "snippet"), readString(p, "address"), readString(p, "phone")]
          .filter(Boolean)
          .join(" — ");
        push("local_results", readString(p, "title") ?? readString(p, "name"), readString(p, "link"), snippet || undefined);
      }
    }
  }

  const storyArrays: [string, unknown][] = [
    ["top_stories", payload.top_stories],
    ["video_results", payload.video_results],
    ["inline_videos", payload.inline_videos],
  ];
  for (const [block, arr] of storyArrays) {
    if (!Array.isArray(arr)) continue;
    for (const row of arr) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      push(block, readString(o, "title") ?? readString(o, "name"), readString(o, "link"), readString(o, "snippet"));
    }
  }

  const nr = payload.news_results;
  if (Array.isArray(nr)) {
    for (const row of nr) {
      if (!row || typeof row !== "object") continue;
      const o = row as Record<string, unknown>;
      push("news_results", readString(o, "title") ?? readString(o, "name"), readString(o, "link"), readString(o, "snippet"));
    }
  } else if (nr && typeof nr === "object") {
    const o = nr as Record<string, unknown>;
    const articles = o.news_results;
    if (Array.isArray(articles)) {
      for (const row of articles) {
        if (!row || typeof row !== "object") continue;
        const a = row as Record<string, unknown>;
        push(
          "news_results",
          readString(a, "title") ?? readString(a, "name"),
          readString(a, "link"),
          readString(a, "snippet"),
        );
      }
    }
  }

  return out;
}

function isAllowedSearchMetadataStatus(status: string | undefined): boolean {
  if (!status) return true;
  const s = status.trim();
  return s === "Success" || s === "Cached";
}

async function fetchSerpPayload(query: string, apiKey: string): Promise<SerpApiResponse> {
  const url = new URL(SERPAPI_ENDPOINT);
  url.searchParams.set("engine", "google");
  url.searchParams.set("q", query);
  url.searchParams.set("num", String(MAX_RESULTS_PER_QUERY));
  url.searchParams.set("hl", "en");
  url.searchParams.set("safe", "active");
  url.searchParams.set("api_key", apiKey);

  const res = await fetch(url.toString(), {
    method: "GET",
    cache: "no-store",
  });

  const payload = (await res.json()) as SerpApiResponse;
  if (typeof payload.error === "string" && payload.error.trim().length > 0) {
    throw new Error(`SerpAPI error: ${payload.error}`);
  }
  if (!res.ok) {
    throw new Error(`SerpAPI HTTP ${res.status}`);
  }
  if (!isAllowedSearchMetadataStatus(payload.search_metadata?.status)) {
    throw new Error(`SerpAPI status: ${payload.search_metadata?.status ?? "unknown"}`);
  }
  return payload;
}

export async function fetchSerpCandidates(input: FetchSerpCandidatesInput): Promise<RawPublicAuditCandidate[]> {
  const apiKey = process.env.SERPAPI_API_KEY?.trim();
  if (!apiKey) {
    return [];
  }

  const queries = buildQueries(input);
  if (queries.length === 0) {
    return [];
  }

  const allRows: ExtractedSerpRow[] = [];
  let providerErrors = 0;
  for (const query of queries) {
    try {
      const payload = await fetchSerpPayload(query, apiKey);
      allRows.push(...extractResultRows(payload));
    } catch (error) {
      providerErrors += 1;
      console.warn(
        "[public-audit] SerpAPI query failed:",
        query,
        error instanceof Error ? error.message : "unknown error",
      );
    }
  }

  if (providerErrors === queries.length) {
    console.warn("[public-audit] All SerpAPI queries failed for this run.");
  }

  const dedupe = new Set<string>();
  const candidates: RawPublicAuditCandidate[] = [];
  const identityContext = buildIdentityContext(input);

  for (const row of allRows) {
    const candidate = toCandidate(input, row, identityContext);
    if (!candidate) continue;
    const key = `${candidate.url ?? ""}|${candidate.title.toLowerCase()}`;
    if (dedupe.has(key)) continue;
    dedupe.add(key);
    candidates.push(candidate);
    if (candidates.length >= MAX_CANDIDATES_PER_RUN) break;
  }

  return candidates;
}
