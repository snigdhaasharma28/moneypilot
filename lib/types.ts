// An email as the pipeline sees it. The eval-only `label` field is never part of this type.
export interface Email {
  id: string;
  from_name: string;
  from_email: string;
  subject: string;
  date: string;
  body: string;
}

export interface PastedEmail {
  from: string;
  subject: string;
  date: string;
  body: string;
}

export type MatchRule =
  | "purchase_in_period"
  | "account_in_period"
  | "breach_notice"
  | "dispute_in_period";

export interface Settlement {
  id: string;
  name: string;
  company: string;
  company_aliases: string[];
  parent_company: string | null;
  product_keywords: string[];
  match_rule: MatchRule;
  class_period_start: string | null;
  class_period_end: string | null;
  state_restriction: string | null;
  eligibility_summary: string;
  payout_min: number | null;
  payout_max: number | null;
  payout_note: string | null;
  proof_required: boolean | null;
  notice_id_required: boolean | null;
  claim_deadline: string;
  source_url: string;
  claim_url: string | null;
  excluded_sender_domains?: string[];
}

export const EMAIL_TYPES = [
  "settlement_notice",
  "breach_notice",
  "receipt",
  "order",
  "renewal",
  "billing",
  "account_notice",
  "marketing",
  "other",
] as const;
export type EmailType = (typeof EMAIL_TYPES)[number];

// What Claude returns for one email.
export interface Extraction {
  email_id: string;
  company: string | null;
  brand: string | null;
  product: string | null;
  email_type: EmailType;
  transaction_date: string | null;
  evidence_line: string | null;
  billing_state: string | null;
  is_false_positive: boolean;
  false_positive_reason: string | null;
}

export type MatchKind = "exact" | "parent" | "fuzzy";

export interface Match {
  email: Email;
  extraction: Extraction;
  settlement: Settlement;
  kind: MatchKind;
}

export interface ScoredMatch extends Match {
  score: number;
}

export type Band = "high" | "likely" | "possible";

// One email shown as proof on a claim card.
export interface Evidence {
  email_id: string;
  from_name: string;
  subject: string;
  date: string;
  email_type: EmailType;
  product: string | null;
  evidence_line: string | null;
  score: number;
}

export interface Claim {
  settlement_id: string;
  name: string;
  company: string;
  eligibility_summary: string;
  payout_min: number | null;
  payout_max: number | null;
  payout_note: string | null;
  proof_required: boolean | null;
  notice_id_required: boolean | null;
  claim_deadline: string;
  days_left: number;
  deadline_soon: boolean;
  claim_url: string | null;
  source_url: string;
  band: Band;
  confidence: number;
  reason: string;
  primary: Evidence;
  supporting: Evidence[];
}

export type ScanSource = "sample" | "real" | "paste";

export interface ScanStats {
  total_emails: number;
  kept_after_prefilter: number;
  false_positives_dropped: number;
}

export interface ScanResult {
  mode: "live" | "cached";
  source: ScanSource;
  scanned_at: string;
  snapshot_date: string;
  stats: ScanStats;
  claims: Claim[];
  hidden_count: number;
}
