// Registration exports. Kept deliberately small and dependency-free so the
// web admin and the app can carry the same copy, the way lib/formFields is.

// Excel and Sheets can treat a value opening with =, +, - or @ as a formula,
// so a name typed into the public registration form could run on whoever
// opens the export. A leading apostrophe forces it back to text and neither
// program displays it.
//
// `=` and `@` only ever open a formula. A leading + or - is far more often a
// phone number or a negative amount, and prefixing those corrupts perfectly
// ordinary data, so they are only escaped when what follows could actually
// form a call.
function neutralizeFormula(value: string): string {
  if (/^[=@]/.test(value)) return `'${value}`;
  if (/^[+\-]/.test(value) && /[A-Za-z(]/.test(value)) return `'${value}`;
  return value;
}

// Quote only where it is needed — any comma, quote, or line break — and
// double up quotes inside a quoted field, per RFC 4180.
function escapeCell(value: string): string {
  const cell = neutralizeFormula(value);
  return /[",\r\n]/.test(cell) ? `"${cell.replace(/"/g, '""')}"` : cell;
}

// CRLF row breaks, again per RFC 4180: Excel on Windows is the one reader
// that actually minds.
export function toCsv(headers: string[], rows: string[][]): string {
  return [headers, ...rows].map((row) => row.map(escapeCell).join(",")).join("\r\n");
}

// Prepended so Excel reads the file as UTF-8 rather than the local
// codepage, which otherwise mangles any non-ASCII name.
export const CSV_BOM = "\ufeff";

export interface ExportableSpin {
  name: string;
  phone: string;
  prizeLabel: string | null;
  extraFields: Record<string, string>;
  createdAt: number;
  offerTitle?: string | null;
}

// Columns mirror the registrations table, custom questions included, so the
// export matches what the screen shows.
export function registrationsCsv(
  spins: ExportableSpin[],
  fields: { key: string; label: string }[],
): string {
  const headers = [
    "Name",
    "Phone",
    ...fields.map((f) => f.label),
    "Prize",
    "Offer",
    "Registered",
  ];

  const rows = spins.map((s) => [
    s.name,
    // An anonymous registration stores a placeholder rather than a number;
    // the table hides it, so the export should not leak it either.
    s.phone.startsWith("anon-") ? "" : s.phone,
    ...fields.map((f) => s.extraFields?.[f.key] ?? ""),
    s.prizeLabel ?? "Not spun yet",
    s.offerTitle ?? "",
    new Date(s.createdAt).toISOString(),
  ]);

  return toCsv(headers, rows);
}

export function registrationsFilename(slug: string): string {
  return `registrations-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
}
