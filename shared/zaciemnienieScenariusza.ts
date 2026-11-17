/**
 * Zaciemnienie nazwy scenariusza kardiomonitora w treści pytania (zgłoszenie Z-009).
 *
 * Treść pytania ma linię `::wstawka kardiomonitor scenariusz=<id> pytanie=tak`, a id scenariusza
 * (np. „vf”, „stemi-dolny-blok”) nazywa rozpoznanie. Serwer przed wysłaniem pytania zamienia id na skrót
 * z losową solą (`scenariusz=<skrót> sol=<sól>`), a przeglądarka odnajduje scenariusz, licząc ten sam skrót
 * dla każdego id ze swojej listy.
 *
 * To zaciemnienie, nie tajemnica: lista scenariuszy z nazwami jest w paczce JS, więc kto uruchomi tę funkcję
 * na liście, pozna nazwę. Znika tylko nazwa czytelna gołym okiem w odpowiedzi API i w narzędziach przeglądarki.
 */

/** cyrb53: krótki skrót 53-bitowy (niekryptograficzny), ten sam wynik na serwerze i w przeglądarce */
export function skrotScenariusza(sol: string, id: string): string {
  const s = `${sol}:${id}`;
  let h1 = 0xdeadbeef;
  let h2 = 0x41c6ce57;
  for (let i = 0; i < s.length; i++) {
    const ch = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ ch, 2654435761);
    h2 = Math.imul(h2 ^ ch, 1597334677);
  }
  h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
  h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
  return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

const LINIA = /^([ \t]*::wstawka[ \t]+kardiomonitor)([ \t].*)$/gim;
const SCENARIUSZ = /([ \t])scenariusz=(?:"([^"]*)"|(\S+))/i;

/** Serwer: w liniach kardiomonitora z `pytanie=tak` zamienia id scenariusza na skrót z solą */
export function zaciemnijScenariusze(md: string, sol: string): string {
  if (!md || !md.includes("::wstawka")) return md;
  return md.replace(LINIA, (linia: string, poczatek: string, reszta: string) => {
    if (!/[ \t]pytanie=tak(?=\s|$)/i.test(reszta) || /[ \t]sol=/i.test(reszta)) return linia;
    const m = SCENARIUSZ.exec(reszta);
    const id = m ? (m[2] ?? m[3] ?? "") : "";
    if (!m || !id) return linia;
    return `${poczatek}${reszta.replace(m[0], `${m[1]}scenariusz=${skrotScenariusza(sol, id)} sol=${sol}`)}`;
  });
}

/** Przeglądarka: opcje wstawki ze skrótem → opcje z prawdziwym id (bez `sol`); nieznany skrót zostaje bez zmian */
export function odkryjScenariusz(opts: Record<string, string>, ids: readonly string[]): Record<string, string> {
  const { sol, ...reszta } = opts;
  if (!sol || !reszta.scenariusz) return opts;
  const id = ids.find((x) => skrotScenariusza(sol, x) === reszta.scenariusz);
  return id ? { ...reszta, scenariusz: id } : opts;
}
