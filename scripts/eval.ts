// Precision / recall of the pipeline against each email's ground-truth label.
// Usage: npx tsx --env-file=.env.local scripts/eval.ts
import { readFileSync, writeFileSync } from "node:fs";
import { runPipeline, toEmail } from "@/lib/pipeline";
import type { Band, Claim, Email, ScanSource } from "@/lib/types";

const OUT_PATH = "data/eval.json";
const BANDS: Band[] = ["high", "likely", "possible"];
const SETS: { name: string; file: string; source: ScanSource }[] = [
  { name: "inbox", file: "data/inbox.json", source: "sample" },
  { name: "real", file: "data/real-samples.json", source: "real" },
];

interface Label {
  expected_settlement_ids: string[];
  acceptable_bands: (Band | null)[];
  is_trap: boolean;
}
type LabelledEmail = Email & { label: Label };

function percent(part: number, whole: number): number | null {
  return whole === 0 ? null : Math.round((part / whole) * 1000) / 10;
}

// Correct = some email expects this settlement AND accepts the band it landed in.
function isCorrect(claim: Claim, emails: LabelledEmail[]): boolean {
  return emails.some(
    (e) =>
      e.label.expected_settlement_ids.includes(claim.settlement_id) &&
      e.label.acceptable_bands.includes(claim.band),
  );
}

function evidenceIds(claim: Claim): string[] {
  return [claim.primary.email_id, ...claim.supporting.map((s) => s.email_id)];
}

function evaluate(claims: Claim[], emails: LabelledEmail[]) {
  const bands = BANDS.map((band) => {
    const shown = claims.filter((c) => c.band === band);
    const wrong = shown.filter((c) => !isCorrect(c, emails)).map((c) => c.settlement_id);
    const correct = shown.length - wrong.length;
    return { band, shown: shown.length, correct, precision: percent(correct, shown.length), wrong };
  });

  const expected = [...new Set(emails.flatMap((e) => e.label.expected_settlement_ids))];
  const found = expected.filter((id) => claims.some((c) => c.settlement_id === id));
  const missed = expected
    .filter((id) => !found.includes(id))
    .map((id) => ({
      settlement_id: id,
      email_ids: emails.filter((e) => e.label.expected_settlement_ids.includes(id)).map((e) => e.id),
    }));

  const trapIds = new Set(emails.filter((e) => e.label.is_trap).map((e) => e.id));
  const traps_used = claims.flatMap((c) =>
    evidenceIds(c)
      .filter((id) => trapIds.has(id))
      .map((email_id) => ({ settlement_id: c.settlement_id, email_id })),
  );

  return {
    emails: emails.length,
    claims_shown: claims.length,
    bands,
    recall: { expected: expected.length, found: found.length, recall: percent(found.length, expected.length) },
    missed,
    traps_used,
  };
}

function print(name: string, report: ReturnType<typeof evaluate>) {
  console.log(`\n=== ${name}: ${report.emails} emails, ${report.claims_shown} claims shown ===`);
  console.table(report.bands.map(({ wrong, ...row }) => ({ ...row, wrong: wrong.join(",") })));
  const { expected, found, recall } = report.recall;
  console.log(`Recall: ${found}/${expected} expected settlements found (${recall ?? "n/a"}%)`);
  console.log(`Traps used as evidence: ${report.traps_used.length}`, report.traps_used);
  console.log("Missed:", report.missed.length === 0 ? "none" : report.missed);
}

async function main() {
  const results: Record<string, ReturnType<typeof evaluate>> = {};
  for (const set of SETS) {
    const emails: LabelledEmail[] = JSON.parse(readFileSync(set.file, "utf8")).emails;
    const { result } = await runPipeline(emails.map(toEmail), set.source);
    results[set.name] = evaluate(result.claims, emails);
    print(set.name, results[set.name]);
  }
  const output = { generated_at: new Date().toISOString(), model: "claude-haiku-4-5-20251001", ...results };
  writeFileSync(OUT_PATH, `${JSON.stringify(output, null, 2)}\n`);
  console.log(`\nSaved to ${OUT_PATH}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
