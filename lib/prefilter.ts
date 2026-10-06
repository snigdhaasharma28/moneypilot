import type { Email, Settlement } from "./types";

const KEYWORDS = [
  "receipt",
  "order",
  "confirmation",
  "renewal",
  "subscription",
  "payment",
  "invoice",
  "billing",
  "refund",
  "return",
  "data breach",
  "security incident",
  "data incident",
  "settlement",
  "claim id",
  "notice id",
  "class action",
  "account",
  "password",
  "terms",
];

// Lowercase, strip inc/llc/ltd/.com and punctuation, collapse spaces.
export function normalise(text: string | null | undefined): string {
  return (text ?? "")
    .toLowerCase()
    .replace(/\.com\b/g, " ")
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\b(inc|llc|ltd)\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Whole-word phrase check on normalised text ("ted" must not hit "united"). Allows a plural "s".
export function hasPhrase(normalisedText: string, phrase: string): boolean {
  const p = normalise(phrase);
  if (!p) return false;
  const padded = ` ${normalisedText} `;
  return padded.includes(` ${p} `) || padded.includes(` ${p}s `);
}

export function settlementNames(s: Settlement): string[] {
  return [s.company, ...s.company_aliases].map(normalise).filter(Boolean);
}

export function senderDomain(email: Email): string {
  return email.from_email.split("@").pop()?.toLowerCase() ?? "";
}

function senderMatchesSettlement(email: Email, names: string[]): boolean {
  const fromName = normalise(email.from_name);
  const domainLabels = senderDomain(email).split(".");
  return names.some(
    (name) => hasPhrase(fromName, name) || domainLabels.includes(name.replace(/ /g, "")),
  );
}

function hasKeyword(email: Email): boolean {
  const text = normalise(`${email.subject} ${email.body}`);
  return KEYWORDS.some((k) => hasPhrase(text, k));
}

// Keep transaction / notice emails, drop noise.
export function prefilter(emails: Email[], settlements: Settlement[]): Email[] {
  const names = settlements.flatMap(settlementNames);
  return emails.filter((e) => senderMatchesSettlement(e, names) || hasKeyword(e));
}
