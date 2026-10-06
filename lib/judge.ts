import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import type { JudgeVerdict, ScoredMatch } from "./types";

const MODEL = "claude-haiku-4-5-20251001";

// Second opinion on borderline claims: does this email really fit the settlement's eligibility text?
export const JUDGE_PROMPT = `You check email evidence against a class-action settlement's eligibility text. Each item has facts extracted from one email in a person's inbox and one settlement it was matched to.
For each item return:
- id: copied exactly.
- product_fit: a number from 0 to 1 for how well the product or service in the email fits what the settlement covers. 1.0 = clearly the covered product, service or event. About 0.5 = right company, but the email does not show whether it is the covered product or service. 0 = clearly a different product or service. If the settlement covers anyone with an account, or anyone who was sent a notice, then an account email or notice from that company is 1.0.
- own_transaction: true if the email shows this person's own purchase, account, dispute, or a notice addressed to them. false if it is about someone else, is news or marketing, or comes from a different company with a similar name.
- reason: max 20 words.
Judge only what an email can show. Do not lower product_fit for conditions no email could prove (residency, holding some other account, exact usage).
Be strict. Return only JSON: { "results": [ ... ] }.`;

const ResponseSchema = z.object({
  results: z.array(
    z.object({
      id: z.string(),
      product_fit: z.number().min(0).max(1),
      own_transaction: z.boolean(),
      reason: z.string(),
    }),
  ),
});

// Email facts and eligibility text only; the email body is not sent again.
function toItem(m: ScoredMatch) {
  const { settlement: s, extraction: x, email } = m;
  return {
    id: s.id,
    settlement: { name: s.name, company: s.company, eligibility_summary: s.eligibility_summary },
    email: {
      from_name: email.from_name,
      subject: email.subject,
      company: x.company,
      brand: x.brand,
      product: x.product,
      email_type: x.email_type,
      transaction_date: x.transaction_date,
      evidence_line: x.evidence_line,
    },
  };
}

async function callJudge(client: Anthropic, matches: ScoredMatch[]): Promise<Map<string, JudgeVerdict>> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 2048,
    temperature: 0,
    system: JUDGE_PROMPT,
    messages: [{ role: "user", content: JSON.stringify({ items: matches.map(toItem) }) }],
  });
  const text = message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const { results } = ResponseSchema.parse(JSON.parse(json));
  return new Map(results.map(({ id, ...verdict }) => [id, verdict]));
}

// Returns a verdict per settlement id. If the judge fails twice, claims keep their formula score.
export async function judgeMatches(matches: ScoredMatch[]): Promise<Map<string, JudgeVerdict>> {
  if (matches.length === 0) return new Map();
  const client = new Anthropic({ maxRetries: 0, timeout: 8_000 });
  try {
    return await callJudge(client, matches);
  } catch {
    try {
      return await callJudge(client, matches);
    } catch (err) {
      console.error("Judge step skipped:", err instanceof Error ? err.message : err);
      return new Map();
    }
  }
}
