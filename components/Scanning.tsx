"use client";

import { useEffect, useState } from "react";
import type { ScanResult } from "@/lib/types";

const STEP_MS = 700;
const COUNT_MS = 600;

function CountUp({ to, active }: { to: number; active: boolean }) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    if (!active) return;
    let frame = 0;
    const start = performance.now();
    const tick = (now: number) => {
      const progress = Math.min(1, (now - start) / COUNT_MS);
      setValue(Math.round(to * progress));
      if (progress < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [to, active]);
  return <>{active ? value : "…"}</>;
}

interface Props {
  result: ScanResult | null; // null while the scan is still running
  account: string | null; // address from the connect screen, shown as-is
  onDone: () => void;
}

// Counts up the three API stats one after another, then hands over to the feed.
export default function Scanning({ result, account, onDone }: Props) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!result) return;
    const timers = [1, 2, 3].map((n) => setTimeout(() => setStep(n), (n - 1) * STEP_MS));
    timers.push(setTimeout(onDone, 3 * STEP_MS + 300));
    return () => timers.forEach(clearTimeout);
  }, [result, onDone]);

  const rows = [
    { label: "emails read", value: result?.stats.total_emails ?? 0 },
    { label: "purchases and notices", value: result?.stats.purchases_and_notices ?? 0 },
    { label: "claims matched", value: result?.claims.length ?? 0 },
  ];

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-10">
      <div className="text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-accent/20 border-t-accent" />
        <h1 className="mt-5 font-display text-4xl text-accent">Scanning your inbox</h1>
        {account && <p className="mt-1 truncate text-sm font-semibold text-foreground/75">{account}</p>}
        <p className="mt-2 text-sm text-foreground/65" aria-live="polite">
          {result ? "Matching to open settlements…" : "Reading receipts and notices…"}
        </p>
      </div>

      <ol className="rounded-2xl bg-white p-5 shadow-sm">
        {rows.map((row, i) => (
          <li
            key={row.label}
            className={`flex items-baseline justify-between border-foreground/10 py-3 transition-opacity ${
              i > 0 ? "border-t" : ""
            } ${step > i ? "opacity-100" : "opacity-40"}`}
          >
            <span className="text-foreground/75">{row.label}</span>
            <span className="font-display text-3xl tabular-nums text-accent">
              <CountUp to={row.value} active={step > i} />
            </span>
          </li>
        ))}
      </ol>
    </main>
  );
}
