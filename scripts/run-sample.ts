// Runs the pipeline on a data file and prints the ranked claims.
// Usage: npx tsx --env-file=.env.local scripts/run-sample.ts <file> [--save] [--stripe-check]
import { readFileSync, writeFileSync } from "node:fs";
import { pastedToEmail, runPipeline, toEmail } from "@/lib/pipeline";
import type { Email, ScanSource } from "@/lib/types";

const CACHE_PATH = "data/results.cached.json";

// Synthetic Stripe-style receipt: checks that the merchant, not the processor, is extracted.
const STRIPE_SAMPLE = pastedToEmail({
  from: "Anthropic, PBC <receipts+acct_demo@stripe.com>",
  subject: "Your receipt from Anthropic, PBC #2231-4410",
  date: "2026-09-02T10:15:00-04:00",
  body: "Receipt from Anthropic, PBC\n\nAmount paid: $20.00\nDate paid: Sep 2, 2026\nPayment method: Visa - 4417\n\nClaude Pro (monthly) — Qty 1 — $20.00\nTotal: $20.00\n\nIf you have any questions, contact support@anthropic.com.\n\nPowered by Stripe",
});

async function run(label: string, emails: Email[], source: ScanSource) {
  const started = Date.now();
  const { result, trace } = await runPipeline(emails, source);
  const seconds = ((Date.now() - started) / 1000).toFixed(1);

  console.log(`\n=== ${label}: ${result.claims.length} claims, ${result.hidden_count} hidden, ${seconds}s ===`);
  console.table(
    result.claims.map((c) => ({
      settlement: c.settlement_id,
      band: c.band,
      confidence: c.confidence,
      primary: c.primary.email_id,
      supporting: c.supporting.map((s) => s.email_id).join(","),
      reason: c.reason,
    })),
  );
  console.table(
    trace.extractions.map((x) => ({
      id: x.email_id,
      company: x.company,
      brand: x.brand,
      type: x.email_type,
      state: x.billing_state,
      false_positive: x.is_false_positive ? x.false_positive_reason : "",
    })),
  );
  return result;
}

async function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith("--"));
  if (file) {
    const emails: Email[] = JSON.parse(readFileSync(file, "utf8")).emails.map(toEmail);
    const result = await run(file, emails, file.includes("real") ? "real" : "sample");
    if (args.includes("--save")) {
      writeFileSync(CACHE_PATH, `${JSON.stringify(result, null, 2)}\n`);
      console.log(`Saved to ${CACHE_PATH}`);
    }
  }
  if (args.includes("--stripe-check")) await run("stripe check (paste path)", [STRIPE_SAMPLE], "paste");
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
