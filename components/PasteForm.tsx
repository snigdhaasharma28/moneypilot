"use client";

import { useState } from "react";
import type { PastedEmail } from "@/lib/types";

interface Props {
  onSubmit: (email: PastedEmail) => void;
  onBack: () => void;
}

const field =
  "mt-1 w-full rounded-xl border border-foreground/15 bg-white px-3 py-2.5 text-base outline-none focus:border-accent";

export default function PasteForm({ onSubmit, onBack }: Props) {
  const [email, setEmail] = useState<PastedEmail>({ from: "", subject: "", date: "", body: "" });
  const set = (key: keyof PastedEmail) => (e: { target: { value: string } }) =>
    setEmail((prev) => ({ ...prev, [key]: e.target.value }));

  return (
    <main className="mx-auto w-full max-w-md flex-1 px-5 py-8">
      <button type="button" onClick={onBack} className="text-sm font-semibold text-accent">
        ← Back
      </button>
      <h1 className="mt-3 font-display text-4xl text-accent">Paste an email</h1>
      <p className="mt-2 text-sm text-foreground/70">
        We check this one email against open settlements. It never connects to an inbox and nothing is
        stored.
      </p>

      <form
        className="mt-5 flex flex-col gap-4 rounded-2xl bg-white p-5 shadow-sm"
        onSubmit={(e) => {
          e.preventDefault();
          onSubmit(email);
        }}
      >
        <label className="text-sm font-medium">
          From
          <input
            className={field}
            value={email.from}
            onChange={set("from")}
            placeholder="Apple Store <orders@apple.com>"
            required
          />
        </label>
        <label className="text-sm font-medium">
          Subject
          <input className={field} value={email.subject} onChange={set("subject")} required />
        </label>
        <label className="text-sm font-medium">
          Date
          <input type="date" className={field} value={email.date} onChange={set("date")} required />
        </label>
        <label className="text-sm font-medium">
          Body
          <textarea
            className={`${field} min-h-40`}
            value={email.body}
            onChange={set("body")}
            maxLength={20000}
            required
          />
        </label>
        <button
          type="submit"
          className="rounded-full bg-accent px-6 py-3 font-semibold text-white shadow-md transition-opacity hover:opacity-90"
        >
          Check this email
        </button>
      </form>
    </main>
  );
}
