"use client";

import { useEffect, useState, type FormEvent } from "react";

const STEP_MS = 650;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ACCESS = [
  "Order confirmations and receipts",
  "Subscription and renewal emails",
  "Data breach and settlement notices",
];

const STEPS = ["Finding your inbox", "Setting up read-only access", "Connected"];

interface Props {
  onBack: () => void;
  onConnected: (email: string) => void;
}

function MailIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
      <rect x="3" y="5" width="18" height="14" rx="2.5" />
      <path d="m4 7 8 6 8-6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Walks through the connection steps, then hands the address back to the page.
function Connecting({ email, onDone }: { email: string; onDone: () => void }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    const timers = STEPS.map((_, i) => setTimeout(() => setStep(i + 1), (i + 1) * STEP_MS));
    timers.push(setTimeout(onDone, STEPS.length * STEP_MS + 500));
    return () => timers.forEach(clearTimeout);
  }, [onDone]);

  return (
    <section className="rounded-2xl bg-white p-5 shadow-sm" aria-live="polite">
      <p className="truncate text-sm font-semibold">{email}</p>
      <ol className="mt-3 space-y-3">
        {STEPS.map((label, i) => (
          <li
            key={label}
            className={`flex items-center gap-3 text-sm transition-opacity ${step >= i ? "opacity-100" : "opacity-40"}`}
          >
            {step > i ? (
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-accent text-xs text-white">✓</span>
            ) : (
              <span className="h-5 w-5 animate-spin rounded-full border-2 border-accent/20 border-t-accent" />
            )}
            {label}
          </li>
        ))}
      </ol>
    </section>
  );
}

// Demo of the inbox connection step: the address is only shown back on screen,
// it is never sent anywhere, and the scan that follows reads the sample inbox.
export default function Connect({ onBack, onConnected }: Props) {
  const [email, setEmail] = useState("");
  const [connecting, setConnecting] = useState(false);
  const address = email.trim();
  const valid = EMAIL_PATTERN.test(address);

  function submit(event: FormEvent) {
    event.preventDefault();
    if (valid) setConnecting(true);
  }

  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-10">
      <div className="text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-accent/10 text-accent">
          <MailIcon />
        </div>
        <h1 className="mt-4 font-display text-4xl leading-tight text-accent">
          {connecting ? "Connecting your Gmail" : "Connect your Gmail"}
        </h1>
        <p className="mt-2 text-sm text-foreground/70">
          Read-only access. We never send, delete or store your emails.
        </p>
      </div>

      {connecting ? (
        <Connecting email={address} onDone={() => onConnected(address)} />
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-6">
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <label htmlFor="gmail-address" className="font-semibold">
              Gmail address
            </label>
            <input
              id="gmail-address"
              type="email"
              inputMode="email"
              autoComplete="email"
              autoFocus
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="you@gmail.com"
              className="mt-2 w-full rounded-xl border border-foreground/15 bg-background px-4 py-3 outline-none focus:border-accent"
            />

            <h2 className="mt-5 text-sm font-semibold">MoneyPilot will be able to read</h2>
            <ul className="mt-2 space-y-2 text-sm text-foreground/75">
              {ACCESS.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-accent">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </section>

          <button
            type="submit"
            disabled={!valid}
            className="w-full rounded-full bg-accent px-6 py-3.5 font-semibold text-white shadow-md transition-opacity hover:opacity-90 disabled:opacity-40"
          >
            Connect and scan
          </button>
        </form>
      )}

      {!connecting && (
        <button type="button" onClick={onBack} className="text-sm font-semibold text-accent">
          Back
        </button>
      )}

      <p className="text-center text-xs text-foreground/55">
        Demo: no password is asked and nothing is connected. The scan reads a sample inbox.
      </p>
    </main>
  );
}
