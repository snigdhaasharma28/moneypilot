import inboxFile from "@/data/inbox.json";
import realSamplesFile from "@/data/real-samples.json";
import settlementsFile from "@/data/settlements.json";
import { extractAll } from "./extract";
import { judgeMatches } from "./judge";
import { matchEmail } from "./match";
import { prefilter } from "./prefilter";
import { buildClaims, scoreMatch } from "./score";
import type {
  Email,
  Extraction,
  PastedEmail,
  ScanResult,
  ScanSource,
  ScoredMatch,
  Settlement,
} from "./types";

export const settlements = settlementsFile.settlements as unknown as Settlement[];
const SNAPSHOT_DATE = settlementsFile._meta.snapshot_date;

// The only place raw data files become pipeline emails: the eval `label` is dropped here.
export function toEmail(raw: Email): Email {
  const { id, from_name, from_email, subject, date, body } = raw;
  return { id, from_name, from_email, subject, date, body };
}

export function loadEmails(source: "sample" | "real"): Email[] {
  const file = source === "sample" ? inboxFile : realSamplesFile;
  return file.emails.map(toEmail);
}

// "Name <a@b.com>" or a bare address -> Email.
export function pastedToEmail(pasted: PastedEmail): Email {
  const address = pasted.from.match(/[^\s<>]+@[^\s<>]+/)?.[0] ?? "";
  const name = pasted.from.replace(/<.*>/, "").trim() || address;
  const parsed = new Date(pasted.date);
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return {
    id: "p01",
    from_name: name,
    from_email: address,
    subject: pasted.subject,
    date: date.toISOString(),
    body: pasted.body,
  };
}

function scoreEmails(emails: Email[], extractions: Extraction[]): ScoredMatch[] {
  const byId = new Map(extractions.map((x) => [x.email_id, x]));
  return emails.flatMap((email) => {
    const extraction = byId.get(email.id);
    if (!extraction || extraction.is_false_positive) return [];
    return matchEmail(email, extraction, settlements)
      .map((m) => scoreMatch(m))
      .filter((m): m is ScoredMatch => m !== null);
  });
}

// Judge the primary evidence of Likely / Possible claims, then let the formula re-score them.
async function applyJudge(scored: ScoredMatch[], today: Date): Promise<ScoredMatch[]> {
  const borderline = buildClaims(scored, today).claims.filter((c) => c.band !== "high");
  const primaries = scored.filter((m) =>
    borderline.some((c) => c.settlement_id === m.settlement.id && c.primary.email_id === m.email.id),
  );
  const verdicts = await judgeMatches(primaries);

  return scored.flatMap((m) => {
    const verdict = primaries.includes(m) ? verdicts.get(m.settlement.id) : undefined;
    if (!verdict) return [m];
    if (!verdict.own_transaction) return []; // same treatment as is_false_positive
    const rescored = scoreMatch(m, verdict.product_fit);
    return rescored ? [{ ...rescored, judge: verdict }] : [];
  });
}

function isPurchaseOrNotice(x: Extraction): boolean {
  return !x.is_false_positive && x.email_type !== "marketing" && x.email_type !== "other";
}

// prefilter -> extract -> match -> score -> judge borderline claims -> score. `trace` is for scripts only, never for the UI.
export async function runPipeline(
  emails: Email[],
  source: ScanSource,
  { today = new Date(), judge = true }: { today?: Date; judge?: boolean } = {},
) {
  const kept = prefilter(emails, settlements);
  const extractions = await extractAll(kept);
  const formulaScored = scoreEmails(kept, extractions);
  const scored = judge ? await applyJudge(formulaScored, today) : formulaScored;
  const { claims, hidden_count } = buildClaims(scored, today);

  const result: ScanResult = {
    mode: "live",
    source,
    scanned_at: today.toISOString(),
    snapshot_date: SNAPSHOT_DATE,
    stats: {
      total_emails: emails.length,
      kept_after_prefilter: kept.length,
      purchases_and_notices: extractions.filter(isPurchaseOrNotice).length,
      false_positives_dropped: extractions.filter((x) => x.is_false_positive).length,
    },
    claims,
    hidden_count,
  };
  return { result, trace: { kept, extractions } };
}
