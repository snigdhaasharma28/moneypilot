"use client";

import { useEffect, useRef, useState } from "react";
import { formatDate, formatMoney, plural } from "@/lib/format";
import type { Band, Claim, ScanResult } from "@/lib/types";
import ClaimCard, { BAND_LABEL } from "./ClaimCard";
import ClaimDetail from "./ClaimDetail";
import WhyDrawer from "./WhyDrawer";

const BANDS: Band[] = ["high", "likely", "possible"];
const UNDO_MS = 6000;

interface Props {
  result: ScanResult;
  onRestart: () => void;
}

export default function Feed({ result, onRestart }: Props) {
  const [hidden, setHidden] = useState<string[]>([]);
  const [confirmed, setConfirmed] = useState<string[]>([]); // Possible cards the user answered Yes to
  const [lastHidden, setLastHidden] = useState<Claim | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
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
      <header className="mb-5">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold uppercase tracking-wide text-accent">For You</p>
          <button type="button" onClick={onRestart} className="text-sm font-semibold text-accent">
            Start over
          </button>
        </div>
        {result.claims.length > 0 ? (
          <>
            <h1 className="mt-2 font-display text-4xl leading-tight text-accent">
              {plural(visible.length, "claim")} you likely qualify for
            </h1>
            {maxTotal > 0 && (
              <p className="mt-1 text-foreground/70">
                up to <span className="font-semibold text-foreground">{formatMoney(maxTotal)}</span>{" "}
                <span className="text-sm">(estimate, if every maximum payout applied)</span>
              </p>
            )}
          </>
        ) : (
          <div className="mt-4 rounded-2xl bg-white p-6 text-center shadow-sm">
            <p className="font-semibold">
              {result.source === "paste"
                ? "No open settlement matches this email."
                : "No open settlement matches these emails."}
            </p>
          </div>
        )}
      </header>

      {BANDS.map((band) => {
        const claims = visible.filter((c) => bandOf(c) === band);
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
