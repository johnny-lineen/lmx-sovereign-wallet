import type { LandingAgentIntent } from "@/lib/landing-agent/types";

const CRYPTO_WALLET =
  /\b(crypto|cryptocurrency|bitcoin|btc|ethereum|eth|solana|wallet address|seed phrase|private key|defi|nft|on-?chain|blockchain wallet|hardware wallet|metamask|ledger|trezor)\b/;

const PASSWORD_MANAGER = /\b(password manager|1password|onepassword|lastpass|bitwarden|dashlane|keeper|credentials vault)\b/;

const VPN = /\b(vpn|nordvpn|expressvpn|mullvad|protonvpn|surfshark|tunnelbear|wireguard|openvpn)\b/;

const SCAN_IMPORT =
  /\b(scan|scans|scanning|import|ingest|ingestion|gmail|google oauth|oauth|mailbox|inbox sync|pull email|connect gmail|what do you read|what data do you access)\b/;

const GRAPH =
  /\b(graph|graphs|node|nodes|edge|edges|network map|relationship map|visual map|topology|entity)\b/;

const MVP_TODAY =
  /\b(mvp|minimum viable|what('s| is) (in|shipped|live|built) today|what exists now|current product|beta today|what can i use now|feature list today)\b/;

const ROADMAP = /\b(roadmap|future|coming later|next release|what('s|s) next|long-?term|later phase|planned feature)\b/;

const MVP_SCOPE_HINT =
  /\b(not built yet|what (is not|isn't) (built|included)|outside (the )?mvp|store passwords|does this store passwords)\b/;

const TRUST =
  /\b(trust|security model|privacy policy|encrypt|encryption|where is my data|my data|data residency|clerk|compliance|soc2|hipaa|gdpr|safe|secure|is it secure)\b/;

const WHO_FOR =
  /\b(who is this for|who is it for|target user|ideal customer|should i use|is this for me|persona|founder|operator)\b/;

const WHY_MATTER =
  /\b(why (do i|should i)|why bother|what('s|s) the point|so what|why need|worth it|problem you solve)\b/;

const HOW_WORKS =
  /\b(how does (it|this|lmx) work|how it works|architecture|under the hood|pipeline|flow|mechanism)\b/;

const ACCESS =
  /\b(waitlist|early access|invite|get access|join|sign ?up|notify|newsletter|request access|how do i get in|beta access)\b/;

const WHAT_IS =
  /\b(what (is|are)|what does|describe|overview|explain (the |this )?product|tell me about|who are you)\b/;

/** Normalize user input for deterministic matching. */
export function normalizeLandingMessage(raw: string): string {
  return raw
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/[’']/g, "'");
}

/**
 * Rule-based intent classification. Order matters: more specific signals first.
 * Optional future: LLM fallback — not used in V1.
 */
export function messageSuggestsSignIn(normalized: string): boolean {
  return /\b(sign in|sign-in|log ?in|login|already have an account|existing user|returning user)\b/.test(normalized);
}

export function classifyLandingIntent(normalized: string): LandingAgentIntent {
  if (!normalized) return "fallback_general";

  if (ACCESS.test(normalized)) return "access_cta";

  if (CRYPTO_WALLET.test(normalized)) return "difference_vs_crypto_wallet";
  if (PASSWORD_MANAGER.test(normalized)) return "difference_vs_password_manager";
  if (VPN.test(normalized)) return "difference_vs_vpn";

  if (SCAN_IMPORT.test(normalized)) return "what_it_scans";
  if (GRAPH.test(normalized)) return "graph_explainer";

  if (MVP_TODAY.test(normalized)) return "mvp_scope";
  if (ROADMAP.test(normalized)) return "roadmap";

  if (MVP_SCOPE_HINT.test(normalized)) return "mvp_scope";

  if (TRUST.test(normalized)) return "trust_security";
  if (WHO_FOR.test(normalized)) return "who_is_it_for";

  if (WHY_MATTER.test(normalized)) return "why_it_matters";
  if (HOW_WORKS.test(normalized)) return "how_it_works";

  if (WHAT_IS.test(normalized)) return "what_is_this";

  if (/\b(wallet)\b/.test(normalized) && /\b(not|isn't|isnt|only|just|crypto|btc|eth)\b/.test(normalized)) {
    return "difference_vs_crypto_wallet";
  }
  if (/\b(wallet)\b/.test(normalized)) {
    return "difference_vs_crypto_wallet";
  }

  return "fallback_general";
}
