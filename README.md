# Inbox Claim Matcher (MoneyPilot MVP)

Reads an inbox, finds proof of what a person bought or used, matches it to open class-action settlements,
and shows a ranked feed of claims with the email that proves each one.

## Eval

`scripts/eval.ts` runs the full pipeline on each data set and compares the claims with the ground-truth
`label` on every email. Labels are never sent to Claude or the UI.

```bash
npx tsx --env-file=.env.local scripts/eval.ts
```

A claim is **correct** when its settlement is in some email's `expected_settlement_ids` and its band is in
that email's `acceptable_bands`. **Recall** is expected settlements found / expected settlements. A **trap**
is an email labelled `is_trap` (news, scam, marketing, a friend's email, a same-name company) that must never
be used as evidence.

Results from the run on Oct 6, 2026 (model `claude-haiku-4-5-20251001`, saved in `data/eval.json`):

| | Synthetic inbox (45 emails) | Real receipts (4 emails) |
|---|---|---|
| Claims shown | 15 | 1 |
| High: shown / correct / precision | 13 / 13 / 100% | 1 / 1 / 100% |
| Likely: shown / correct / precision | 2 / 2 / 100% | 0 / 0 / n/a |
| Possible: shown / correct / precision | 0 / 0 / n/a | 0 / 0 / n/a |
| Recall | 15 / 15 (100%) | 1 / 1 (100%) |
| Traps used as evidence | 0 | 0 |
| Missed settlements | none | none |

Targets: high precision ≥ 90%, recall ≥ 80%, traps = 0. All met.

How to read these numbers:

- The synthetic inbox was written against the settlement list, and the matching rules and extraction prompt
  were tuned while looking at it. This is a regression check, not a held-out test.
- The real set is four emails with one expected claim, so its percentages carry little weight. Its value is
  the three real receipts (Fabletics via PayPal, Lyft, WHOOP) that correctly return no claim.
- Extraction uses a language model, so a rerun can move a borderline email between bands. One run is
  reported here.
