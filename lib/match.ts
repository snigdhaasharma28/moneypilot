import { hasPhrase, normalise, senderDomain, settlementNames } from "./prefilter";
import type { Email, Extraction, Match, MatchKind, Settlement } from "./types";

// Purchases from these merchants are matched on the brand in the product line.
const RETAILERS = ["amazon", "best buy", "walmart", "target", "costco", "ebay"];

function isExcludedSender(email: Email, s: Settlement): boolean {
  const domain = senderDomain(email);
  return (s.excluded_sender_domains ?? []).some((d) => domain === d || domain.endsWith(`.${d}`));
}

function isRetailer(company: string): boolean {
  return RETAILERS.some((r) => hasPhrase(company, r));
}

// True when every token of one name appears in the other ("venetian" in "venetian blinds direct").
function tokensOverlap(a: string, b: string): boolean {
  const ta = a.split(" ");
  const tb = b.split(" ");
  return ta.every((t) => tb.includes(t)) || tb.every((t) => ta.includes(t));
}

function matchKind(extraction: Extraction, s: Settlement): MatchKind | null {
  const company = normalise(extraction.company);
  const candidates = [company, normalise(extraction.brand)].filter(Boolean);
  const names = settlementNames(s);

  if (candidates.some((c) => names.includes(c))) return "exact";

  const product = normalise(extraction.product);
  if (isRetailer(company) && names.some((n) => hasPhrase(product, n))) return "exact";

  const parent = normalise(s.parent_company);
  if (parent && candidates.includes(parent)) return "parent";

  if (candidates.some((c) => names.some((n) => tokensOverlap(c, n)))) return "fuzzy";
  return null;
}

// Email facts -> candidate settlements.
export function matchEmail(email: Email, extraction: Extraction, settlements: Settlement[]): Match[] {
  return settlements.flatMap((settlement) => {
    if (isExcludedSender(email, settlement)) return [];
    const kind = matchKind(extraction, settlement);
    return kind ? [{ email, extraction, settlement, kind }] : [];
  });
}
