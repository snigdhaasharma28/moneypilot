"use client";

import { useEffect } from "react";
import { formatDate } from "@/lib/format";
import type { Band, Claim, Evidence } from "@/lib/types";
import { Avatar, ConfidencePill } from "./ClaimCard";

interface Check {
  ok: boolean;
  text: string;
}

function classPeriod(c: Claim): string {
  const start = c.class_period_start ? formatDate(c.class_period_start) : null;
  const end = c.class_period_end ? formatDate(c.class_period_end) : null;
  if (start && end) return `${start} – ${end}`;
  return start ? `on or after ${start}` : `before ${end}`;
}

// Plain-language version of the scoring factors for the primary evidence.
function buildChecks(c: Claim): Check[] {
  const { checks } = c;
  const company: Record<Claim["checks"]["company"], Check> = {
    exact: { ok: true, text: `Company matches ${c.company}` },
    parent: { ok: true, text: `Matches the parent company of ${c.company}` },
    fuzzy: { ok: false, text: `Name is similar to ${c.company}, please confirm` },
  };
  const period: Record<Claim["checks"]["period"], Check> = {
    notice: { ok: true, text: "Notice addressed to you, no date check needed" },
    inside: { ok: true, text: `${formatDate(c.primary.date)} is inside the class period (${classPeriod(c)})` },
    no_period: { ok: false, text: "No class period to check; the settlement relies on a notice" },
    outside: { ok: false, text: `${formatDate(c.primary.date)} is outside the class period (${classPeriod(c)})` },
  };
  const product: Record<Claim["checks"]["product"], Check> = {
    found: { ok: true, text: "Covered product named in the email" },
    no_keywords: { ok: true, text: "No specific product required" },
    not_found: { ok: false, text: "Covered product not found in the email" },
  };
  const list = [company[checks.company], period[checks.period], product[checks.product]];
  if (c.judge) {
    list.push({ ok: c.judge.product_fit >= 0.6, text: `Eligibility review: ${c.judge.reason}` });
  }
  if (checks.state === "match") list.push({ ok: true, text: `Address in ${c.state_restriction} shown in the email` });
  if (checks.state === "unknown") {
    list.push({ ok: false, text: `Needs a ${c.state_restriction} address, none shown in the email` });
  }
  return list;
}

function EvidenceBlock({ evidence, primary }: { evidence: Evidence; primary?: boolean }) {
  return (
    <div className="rounded-xl border border-foreground/10 p-3 text-sm">
      <p className="font-semibold">{evidence.from_name}</p>
      <p className="text-foreground/80">{evidence.subject}</p>
      <p className="text-xs text-foreground/55">{formatDate(evidence.date)}</p>
      {evidence.evidence_line && (
        <p className={`mt-2 rounded-lg px-2 py-1.5 ${primary ? "bg-accent/15 font-medium" : "bg-stone-100"}`}>
          “{evidence.evidence_line}”
        </p>
      )}
    </div>
  );
}

interface Props {
  claim: Claim;
  band: Band;
  onClose: () => void;
}

export default function WhyDrawer({ claim, band, onClose }: Props) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  // While the drawer is open only the drawer scrolls, never the feed behind it.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div
      className="fixed inset-0 z-20 flex items-end justify-center bg-black/40 md:items-center md:p-6"
      onClick={onClose}
    >
      <section
        role="dialog"
        aria-modal="true"
        aria-label={`Why ${claim.name}`}
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[88dvh] w-full max-w-lg flex-col gap-4 overflow-y-auto overscroll-contain rounded-t-3xl bg-white p-5 shadow-xl md:rounded-3xl md:p-6"
      >
        <header className="flex items-start gap-3">
          <Avatar company={claim.company} />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-accent">Why this?</p>
            <h2 className="font-semibold leading-snug">{claim.name}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="rounded-full bg-stone-100 px-3 py-1.5 text-sm font-semibold"
          >
            ✕
          </button>
        </header>

        <div className="flex items-center gap-2">
          <ConfidencePill band={band} />
          <p className="text-sm text-foreground/70">{claim.reason}</p>
        </div>

        <div>
          <h3 className="mb-2 text-sm font-semibold">The email that proves it</h3>
          <EvidenceBlock evidence={claim.primary} primary />
        </div>

        {claim.supporting.length > 0 && (
          <div>
            <h3 className="mb-2 text-sm font-semibold">Supporting emails</h3>
            <div className="flex flex-col gap-2">
              {claim.supporting.map((e) => (
                <EvidenceBlock key={e.email_id} evidence={e} />
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="mb-2 text-sm font-semibold">What we checked</h3>
          <ul className="flex flex-col gap-1.5 text-sm">
            {buildChecks(claim).map((check) => (
              <li key={check.text} className="flex gap-2">
                <span className={check.ok ? "text-accent" : "text-amber-600"} aria-hidden>
                  {check.ok ? "✓" : "!"}
                </span>
                <span>{check.text}</span>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="mb-1 text-sm font-semibold">Who qualifies</h3>
          <p className="text-sm text-foreground/75">{claim.eligibility_summary}</p>
          <a
            href={claim.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-2 inline-block text-sm font-semibold text-accent underline"
          >
            Read the settlement source
          </a>
        </div>
      </section>
    </div>
  );
}
