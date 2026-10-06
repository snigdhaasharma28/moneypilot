"use client";

import { useState } from "react";
import { daysLeftLabel, formatDate, payoutRange } from "@/lib/format";
import type { Band, Claim } from "@/lib/types";
import { BAND_LABEL } from "./ClaimCard";
import { ClaimSign, ClaimSubmitted } from "./ClaimSign";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm md:p-6">
      <h2 className="font-semibold">{title}</h2>
      <div className="mt-2 text-sm leading-relaxed text-foreground/75">{children}</div>
    </section>
  );
}

function HeroStat({ label, value, note }: { label: string; value: string; note?: string }) {
  return (
    <div>
      <p className="text-xs font-semibold uppercase tracking-wide text-white/70">{label}</p>
      <p className="text-xl font-semibold">{value}</p>
      {note && <p className="text-xs text-white/80">{note}</p>}
    </div>
  );
}

interface Props {
  claim: Claim;
  band: Band;
  submitted: boolean;
  onBack: () => void;
  onSubmitted: () => void;
}

// In-app claim flow opened by "Start claim": details -> sign -> submitted.
// Nothing is filed in this MVP; the official site is only linked from here.
export default function ClaimDetail({ claim, band, submitted, onBack, onSubmitted }: Props) {
  const [signing, setSigning] = useState(false);

  if (submitted) return <ClaimSubmitted claim={claim} onBack={onBack} />;
  if (signing) {
    return <ClaimSign claim={claim} onBack={() => setSigning(false)} onSubmit={onSubmitted} />;
  }

  const needs = [
    claim.proof_required ? "Proof of purchase" : "No proof of purchase needed",
    claim.notice_id_required ? "The Notice ID (and PIN or code) from your notice email" : null,
  ].filter((item): item is string => item !== null);

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-5 md:max-w-3xl md:px-6">
      <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center">
        <button
          type="button"
          onClick={onBack}
          aria-label="Back to claims"
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-xl shadow-sm"
        >
          ‹
        </button>
        <h1 className="text-center text-lg font-semibold">Submit Claim</h1>
      </div>

      <section className="rounded-3xl bg-gradient-to-br from-accent to-emerald-600 p-5 text-white shadow-md md:p-7">
        <div className="flex items-center gap-3">
          <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white font-display text-2xl text-accent">
            {claim.company.replace(/^the\s+/i, "").charAt(0).toUpperCase()}
          </span>
          <div className="min-w-0">
            <p className="text-sm text-white/80">{claim.company}</p>
            <p className="text-lg font-semibold leading-snug">{claim.name}</p>
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-x-10 gap-y-3">
          <HeroStat label="Est. payout" value={payoutRange(claim)} />
          <HeroStat
            label="Deadline"
            value={formatDate(claim.claim_deadline)}
            note={daysLeftLabel(claim.days_left)}
          />
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-white/25 pt-4 text-sm">
          <span>{BAND_LABEL[band]} match</span>
          <span className="font-semibold">{claim.proof_required ? "Proof needed" : "No proof needed"}</span>
        </div>
      </section>

      <Section title="Why this is for you">
        <p>{claim.reason}.</p>
        {claim.primary.evidence_line && (
          <p className="mt-2 rounded-lg bg-accent/10 px-3 py-2 font-medium text-foreground">
            “{claim.primary.evidence_line}”
          </p>
        )}
      </Section>

      <Section title="Who qualifies">
        <p>{claim.eligibility_summary}</p>
      </Section>

      {claim.payout_note && (
        <Section title="Payout">
          <p>{claim.payout_note}</p>
        </Section>
      )}

      <Section title="What you'll need">
        <ul className="list-disc pl-5">
          {needs.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </Section>

      <div className="sticky bottom-0 -mx-4 mt-auto border-t border-foreground/10 bg-background px-4 py-3 md:-mx-6 md:px-6">
        <button
          type="button"
          onClick={() => {
            setSigning(true);
            window.scrollTo(0, 0);
          }}
          className="block w-full rounded-2xl bg-accent px-6 py-3.5 text-center font-semibold text-white shadow-md transition-opacity hover:opacity-90"
        >
          Claim Settlement
        </button>
        <p className="mt-2 text-center text-xs text-foreground/55">
          <a href={claim.claim_url ?? claim.source_url} target="_blank" rel="noopener noreferrer" className="underline">
            Official settlement site
          </a>{" "}
          ·{" "}
          <a href={claim.source_url} target="_blank" rel="noopener noreferrer" className="underline">
            settlement source
          </a>
        </p>
      </div>
    </main>
  );
}
