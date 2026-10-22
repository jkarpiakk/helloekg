/**
 * Parser treści wykładu: Markdown + dyrektywy marki helloEKG.
 * Ten sam parser działa w podglądzie edytora i w trybie kursanta.
 */

export const CALLOUT_KINDS = ['rada', 'zasada', 'trik', 'liczby', 'dociekliwi'] as const;
export type CalloutKind = (typeof CALLOUT_KINDS)[number];

export const EKG_RHYTHMS = [
  'sinus', 'af', 'avb1', 'wenckebach', 'avb3', 'aflutter', 'brady', 'tachy',
] as const;
export type EkgRhythm = (typeof EKG_RHYTHMS)[number];

export const EKG_RHYTHM_LABELS: Record<EkgRhythm, string> = {
  sinus: 'rytm zatokowy',
  af: 'migotanie przedsionków',
  avb1: 'blok AV I stopnia',
  wenckebach: 'blok AV II stopnia typu Wenckebacha',
  avb3: 'blok AV III stopnia',
  aflutter: 'trzepotanie przedsionków',
  brady: 'bradykardia zatokowa',
  tachy: 'tachykardia zatokowa',
};

/** Wstawki interaktywne — kod w `web/src/wstawki/`, w treści `::wstawka <nazwa> [klucz=wartość …]`. */
export const WSTAWKI = [
  'droga-impulsu', 'kompas-osi', 'mapa-zawalu', 'wezel-av', 'petla-qrs', 'pomiary',
  'stymulator', 'adenozyna', 'potas', 'elektrody', 'nzk', 'kardiomonitor',
] as const;
export type WstawkaId = (typeof WSTAWKI)[number];

export const WSTAWKA_LABELS: Record<WstawkaId, string> = {
  'droga-impulsu': 'Droga impulsu',
  'kompas-osi': 'Kompas osi',
  'mapa-zawalu': 'Mapa zawału',
  'wezel-av': 'Laboratorium węzła AV',
  'petla-qrs': 'Pętla QRS w V1 i V6',
  'pomiary': 'Pracownia pomiarów',
  'stymulator': 'Konsola stymulatora',
  'adenozyna': 'Adenozyna przy wąskim QRS',
  'potas': 'Potas na suwaku',
  'elektrody': 'Zamienione elektrody',
  'nzk': 'Monitor zatrzymania krążenia',
  'kardiomonitor': 'Kardiomonitor',
};

export function isWstawka(v: string): v is WstawkaId {
  return (WSTAWKI as readonly string[]).includes(v);
}

/**
 * Zaproszenie nad zwiniętą wstawką w wyjaśnieniu pytania (kurs: „Zobacz to na żywo”), gdy linia nie ma
 * własnego `zaproszenie="…"`. Wzorce z planu koordynatora z 22.10 (mapowanie M), zatwierdzone przez JK.
 */
export const WSTAWKA_ZAPROSZENIA: Record<WstawkaId, string> = {
  'droga-impulsu': 'Prześledź drogę impulsu: przesuń palcem po zapisie i patrz, co się właśnie pobudza.',
  'elektrody': 'Pozamieniaj klipsy na pacjencie i zobacz, które kamery zaczynają kłamać.',
  'kompas-osi': 'Pokręć wektorem i zobacz, jak każda z sześciu kamer zmienia zdanie.',
  'pomiary': 'Weź cyrkiel do ręki i zmierz to samo na żywym papierze.',
  'petla-qrs': 'Zobacz, jak pętla wektora rysuje ten zespół w V1 i V6.',
  'potas': 'Przesuń suwak potasu i obejrzyj, co robi się z załamkami.',
  'wezel-av': 'Zajrzyj do bramy: przestaw blok własnymi rękami i patrz, kiedy odźwierny przepuści impuls.',
  'mapa-zawalu': 'Zamknij tętnicę i zobacz, które kamery podniosą alarm, a które pokażą lustro.',
  'stymulator': 'Usiądź przy programatorze i sprawdź, co słyszy stymulator, zanim zdecyduje.',
  'adenozyna': 'Zwolnij bramę AV na chwilę i zobacz, co naprawdę kryje się pod częstoskurczem.',
  'nzk': 'Stań przy monitorze i rozpoznaj rytm, zanim zrobi to alarm.',
  'kardiomonitor': 'Spójrz na ten monitor jeszcze raz, tym razem z rozpoznaniem i alarmem.',
};

/** Najdłuższe zaproszenie, jakie mieści się w jednej-dwóch liniach karty na telefonie. */
export const ZAPROSZENIE_MAX = 160;

/**
 * Rozbiór opcji wstawki: `klucz=wartość` albo `klucz="wartość ze spacjami"` (np. zaproszenie).
 * `nieznane` = słowa, które nie są opcją (parser zgłasza je jako błąd).
 */
export function rozbierzOpcjeWstawki(s: string): { opts: Record<string, string>; nieznane: string[] } {
  const opts: Record<string, string> = {};
  const nieznane: string[] = [];
  let reszta = s.trim();
  while (reszta) {
    const m = /^([a-ząćęłńóśźż0-9_-]+)=(?:"([^"]*)"|(\S+))/i.exec(reszta);
    if (m) {
      opts[(m[1] ?? '').toLowerCase()] = m[2] !== undefined ? m[2].trim() : (m[3] ?? '');
      reszta = reszta.slice(m[0].length).trimStart();
    } else {
      const slowo = /^\S+/.exec(reszta)?.[0] ?? reszta;
      nieznane.push(slowo);
      reszta = reszta.slice(slowo.length).trimStart();
    }
  }
  return { opts, nieznane };
}

/** „start=-60 tryb=cwiczenie” → { start: '-60', tryb: 'cwiczenie' }; wartości w cudzysłowie mogą mieć spacje. */
export function parsujOpcjeWstawki(s: string): Record<string, string> {
  return rozbierzOpcjeWstawki(s).opts;
}

export function opcjeWstawkiNaTekst(o: Readonly<Record<string, string>>): string {
  return Object.entries(o)
    .filter(([k, v]) => k && v)
    .map(([k, v]) => (/[\s"]/.test(v) ? `${k}="${v.replace(/"/g, '')}"` : `${k}=${v}`))
    .join(' ');
}

/** Błąd w zaproszeniu (dla kursanta: krótko, bez długich myślników) albo null. */
export function bladZaproszenia(z: string): string | null {
  if (z.length > ZAPROSZENIE_MAX) return `Zaproszenie ma ${z.length} znaków, najwyżej ${ZAPROSZENIE_MAX}.`;
  if (/[—–]/.test(z)) return 'Zaproszenie nie może mieć długiego myślnika „—” ani półpauzy „–”.';
  if (/[;\n]/.test(z)) return 'Zaproszenie to jedno zdanie, bez średnika i nowej linii.';
  return null;
}

export const CALLOUT_LABELS: Record<CalloutKind, string> = {
  rada: 'ZŁOTA RADA Z DYŻURU',
  zasada: 'ZŁOTA ZASADA',
  trik: 'TRIK',
  liczby: 'LICZBY DO ZAPAMIĘTANIA',
  dociekliwi: 'DLA DOCIEKLIWYCH',
};

/** Jedna karta w bloku „przypomnij sobie": pytanie widoczne, odpowiedź schowana. */
export interface ParaPrzypomnij {
  pytanie: string;
  odpowiedz: string;
}

export type Segment =
  | { type: 'markdown'; md: string }
  | { type: 'przypomnij'; pary: ParaPrzypomnij[] }
  | { type: 'callout'; kind: CalloutKind; title?: string; md: string }
  | { type: 'grafika'; code: string }
  | { type: 'ekg'; rhythm: EkgRhythm }
  | { type: 'wstawka'; id: WstawkaId; opts: Record<string, string> }
  | { type: 'pytanie'; code: string }
  | { type: 'blad'; message: string; raw: string };

const OPEN_RE = /^:::([a-ząćęłńóśźż]+)[ \t]*(.*)$/i;
const CLOSE_RE = /^:::[ \t]*$/;
const INLINE_RE = /^::([a-ząćęłńóśźż]+)[ \t]+(.+?)[ \t]*$/i;

const GFX_CODE_RE = /^GFX-\d{4,}$/i;
const Q_CODE_RE = /^Q-[A-Za-z0-9_-]+$/i;

/**
 * Treść bloku „:::przypomnij" na pary. Pytanie zaczyna się od „? ",
 * odpowiedź to wszystko do następnego „?" albo do końca bloku.
 */
export function parsujPrzypomnij(linie: readonly string[]): ParaPrzypomnij[] {
  const pary: ParaPrzypomnij[] = [];
  let pytanie: string | null = null;
  let odpowiedz: string[] = [];

  const zamknij = () => {
    if (pytanie === null) return;
    const tresc = odpowiedz.join('\n').trim();
    if (pytanie.trim()) pary.push({ pytanie: pytanie.trim(), odpowiedz: tresc });
    pytanie = null;
    odpowiedz = [];
  };

  for (const linia of linie) {
    const nowe = /^\?[ \t]+(.*)$/.exec(linia);
    if (nowe) {
      zamknij();
      pytanie = nowe[1] ?? '';
    } else if (pytanie !== null) {
      odpowiedz.push(linia);
    }
  }
  zamknij();
  return pary;
}

function isCalloutKind(v: string): v is CalloutKind {
  return (CALLOUT_KINDS as readonly string[]).includes(v);
}
function isRhythm(v: string): v is EkgRhythm {
  return (EKG_RHYTHMS as readonly string[]).includes(v);
}

/** Dzieli dokument na segmenty. Nigdy nie rzuca wyjątku — błędy stają się segmentem `blad`. */
export function parseLecture(content: string): Segment[] {
  const lines = content.replace(/\r\n?/g, '\n').split('\n');
  const segments: Segment[] = [];
  let buffer: string[] = [];

  const flush = () => {
    if (buffer.length === 0) return;
    const md = buffer.join('\n');
    if (md.trim() !== '') segments.push({ type: 'markdown', md: md.replace(/^\n+|\n+$/g, '') });
    buffer = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';

    const open = OPEN_RE.exec(line);
    if (open && !CLOSE_RE.test(line)) {
      const kind = (open[1] ?? '').toLowerCase();
      const title = (open[2] ?? '').trim();
      // zbierz do zamykającego :::
      const body: string[] = [];
      let closed = false;
      let j = i + 1;
      for (; j < lines.length; j++) {
        if (CLOSE_RE.test(lines[j] ?? '')) { closed = true; break; }
        body.push(lines[j] ?? '');
      }
      flush();
      if (kind === 'przypomnij') {
        if (!closed) {
          segments.push({
            type: 'blad',
            message: 'Blok „:::przypomnij" nie został zamknięty. Dopisz linię „:::".',
            raw: line,
          });
        } else {
          const pary = parsujPrzypomnij(body);
          if (pary.length === 0) {
            segments.push({
              type: 'blad',
              message: 'Blok „:::przypomnij" nie zawiera ani jednej pary. '
                + 'Każde pytanie zaczyna się od znaku zapytania i spacji, np. „? Co to jest załamek P?".',
              raw: line,
            });
          } else {
            segments.push({ type: 'przypomnij', pary });
          }
        }
      } else if (!isCalloutKind(kind)) {
        segments.push({
          type: 'blad',
          message: `Nieznana dyrektywa „:::${kind}". Dostępne: ${CALLOUT_KINDS.join(', ')}, przypomnij.`,
          raw: line,
        });
      } else if (!closed) {
        segments.push({
          type: 'blad',
          message: `Blok „:::${kind}" nie został zamknięty. Dopisz linię „:::".`,
          raw: line,
        });
      } else {
        segments.push({
          type: 'callout',
          kind,
          ...(title ? { title } : {}),
          md: body.join('\n').replace(/^\n+|\n+$/g, ''),
        });
      }
      i = closed ? j : lines.length;
      continue;
    }

    const inline = INLINE_RE.exec(line);
    if (inline && !line.startsWith(':::')) {
      const name = (inline[1] ?? '').toLowerCase();
      const arg = (inline[2] ?? '').trim();
      flush();
      if (name === 'grafika') {
        if (GFX_CODE_RE.test(arg)) segments.push({ type: 'grafika', code: arg.toUpperCase() });
        else segments.push({ type: 'blad', message: `Nieprawidłowy kod grafiki „${arg}". Oczekiwano formatu GFX-0001.`, raw: line });
      } else if (name === 'ekg') {
        const r = arg.toLowerCase();
        if (isRhythm(r)) segments.push({ type: 'ekg', rhythm: r });
        else segments.push({ type: 'blad', message: `Nieznany rytm „${arg}". Dostępne: ${EKG_RHYTHMS.join(', ')}.`, raw: line });
      } else if (name === 'wstawka') {
        const nazwa = /^\S*/.exec(arg)?.[0] ?? '';
        const id = nazwa.toLowerCase();
        const { opts, nieznane } = rozbierzOpcjeWstawki(arg.slice(nazwa.length));
        const zaproszenie = opts.zaproszenie !== undefined ? bladZaproszenia(opts.zaproszenie) : null;
        if (!isWstawka(id)) segments.push({ type: 'blad', message: `Nieznana wstawka „${nazwa}". Dostępne: ${WSTAWKI.join(', ')}.`, raw: line });
        else if (nieznane.length) segments.push({ type: 'blad', message: `Opcje wstawki zapisuj jako klucz=wartość, np. „start=-60" albo zaproszenie="Jedno zdanie.". Nie rozumiem: ${nieznane.join(' ')}.`, raw: line });
        else if (zaproszenie) segments.push({ type: 'blad', message: zaproszenie, raw: line });
        else segments.push({ type: 'wstawka', id, opts });
      } else if (name === 'pytanie') {
        if (Q_CODE_RE.test(arg)) segments.push({ type: 'pytanie', code: arg.toUpperCase() });
        else segments.push({ type: 'blad', message: `Nieprawidłowy kod pytania „${arg}". Oczekiwano formatu Q-0001.`, raw: line });
      } else {
        segments.push({ type: 'blad', message: `Nieznana dyrektywa „::${name}". Dostępne: ::grafika, ::ekg, ::wstawka, ::pytanie.`, raw: line });
      }
      continue;
    }

    buffer.push(line);
  }
  flush();
  return segments;
}

/** Kody grafik i pytań użyte w treści — do przeliczania „używana w". */
export function collectReferences(content: string): { graphics: string[]; questions: string[] } {
  const graphics = new Set<string>();
  const questions = new Set<string>();
  for (const s of parseLecture(content)) {
    if (s.type === 'grafika') graphics.add(s.code);
    if (s.type === 'pytanie') questions.add(s.code);
  }
  return { graphics: [...graphics], questions: [...questions] };
}
