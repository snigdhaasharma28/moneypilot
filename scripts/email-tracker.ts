// Writes one row per sample email: what it is, what it should match, and what the pipeline did with it.
// Usage: npx tsx --env-file=.env.local scripts/email-tracker.ts
import { readFileSync, writeFileSync } from "node:fs";
import { runPipeline, toEmail } from "@/lib/pipeline";
import type { Claim, Email, ScanSource } from "@/lib/types";

const OUT_PATH = "data/email-tracker.csv";
const SETS: { name: string; file: string; source: ScanSource }[] = [
  { name: "inbox", file: "data/inbox.json", source: "sample" },
  { name: "real", file: "data/real-samples.json", source: "real" },
];

interface Label {
  category: string;
  expected_settlement_ids: string[];
  is_trap: boolean;
}
type LabelledEmail = Email & { label: Label };
type Row = Record<string, string | number | boolean>;

interface Use {
  role: "primary" | "supporting";
  claim: Claim;
}

function usesOf(emailId: string, claims: Claim[]): Use[] {
  return claims.flatMap((claim): Use[] => {
    if (claim.primary.email_id === emailId) return [{ role: "primary", claim }];
    if (claim.supporting.some((s) => s.email_id === emailId)) return [{ role: "supporting", claim }];
    return [];
  });
}

// The outcome agrees with the label: evidence is used for an expected settlement, everything else is unused.
function isCorrect(label: Label, uses: Use[]): boolean {
  if (label.expected_settlement_ids.length === 0) return uses.length === 0;
  return uses.some((u) => label.expected_settlement_ids.includes(u.claim.settlement_id));
}

async function rowsFor(set: (typeof SETS)[number]): Promise<Row[]> {
  const emails: LabelledEmail[] = JSON.parse(readFileSync(set.file, "utf8")).emails;
  const { result, trace } = await runPipeline(emails.map(toEmail), set.source);
  const kept = new Set(trace.kept.map((e) => e.id));
  const extractions = new Map(trace.extractions.map((x) => [x.email_id, x]));

  return emails.map((email) => {
    const uses = usesOf(email.id, result.claims);
    const x = extractions.get(email.id);
    return {
      set: set.name,
      id: email.id,
      from_name: email.from_name,
      from_email: email.from_email,
      subject: email.subject,
      date: email.date.slice(0, 10),
      label_category: email.label.category,
      is_trap: email.label.is_trap,
      expected_settlements: email.label.expected_settlement_ids.join("; "),
      kept_by_prefilter: kept.has(email.id),
      extracted_company: x?.company ?? "",
      extracted_brand: x?.brand ?? "",
      extracted_type: x?.email_type ?? "",
      flagged_false_positive: x?.is_false_positive ?? "",
      used_as: uses.map((u) => u.role).join("; ") || "not used",
      matched_settlement: uses.map((u) => u.claim.settlement_id).join("; "),
      band: uses.map((u) => u.claim.band).join("; "),
      confidence: uses.map((u) => u.claim.confidence).join("; "),
      correct: isCorrect(email.label, uses) ? "yes" : "no",
    };
  });
}

function csvCell(value: string | number | boolean): string {
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows: Row[]): string {
  const columns = Object.keys(rows[0]);
  const lines = rows.map((row) => columns.map((c) => csvCell(row[c])).join(","));
  return `${[columns.join(","), ...lines].join("\n")}\n`;
}

async function main() {
  const rows = (await Promise.all(SETS.map(rowsFor))).flat();
  writeFileSync(OUT_PATH, toCsv(rows));

  const count = (test: (r: Row) => boolean) => rows.filter(test).length;
  console.log(`Wrote ${rows.length} rows to ${OUT_PATH}`);
  console.log(`primary: ${count((r) => String(r.used_as).includes("primary"))}`);
  console.log(`supporting: ${count((r) => String(r.used_as).includes("supporting"))}`);
  console.log(`not used: ${count((r) => r.used_as === "not used")}`);
  console.log(`traps used: ${count((r) => r.is_trap === true && r.used_as !== "not used")}`);
  const wrong = rows.filter((r) => r.correct === "no");
  console.log(`disagree with label: ${wrong.length}`, wrong.map((r) => `${r.id} (${r.used_as})`));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
