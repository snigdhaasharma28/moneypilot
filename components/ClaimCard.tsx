import { daysLeftLabel, formatDate, payoutRange } from "@/lib/format";
import type { Band, Claim } from "@/lib/types";

export const BAND_LABEL: Record<Band, string> = { high: "High", likely: "Likely", possible: "Possible" };
const BAND_PILL: Record<Band, string> = {
  high: "bg-accent/10 text-accent",
  likely: "bg-amber-100 text-amber-800",
  possible: "bg-stone-200 text-stone-700",
};

// Shows the band only; the numeric confidence stays in the API for sorting and banding.
export function ConfidencePill({ band }: { band: Band }) {
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${BAND_PILL[band]}`}>
      {BAND_LABEL[band]}
    </span>
  );
}

export function Avatar({ company }: { company: string }) {
  const initial = company.replace(/^the\s+/i, "").charAt(0).toUpperCase();
  return (
    <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent font-display text-xl text-white">
      {initial}
    </span>
  );
}

function Tag({ children }: { children: string }) {
  return (
    <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-700">
      {children}
    </span>
  );
}

interface Props {
  claim: Claim;
  band: Band; // may differ from claim.band after the user answers the eligibility question
  needsAnswer: boolean;
  onStart: () => void;
  onWhy: () => void;
  onNotMe: () => void;
  onConfirm: () => void;
}

export default function ClaimCard({ claim, band, needsAnswer, onStart, onWhy, onNotMe, onConfirm }: Props) {
  return (
    <article className="flex flex-col gap-3 rounded-2xl bg-white p-4 shadow-sm md:gap-4 md:p-6">
      <header className="flex items-start gap-3">
        <Avatar company={claim.company} />
        <h3 className="min-w-0 flex-1 font-semibold leading-snug md:text-lg">{claim.name}</h3>
        <ConfidencePill band={band} />
      </header>

      <p className="text-sm text-foreground/75">{claim.reason}</p>

      {/* Phone: payout row then tags row. Web: one row, payout left and tags right. */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex flex-wrap items-center justify-between gap-2 md:justify-start md:gap-4">
          <span className="text-lg font-semibold text-accent md:text-2xl">{payoutRange(claim)}</span>
          <span className="flex items-center gap-2 text-xs text-foreground/65">
            Due {formatDate(claim.claim_deadline)}
            <span
              className={`rounded-full px-2 py-0.5 font-semibold ${
                claim.deadline_soon ? "bg-red-100 text-red-700" : "bg-stone-100 text-stone-700"
              }`}
            >
              {daysLeftLabel(claim.days_left)}
            </span>
          </span>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {claim.proof_required ? <Tag>Proof needed</Tag> : <Tag>No proof needed</Tag>}
          {claim.notice_id_required && <Tag>Notice ID needed</Tag>}
        </div>
      </div>

      {needsAnswer && (
        <div className="rounded-xl bg-amber-50 p-3 text-sm">
          <p className="font-semibold">Quick check: does this describe you?</p>
          <p className="mt-1 text-foreground/75">{claim.eligibility_summary}</p>
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={onConfirm}
              className="rounded-full bg-accent px-4 py-1.5 font-semibold text-white"
            >
              Yes
            </button>
            <button
              type="button"
              onClick={onNotMe}
              className="rounded-full border border-foreground/20 bg-white px-4 py-1.5 font-semibold"
            >
              No
            </button>
          </div>
        </div>
      )}

      <footer className="mt-auto flex items-center gap-2 pt-1">
        <button
          type="button"
          onClick={onStart}
          className="flex-1 rounded-full bg-accent px-4 py-2.5 text-center text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Start claim
        </button>
        <button
          type="button"
          onClick={onWhy}
          className="rounded-full border border-accent/30 px-4 py-2.5 text-sm font-semibold text-accent hover:bg-accent/5"
        >
          Why this?
        </button>
        <button
          type="button"
          onClick={onNotMe}
          className="rounded-full px-3 py-2.5 text-sm font-medium text-foreground/60 hover:text-foreground"
        >
          Not me
        </button>
      </footer>
    </article>
  );
}
