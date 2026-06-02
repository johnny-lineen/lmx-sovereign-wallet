const HIBP_BASE = "https://haveibeenpwned.com/api/v3";
const USER_AGENT = "LMX-Sovereign-Wallet";
export const HIBP_RATE_LIMIT_DELAY_MS = 1500;

export type HibpBreach = {
  Name: string;
  Domain: string;
  BreachDate: string;
  DataClasses: string[];
  IsSensitive: boolean;
};

type HibpBreachApiRow = {
  Name?: string;
  Domain?: string;
  BreachDate?: string;
  DataClasses?: string[];
  IsSensitive?: boolean;
};

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function mapBreach(row: HibpBreachApiRow): HibpBreach {
  return {
    Name: row.Name ?? "",
    Domain: row.Domain ?? "",
    BreachDate: row.BreachDate ?? "",
    DataClasses: Array.isArray(row.DataClasses) ? row.DataClasses : [],
    IsSensitive: Boolean(row.IsSensitive),
  };
}

/**
 * Query Have I Been Pwned for breaches affecting `email`.
 * Returns an empty array on 404 (no breaches) or on recoverable API errors.
 */
export async function checkBreaches(email: string): Promise<HibpBreach[]> {
  const apiKey = process.env.HIBP_API_KEY?.trim();
  if (!apiKey) {
    console.error("[hibp] HIBP_API_KEY is not configured");
    return [];
  }

  const account = encodeURIComponent(email.trim());
  const url = `${HIBP_BASE}/breachedaccount/${account}?truncateResponse=false`;

  try {
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "hibp-api-key": apiKey,
        "user-agent": USER_AGENT,
        Accept: "application/json",
      },
      cache: "no-store",
    });

    if (res.status === 404) {
      return [];
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[hibp] breachedaccount failed for ${email}: ${res.status} ${body.slice(0, 200)}`);
      return [];
    }

    const data = (await res.json()) as HibpBreachApiRow[];
    if (!Array.isArray(data)) {
      console.error("[hibp] unexpected response shape", { email });
      return [];
    }

    return data.map(mapBreach);
  } catch (err) {
    console.error("[hibp] request error", { email, err });
    return [];
  }
}

/**
 * Check multiple emails with HIBP rate-limit spacing between calls.
 */
export async function checkBreachesMany(emails: string[]): Promise<Map<string, HibpBreach[]>> {
  const unique = [...new Set(emails.map((e) => e.trim().toLowerCase()).filter(Boolean))];
  const results = new Map<string, HibpBreach[]>();

  for (let i = 0; i < unique.length; i++) {
    if (i > 0) {
      await sleep(HIBP_RATE_LIMIT_DELAY_MS);
    }
    const email = unique[i]!;
    results.set(email, await checkBreaches(email));
  }

  return results;
}
