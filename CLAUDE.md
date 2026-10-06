# Inbox Claim Matcher (MoneyPilot MVP)

## What this is
An MVP for MoneyPilot, an app that helps US consumers find and file class-action settlement claims.
Instead of a generic quiz, we read a user's inbox, find proof of what they bought or used, match it to open
settlements, and show a ranked feed of claims with the reason for each ("Because we found your Spotify renewal, Mar 12, 2023").

Magic moment: tap "Connect Gmail", enter an address -> in under 15 seconds see a ranked feed where every card shows the email that proves it.

Optimise for a clean, working core loop over breadth. When in doubt, cut scope and keep the loop working.

## Real vs mocked (keep it this way)
- Real: Claude extraction, matching, confidence scoring, UI, live deploy, settlement data (`data/settlements.json`, 17 real open settlements, snapshot 2026-10-06).
- Mocked: the inbox (`data/inbox.json`, 45 synthetic labelled emails). No Gmail/Outlook OAuth; the "Connect Gmail" screen is a demo step that always scans the sample inbox.
- Real emails: `data/real-samples.json` (4 of the builder's own receipts, redacted). Used by the eval and `POST /api/scan { source: "real" }`; there is no button for it in the UI. The iPhone 16 Pro order (Oct 19, 2024) must match `apple-siri` as High; Fabletics, Lyft and WHOOP must return no claim.
- `POST /api/scan { source: "paste", email }` runs the same pipeline on one email and stores nothing. The paste form was removed from the UI; the API still accepts it.

## Stack (do not deviate without asking)
- Next.js (App Router, TypeScript) + Tailwind CSS
- Anthropic SDK (`@anthropic-ai/sdk`), model `claude-haiku-4-5-20251001`
- `zod` for validating Claude's JSON
- No database, no auth. Data lives in `data/*.json`.
- Deployed on Vercel from GitHub (every push to `main` deploys).
- Ask before adding any other dependency.

## Folder plan
```
data/settlements.json      # real settlements (DO NOT EDIT unless asked)
data/inbox.json            # synthetic inbox with labels (DO NOT EDIT unless asked)
data/real-samples.json     # 4 REAL emails from the builder's Gmail, redacted (Apple, Fabletics, Lyft, WHOOP)
data/results.cached.json   # saved good sample run, used as fallback (rewrite with run-sample.ts --save)
data/eval.json             # last eval run (written by scripts/eval.ts)
data/settlements-tracker.csv  # the settlement catalogue as a spreadsheet, with the saved sample-scan result per settlement
data/email-tracker.csv     # one row per sample email: label, extraction, how it was used (written by scripts/email-tracker.ts)
docs/                      # README screenshots (intro, feed, why-this)
lib/types.ts
lib/format.ts              # date / money / payout formatting for the UI
lib/prefilter.ts           # rules: keep transaction / notice emails, drop noise
lib/extract.ts             # Claude extraction (batches of 10, parallel)
lib/match.ts               # email facts -> candidate settlements
lib/score.ts               # confidence formula, bands, sort, reason line
lib/judge.ts               # Claude judge for Likely / Possible claims: product_fit replaces P
lib/pipeline.ts            # runs prefilter -> extract -> match -> score -> judge -> score
app/api/scan/route.ts      # POST { source: "sample" } | { source: "real" } | { source: "paste", email }
app/page.tsx               # stage switch: intro | connect | scanning | feed
components/                # Header, Intro, Connect, Scanning, Feed, ClaimCard, WhyDrawer, ClaimDetail, ClaimSign
scripts/run-sample.ts      # run the pipeline on a data file and print the claims table
scripts/eval.ts            # precision / recall vs labels (--no-judge to compare)
scripts/email-tracker.ts   # writes data/email-tracker.csv
scripts/settlements-tracker.ts  # writes data/settlements-tracker.csv from settlements.json + results.cached.json (no API call)
scripts/csv.ts             # CSV writer shared by the two tracker scripts
```
Never send the `label` field of inbox emails to Claude or the UI. It is only for `scripts/eval.ts`.

## Pipeline rules
1. Pre-filter: keep an email if the sender name/domain matches any settlement company or alias, OR subject/body contains: receipt, order, confirmation, renewal, subscription, payment, invoice, billing, refund, return, data breach, security incident, data incident, settlement, claim id, notice id, class action, account, password, terms. Drop everything else.
2. Extract (Claude): per email return `company` (the merchant), `brand` (product brand if different, e.g. LEVOIT bought on Amazon), `product`, `email_type`, `transaction_date`, `evidence_line` (max 15 words, quoted from the email), `billing_state` (2-letter if an address is shown, else null), `is_false_positive`, `false_positive_reason`. Use the system prompt in `lib/extract.ts` (see "Extraction prompt" below).
3. Match: if the settlement has `excluded_sender_domains` and the email's sender domain is in it, never match (e.g. Equinox gym at equinox.com is NOT Equinox, Inc.). Normalise names (lowercase, strip inc/llc/ltd/.com and punctuation). Compare BOTH `company` AND `brand` AND `product` text against each settlement's `company`, `company_aliases`, `parent_company`. Retailer purchases (Amazon, Best Buy, Walmart) must match on brand.
4. Score (formula, deterministic):
   - E by email_type: settlement_notice 1.0, breach_notice 0.95, receipt/order 0.9, renewal/billing 0.9, account_notice 0.7, marketing 0.3, other 0.3.
   - M: exact/alias 1.0, parent 0.8, fuzzy token overlap 0.5.
   - T: inside class period 1.0, period missing 0.7, outside 0.2. If the settlement `match_rule` is `breach_notice` AND the evidence is a breach_notice from that company, T = 1.0. A settlement_notice from that company is T = 1.0 for every match_rule (a notice date is not a transaction date).
   - P: product keyword found 1.0, settlement has no product_keywords 0.9, keywords exist but none found 0.6.
   - State: if `state_restriction` is set and `billing_state` is a different state -> drop; if unknown -> multiply by 0.7.
   - confidence = min(0.99, E*M*T*P + 0.05 per extra matching email for the same settlement, max +0.15).
     An extra email only counts (and is listed as supporting) if its own score is >= 0.30 and P is not 0.6.
   - Drop any email with `is_false_positive = true` before scoring.
   - Bands: high >= 0.75, likely >= 0.50, possible >= 0.30, else hidden.
   - Group by settlement; strongest email = primary evidence; others listed as supporting.
   - Sort by band, then confidence x payout midpoint (null -> payout_min -> 25).
   - `deadline_soon` = claim_deadline within 14 days of today.
   - Reason line: "Because we found your {product or company} {email_type label} from {Mon D, YYYY}".
5. Judge (Claude, `lib/judge.ts`): only for claims the formula puts in Likely or Possible. Send the extracted email facts (not the body) and the settlement's `eligibility_summary`; get `{ product_fit: 0-1, own_transaction, reason }`. `product_fit` replaces P and the formula in step 4 scores again; `own_transaction = false` drops that email. Never judge High claims. If the judge call fails, keep the formula score.
6. If no API key, Claude errors, or the scan takes > 20 s: the sample source returns `data/results.cached.json` with `mode: "cached"`; real and paste return a 503 error (the saved run is the sample inbox only).

## Extraction prompt (system prompt for Claude, keep in lib/extract.ts)
You read emails from one person's inbox and extract evidence that THEY bought, subscribed to, or used a product or service, or that a company notified THEM directly. This evidence is matched to class-action settlements.
For each email return the fields listed above. Mark `is_false_positive = true` when:
1. The person is writing ABOUT a lawsuit or settlement (to a friend, in a forward) rather than receiving a notice addressed to them.
2. It is news, a blog or a newsletter reporting on a lawsuit.
3. It looks like a scam: promises money, urgent links, asks for bank/SSN, or the sender domain does not match the company it claims to be.
4. It is marketing only, with no sign the person bought something or holds an account (still return email_type = marketing).
5. The company named is not the party the person transacted with (similar names count as different companies).
Payment processors (PayPal, Stripe, Apple Pay, Klarna, Afterpay) are never the company: use the merchant named in the email (e.g. "You authorized $59.95 to Fabletics" -> company = Fabletics).
Be strict. Never guess a product, date or state not in the email. Return only JSON: { "results": [ ... ] }.

## UI and brand
- Product framing: MoneyPilot's real app already has a "For You" tab next to "All". This feature is what powers "For You". Mirror the real app's claim card pattern: company logo/initial, settlement name, payout, "No proof needed" tag, "{n}+ filed"-style social proof is NOT available here, so skip it.
- Mobile-first at 390 px, must also look fine at 1280 px. On web the feed is one centred column of wide cards (payout left, tags right, full-width Start claim), like the real MoneyPilot web app; no multi-column grid.
- Header on every screen (`components/Header.tsx`): MoneyPilot wordmark on the left, profile avatar on the right. Both are drawn in code (no logo file, no real account).
- Headline font: Protest Strike (Google Fonts via next/font). Body: Inter.
- Accent green #1C7359. Background warm beige #F6F0E6. Cards white, rounded-2xl, soft shadow. The main call to action ("Start claim") uses a brighter green, `--cta` #07B57A in `app/globals.css`, so it stands out.
- Flow: Intro + consent card -> Connect Gmail -> Scanning (animated counts, min 2.5 s) -> Feed (summary card, search, filter, then High / Likely / Possible sections) -> "Why this?" drawer -> Start claim / Not me.
- Card: company initial avatar, settlement name, confidence pill (High green, Likely amber, Possible grey; band label only, the % stays in the API for sorting and banding), reason line, payout range, deadline + days left (red badge if deadline_soon), "Proof needed" / "Notice ID needed" tags. "Start claim" is a full-width CTA bar in the CTA green; "Why this?" and "Not me" are small secondary actions under it on phones and sit in the same row on web.
- Start claim opens an in-app flow (`components/ClaimDetail.tsx`, `components/ClaimSign.tsx`): "Submit Claim" details (hero with payout and deadline, why it matched, who qualifies, payout note, what you'll need) -> "Claim Settlement" -> draw-to-sign screen -> "Claim Submitted!". It is a demo of the filing flow: nothing is filed and the signature is never stored, and the submitted screen says so. The official site (`claim_url`, or `source_url` if null) is only a link inside this flow.
- Feed top (`components/Feed.tsx`): a compact green summary card with "{n} claims we recommend you file today", "up to $X (estimate)" (sum of payout_max), "{n} emails read · {n} purchases and notices", and a strip with the settlement data date and "Start over". Below it: a search bar (matches settlement name, company, product), a filter button and a "For You" pill.
- Filter popover (two-pane "Filters": left nav, pill options on the right) has exactly two filters: Deadline (next 7 / 30 / 60 / 90 days, on `days_left`) and Payout (up to $100, $100 - $500, $500 - $1,000, $1,000+, on `payout_max`, falling back to `payout_min`). Select a pill again to clear it; Reset clears both.
- The app bar, the search row and the "For You" pill are pinned (sticky) while the claim list scrolls; the summary card scrolls away. Inside each band, claims keep the API order (confidence x payout); there is no sort control.
- "Why this?" drawer (bottom sheet on phones, centred pop-up on web; the feed behind it does not scroll while it is open): primary email with the evidence line highlighted, supporting emails, checks (company, class period, product, state, judge reason when present), eligibility summary, link to `source_url`.
- Possible cards ask one Yes/No question from `eligibility_summary`; Yes moves the card to Likely, No hides it.
- "Not me" hides the card with undo and logs `{ event: "not_me", settlement_id, confidence }` to the console.
- Intro has one button, "Connect Gmail", which opens the connect screen (`components/Connect.tsx`).
- Connect screen: Gmail address field, list of what will be read, "Connect and scan", then a short "connecting" sequence. A "Skip" link (instead of Back) runs the same sample scan without an address. It is a demo: no password field, no Google branding or sign-in look-alike, the address stays in the browser (shown on the scanning screen only), and any address scans the sample inbox. The demo note under it says so; keep that note.
- Footer: "{n} weak matches hidden" + "Settlement data as of Oct 6, 2026 from openclassactions.com and topclassactions.com" + small "live" / "cached" tag.

## Working rules
- Keep the API key only in `.env.local` (local) and Vercel env vars. Never print it, never commit it. `.env*` stays in `.gitignore`.
- After each working stage: run `npm run build`, fix errors, and check it on localhost (`npm run dev`). Commit locally with a clear message. Push only once a substantial amount of work is done, not after every stage (each push to `main` deploys).
- Keep functions small and readable; this repo will be read by reviewers.
- Do not rewrite working code unless asked. Prefer small diffs.
- Today's date for deadline maths: use the real current date.

## Definition of done
- Live Vercel URL works on a phone.
- Sample scan returns a ranked feed; every card has a reason; no trap email (label.is_trap) appears as evidence.
- `npx tsx --env-file=.env.local scripts/eval.ts` prints precision/recall; numbers are in README. Targets: high precision >= 90%, recall >= 80%, traps = 0.
- README covers: problem, approach, real vs mocked, algorithm, privacy, eval, verify & monitor, future scope. Keep it in step with the code when the pipeline or UI changes.
