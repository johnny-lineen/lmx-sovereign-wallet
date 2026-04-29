type IdentityContextInput = {
  fullName: string;
  submittedEmail: string;
  usernames: string[];
  websiteHint: string | null;
  locationHint?: string | null;
};

export type IdentityMatchResult = {
  hardSignals: string[];
  softSignals: string[];
  score: number;
  allowBalancedQueue: boolean;
  allowHighConfidence: boolean;
};

type IdentityContext = {
  fullName: string;
  nameParts: string[];
  email: string;
  emailLocalPart: string;
  emailDomain: string;
  usernames: string[];
  websiteHost: string;
  locationTokens: string[];
};

function normalizePart(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function toTokens(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9@._-]+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
}

function hostFromUrl(raw: string | null): string {
  if (!raw) return "";
  const trimmed = raw.trim();
  if (!trimmed) return "";
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  try {
    return new URL(withProtocol).hostname.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function buildIdentityContext(input: IdentityContextInput): IdentityContext {
  const email = normalizePart(input.submittedEmail);
  const [emailLocalPartRaw, emailDomainRaw] = email.split("@");
  const fullName = normalizePart(input.fullName);
  const nameParts = fullName
    .split(/\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length >= 2);
  const usernames = [...new Set(input.usernames.map((u) => normalizePart(u).replace(/^@+/, "")).filter(Boolean))];
  const locationTokens = toTokens(input.locationHint ?? "").filter((t) => !/^\d+$/.test(t)).slice(0, 5);

  return {
    fullName,
    nameParts,
    email,
    emailLocalPart: normalizePart(emailLocalPartRaw ?? ""),
    emailDomain: normalizePart(emailDomainRaw ?? ""),
    usernames,
    websiteHost: hostFromUrl(input.websiteHint),
    locationTokens,
  };
}

export function evaluateIdentityMatch(params: {
  context: IdentityContext;
  text: string;
  url?: string | null;
}): IdentityMatchResult {
  const haystack = `${params.text} ${params.url ?? ""}`.toLowerCase();
  const tokens = new Set(toTokens(haystack));
  const urlHost = hostFromUrl(params.url ?? null);

  const hardSignals: string[] = [];
  const softSignals: string[] = [];

  if (params.context.email && haystack.includes(params.context.email)) {
    hardSignals.push("exact_email");
  }
  if (params.context.emailLocalPart && params.context.emailDomain) {
    const hasLocal = haystack.includes(params.context.emailLocalPart) || tokens.has(params.context.emailLocalPart);
    const hasDomain = haystack.includes(params.context.emailDomain) || tokens.has(params.context.emailDomain);
    if (hasLocal && hasDomain) hardSignals.push("email_local_and_domain");
  }

  for (const username of params.context.usernames.slice(0, 10)) {
    if (!username) continue;
    if (tokens.has(username) || haystack.includes(`/${username}`) || haystack.includes(`@${username}`)) {
      hardSignals.push(`username:${username}`);
      break;
    }
  }

  if (params.context.websiteHost) {
    if (urlHost === params.context.websiteHost || urlHost.endsWith(`.${params.context.websiteHost}`)) {
      hardSignals.push("website_host_match");
    } else if (haystack.includes(params.context.websiteHost)) {
      softSignals.push("website_host_mention");
    }
  }

  if (params.context.fullName && haystack.includes(params.context.fullName)) {
    softSignals.push("full_name_exact");
  }
  const matchedNameParts = params.context.nameParts.filter((part) => tokens.has(part) || haystack.includes(part));
  if (matchedNameParts.length >= 2) {
    softSignals.push("name_parts_2plus");
  }
  if (params.context.emailLocalPart && (tokens.has(params.context.emailLocalPart) || haystack.includes(params.context.emailLocalPart))) {
    softSignals.push("email_local_mention");
  }
  if (params.context.emailDomain && (tokens.has(params.context.emailDomain) || haystack.includes(params.context.emailDomain))) {
    softSignals.push("email_domain_mention");
  }
  if (params.context.locationTokens.some((token) => tokens.has(token) || haystack.includes(token))) {
    softSignals.push("location_match");
  }

  const hardCount = hardSignals.length;
  const softCount = softSignals.length;
  const nonNameSoftCount = softSignals.filter((s) => s !== "full_name_exact" && s !== "name_parts_2plus").length;
  const looksLikeGenericBiography =
    /\b(wikipedia|is an american|american actor|american singer|born\s+\w+|biography)\b/i.test(haystack);
  const score = Math.min(1, hardCount * 0.55 + softCount * 0.15);
  const allowHighConfidence = hardCount >= 1 || (softCount >= 4 && softSignals.includes("full_name_exact"));
  const allowBalancedQueue =
    allowHighConfidence ||
    hardCount >= 1 ||
    (softCount >= 2 && nonNameSoftCount >= 1 && !looksLikeGenericBiography);

  return {
    hardSignals: [...new Set(hardSignals)],
    softSignals: [...new Set(softSignals)],
    score,
    allowBalancedQueue,
    allowHighConfidence,
  };
}
