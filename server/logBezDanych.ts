/**
 * Dziennik serwera bez danych osobowych: błędy bazy (drizzle: „Failed query: … params: …”, pg: `parameters`)
 * niosą w treści parametry zapytań, czyli adresy e-mail, skróty haseł i tokenów. console.error i console.warn
 * przepuszczamy przez filtr, który zostawia nazwę błędu, komunikat bez parametrów, kod i stos.
 * Błąd parsera JSON (body-parser) ma w polu `body` surową treść żądania (np. hasło przy logowaniu): pomijamy ją.
 */
const BEZ_PARAMETROW = /\nparams: [\s\S]*$/;

function opisBledu(e: any, glebokosc = 0): string {
  const komunikat = String(e?.message ?? "").replace(BEZ_PARAMETROW, "\nparams: [ukryte]");
  const kod = e?.code ? ` [${e.code}]` : "";
  const stos = typeof e?.stack === "string" ? `\n${e.stack.split("\n").slice(1, 8).join("\n")}` : "";
  const przyczyna = e?.cause && glebokosc < 2 ? `\n  przyczyna: ${opisBledu(e.cause, glebokosc + 1)}` : "";
  return `${e?.name ?? "Error"}: ${komunikat}${kod}${stos}${przyczyna}`;
}

function filtr(arg: unknown): unknown {
  if (arg instanceof Error || (arg && typeof arg === "object" && "stack" in (arg as any) && "message" in (arg as any))) {
    return opisBledu(arg);
  }
  if (typeof arg === "string") return arg.replace(BEZ_PARAMETROW, "\nparams: [ukryte]");
  return arg;
}

for (const poziom of ["error", "warn"] as const) {
  const oryginal = console[poziom].bind(console);
  console[poziom] = (...args: unknown[]) => oryginal(...args.map(filtr));
}
