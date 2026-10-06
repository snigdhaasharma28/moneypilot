// Minimal CSV writer shared by the tracker scripts.
export type Row = Record<string, string | number | boolean | null>;

function csvCell(value: Row[string]): string {
  const text = value === null ? "" : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(rows: Row[]): string {
  const columns = Object.keys(rows[0]);
  const lines = rows.map((row) => columns.map((c) => csvCell(row[c])).join(","));
  return `${[columns.join(","), ...lines].join("\n")}\n`;
}
