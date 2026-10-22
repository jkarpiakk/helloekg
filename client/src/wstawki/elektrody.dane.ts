/**
 * Dane i czysta logika wstawki „elektrody” (bez DOM).
 *
 * Zapis liczony fizycznie: potencjał w miejscu przyłożenia elektrody = rzut wektora serca (płaszczyzna
 * czołowa) na kierunek tego miejsca (prawa ręka −150°, lewa ręka −30°, obie nogi +90°). Aparat nie wie,
 * gdzie leży kabel: odprowadzenia liczy z kabli według definicji z S1_01:
 *   I = LR − PR, II = LN − PR, III = LN − LR,
 *   aVR = PR − (LR + LN)/2, aVL = LR − (PR + LN)/2, aVF = LN − (PR + LR)/2,
 *   Vn = potencjał Vn − końcówka Wilsona, Wilson = (PR + LR + LN)/3.
 * Prawa noga (PN) to elektroda neutralna: nie wchodzi do żadnego odprowadzenia.
 * Wzmocnienie aparatu (1/√3 dla dwubiegunowych, 1/1,5 dla wzmocnionych) jest stałą odprowadzenia,
 * dobraną tak, by przy poprawnym podłączeniu zapis był identyczny z `volt` z core/model.ts.
 */
import { LEADS, LEADS_12, beat, vectorAt, volt, type Beat, type Comp, type LeadName, type V3 } from './core/model.js';
import { WARIANTY } from './petla-qrs.dane.js';

export type Miejsce = 'PR' | 'LR' | 'PN' | 'LN';
export const MIEJSCA: readonly Miejsce[] = ['PR', 'LR', 'PN', 'LN'];
export const NAZWA: Record<Miejsce, string> = { PR: 'prawa ręka', LR: 'lewa ręka', PN: 'prawa noga', LN: 'lewa noga' };
/** Kierunek miejsca w płaszczyźnie czołowej (°). */
export const KAT: Record<Miejsce, number> = { PR: -150, LR: -30, PN: 90, LN: 90 };

/** Podłączenie: dla każdego kabla (oznaczenie na klipsie) miejsce, na którym leży. */
export type Podlaczenie = Record<Miejsce, Miejsce>;
export const POPRAWNE: Podlaczenie = { PR: 'PR', LR: 'LR', PN: 'PN', LN: 'LN' };

/** Zamiana dwóch kabli. */
export function zamien(p: Podlaczenie, a: Miejsce, b: Miejsce): Podlaczenie {
  return { ...p, [a]: p[b], [b]: p[a] };
}
/** Który kabel leży na danym miejscu. */
export function kablNa(p: Podlaczenie, m: Miejsce): Miejsce {
  return MIEJSCA.find((k) => p[k] === m) ?? m;
}

export type ZamianaId = 'brak' | 'rece' | 'pr-ln' | 'lr-ln' | 'pr-pn' | 'lr-pn' | 'ln-pn';
export const ZAMIANY: ReadonlyArray<{ id: ZamianaId; a: Miejsce | null; b: Miejsce | null; label: string; zTekstu: boolean }> = [
  { id: 'brak', a: null, b: null, label: 'Bez zamiany', zTekstu: true },
  { id: 'rece', a: 'PR', b: 'LR', label: 'Zamiana rąk (PR ↔ LR)', zTekstu: true },
  { id: 'lr-ln', a: 'LR', b: 'LN', label: 'LR ↔ LN', zTekstu: false },
  { id: 'pr-ln', a: 'PR', b: 'LN', label: 'PR ↔ LN', zTekstu: false },
  { id: 'pr-pn', a: 'PR', b: 'PN', label: 'PR ↔ PN', zTekstu: false },
  { id: 'lr-pn', a: 'LR', b: 'PN', label: 'LR ↔ PN', zTekstu: false },
  { id: 'ln-pn', a: 'LN', b: 'PN', label: 'LN ↔ PN', zTekstu: false },
];
export function podlaczenieZ(id: ZamianaId): Podlaczenie {
  const z = ZAMIANY.find((q) => q.id === id);
  return z && z.a && z.b ? zamien(POPRAWNE, z.a, z.b) : { ...POPRAWNE };
}
/** Rozpoznaje podłączenie jako jedną z nazwanych zamian (albo null, gdy to złożenie kilku). */
export function jakaZamiana(p: Podlaczenie): ZamianaId | null {
  for (const z of ZAMIANY) { const q = podlaczenieZ(z.id); if (MIEJSCA.every((k) => q[k] === p[k])) return z.id; }
  return null;
}

/* ─────────── serce ─────────── */

const mirrorX = (c: Comp): Comp => ({ ...c, v: [-c.v[0], c.v[1], c.v[2]] as V3 });
/** Obrót składowej w płaszczyźnie czołowej o `d` stopni (z bez zmian). */
const rotF = (c: Comp, d: number): Comp => {
  const a = (d * Math.PI) / 180, [x, y, z] = c.v;
  return { ...c, v: [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a), z] as V3 };
};

/** Oś QRS prawidłowego serca z petla-qrs (składowe dopasowane do progresji R z S2_03). */
export const OS_BAZOWA = 56;
/** P obrócony o −15° względem modelu (oś P ok. +38°), żeby po zamianie rąk dodatnie P w aVR było czytelne. */
const P_OBROT = -15;

/**
 * Serce prawidłowo położone albo w lustrzanej dekstrokardii (odbicie lewo-prawo całego pobudzenia).
 * QRS: składowe normy z petla-qrs, obrócone w płaszczyźnie czołowej do osi `axis`; P i T z core/model.ts.
 */
export function serce(o: { axis?: number; dekstro?: boolean } = {}): Beat {
  const b0 = beat({});
  const d = (o.axis ?? OS_BAZOWA) - OS_BAZOWA;
  const b: Beat = { ...b0, p: b0.p.map((c) => rotF(c, P_OBROT)), qrs: WARIANTY.normal.qrs.map((c) => rotF(c, d)), j: WARIANTY.normal.j };
  if (!o.dekstro) return b;
  return { ...b, p: b.p.map(mirrorX), qrs: b.qrs.map(mirrorX), t: b.t.map(mirrorX), u: b.u.map(mirrorX), st: b.st ? ([-b.st[0], b.st[1], b.st[2]] as V3) : null };
}

/* ─────────── fizyka ─────────── */

/** Potencjał (j. umowne) w miejscu przyłożenia: rzut wektora czołowego na kierunek miejsca. */
export function potencjal(vec: V3, m: Miejsce): number {
  const a = (KAT[m] * Math.PI) / 180;
  return vec[0] * Math.cos(a) + vec[1] * Math.sin(a);
}

const G_BIP = 1 / Math.sqrt(3);
const G_AUG = 1 / 1.5;

/** Napięcie [mV] w odprowadzeniu w chwili t przy danym podłączeniu. */
export function napiecie(b: Beat, p: Podlaczenie, lead: LeadName, t: number): number {
  const vec = vectorAt(b, t);
  const k = (kabel: Miejsce) => potencjal(vec, p[kabel]);
  const PR = k('PR'), LR = k('LR'), LN = k('LN');
  switch (lead) {
    case 'I': return (LR - PR) * G_BIP;
    case 'II': return (LN - PR) * G_BIP;
    case 'III': return (LN - LR) * G_BIP;
    case 'aVR': return (PR - (LR + LN) / 2) * G_AUG;
    case 'aVL': return (LR - (PR + LN) / 2) * G_AUG;
    case 'aVF': return (LN - (PR + LR) / 2) * G_AUG;
    default: {
      // przedsercowe: potencjał elektrody względem końcówki Wilsona; przy poprawnym podłączeniu Wilson = 0
      const wilson = ((PR + LR + LN) / 3) * G_BIP;
      return volt(b, LEADS[lead], t) - wilson;
    }
  }
}

/* ─────────── porównanie z poprawnym zapisem ─────────── */

export const LIMB6: readonly LeadName[] = ['I', 'II', 'III', 'aVR', 'aVL', 'aVF'];
export const WIDOK: readonly LeadName[] = LEADS_12;

const TS = Array.from({ length: 181 }, (_, i) => -0.2 + i * 0.004);

/** Czy dwa przebiegi są identyczne (z dokładnością numeryczną). */
function rowne(f: (t: number) => number, g: (t: number) => number): boolean {
  return TS.every((t) => Math.abs(f(t) - g(t)) < 1e-9);
}
/** Największe |napięcie| w odprowadzeniu [mV]. */
export function maks(b: Beat, p: Podlaczenie, lead: LeadName): number {
  return Math.max(...TS.map((t) => Math.abs(napiecie(b, p, lead, t))));
}

export type Obraz = { typ: 'bez zmian' } | { typ: 'jak'; lead: LeadName; znak: 1 | -1 } | { typ: 'płaskie' } | { typ: 'inny' };

/** Co widać w odprowadzeniu `lead` po zamianie, w porównaniu z poprawnym zapisem tego samego serca. */
export function obraz(b: Beat, p: Podlaczenie, lead: LeadName): Obraz {
  const f = (t: number) => napiecie(b, p, lead, t);
  const ok = (l: LeadName) => (t: number) => napiecie(b, POPRAWNE, l, t);
  if (rowne(f, ok(lead))) return { typ: 'bez zmian' };
  if (maks(b, p, lead) < 0.03) return { typ: 'płaskie' };
  const kandydaci = LEADS_12.filter((l) => (LIMB6.includes(lead) ? LIMB6.includes(l) : l === lead));
  for (const l of kandydaci) {
    if (l !== lead && rowne(f, ok(l))) return { typ: 'jak', lead: l, znak: 1 };
    if (rowne(f, (t) => -ok(l)(t))) return { typ: 'jak', lead: l, znak: -1 };
  }
  return { typ: 'inny' };
}

/** Opis obrazu jednym krótkim zwrotem (bez wniosków klinicznych). */
export function opisObrazu(o: Obraz, lead: LeadName): string {
  switch (o.typ) {
    case 'bez zmian': return 'bez zmian';
    case 'płaskie': return 'prawie płaskie';
    case 'jak': return o.lead === lead && o.znak < 0 ? 'odwrócone' : `jak ${o.znak < 0 ? 'odwrócone ' : ''}${o.lead}`;
    default: return 'inny kształt';
  }
}

/* ─────────── ćwiczenie ─────────── */

export type Odpowiedz = 'prawidlowe' | 'rece' | 'dekstro';
export const ODPOWIEDZI: ReadonlyArray<{ v: Odpowiedz; label: string }> = [
  { v: 'prawidlowe', label: 'Bez zamiany elektrod' },
  { v: 'rece', label: 'Zamiana elektrod rąk' },
  { v: 'dekstro', label: 'Dekstrokardia' },
];
/** Nazwa prawidłowej odpowiedzi w werdykcie („Nie. Prawidłowo: dekstrokardia.”), małą literą. */
export const W_WERDYKCIE: Record<Odpowiedz, string> = { prawidlowe: 'bez zamiany elektrod', rece: 'zamiana elektrod rąk', dekstro: 'dekstrokardia' };
/** Ocena odpowiedzi według wspólnego wzoru werdyktu (bez własnego tekstu werdyktu). */
export function ocena(odp: Odpowiedz, picked: Odpowiedz | null): { ok: boolean; prawidlowo?: string; szczegol?: string } {
  const n = W_WERDYKCIE[odp];
  return picked === odp ? { ok: true, szczegol: n.charAt(0).toUpperCase() + n.slice(1) + '.' } : { ok: false, prawidlowo: n };
}
export interface Zadanie { odp: Odpowiedz; axis: number }
const OSIE = [44, 50, 56, 62];

/** 5 zadań: dwa razy zamiana rąk, dwa razy dekstrokardia, raz zapis prawidłowy, w losowej kolejności. */
export function zadania(r: () => number): Zadanie[] {
  const odp: Odpowiedz[] = ['rece', 'rece', 'dekstro', 'dekstro', 'prawidlowe'];
  for (let i = odp.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [odp[i], odp[j]] = [odp[j]!, odp[i]!]; }
  return odp.map((o) => ({ odp: o, axis: OSIE[Math.floor(r() * OSIE.length)] ?? 45 }));
}
/** Serce i podłączenie dla zadania. */
export function stanZadania(z: Zadanie): { b: Beat; p: Podlaczenie } {
  if (z.odp === 'dekstro') return { b: serce({ axis: z.axis, dekstro: true }), p: { ...POPRAWNE } };
  return { b: serce({ axis: z.axis }), p: z.odp === 'rece' ? podlaczenieZ('rece') : { ...POPRAWNE } };
}

/** Wyjaśnienia (HTML) z planszy S1_01 „Gdy elektrody są źle podłączone”. */
export const WYJASNIENIE: Record<Odpowiedz, string> = {
  rece: '<b>Zamiana elektrod rąk.</b> W odprowadzeniu I aparat odejmuje te same dwa potencjały w przeciwnej kolejności, więc każde wychylenie zmienia znak. II i III zamieniają się obrazami, podobnie aVR i aVL. Z kończynowych bez zmian zostaje tylko aVF. Odprowadzenia przedsercowe też się nie zmieniają. Odwrócone I, dodatnie P w aVR i prawidłowa progresja R mocno sugerują zamianę elektrod rąk.',
  dekstro: '<b>Dekstrokardia.</b> Odprowadzenia kończynowe wyglądają podobnie jak po zamianie rąk, ale serce naprawdę znajduje się po drugiej stronie, więc zmienia się także widok z kamer przedsercowych: R zmniejsza się w kierunku V6. Przy samej zamianie przewodów rąk progresja przedsercowa pozostaje prawidłowa.',
  prawidlowe: '<b>Podłączenie prawidłowe.</b> W prawidłowym zapisie P i przeważająca część QRS są zwykle ujemne w aVR, a dodatnie w I. Progresja R w V1-V6 jest prawidłowa.',
};

/** Następne / poprzednie miejsce w kolejności PR, LR, PN, LN (klawiatura na klipsie). */
export function sasiednie(m: Miejsce, dir: 1 | -1): Miejsce {
  const i = MIEJSCA.indexOf(m), n = MIEJSCA.length;
  return MIEJSCA[(i + dir + n) % n]!;
}
