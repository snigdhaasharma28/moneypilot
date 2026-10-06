export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-6 py-16 text-center">
      <h1 className="font-display text-5xl text-accent sm:text-6xl">
        Inbox Claim Matcher
      </h1>
      <p className="max-w-md text-lg text-foreground/70">
        Find settlements you may be owed, with the email that proves it.
      </p>
      <button
        type="button"
        className="rounded-full bg-accent px-8 py-3 font-semibold text-white shadow-md transition-opacity hover:opacity-90"
      >
        Scan sample inbox
      </button>
    </main>
  );
}
