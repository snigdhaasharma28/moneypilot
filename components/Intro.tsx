interface Props {
  error: string | null;
  onScanSample: () => void;
}

export default function Intro({ error, onScanSample }: Props) {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center gap-6 px-5 py-10">
      <div className="text-center">
        <p className="text-sm font-semibold uppercase tracking-wide text-accent">MoneyPilot · For You</p>
        <h1 className="mt-2 font-display text-5xl leading-tight text-accent">
          Claims hiding in your inbox
        </h1>
        <p className="mt-3 text-foreground/70">
          We match your receipts to open class-action settlements and show the email that proves each one.
        </p>
      </div>

      <section className="rounded-2xl bg-white p-5 shadow-sm">
        <h2 className="font-semibold">What we read</h2>
        <p className="mt-2 text-sm leading-relaxed text-foreground/75">
          We read: order confirmations, receipts, subscription emails, breach and settlement notices. We
          never store email content or read personal threads.
        </p>
      </section>

      {error && (
        <p role="alert" className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onScanSample}
        className="w-full rounded-full bg-accent px-6 py-3.5 font-semibold text-white shadow-md transition-opacity hover:opacity-90"
      >
        Scan inbox
      </button>

      <p className="text-center text-xs text-foreground/55">
        Demo uses a sample inbox. Real inbox connection is coming.
      </p>
    </main>
  );
}
