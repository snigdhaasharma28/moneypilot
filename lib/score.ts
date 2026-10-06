import { hasPhrase, normalise } from "./prefilter";
import type {
  Band,
  Claim,
  EmailType,
  Evidence,
  Match,
  MatchKind,
  ScanResult,
  ScoredMatch,
  Settlement,
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

function timeScore(m: Match): number {
  const { settlement: s, extraction: ex } = m;
  // A notice addressed to the user is proof in itself; its date is not a transaction date.
  if (ex.email_type === "settlement_notice") return 1.0;
  if (s.match_rule === "breach_notice" && ex.email_type === "breach_notice") return 1.0;
  if (!s.class_period_start && !s.class_period_end) return 0.7;
  const date = evidenceDate(m);
  const afterStart = !s.class_period_start || date >= s.class_period_start;
  const beforeEnd = !s.class_period_end || date <= s.class_period_end;
  return afterStart && beforeEnd ? 1.0 : 0.2;
}

function productScore(m: Match): number {
  const keywords = m.settlement.product_keywords;
  if (keywords.length === 0) return 0.9;
  const text = normalise(`${m.extraction.product ?? ""} ${m.email.subject} ${m.email.body}`);
  return keywords.some((k) => hasPhrase(text, k)) ? 1.0 : 0.6;
}

// 1 = no restriction or same state, 0.7 = state unknown, null = different state (drop).
function stateFactor(m: Match): number | null {
  const required = m.settlement.state_restriction;
  if (!required) return 1;
  if (!m.extraction.billing_state) return 0.7;
  return m.extraction.billing_state === required ? 1 : null;
}

export function scoreMatch(m: Match): ScoredMatch | null {
  const state = stateFactor(m);
  if (state === null) return null;
  const score = E[m.extraction.email_type] * M[m.kind] * timeScore(m) * productScore(m) * state;
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
  const supporting = rest.filter((m) => m.score >= POSSIBLE_MIN && productScore(m) >= 0.9);
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
    claim_deadline: s.claim_deadline,
    days_left: days,
    deadline_soon: days <= DEADLINE_SOON_DAYS,
    claim_url: s.claim_url,
    source_url: s.source_url,
    band,
    confidence: round2(confidence),
    reason: reasonLine(primary),
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
