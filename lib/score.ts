import { hasPhrase, normalise } from "./prefilter";
import type {
  Band,
  Claim,
  EmailType,
  Evidence,
  Match,
  MatchKind,
  PeriodCheck,
  ProductCheck,
  ScanResult,
  ScoredMatch,
  Settlement,
  StateCheck,
} from "./types";

const E: Record<EmailType, number> = {
  settlement_notice: 1.0,
  breach_notice: 0.95,
  receipt: 0.9,
  order: 0.9,
  renewal: 0.9,
  billing: 0.9,
  account_notice: 0.7,
  marketing: 0.3,
  other: 0.3,
};
const M: Record<MatchKind, number> = { exact: 1.0, parent: 0.8, fuzzy: 0.5 };
const T: Record<PeriodCheck, number> = { notice: 1.0, inside: 1.0, no_period: 0.7, outside: 0.2 };
const P: Record<ProductCheck, number> = { found: 1.0, no_keywords: 0.9, not_found: 0.6 };
const STATE: Record<Exclude<StateCheck, "mismatch">, number> = { none: 1, match: 1, unknown: 0.7 };

const TYPE_LABEL: Record<EmailType, string> = {
  settlement_notice: "settlement notice",
  breach_notice: "data breach notice",
  receipt: "receipt",
  order: "order",
  renewal: "renewal",
  billing: "payment",
  account_notice: "account email",
  marketing: "email",
  other: "email",
};

const BAND_ORDER: Band[] = ["high", "likely", "possible"];
const POSSIBLE_MIN = 0.3;
const DEADLINE_SOON_DAYS = 14;
const DAY_MS = 86_400_000;

function isNotice(m: Match): boolean {
  return ["settlement_notice", "breach_notice"].includes(m.extraction.email_type);
}

function evidenceDate(m: Match): string {
  return m.extraction.transaction_date ?? m.email.date.slice(0, 10);
}

function periodCheck(m: Match): PeriodCheck {
  const { settlement: s, extraction: ex } = m;
  // A notice addressed to the user is proof in itself; its date is not a transaction date.
  if (ex.email_type === "settlement_notice") return "notice";
  if (s.match_rule === "breach_notice" && ex.email_type === "breach_notice") return "notice";
  if (!s.class_period_start && !s.class_period_end) return "no_period";
  const date = evidenceDate(m);
  const afterStart = !s.class_period_start || date >= s.class_period_start;
  const beforeEnd = !s.class_period_end || date <= s.class_period_end;
  return afterStart && beforeEnd ? "inside" : "outside";
}

function productCheck(m: Match): ProductCheck {
  const keywords = m.settlement.product_keywords;
  if (keywords.length === 0) return "no_keywords";
  const text = normalise(`${m.extraction.product ?? ""} ${m.email.subject} ${m.email.body}`);
  return keywords.some((k) => hasPhrase(text, k)) ? "found" : "not_found";
}

function stateCheck(m: Match): StateCheck {
  const required = m.settlement.state_restriction;
  if (!required) return "none";
  if (!m.extraction.billing_state) return "unknown";
  return m.extraction.billing_state === required ? "match" : "mismatch";
}

export function scoreMatch(m: Match): ScoredMatch | null {
  const state = stateCheck(m);
  if (state === "mismatch") return null; // wrong state: not in the class
  const score =
    E[m.extraction.email_type] * M[m.kind] * T[periodCheck(m)] * P[productCheck(m)] * STATE[state];
  return { ...m, score };
}

function bandFor(confidence: number): Band | null {
  if (confidence >= 0.75) return "high";
  if (confidence >= 0.5) return "likely";
  if (confidence >= POSSIBLE_MIN) return "possible";
  return null;
}

function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

function reasonLine(m: ScoredMatch): string {
  const label = TYPE_LABEL[m.extraction.email_type];
  // A notice is identified by who sent it and when it arrived, not by a product.
  if (isNotice(m)) {
    const company = m.extraction.company ?? m.settlement.company;
    return `Because we found your ${company} ${label} from ${formatDate(m.email.date.slice(0, 10))}`;
  }
  const what = m.extraction.product ?? m.extraction.company ?? m.settlement.company;
  return `Because we found your ${what} ${label} from ${formatDate(evidenceDate(m))}`;
}

function toEvidence(m: ScoredMatch): Evidence {
  return {
    email_id: m.email.id,
    from_name: m.email.from_name,
    subject: m.email.subject,
    date: evidenceDate(m),
    email_type: m.extraction.email_type,
    product: m.extraction.product,
    evidence_line: m.extraction.evidence_line,
    score: round2(m.score),
  };
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function daysLeft(deadline: string, today: Date): number {
  const todayUtc = Date.parse(today.toISOString().slice(0, 10));
  return Math.round((Date.parse(deadline) - todayUtc) / DAY_MS);
}

function payoutMidpoint(s: Pick<Settlement, "payout_min" | "payout_max">): number {
  if (s.payout_min !== null && s.payout_max !== null) return (s.payout_min + s.payout_max) / 2;
  return s.payout_min ?? s.payout_max ?? 25;
}

function sortClaims(claims: Claim[]): Claim[] {
  const rank = (c: Claim) => c.confidence * payoutMidpoint(c);
  return [...claims].sort(
    (a, b) => BAND_ORDER.indexOf(a.band) - BAND_ORDER.indexOf(b.band) || rank(b) - rank(a),
  );
}

function toClaim(group: ScoredMatch[], today: Date): Claim | null {
  const [primary, ...rest] = [...group].sort((a, b) => b.score - a.score);
  // Only emails that would stand on their own, and are about the settlement's product, count as extra evidence.
  const supporting = rest.filter((m) => m.score >= POSSIBLE_MIN && productCheck(m) !== "not_found");
  const confidence = Math.min(0.99, primary.score + Math.min(0.15, 0.05 * supporting.length));
  const band = bandFor(confidence);
  if (!band) return null;

  const s = primary.settlement;
  const days = daysLeft(s.claim_deadline, today);
  return {
    settlement_id: s.id,
    name: s.name,
    company: s.company,
    eligibility_summary: s.eligibility_summary,
    payout_min: s.payout_min,
    payout_max: s.payout_max,
    payout_note: s.payout_note,
    proof_required: s.proof_required,
    notice_id_required: s.notice_id_required,
    class_period_start: s.class_period_start,
    class_period_end: s.class_period_end,
    state_restriction: s.state_restriction,
    claim_deadline: s.claim_deadline,
    days_left: days,
    deadline_soon: days <= DEADLINE_SOON_DAYS,
    claim_url: s.claim_url,
    source_url: s.source_url,
    band,
    confidence: round2(confidence),
    reason: reasonLine(primary),
    checks: {
      company: primary.kind,
      period: periodCheck(primary),
      product: productCheck(primary),
      state: stateCheck(primary),
    },
    primary: toEvidence(primary),
    supporting: supporting.map(toEvidence),
  };
}

// Group by settlement, pick the strongest email, band and sort.
export function buildClaims(scored: ScoredMatch[], today: Date) {
  const groups = new Map<string, ScoredMatch[]>();
  for (const m of scored) {
    groups.set(m.settlement.id, [...(groups.get(m.settlement.id) ?? []), m]);
  }
  const built = [...groups.values()].map((g) => toClaim(g, today));
  const claims = built.filter((c): c is Claim => c !== null);
  return { claims: sortClaims(claims), hidden_count: built.length - claims.length };
}

// Cached results keep their scores but get today's deadline maths.
export function refreshDeadlines(result: ScanResult, today: Date): ScanResult {
  const claims = result.claims.map((c) => {
    const days = daysLeft(c.claim_deadline, today);
    return { ...c, days_left: days, deadline_soon: days <= DEADLINE_SOON_DAYS };
  });
  return { ...result, claims };
}
