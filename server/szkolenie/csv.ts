/** Komórka CSV: średnik jako separator (Excel PL), cudzysłowy, bez formuł (=, +, -, @ na początku) */
export function komorkaCsv(v: unknown): string {
  let s = v === null || v === undefined ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
