"use client";

import { useEffect, useRef, useState } from "react";
import { payoutRange } from "@/lib/format";
import type { Claim } from "@/lib/types";

// Draw-to-sign box. The drawing lives only in this canvas; it is never uploaded or stored.
function SignaturePad({ onChange }: { onChange: (signed: boolean) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [signed, setSigned] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    const ratio = window.devicePixelRatio || 1;
    const { width, height } = canvas.getBoundingClientRect();
    canvas.width = width * ratio;
    canvas.height = height * ratio;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#1a1a1a";
  }, []);

  function position(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const { x, y } = position(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    drawing.current = true;
  }

  function draw(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = e.currentTarget.getContext("2d");
    if (!drawing.current || !ctx) return;
    const { x, y } = position(e);
    ctx.lineTo(x, y);
    ctx.stroke();
    if (!signed) {
      setSigned(true);
      onChange(true);
    }
  }

  function clear() {
    const canvas = canvasRef.current;
    canvas?.getContext("2d")?.clearRect(0, 0, canvas.width, canvas.height);
    setSigned(false);
    onChange(false);
  }

  return (
    <div>
      <div className="relative">
        <canvas
          ref={canvasRef}
          aria-label="Signature"
          onPointerDown={start}
          onPointerMove={draw}
          onPointerUp={() => (drawing.current = false)}
          onPointerLeave={() => (drawing.current = false)}
          className="h-44 w-full touch-none rounded-2xl border-2 border-emerald-500 bg-white"
        />
        {!signed && (
          <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-sm text-foreground/40">
            Draw your signature here
          </p>
        )}
      </div>
      {signed && (
        <button type="button" onClick={clear} className="mt-3 font-semibold text-accent underline">
          Change signature
        </button>
      )}
    </div>
  );
}

function ClaimHeader({ claim, onBack }: { claim: Claim; onBack: () => void }) {
  return (
    <>
      <button type="button" onClick={onBack} aria-label="Back" className="self-start px-1 text-2xl text-foreground/70">
        ‹
      </button>
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-white font-display text-2xl text-accent shadow-sm">
          {claim.company.replace(/^the\s+/i, "").charAt(0).toUpperCase()}
        </span>
        <h1 className="min-w-0 flex-1 font-semibold leading-snug md:text-lg">{claim.name}</h1>
        <div className="shrink-0 text-right">
          <p className="text-xs font-semibold uppercase tracking-wide text-foreground/55">Est. payout</p>
          <p className="text-lg font-semibold text-accent md:text-xl">{payoutRange(claim)}</p>
        </div>
      </div>
    </>
  );
}

function Steps() {
  return (
    <ol className="flex items-center gap-3 text-sm font-medium">
      <li className="flex items-center gap-2 text-accent">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-emerald-500 text-xs text-white">✓</span>
        Details
      </li>
      <li aria-hidden className="h-px flex-1 bg-emerald-500" />
      <li className="flex items-center gap-2">
        <span className="flex h-6 w-6 items-center justify-center rounded-full bg-foreground text-xs text-white">2</span>
        Sign
      </li>
    </ol>
  );
}

const shell = "mx-auto flex w-full max-w-md flex-1 flex-col gap-5 px-4 py-5 md:max-w-3xl md:px-6";

interface SignProps {
  claim: Claim;
  onBack: () => void;
  onSubmit: () => void;
}

export function ClaimSign({ claim, onBack, onSubmit }: SignProps) {
  const [signed, setSigned] = useState(false);

  return (
    <main className={shell}>
      <ClaimHeader claim={claim} onBack={onBack} />
      <Steps />

      <section className="flex flex-1 flex-col rounded-3xl bg-white p-5 shadow-sm md:p-7">
        <h2 className="mb-3 text-lg font-semibold">
          Signature<span className="text-red-600">*</span>
        </h2>
        <SignaturePad onChange={setSigned} />
        <p className="mt-5 text-center text-xs leading-relaxed text-foreground/60">
          By signing above, I declare under penalty of perjury under the laws of the United States of America
          that all the information provided by me on this claim form is true and correct, to the best of my
          knowledge and belief. I understand that my claim is subject to audit, review, and validation using
          all available information.
        </p>
        <button
          type="button"
          onClick={onSubmit}
          disabled={!signed}
          className="mt-auto rounded-2xl bg-accent px-6 py-3.5 font-semibold text-white shadow-md transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Continue
        </button>
      </section>
    </main>
  );
}

export function ClaimSubmitted({ claim, onBack }: { claim: Claim; onBack: () => void }) {
  return (
    <main className={shell}>
      <ClaimHeader claim={claim} onBack={onBack} />
      <div className="flex flex-1 flex-col items-center justify-center gap-5 py-10 text-center">
        <span className="flex h-24 w-24 items-center justify-center rounded-full bg-accent text-5xl text-white">✓</span>
        <h2 className="text-3xl font-bold text-accent">Claim Submitted!</h2>
        <p className="max-w-sm text-sm text-foreground/60">
          Demo only: nothing was sent to the settlement administrator and your signature was not saved. To
          file for real, use the{" "}
          <a
            href={claim.claim_url ?? claim.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-semibold text-accent underline"
          >
            official settlement site
          </a>
          .
        </p>
        <button
          type="button"
          onClick={onBack}
          className="rounded-full border border-accent/30 bg-white px-6 py-2.5 font-semibold text-accent"
        >
          Back to claims
        </button>
      </div>
    </main>
  );
}
