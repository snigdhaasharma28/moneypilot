"use client";

import { useEffect, useRef, useState } from "react";
import { formatDate, formatMoney, plural } from "@/lib/format";
import type { Band, Claim, ScanResult } from "@/lib/types";
import ClaimCard, { BAND_LABEL } from "./ClaimCard";
import ClaimDetail from "./ClaimDetail";
import WhyDrawer from "./WhyDrawer";

const BANDS: Band[] = ["high", "likely", "possible"];
const UNDO_MS = 6000;

const payoutOf = (c: Claim) => c.payout_max ?? c.payout_min;

// Filter options. Payout range tests the claim's largest payout; deadline tests days left.
const PAYOUT_FILTERS = [
  { label: "Any", test: () => true },
  { label: "Under $25", test: (c: Claim) => (payoutOf(c) ?? Infinity) < 25 },
  { label: "$25 – $100", test: (c: Claim) => (payoutOf(c) ?? -1) >= 25 && (payoutOf(c) ?? -1) <= 100 },
  { label: "$100 – $1,000", test: (c: Claim) => (payoutOf(c) ?? -1) > 100 && (payoutOf(c) ?? -1) <= 1000 },
  { label: "Over $1,000", test: (c: Claim) => (payoutOf(c) ?? -1) > 1000 },
];
const DEADLINE_FILTERS = [
  { label: "Any", test: () => true },
  { label: "Within 14 days", test: (c: Claim) => c.days_left <= 14 },
  { label: "Within 30 days", test: (c: Claim) => c.days_left <= 30 },
  { label: "Within 60 days", test: (c: Claim) => c.days_left <= 60 },
];

function matchesSearch(c: Claim, query: string): boolean {
  const q = query.trim().toLowerCase();
  if (!q) return true;
  return [c.name, c.company, c.primary.product ?? ""].some((t) => t.toLowerCase().includes(q));
}

function FilterChips({ label, options, value, onChange }: {
  label: string;
  options: { label: string }[];
  value: number;
  onChange: (i: number) => void;
}) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">{label}</p>
      <div className="flex flex-wrap gap-2">
        {options.map((o, i) => (
          <button
            key={o.label}
            type="button"
            aria-pressed={value === i}
            onClick={() => onChange(i)}
            className={`rounded-full px-3 py-1.5 text-sm font-medium ${
              value === i ? "bg-accent text-white" : "bg-stone-100 text-foreground/75"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

interface Props {
  result: ScanResult;
  onRestart: () => void;
}

export default function Feed({ result, onRestart }: Props) {
  const [hidden, setHidden] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState<string[]>([]); // Possible cards the user answered Yes to
  const [lastHidden, setLastHidden] = useState<Claim | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [filterOpen, setFilterOpen] = useState(false);
  const [payoutFilter, setPayoutFilter] = useState(0); // index into PAYOUT_FILTERS
  const [deadlineFilter, setDeadlineFilter] = useState(0); // index into DEADLINE_FILTERS
  const [startedId, setStartedId] = useState<string | null>(null); // claim shown on the detail screen
  const [submitted, setSubmitted] = useState<string[]>([]); // claims taken through the sign step
  const feedScroll = useRef(0);

  useEffect(() => {
    if (!lastHidden) return;
    const timer = setTimeout(() => setLastHidden(null), UNDO_MS);
    return () => clearTimeout(timer);
  }, [lastHidden]);

  const bandOf = (c: Claim): Band =>
    c.band === "possible" && confirmed.includes(c.settlement_id) ? "likely" : c.band;
  const visible = result.claims.filter((c) => !hidden.includes(c.settlement_id));
  const open = visible.find((c) => c.settlement_id === openId);
  const maxTotal = visible.reduce((sum, c) => sum + (c.payout_max ?? 0), 0);
  const activeFilters = (payoutFilter > 0 ? 1 : 0) + (deadlineFilter > 0 ? 1 : 0);
  const shown = visible.filter(
    (c) =>
      matchesSearch(c, query) &&
      PAYOUT_FILTERS[payoutFilter].test(c) &&
      DEADLINE_FILTERS[deadlineFilter].test(c),
  );

  function clearFilters() {
    setQuery("");
    setPayoutFilter(0);
    setDeadlineFilter(0);
  }

  function notMe(claim: Claim) {
    console.log({ event: "not_me", settlement_id: claim.settlement_id, confidence: claim.confidence });
    setHidden((ids) => [...ids, claim.settlement_id]);
    setLastHidden(claim);
  }

  function startClaim(claim: Claim) {
    feedScroll.current = window.scrollY;
    setStartedId(claim.settlement_id);
    window.scrollTo(0, 0);
  }

  function backToFeed() {
    setStartedId(null);
    requestAnimationFrame(() => window.scrollTo(0, feedScroll.current));
  }

  function undo(claim: Claim) {
    setHidden((ids) => ids.filter((id) => id !== claim.settlement_id));
    setLastHidden(null);
  }

  const started = visible.find((c) => c.settlement_id === startedId);
  if (started) {
    return (
      <ClaimDetail
        claim={started}
        band={bandOf(started)}
        submitted={submitted.includes(started.settlement_id)}
        onBack={backToFeed}
        onSubmitted={() => setSubmitted((ids) => [...ids, started.settlement_id])}
      />
    );
  }

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-4 py-6 md:max-w-3xl md:px-6">
      {result.claims.length > 0 ? (
        <>
          <section className="overflow-hidden rounded-3xl bg-accent text-white shadow-sm">
            <div className="p-6">
              <p className="text-sm text-white/80">Scan complete</p>
              <h1 className="mt-1 font-display text-4xl leading-tight">
                {plural(visible.length, "claim")} you likely qualify for
              </h1>
              {maxTotal > 0 && (
                <p className="mt-1 text-white/85">
                  up to <span className="font-semibold text-yellow-200">{formatMoney(maxTotal)}</span>{" "}
                  <span className="text-sm">(estimate, if every maximum payout applied)</span>
                </p>
              )}
              <ul className="mt-5 space-y-2 text-sm text-white/90">
                <li>
                  Read <b className="text-yellow-200">{result.stats.total_emails}</b> emails
                </li>
                <li>
                  Found <b className="text-yellow-200">{result.stats.purchases_and_notices}</b> purchases and notices
                </li>
                <li>
                  Matched them to <b className="text-yellow-200">{result.claims.length}</b> open settlements
                </li>
              </ul>
            </div>
            <div className="flex items-center justify-between bg-green-300 px-6 py-3 text-sm font-semibold text-accent">
              <span>Settlement data as of {formatDate(result.snapshot_date)}</span>
              <button type="button" onClick={onRestart} className="underline">
                Start over
              </button>
            </div>
          </section>

          <div className="mt-5 flex gap-2">
            <label className="flex flex-1 items-center gap-2 rounded-2xl border border-stone-300 bg-white px-4 py-3">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-foreground/50" aria-hidden>
                <circle cx="11" cy="11" r="7" />
                <path d="m20 20-3.5-3.5" />
              </svg>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search claims"
                aria-label="Search claims"
                className="w-full bg-transparent text-base outline-none placeholder:text-foreground/50"
              />
            </label>
            <button
              type="button"
              onClick={() => setFilterOpen((o) => !o)}
              aria-expanded={filterOpen}
              aria-label="Filter claims"
              className="relative flex w-14 items-center justify-center rounded-2xl border border-stone-300 bg-white"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
                <path d="M4 7h10M18 7h2M4 17h2M10 17h10" />
                <circle cx="16" cy="7" r="2" />
                <circle cx="8" cy="17" r="2" />
              </svg>
              {activeFilters > 0 && (
                <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs font-semibold text-white">
                  {activeFilters}
                </span>
              )}
            </button>
          </div>

          {filterOpen && (
            <div className="mt-3 space-y-4 rounded-2xl bg-white p-4 shadow-sm">
              <FilterChips label="Payout range" options={PAYOUT_FILTERS} value={payoutFilter} onChange={setPayoutFilter} />
              <FilterChips label="Deadline" options={DEADLINE_FILTERS} value={deadlineFilter} onChange={setDeadlineFilter} />
              {activeFilters > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setPayoutFilter(0);
                    setDeadlineFilter(0);
                  }}
                  className="text-sm font-semibold text-accent"
                >
                  Reset filters
                </button>
              )}
            </div>
          )}

          <div className="mb-4 mt-5">
            <span className="inline-block rounded-full border-2 border-accent bg-white px-5 py-2 font-semibold text-accent">
              For You
            </span>
          </div>

          {shown.length === 0 && (
            <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
              <p className="font-semibold">No claims match your search or filters.</p>
              <button type="button" onClick={clearFilters} className="mt-2 text-sm font-semibold text-accent">
                Clear search and filters
              </button>
            </div>
          )}
        </>
      ) : (
        <div className="rounded-2xl bg-white p-6 text-center shadow-sm">
          <p className="font-semibold">No open settlement matches these emails.</p>
        </div>
      )}

      {BANDS.map((band) => {
        // Highest confidence first inside each band.
        const claims = shown
          .filter((c) => bandOf(c) === band)
          .sort((x, y) => y.confidence - x.confidence);
        if (claims.length === 0) return null;
        return (
          <section key={band} className="mb-6">
            <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-foreground/60">
              {BAND_LABEL[band]} · {claims.length}
            </h2>
            <div className="grid gap-3 md:gap-4">
              {claims.map((claim) => (
                <ClaimCard
                  key={claim.settlement_id}
                  claim={claim}
                  band={band}
                  needsAnswer={band === "possible"}
                  submitted={submitted.includes(claim.settlement_id)}
                  onStart={() => startClaim(claim)}
                  onWhy={() => setOpenId(claim.settlement_id)}
                  onNotMe={() => notMe(claim)}
                  onConfirm={() => setConfirmed((ids) => [...ids, claim.settlement_id])}
                />
              ))}
            </div>
          </section>
        );
      })}

      <footer className="mt-8 flex flex-col gap-1 pb-16 text-center text-xs text-foreground/55">
        <p>
          {result.hidden_count} weak {result.hidden_count === 1 ? "match" : "matches"} hidden
        </p>
        <p>
          Settlement data as of {formatDate(result.snapshot_date)} from openclassactions.com and
          topclassactions.com
          <span className="ml-2 rounded-full bg-foreground/10 px-2 py-0.5 font-semibold">{result.mode}</span>
        </p>
      </footer>

      {lastHidden && (
        <div
          role="status"
          className="fixed inset-x-4 bottom-4 z-10 mx-auto flex max-w-md items-center justify-between gap-3 rounded-full bg-foreground px-5 py-3 text-sm text-white shadow-lg"
        >
          <span className="truncate">Hidden: {lastHidden.company}</span>
          <button type="button" onClick={() => undo(lastHidden)} className="font-semibold underline">
            Undo
          </button>
        </div>
      )}

      {open && <WhyDrawer claim={open} band={bandOf(open)} onClose={() => setOpenId(null)} />}
    </main>
  );
}
