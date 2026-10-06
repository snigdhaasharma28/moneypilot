// Writes the settlement catalogue as a spreadsheet, with how each one did in the saved sample scan.
// Usage: npx tsx scripts/settlements-tracker.ts   (no API key needed; reads data files only)
import { readFileSync, writeFileSync } from "node:fs";
import type { ScanResult, Settlement } from "@/lib/types";
import { toCsv, type Row } from "./csv";

const OUT_PATH = "data/settlements-tracker.csv";

type CatalogueEntry = Settlement & { industry?: string; verified_on?: string };

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8"));
}

function toRow(s: CatalogueEntry, scan: ScanResult): Row {
  const claim = scan.claims.find((c) => c.settlement_id === s.id);
  return {
    id: s.id,
    name: s.name,
    company: s.company,
    aliases: s.company_aliases.join("; "),
    industry: s.industry ?? "",
    match_rule: s.match_rule,
    class_period_start: s.class_period_start,
    class_period_end: s.class_period_end,
    state_restriction: s.state_restriction,
    payout_min: s.payout_min,
    payout_max: s.payout_max,
    payout_note: s.payout_note,
    proof_required: s.proof_required,
    notice_id_required: s.notice_id_required,
    claim_deadline: s.claim_deadline,
    eligibility_summary: s.eligibility_summary,
    claim_url: s.claim_url,
    source_url: s.source_url,
    verified_on: s.verified_on ?? "",
    sample_inbox_result: claim ? claim.band : "not shown",
    sample_confidence: claim ? claim.confidence : "",
    sample_primary_email: claim ? claim.primary.email_id : "",
    sample_supporting_emails: claim ? claim.supporting.map((e) => e.email_id).join("; ") : "",
  };
}

const { settlements } = readJson<{ settlements: CatalogueEntry[] }>("data/settlements.json");
const scan = readJson<ScanResult>("data/results.cached.json");
const rows = settlements.map((s) => toRow(s, scan));

writeFileSync(OUT_PATH, toCsv(rows));
const shown = rows.filter((r) => r.sample_inbox_result !== "not shown").length;
console.log(`Wrote ${rows.length} settlements to ${OUT_PATH} (${shown} matched in the saved sample scan)`);
