import type { Claim } from "./types";

export function formatDate(isoDate: string): string {
  return new Date(`${isoDate.slice(0, 10)}T00:00:00Z`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
}

export function formatMoney(amount: number): string {
  const digits = Number.isInteger(amount) ? 0 : 2;
  return `$${amount.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: 2 })}`;
}

export function payoutRange(c: Pick<Claim, "payout_min" | "payout_max">): string {
  const { payout_min: min, payout_max: max } = c;
  if (min !== null && max !== null) {
    return min === max ? formatMoney(min) : `${formatMoney(min)} – ${formatMoney(max)}`;
  }
  if (max !== null) return `Up to ${formatMoney(max)}`;
  if (min !== null) return `From ${formatMoney(min)}`;
  return "Payout varies";
}

export function daysLeftLabel(days: number): string {
  if (days < 0) return "Closed";
  if (days === 0) return "Last day";
  return days === 1 ? "1 day left" : `${days} days left`;
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}
