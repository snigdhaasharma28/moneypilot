import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { EMAIL_TYPES, type Email, type Extraction } from "./types";

const MODEL = "claude-haiku-4-5-20251001";
const BATCH_SIZE = 10;
const MAX_BODY_CHARS = 2500;

// Extraction prompt from CLAUDE.md (verbatim), followed by the JSON field spec.
export const SYSTEM_PROMPT = `You read emails from one person's inbox and extract evidence that THEY bought, subscribed to, or used a product or service, or that a company notified THEM directly. This evidence is matched to class-action settlements.
For each email return the fields listed above. Mark \`is_false_positive = true\` when:
1. The person is writing ABOUT a lawsuit or settlement (to a friend, in a forward) rather than receiving a notice addressed to them.
2. It is news, a blog or a newsletter reporting on a lawsuit.
3. It looks like a scam: promises money, urgent links, asks for bank/SSN, or the sender domain does not match the company it claims to be.
4. It is marketing only, with no sign the person bought something or holds an account (still return email_type = marketing).
5. The company named is not the party the person transacted with (similar names count as different companies).
Payment processors (PayPal, Stripe, Apple Pay, Klarna, Afterpay) are never the company: use the merchant named in the email (e.g. "You authorized $59.95 to Fabletics" -> company = Fabletics).
Be strict. Never guess a product, date or state not in the email. Return only JSON: { "results": [ ... ] }.

Fields (one object per email, in the same order as the input):
- email_id: the id of the email, copied exactly.
- company: the merchant or service the person dealt with, as named in the email. For a notice sent by a settlement administrator, the defendant company. null if none.
- brand: the product brand if it differs from company (e.g. LEVOIT bought on Amazon), else null.
- product: the main product or service, max 8 words, else null.
- email_type: one of settlement_notice, breach_notice, receipt, order, renewal, billing, account_notice, marketing, other. receipt, order, renewal and billing need a charge, amount or refund shown in the email; a return or refund confirmation is a receipt and a new paid subscription is billing. Use account_notice for account activity with no charge (welcome, password change, terms update, visit or usage summary).
- transaction_date: YYYY-MM-DD of the purchase, charge or event, else null.
- evidence_line: max 15 words, quoted from the email.
- billing_state: 2-letter US state if a billing or shipping address is shown, else null.
- is_false_positive: boolean.
- false_positive_reason: short reason when is_false_positive is true, else null.`;

const ExtractionSchema = z.object({
  email_id: z.string(),
  company: z.string().nullable(),
  brand: z.string().nullable(),
  product: z.string().nullable(),
  email_type: z.enum(EMAIL_TYPES),
  transaction_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().catch(null),
  evidence_line: z.string().nullable(),
  billing_state: z.string().regex(/^[A-Z]{2}$/).nullable().catch(null),
  is_false_positive: z.boolean(),
  false_positive_reason: z.string().nullable(),
});
const ResponseSchema = z.object({ results: z.array(ExtractionSchema) });

function chunk<T>(items: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

// Only these six fields ever reach Claude.
function toPromptEmail(e: Email) {
  return {
    id: e.id,
    from_name: e.from_name,
    from_email: e.from_email,
    subject: e.subject,
    date: e.date,
    body: e.body.slice(0, MAX_BODY_CHARS),
  };
}

function parseResponse(text: string, batch: Email[]): Extraction[] {
  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const { results } = ResponseSchema.parse(JSON.parse(json));
  const ids = new Set(results.map((r) => r.email_id));
  const missing = batch.filter((e) => !ids.has(e.id));
  if (missing.length > 0) throw new Error(`Missing results for ${missing.map((e) => e.id)}`);
  return results;
}

async function callClaude(client: Anthropic, batch: Email[]): Promise<Extraction[]> {
  const message = await client.messages.create({
    model: MODEL,
    max_tokens: 4096,
    temperature: 0,
    system: SYSTEM_PROMPT,
    messages: [{ role: "user", content: JSON.stringify({ emails: batch.map(toPromptEmail) }) }],
  });
  const text = message.content.map((b) => (b.type === "text" ? b.text : "")).join("");
  return parseResponse(text, batch);
}

async function extractBatch(client: Anthropic, batch: Email[]): Promise<Extraction[]> {
  try {
    return await callClaude(client, batch);
  } catch {
    return callClaude(client, batch); // one retry, then let the caller fall back
  }
}

export async function extractAll(emails: Email[]): Promise<Extraction[]> {
  if (!process.env.ANTHROPIC_API_KEY) throw new Error("ANTHROPIC_API_KEY is not set");
  if (emails.length === 0) return [];
  const client = new Anthropic({ maxRetries: 0, timeout: 18_000 });
  const batches = await Promise.all(chunk(emails, BATCH_SIZE).map((b) => extractBatch(client, b)));
  return batches.flat();
}
