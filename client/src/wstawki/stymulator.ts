/**
 * Konsola stymulatora: programator (tryb AAI / VVI / DDD, dolna częstość, amplituda względem progu,
 * czułość w mV, magnes), własny rytm pacjenta i odliczanie „urządzenie najpierw słucha”.
 * Usterki z S5_03, tryb ICD (strażak) z S5_04 i ćwiczenie „Co się psuje?”.
 * Wykłady: S5_01, S5_02, S5_03, S5_04.
 *
 * Opcje: tryb=vvi | aai | ddd | usterki | icd | cwiczenie (domyślnie konsola VVI 60/min, własny rytm 50/min).
 */
import { C, TRYB_SPRAWDZ, TRYB_UCZ, button, chips, exercise, fmtNum, h, options, reducedMotion, shell, shuffle, slider, trace, type WstawkaOpts } from './core/ui.js';
import { Strip, monitor, pComps, playToggle, vBeat, type Background, type MonitorMap } from './core/rytm.js';
import type { Beat, V3 } from './core/model.js';
import {
  ATP_ODSTEP, CZULOSCI, ICD_N, ICD_SCEN, Icd, ODPOWIEDZI, OPOZNIENIE_AV, PACJENT_KANON, PQ, SYGNAL_MV, Stymulator, USTAWIENIA_KANON, USTERKI,
  VT_CZESTOSC, ZASTEPCZY, liczonaCzestosc, naprawione, odstep, oknaSzumu, pulaZadan, scenariuszUsterki, wykrywa,
  type IcdFaza, type IcdScen, type IcdZd, type Pacjent, type Tryb, type Usterka, type Ustawienia, type Zadanie, type Zd,
} from './stymulator.dane.js';
import { falaVF } from './nzk.dane.js';
import { scena } from './core/obrazy.js';

type Tryby = 'konsola' | 'usterki' | 'icd' | 'cwiczenie';
type Temat = Exclude<Tryby, 'cwiczenie'>;

/** Styl lokalny: małe chipy też mają cel dotyku 44 px, długie etykiety się łamią zamiast wychodzić poza ekran. */
const CSS = `.stym .hw-chip--sm{min-height:44px}.stym .hw-chip{white-space:normal;line-height:1.2;text-align:center}`;
let styled = false;
function ensureLocalStyle(): void {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const st = document.createElement('style');
  st.setAttribute('data-hw-stym', '');
  st.textContent = CSS;
  document.head.appendChild(st);
}

/**
 * Przenikanie bez timera: stan zmienia się od razu, a ekran przygasa i wraca, zaczynając od bieżącego krycia.
 * Nowe wywołanie przerywa poprzednie, więc szybkie klikanie niczego nie blokuje i niczego nie nakłada.
 */
function przenikanie(els: HTMLElement[]): { run(fn: () => void, animuj?: boolean): void; stop(): void } {
  let anims: Animation[] = [];
  const krycie = (el: HTMLElement): number => {
    if (typeof getComputedStyle !== 'function') return 1;
    const v = parseFloat(getComputedStyle(el).opacity);
    return Number.isFinite(v) ? v : 1;
  };
  return {
    run(fn, animuj = true) {
      const od = els.map(krycie);
      anims.forEach((a) => a.cancel()); anims = [];
      fn();
      if (!animuj || reducedMotion()) return;
      els.forEach((el, i) => {
        if (typeof el.animate !== 'function') return;
        anims.push(el.animate([{ opacity: od[i] ?? 1 }, { opacity: 0.2, offset: 0.25 }, { opacity: 1 }], { duration: 420, easing: 'ease-out' }));
      });
    },
    stop() { anims.forEach((a) => a.cancel()); anims = []; },
  };
}

const SEK = 6;
const LOOK = 0.15;
const BEAT_N = vBeat();
const BEAT_ESC = vBeat({ qrs: 'vent' });
/**
 * Stymulacja z koniuszka prawej komory, zbudowana lokalnie (gotowe 'paced-rv' daje w II tylko mały ząbek):
 * pobudzenie biegnie od koniuszka w górę, w lewo i do tyłu, wolno, przez mięsień. W II szeroki (~0,16 s),
 * głęboko ujemny zespół około −1,2 mV (porównywalny z własnym R ~1,2 mV), dodatni w I, ujemny w V1,
 * z przeciwstawnym (dyskordantnym) załamkiem T.
 */
function pacedRv(): Beat {
  const k = (v: V3, a: number): V3 => [v[0] * a, v[1] * a, v[2] * a];
  return {
    ...vBeat({ qrs: 'paced-rv' }),
    qrs: [{ t: 0.04, w: 0.024, v: k([0.3, -0.95, -0.35], 1.6) }, { t: 0.102, w: 0.03, v: k([0.35, -0.95, -0.45], 1.45) }],
    t: [{ t: 0.36, w: 0.07, w2: 0.05, v: k([-0.3, 0.95, 0.35], 0.5) }],
    u: [], st: null, j: 0.16, tPeak: 0.36, qrsMs: 160, qtMs: 450,
  };
}
const BEAT_PACED = pacedRv();
const SPIKE_V = 1.95, SPIKE_A = 1.7; // iglice cienkie, jasne i wyraźnie wyższe niż QRS (~1,2 mV)
const BEAT_VT = vBeat({ qrs: 'vent', qt: 0.3 });
const P_ZAT = pComps('normal');
const P_STYM = pComps('normal', 0.85);
const PACED_DELAY = 0.008; // początek QRS tuż za iglicą

const s2 = (v: number) => fmtNum(v, 2);
/** Sygnał własny w elektrodzie komorowej, np. „1,5 mV”. */
const MV = `${fmtNum(SYGNAL_MV, 1)} mV`;

/** Widoczne odcinki [x0, x1] przedziału czasu na monitorze z przesuwem (ten sam podział co w `monitor`). */
function pieces(m: MonitorMap, t0: number, t1: number): Array<[number, number]> {
  const out: Array<[number, number]> = [];
  const pps = m.pxPerSec, now = m.now, ss = Math.floor(now / SEK) * SEK, gap = Math.max(14, m.w * 0.035);
  const a0 = Math.max(t0, ss), a1 = Math.min(t1, now);
  if (a1 > a0) out.push([(a0 - ss) * pps, (a1 - ss) * pps]);
  const b0 = Math.max(t0, now - SEK + gap / pps), b1 = Math.min(t1, ss);
  if (b1 > b0) out.push([(b0 - ss + SEK) * pps, (b1 - ss + SEK) * pps]);
  return out;
}

/** Potencjały mięśniowe w oknach czasu (szum wysokiej częstotliwości z łagodnym narastaniem). */
const szumMiesni = (okna: () => ReadonlyArray<readonly [number, number]>): Background => (t) => {
  let g = 0;
  for (const [a, b] of okna()) if (t > a && t < b) { g = Math.min(1, (t - a) / 0.15, (b - t) / 0.15); break; }
  if (!g) return 0;
  let v = 0;
  for (let i = 1; i <= 6; i++) v += Math.sin(2 * Math.PI * (31 + i * 13.7) * t + i * 1.7) / i;
  return 0.09 * g * v;
};

/** Artefakt wyładowania: bardzo duże wychylenie i powolny powrót linii. */
const szokArt = (d: number): number => {
  if (d < 0 || d > 0.7) return 0;
  if (d < 0.012) return 7;
  if (d < 0.026) return -6;
  return -1.3 * Math.exp(-(d - 0.026) / 0.12);
};

interface Engine {
  kind: 'pace' | 'icd';
  strip: Strip;
  tick(now: number): void;
  overlay(ctx: CanvasRenderingContext2D, m: MonitorMap, marks: boolean): void;
}

interface PaceEngine extends Engine { kind: 'pace'; sim: Stymulator; dodajSzum(now: number): void }
interface IcdEngine extends Engine { kind: 'icd'; icd: Icd }

/** Bieżący przesuw (od lewej krawędzi do pióra) jeszcze raz, pełną zielenią i grubszą kreską. */
function jasnyPrzesuw(ctx: CanvasRenderingContext2D, m: MonitorMap, f: (t: number) => number, sek = SEK): void {
  const ss = Math.floor(m.now / sek) * sek, xNow = (m.now - ss) * m.pxPerSec;
  if (xNow < 2) return;
  trace(ctx, f, { x: 0, w: xNow, t0: ss, t1: m.now, y0: m.y(0), pxPerMv: m.pxPerMv, color: C.puls, width: 2.2 });
}

function mono(ctx: CanvasRenderingContext2D, size = 12): void { ctx.font = `500 ${size}px ${C.fontMono}`; ctx.textBaseline = 'middle'; }

function paceEngine(ust: Ustawienia, pac: Pacjent, now: number, szumAuto: boolean): PaceEngine {
  const t0 = now - SEK - 0.5;
  const sim = new Stymulator(ust, { ...pac, szum: [] }, t0);
  const strip = new Strip();
  strip.backgrounds.push(szumMiesni(() => sim.p.szum));
  let nextNoise = szumAuto ? (oknaSzumu(t0, t0 + 10)[0]?.[0] ?? Infinity) : Infinity;
  const pull = () => {
    for (const e of sim.odbierz()) {
      if (e.typ === 'P') strip.add({ kind: 'P', at: e.at, comps: e.zrodlo === 'stym' ? P_STYM : P_ZAT });
      else if (e.typ === 'QRS') strip.add({ kind: 'QRS', at: e.zrodlo === 'stym' ? e.at + PACED_DELAY : e.at, beat: e.zrodlo === 'stym' ? BEAT_PACED : e.zrodlo === 'zastepczy' ? BEAT_ESC : BEAT_N });
      else if (e.typ === 'iglica') strip.add({ kind: 'spike', at: e.at, chamber: e.jama, amp: e.jama === 'V' ? SPIKE_V : SPIKE_A });
    }
  };
  const eng: PaceEngine = {
    kind: 'pace', sim, strip,
    dodajSzum(n) {
      const last = sim.p.szum.at(-1);
      const od = Math.max(n + 0.1, last ? last[1] + 0.3 : -Infinity);
      sim.p.szum.push([od, od + 2.6]);
    },
    tick(n) {
      while (nextNoise < n + 1) { sim.p.szum.push([nextNoise, nextNoise + 2.6]); nextNoise += 7; }
      sim.advance(n + LOOK);
      pull();
      strip.prune(n - 12); sim.przytnij(n - 12);
      sim.p.szum = sim.p.szum.filter((w) => w[1] > n - 12);
    },
    overlay(ctx, m, marks) {
      if (!marks) return;
      const H = m.h, rowH = 9;
      const rows: readonly string[] = sim.u.tryb === 'DDD' ? ['A', 'AV'] : sim.u.tryb === 'AAI' ? ['A'] : ['V'];
      const rowY = (j: string) => H - 12 - (rows.length - 1 - rows.indexOf(j)) * (rowH + 12);
      mono(ctx, 12);
      // odliczanie: zamknięte okna z historii
      for (const e of sim.historia) {
        if (e.typ !== 'okno' || !rows.includes(e.jama)) continue;
        const y = rowY(e.jama);
        for (const [x0, x1] of pieces(m, e.od, e.do)) {
          ctx.fillStyle = e.koniec === 'iglica' || e.koniec === 'brak' ? C.line2 : 'rgba(163,175,183,.28)';
          ctx.fillRect(x0, y - rowH / 2, Math.max(1, x1 - x0 - 1), rowH);
        }
      }
      // trwające okno: zielony pasek do teraz, przerywany obrys do planowanego impulsu
      for (const o of sim.otwarte()) {
        if (!rows.includes(o.jama)) continue;
        const y = rowY(o.jama);
        for (const [x0, x1] of pieces(m, o.od, m.now)) { ctx.fillStyle = C.puls; ctx.fillRect(x0, y - rowH / 2, Math.max(1, x1 - x0), rowH); }
        const xn = m.x(m.now);
        if (xn !== null && o.planowo > m.now) {
          const xe = Math.min(m.w - 1, xn + (o.planowo - m.now) * m.pxPerSec);
          ctx.strokeStyle = C.puls; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
          ctx.strokeRect(xn + 0.5, y - rowH / 2 + 0.5, Math.max(1, xe - xn - 1), rowH - 1);
          ctx.setLineDash([]);
        }
      }
      // podpisy rzędów
      ctx.fillStyle = C.txt3; ctx.textAlign = 'left';
      for (const r of rows) ctx.fillText(r, 4, rowY(r) - rowH / 2 - 7);
      // znaczniki zdarzeń nad paskiem odliczania
      const yM = rowY(rows[0] ?? 'V') - rowH - 16;
      for (const e of sim.historia) {
        if (e.typ === 'okno' || e.typ === 'P' || e.typ === 'QRS' || e.typ === 'iglica') continue;
        const x = m.x(e.at);
        if (x === null) continue;
        if (e.typ === 'wykrycie' && e.co !== 'szum') { ctx.strokeStyle = C.txt2; ctx.lineWidth = 1.3; ctx.beginPath(); ctx.moveTo(x, yM - 5); ctx.lineTo(x + 5, yM + 4); ctx.lineTo(x - 5, yM + 4); ctx.closePath(); ctx.stroke(); }
        else if (e.typ === 'wykrycie') { ctx.fillStyle = C.warn; ctx.beginPath(); ctx.moveTo(x, yM - 5); ctx.lineTo(x + 4, yM); ctx.lineTo(x, yM + 5); ctx.lineTo(x - 4, yM); ctx.closePath(); ctx.fill(); }
        else if (e.typ === 'pominiecie') { ctx.strokeStyle = C.alarm; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(x - 4, yM - 4); ctx.lineTo(x + 4, yM + 4); ctx.moveTo(x + 4, yM - 4); ctx.lineTo(x - 4, yM + 4); ctx.stroke(); }
        else if (e.typ === 'brak') {
          ctx.strokeStyle = C.alarm; ctx.lineWidth = 1.2; ctx.setLineDash([3, 3]);
          ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, 8); ctx.lineTo(Math.round(x) + 0.5, yM + 4); ctx.stroke(); ctx.setLineDash([]);
          ctx.fillStyle = C.alarm; ctx.textAlign = 'center'; ctx.fillText('?', x, 14);
        }
      }
    },
  };
  eng.tick(now);
  return eng;
}

function icdEngine(scen: IcdScen, now: number, liczyT: boolean, magnes: boolean): IcdEngine {
  const t0 = now - SEK - 0.5;
  const icd = new Icd(scen, t0, { liczyT, magnes, onset: SEK + 0.5 + 2 });
  const strip = new Strip();
  const vf: Array<[number, number]> = [];
  const szoki: number[] = [];
  const det: Array<Extract<IcdZd, { typ: 'detekcja' }>> = [];
  const atp: number[] = [];
  strip.backgrounds.push((t) => {
    let v = 0;
    const open = icd.vfTrwa();
    const inVf = (open !== null && t >= open) || vf.some(([a, b]) => t >= a && t <= b);
    if (inVf) v += falaVF(t, true, 2);
    for (const s of szoki) v += szokArt(t - s);
    return v;
  });
  const pull = () => {
    for (const e of icd.odbierz()) {
      if (e.typ === 'P') strip.add({ kind: 'P', at: e.at, comps: P_ZAT });
      else if (e.typ === 'QRS') strip.add({ kind: 'QRS', at: e.zrodlo === 'stym' ? e.at + PACED_DELAY : e.at, beat: e.zrodlo === 'stym' ? BEAT_PACED : e.zrodlo === 'vt' ? BEAT_VT : BEAT_N });
      else if (e.typ === 'iglica') { strip.add({ kind: 'spike', at: e.at, chamber: 'V', amp: SPIKE_V }); atp.push(e.at); }
      else if (e.typ === 'vf') vf.push([e.od, e.do]);
      else if (e.typ === 'wyladowanie') szoki.push(e.at);
      else if (e.typ === 'detekcja') det.push(e);
    }
  };
  const eng: IcdEngine = {
    kind: 'icd', icd, strip,
    tick(n) { icd.advance(n + LOOK); pull(); strip.prune(n - 12); while (det.length && det[0]!.at < n - 12) det.shift(); },
    overlay(ctx, m, marks) {
      if (!marks) return;
      mono(ctx, 12);
      const yB = m.h - 10;
      for (const d of det) {
        const x = m.x(d.at);
        if (x === null) continue;
        const tall = d.wStrefie ? 12 : 6;
        ctx.strokeStyle = d.co === 'T' ? C.warn : d.wStrefie ? C.alarm : C.txt3;
        ctx.lineWidth = d.co === 'T' ? 2.2 : 1.4;
        ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, yB); ctx.lineTo(Math.round(x) + 0.5, yB - tall); ctx.stroke();
      }
      ctx.fillStyle = C.txt3; ctx.textAlign = 'left'; ctx.fillText('ICD liczy', 4, yB - 20);
      // podpisy terapii
      ctx.textAlign = 'center';
      const firstAtp = atp.find((a, i) => i === 0 || a - (atp[i - 1] ?? 0) > ATP_ODSTEP * 1.5);
      if (firstAtp !== undefined) { const x = m.x(firstAtp); if (x !== null) { ctx.fillStyle = C.txt; ctx.fillText('ATP', x + 30, 14); } }
      for (const s of szoki) { const x = m.x(s); if (x !== null) { ctx.fillStyle = C.txt; ctx.fillText('wyładowanie', Math.min(m.w - 50, Math.max(50, x)), 14); } }
    },
  };
  eng.tick(now);
  return eng;
}

export function mountStymulator(host: HTMLElement, opts: WstawkaOpts): () => void {
  ensureLocalStyle();
  const { root, body, live } = shell(host, {
    label: 'Wstawka · stymulator',
    title: 'Konsola stymulatora: urządzenie najpierw słucha, potem stymuluje.',
    intro: 'Ustaw programator i własny rytm pacjenta, a pod zapisem patrz na pasek odliczania do następnego impulsu. Potem znajdź usterki i zobacz, jak ICD gasi pożar.',
  });
  root.classList.add('stym');
  const optTryb = (opts.tryb ?? '').toLowerCase();
  let mode: Tryby = optTryb === 'usterki' ? 'usterki' : optTryb === 'icd' ? 'icd' : optTryb === 'cwiczenie' ? 'cwiczenie' : 'konsola';
  let temat: Temat = mode === 'cwiczenie' ? 'konsola' : mode;
  let mounted = false;
  /** Prefiks do ogłoszenia stanu ICD po zmianie scenariusza (null: nie ogłaszaj poza ważnymi fazami). */
  let oglosIcd: string | null = null;
  const startTryb: Tryb = optTryb === 'aai' ? 'AAI' : optTryb === 'ddd' ? 'DDD' : 'VVI';
  let ust: Ustawienia = { ...USTAWIENIA_KANON, tryb: startTryb };
  let pac: Pacjent = { ...PACJENT_KANON };
  let usterka: Usterka = 'wychwyt';
  let icdScen: IcdScen = 'atp', icdT = false, icdMag = false;
  let marks = true;
  let eng: Engine | null = null;
  let zad: Zadanie | null = null;

  const build = (now: number): Engine => {
    if (mode === 'icd') return icdEngine(icdScen, now, icdT, icdMag);
    if (mode === 'cwiczenie' && zad) return paceEngine(zad.ust, zad.pac, now, zad.szum);
    if (mode === 'usterki') { const s = scenariuszUsterki(usterka); ust = s.ust; pac = s.pac; return paceEngine(ust, pac, now, usterka === 'nadczulosc'); }
    return paceEngine(ust, pac, now, false);
  };

  /* ─────────── monitor ─────────── */
  const status = h('b');
  const screen = h('div', { class: 'hw-screen' },
    h('div', { class: 'hw-mbar' }, h('span', {}, h('i', { class: 'hw-dot' }), 'II · 25 mm/s · 1 s = 5 dużych kratek'), status));
  let lastRead = -1, ready = false, lastTags = '';
  const mon = monitor(screen, {
    seconds: SEK, height: 260, scale: 'fit', base: 0.44, fitMv: 2,
    label: 'Kardiomonitor, odprowadzenie II, zapis pacjenta ze stymulatorem',
    signal: (t) => eng?.strip.volt(t, 'II') ?? 0,
    spikes: (t0, t1) => (eng?.strip.spikes(t0, t1) ?? []).map((sp) => ({ at: sp.at, amp: sp.amp, color: C.txt })),
    overlay: (ctx, m) => {
      if (!eng) return;
      const st = eng.strip, f = (t: number) => st.volt(t, 'II');
      jasnyPrzesuw(ctx, m, f);
      // iglice bieżącego przesuwu jeszcze raz nad jaśniejszą kreską: cienkie, jasne, wyższe niż QRS
      const ss = Math.floor(m.now / SEK) * SEK;
      ctx.strokeStyle = C.txt; ctx.lineWidth = 1.4;
      for (const sp of st.spikes(ss, m.now)) {
        const x = Math.round((sp.at - ss) * m.pxPerSec) + 0.5;
        ctx.beginPath(); ctx.moveTo(x, m.y(f(sp.at)) + 2); ctx.lineTo(x, m.y(sp.amp)); ctx.stroke();
      }
      eng.overlay(ctx, m, marks);
    },
    tick: (now) => {
      if (!eng) eng = build(now);
      eng.tick(now);
      if (ready && Math.abs(now - lastRead) > 0.12) { lastRead = now; readout(now); }
    },
  });
  const play = playToggle(mon);
  const restart = () => { eng = build(mon.now()); mon.redraw(); if (ready) readout(mon.now()); };
  const fade = przenikanie([screen]);
  /** Zmiana stanu: od razu nowy zapis, opis i kontrolki; przenikanie tylko jako tło, bez czekania. */
  const swap = (fn: () => void) => fade.run(() => { fn(); restart(); syncControls(); describe(); }, mounted);

  const legend = h('div', { class: 'hw-legend' });
  const paintLegend = () => {
    const item = (sym: string, col: string, txt: string) => `<span><b style="color:${col};font-weight:500;margin-right:6px">${sym}</b>${txt}</span>`;
    legend.innerHTML = mode === 'icd'
      ? item('│', C.alarm, 'pobudzenie w strefie') + item('╵', C.txt3, 'poza strefą') + item('┃', C.warn, 'policzony załamek T') + item('│', C.txt, 'iglica ATP')
      : item('│', C.txt, 'iglica (impuls)') + item('△', C.txt2, 'wykryte pobudzenie') + item('✕', C.alarm, 'pominięte pobudzenie') + item('◆', C.warn, 'szum uznany za pobudzenie')
        + item('┆?', C.alarm, 'należny impuls, którego brak') + item('▬', C.puls, 'odliczanie do impulsu');
  };
  const tags = h('div', { class: 'hw-tags', 'aria-live': 'off' });

  /* ─────────── programator ─────────── */
  const trybCh = chips([{ v: 'AAI', label: 'AAI' }, { v: 'VVI', label: 'VVI' }, { v: 'DDD', label: 'DDD' }] as const, ust.tryb, (v) => {
    ust = { ...ust, tryb: v };
    if (eng?.kind === 'pace') (eng as PaceEngine).sim.zmienTryb(v);
    apply(`Tryb ${v}.`);
  }, { label: 'Tryb stymulacji' });
  const dolnaSl = slider({ label: 'Dolna częstość', min: 40, max: 90, step: 5, value: ust.dolna, fmt: (v) => `${v}/min · okno ${s2(odstep(v))} s`, onInput: (v) => { ust = { ...ust, dolna: v }; apply(`Dolna częstość ${v}/min, okno ${s2(odstep(v))} s.`); } });
  const ampFmt = (v: number) => (v > ust.prog ? 'z zapasem ponad próg' : 'poniżej progu wychwytu');
  const ampSl = slider({ label: 'Amplituda impulsu', min: 0.1, max: 1, step: 0.05, value: ust.amplituda, fmt: ampFmt, onInput: (v) => { ust = { ...ust, amplituda: v }; apply(`Amplituda ${ampFmt(v)}.`); } });
  ampSl.el.append(h('div', { class: 'hw-note', style: 'position:relative;height:16px' },
    h('span', { style: `position:absolute;left:calc(11px + (100% - 22px) * ${(USTAWIENIA_KANON.prog - 0.1) / 0.9});transform:translateX(-50%);white-space:nowrap`, text: '▲ próg wychwytu' })));
  const czulCh = chips(CZULOSCI.map((c) => ({ v: String(c) as '1' | '2', label: `${c} mV` })), String(ust.czulosc) as '1' | '2', (v) => {
    ust = { ...ust, czulosc: Number(v) };
    apply(wykrywa(SYGNAL_MV, ust.czulosc) ? `Czułość ${v} mV: sygnał ${MV} wykryty.` : `Czułość ${v} mV: sygnał ${MV} może zostać pominięty.`);
  }, { label: 'Czułość', small: true });
  const czulNote = h('p', { class: 'hw-note', text: `Sygnał własny w elektrodzie komorowej: ${MV}. Mniejsza liczba mV oznacza lepszy słuch.` });
  const aaiNote = h('p', { class: 'hw-note', text: 'W trybie AAI urządzenie nie słucha komory.' });
  const magBtn = h('button', { class: 'hw-chip', type: 'button', 'aria-pressed': 'false', text: 'Przyłóż magnes' });
  const paintMag = () => {
    const on = mode === 'icd' ? icdMag : ust.magnes;
    magBtn.setAttribute('aria-pressed', String(on));
    magBtn.textContent = on ? 'Zdejmij magnes' : 'Przyłóż magnes';
  };
  magBtn.addEventListener('click', () => {
    if (mode === 'icd') { icdMag = !icdMag; paintMag(); if (eng?.kind === 'icd') (eng as IcdEngine).icd.magnes = icdMag; describe(); live(icdMag ? 'Magnes nad ICD: terapie zawieszone, ICD nie przerwie arytmii.' : 'Magnes zdjęty: terapie aktywne.'); return; }
    ust = { ...ust, magnes: !ust.magnes };
    apply(ust.magnes ? 'Magnes zwykle przełącza na stymulację asynchroniczną, bez nasłuchiwania.' : 'Magnes zdjęty: urządzenie znów słucha.');
  });
  const field = (label: string, ...kids: Node[]) => h('div', { class: 'hw-field' }, h('span', { class: 'hw-flabel', text: label }), ...kids);
  const magSlot = h('div', { class: 'hw-row' }, magBtn);
  const resetUst = button('Przywróć ustawienia', () => {
    if (mode === 'usterki') {
      swap(() => {});
      live(`Ustawienia startowe: ${USTERKI.find((x) => x.v === usterka)?.label.toLowerCase() ?? ''}.`);
      return;
    }
    swap(() => { ust = { ...USTAWIENIA_KANON }; pac = { ...PACJENT_KANON }; });
    live(`Ustawienia startowe: ${USTAWIENIA_KANON.tryb} ${USTAWIENIA_KANON.dolna}/min, własny rytm ${PACJENT_KANON.zatoka}/min.`);
  }, 'ghost');
  const prog = h('div', { class: 'hw-panel hw-grid' },
    h('p', { class: 'hw-label', text: 'Programator' }),
    field('Tryb', trybCh.el), dolnaSl.el, ampSl.el, field('Czułość komorowa', czulCh.el, aaiNote, czulNote),
    field('Magnes nad generatorem', magSlot), h('div', { class: 'hw-row' }, resetUst));

  /* ─────────── pacjent ─────────── */
  const zatSl = slider({ label: 'Własny rytm zatokowy', min: 30, max: 100, step: 5, value: pac.zatoka, fmt: (v) => `${v}/min · ${s2(odstep(v))} s`, onInput: (v) => { pac = { ...pac, zatoka: v }; apply(`Własny rytm ${v}/min.`); } });
  const avCh = chips([{ v: 'sprawne', label: 'Przewodzenie AV sprawne' }, { v: 'blok', label: 'Blok całkowity' }] as const, pac.av, (v) => { pac = { ...pac, av: v }; apply(v === 'blok' ? 'Blok całkowity: P nie przechodzą do komór.' : 'Przewodzenie AV sprawne.'); }, { label: 'Przewodzenie AV', small: true });
  const escCh = chips([{ v: '30', label: `Rytm zastępczy ${ZASTEPCZY}/min` }, { v: '0', label: 'Brak rytmu zastępczego' }] as const, '30', (v) => { pac = { ...pac, zastepczy: Number(v) }; apply(v === '0' ? 'Bez rytmu zastępczego: pacjent zależny od stymulatora.' : `Rytm zastępczy ${ZASTEPCZY}/min.`); }, { label: 'Rytm zastępczy', small: true });
  const pacPanel = h('div', { class: 'hw-panel hw-grid' },
    h('p', { class: 'hw-label', text: 'Pacjent' }), zatSl.el, field('Brama AV', avCh.el), field('Gdy brama zamknięta', escCh.el),
    h('p', { class: 'hw-note', text: `Blok całkowity: P idą swoim rytmem, a do komór nie dochodzą. Rytm zastępczy ${ZASTEPCZY}/min to QRS co ${fmtNum(odstep(ZASTEPCZY))} s.` }));

  /* ─────────── usterki ─────────── */
  const ustCh = chips(USTERKI, usterka, (v) => {
    swap(() => { usterka = v; ruchBtn.hidden = v !== 'nadczulosc'; });
    live(`Usterka: ${USTERKI.find((x) => x.v === v)?.label.toLowerCase()}.`);
  }, { label: 'Usterka' });
  const ruchBtn = button('Napnij mięsień piersiowy', () => { if (eng?.kind === 'pace') (eng as PaceEngine).dodajSzum(mon.now()); live('Przez chwilę widać potencjały mięśniowe.'); }, 'ghost');
  const fixState = h('p', { class: 'hw-verdict' });
  const ustPanel = h('div', { class: 'hw-grid' }, ustCh.el, h('div', { class: 'hw-row' }, ruchBtn), fixState);

  /* ─────────── ICD ─────────── */
  const icdCh = chips(ICD_SCEN, icdScen, (v) => { oglosIcd = `${ICD_SCEN.find((x) => x.v === v)?.label ?? ''}. `; swap(() => { icdScen = v; }); }, { label: 'Scenariusz ICD', small: true });
  const liczCh = chips([{ v: 'qrs', label: 'ICD liczy QRS' }, { v: 'qrst', label: 'ICD liczy QRS + T' }] as const, 'qrs', (v) => {
    icdT = v === 'qrst';
    if (eng?.kind === 'icd') (eng as IcdEngine).icd.liczyT = icdT;
    describe();
    live(icdT ? 'ICD liczy QRS i załamek T: 90/min wygląda jak 180/min.' : 'ICD liczy tylko QRS.');
  }, { label: 'Co liczy ICD', small: true });
  const icdRestart = button('Zacznij scenariusz od nowa', () => { oglosIcd = 'Od nowa. '; swap(() => {}); }, 'ghost');
  const icdMagSlot = h('div', { class: 'hw-row' });
  const cells = h('div', { style: 'display:flex;gap:3px', 'aria-hidden': 'true' }, ...Array.from({ length: ICD_N }, () => h('span', { style: `width:14px;height:10px;border:1px solid ${C.line2};border-radius:2px` })));
  const icdState = h('p', { class: 'hw-verdict' });
  const icdPanel = h('div', { class: 'hw-grid' }, icdCh.el, h('div', { class: 'hw-row' }, liczCh.el, icdMagSlot, icdRestart),
    h('div', { class: 'hw-row', style: 'gap:10px' }, h('span', { class: 'hw-note', text: 'Rozpoznanie:' }), cells), icdState);

  /* ─────────── ćwiczenie ─────────── */
  let pool: Zadanie[] = [];
  const opt = options(ODPOWIEDZI, () => ex.odswiez());
  const taskInfo = h('p', { class: 'hw-tag' });
  const why: Record<string, string> = {
    wychwyt: '<b>Brak wychwytu:</b> iglica jest, ale nie następuje po niej pobudzenie jamy, którą miała pobudzić. Komory pobudza tylko rytm zastępczy co 2 s. Przy braku wychwytu iglica jest i nie działa.',
    stymulacja: '<b>Brak stymulacji:</b> pauza, która powinna wyzwolić stymulację, a iglicy brak. Odmierz 1 s, czyli pięć dużych kratek, od ostatniego QRS: tam powinna stać iglica. Przy braku stymulacji nie ma jej wcale. Ten sam obraz może dać nadczułość bez widocznych zakłóceń; rozstrzyga odczyt urządzenia.',
    niedoczulosc: '<b>Niedoczułość:</b> iglice wpadają w środek własnego rytmu, zbyt wcześnie po własnym QRS albo w obrębie załamka T. Urządzenie nie słyszy części własnych pobudzeń i stymuluje tak, jakby ich nie było.',
    nadczulosc: '<b>Nadczułość:</b> w czasie potencjałów mięśniowych iglic brak, choć komory stoją. Urządzenie słyszy szum, traktuje go jak pobudzenia serca i wstrzymuje stymulację. Pauzy pojawiają się dokładnie wtedy, gdy pacjent stymulacji potrzebuje.',
    'vvi-cisza': `<b>Prawidłowa praca:</b> własny rytm 75/min daje QRS co ${fmtNum(odstep(75), 1)} s, czyli przed upływem zaprogramowanej sekundy. Każde pobudzenie uruchamia odliczanie od nowa. Urządzenie milczy, bo milczeć powinno.`,
    'ddd-blok': '<b>Prawidłowa praca:</b> własny P, krótka przerwa, iglica komorowa i QRS. W DDD przy bloku AV to prawidłowa odpowiedź urządzenia: mikrofon w przedsionku usłyszał P, a słuchawka w komorze dokończyła resztę.',
  };
  const ex = exercise<Zadanie>({
    rounds: 5,
    make: (i) => { if (i === 0 || pool.length === 0) pool = shuffle(pulaZadan()); return pool[i % pool.length]!; },
    show: (z) => {
      zad = z; marks = false; opt.reset();
      taskInfo.innerHTML = `Ustawienia: <b>${z.ust.tryb} ${z.ust.dolna}/min</b> · ${z.opis.replace(/^(VVI|DDD)[^,]*, ?/, '')}`;
      swap(() => {});
    },
    prompt: 'Co się psuje? Obejrzyj kilka cykli i wybierz odpowiedź.',
    gotowe: () => opt.picked() !== null,
    check: (z) => {
      const picked = opt.picked();
      opt.reveal(z.odp, picked);
      marks = true; mon.redraw();
      const ok = picked === z.odp;
      const right = (ODPOWIEDZI.find((o) => o.v === z.odp)?.label ?? '').toLowerCase();
      return { ok, prawidlowo: right, szczegol: ok ? `To ${right}.` : undefined, why: (why[z.id] ?? '') + ' Znaczniki pod zapisem pokazują teraz, co usłyszało urządzenie.' };
    },
    live,
  });
  ex.miejsce.append(taskInfo, opt.el);
  const exPanel = h('div', { class: 'hw-grid' }, ex.el);

  /* ─────────── scena ICD: strażak obok dyrygenta (S5_04) ─────────── */
  const icdScena = h('figure', { class: 'hw-grid', style: 'margin:0;gap:4px' },
    scena('strazak', { alt: 'Dyrygent i strażak obok siebie: stymulator podaje tempo, ICD czuwa i gasi pożar', maxH: 220 }),
    h('figcaption', { class: 'hw-note', style: 'text-align:center', text: 'ICD jest strażakiem: przez większość czasu tylko obserwuje' }));

  /* ─────────── opis stanu ─────────── */
  const whyP = h('p', { class: 'hw-why' });
  const modeCh = chips([{ v: 'ucz', label: TRYB_UCZ }, { v: 'sprawdz', label: TRYB_SPRAWDZ }] as const,
    mode === 'cwiczenie' ? 'sprawdz' : 'ucz', (v) => setMode(v === 'sprawdz' ? 'cwiczenie' : temat), { label: 'Tryb wstawki' });
  const tematCh = chips([{ v: 'konsola', label: 'Konsola' }, { v: 'usterki', label: 'Usterki' }, { v: 'icd', label: 'ICD: strażak' }] as const,
    temat, (v) => setMode(v), { label: 'Temat' });

  body.append(
    h('div', { class: 'hw-bar' }, modeCh.el, play),
    tematCh.el,
    icdScena, screen, legend, tags,
    exPanel, ustPanel, icdPanel,
    h('div', { class: 'hw-2col', style: 'align-items:start' }, prog, pacPanel),
    whyP,
  );

  function syncControls() {
    trybCh.set(ust.tryb); dolnaSl.set(ust.dolna); ampSl.set(ust.amplituda); czulCh.set(String(ust.czulosc) as '1' | '2');
    paintMag();
    zatSl.set(pac.zatoka); avCh.set(pac.av); escCh.set(String(pac.zastepczy) as '30' | '0');
    czulCh.disable(ust.tryb === 'AAI');
    aaiNote.hidden = ust.tryb !== 'AAI';
    escCh.disable(pac.av !== 'blok');
  }

  function apply(msg: string) {
    if (eng?.kind === 'pace') {
      const sim = (eng as PaceEngine).sim;
      sim.u = { ...ust, brakImpulsu: mode === 'usterki' && usterka === 'stymulacja' };
      sim.p.zatoka = pac.zatoka; sim.p.av = pac.av; sim.p.zastepczy = pac.zastepczy;
    }
    syncControls(); describe(); live(msg);
    // bez czekania na kolejną klatkę: odczyt i nakładka od razu pokazują nowe ustawienie (także przy pauzie)
    mon.redraw(); readout(mon.now());
  }

  function readout(now: number) {
    if (!eng) return;
    if (eng.kind === 'icd') {
      const icd = (eng as IcdEngine).icd;
      const kids = cells.children;
      for (let i = 0; i < kids.length; i++) {
        const on = i < Math.min(ICD_N, icd.licznik) && (icd.faza === 'liczy' || icd.faza === 'ocena' || icd.faza === 'zawieszone');
        (kids[i] as HTMLElement).style.background = on ? C.alarm : 'transparent';
      }
      icdStatus(icd.faza);
      return;
    }
    if (!marks) { if (tags.childElementCount) { tags.replaceChildren(); lastTags = ''; } return; }
    const sim = (eng as PaceEngine).sim;
    const parts: string[] = [];
    for (const o of sim.otwarte()) {
      const el = Math.max(0, Math.min(now, o.planowo) - o.od), tot = o.planowo - o.od;
      const name = o.jama === 'AV' ? 'Opóźnienie AV' : o.jama === 'A' ? 'Odliczanie przedsionka' : 'Odliczanie komory';
      parts.push(`<span class="hw-tag">${name} <b>${s2(el)} s z ${s2(tot)} s</b></span>`);
    }
    const last = [...sim.historia].reverse().find((e) => e.typ !== 'okno' && e.typ !== 'P' && e.at <= now);
    if (last) parts.push(`<span class="hw-tag">${lastText(last, sim.u)}</span>`);
    const html = parts.join('');
    if (html !== lastTags) { lastTags = html; tags.innerHTML = html; }
  }
  const lastText = (e: Zd, u: Ustawienia): string => {
    switch (e.typ) {
      case 'wykrycie': return e.co === 'szum' ? 'Szum uznany za pobudzenie: <b>odliczanie od nowa</b>' : e.jama === 'A' ? `Wykryty własny P: <b>${u.tryb === 'DDD' ? 'start opóźnienia AV' : 'odliczanie od nowa'}</b>` : 'Wykryty własny QRS: <b>odliczanie od nowa</b>';
      case 'pominiecie': return 'Własny QRS <b>pominięty</b>: odliczanie biegnie dalej';
      case 'iglica': return e.wychwyt ? `Impuls ${e.jama === 'A' ? 'przedsionkowy' : 'komorowy'}: <b>wychwyt</b>`
        : e.refrakcja ? (e.jama === 'A' ? 'Impuls w trakcie pobudzenia przedsionka: <b>przedsionek już pobudzony, to nie brak wychwytu</b>' : 'Impuls w trakcie pobudzenia komory: <b>komora już pobudzona, to nie brak wychwytu</b>')
        : `Impuls ${e.jama === 'A' ? 'przedsionkowy' : 'komorowy'}: <b>bez wychwytu</b>`;
      case 'brak': return 'Należny impuls <b>nie wyszedł</b>';
      case 'QRS': return e.zrodlo === 'stym' ? 'Stymulowany QRS' : e.zrodlo === 'zastepczy' ? 'QRS rytmu zastępczego' : 'Własny QRS';
      default: return '';
    }
  };

  function icdStatus(f: IcdFaza) {
    const t: Record<IcdFaza, string> = {
      czuwa: 'Strażak czuwa: mierzy odstępy między pobudzeniami komór.',
      liczy: icdScen === 'vf' ? 'Odstępy bardzo krótkie i nieregularne: urządzenie liczy, czy arytmia trwa.' : `VT ${VT_CZESTOSC}/min, odstęp około ${s2(odstep(VT_CZESTOSC))} s: w strefie leczenia, urządzenie liczy pobudzenia.`,
      atp: `ATP: krótka seria impulsów szybszych niż częstoskurcz, odstęp ${s2(ATP_ODSTEP)} s.`,
      ocena: 'Seria nie przerwała częstoskurczu. ICD ponownie ocenia rytm.',
      wyladowanie: 'Wyładowanie: gruby, wysoki artefakt przecinający wszystko.',
      po: icdScen === 'atp' ? 'Częstoskurcz zniknął i wrócił wolniejszy, własny rytm. Tak wygląda skuteczna ATP.' : 'Po wyładowaniu rytm się zmienił. Oceniasz fragment przed artefaktem i po nim.',
      zawieszone: icdScen === 'vf' ? 'Terapie zawieszone: ICD nie przerwie migotania komór. To rytm do defibrylacji: potrzebna jest defibrylacja zewnętrzna.' : 'Terapie zawieszone: ICD nie przerwie arytmii. Pacjent zostaje bez ochrony.',
      poza: 'VT wolniejszy od dolnej granicy leczenia: urządzenie nie interweniuje. Sprawdź stan chorego.',
    };
    let s = t[f];
    if (icdScen === 'qrst') s = icdT ? `ICD liczy QRS i T: ${liczonaCzestosc(90, true)}/min, choć rytm ma 90/min. To jeszcze nie oznacza automatycznego wyładowania.` : 'ICD liczy tylko QRS: 90/min, tyle, ile ma rytm.';
    const zmiana = icdState.textContent !== s;
    if (zmiana) { icdState.textContent = s; icdState.className = 'hw-verdict' + (f === 'wyladowanie' || f === 'liczy' || f === 'atp' ? ' hw-bad' : f === 'zawieszone' || f === 'poza' || (icdScen === 'qrst' && icdT) ? ' hw-warn' : ''); }
    // czytnik ekranu: po zmianie scenariusza oraz w fazach, które coś zmieniają u pacjenta; reszta tylko na ekranie
    if (oglosIcd !== null) { live(oglosIcd + s); oglosIcd = null; }
    else if (zmiana && (f === 'atp' || f === 'wyladowanie' || f === 'po' || f === 'zawieszone')) live(s);
  }

  function describe() {
    status.textContent = mode === 'icd' ? (icdMag ? 'ICD · MAGNES' : 'ICD') : mode === 'cwiczenie' ? (zad ? `${zad.ust.tryb} ${zad.ust.dolna}/MIN` : '') : `${ust.tryb} ${ust.dolna}/MIN${ust.magnes ? ' · MAGNES' : ''}`;
    if (mode === 'icd') {
      whyP.innerHTML = '<b>ICD jest strażakiem:</b> przez większość czasu tylko obserwuje. Mierzy odstępy między pobudzeniami komór i sprawdza, czy szybki rytm utrzymuje się przez zaprogramowaną liczbę pobudzeń. '
        + (icdScen === 'vf' ? 'Migotania komór ATP nie przerywa, więc przy VF potrzebna jest defibrylacja.' : icdScen === 'szok' ? 'W jednym epizodzie VT urządzenie może najpierw podać ATP, a po jej niepowodzeniu wyładowanie, zsynchronizowane z pobudzeniem komór.' : icdScen === 'wolny' ? 'VT wolniejszy od dolnej granicy leczenia może trwać bez żadnej interwencji urządzenia.' : icdScen === 'qrst' ? 'Przy rzeczywistej częstości 90/min policzenie każdego QRS i każdego T daje liczbę sygnałów odpowiadającą 180/min.' : `Przy częstoskurczu ${VT_CZESTOSC}/min odstęp wynosi około ${s2(odstep(VT_CZESTOSC))} s; podczas ATP może się skrócić np. do ${s2(ATP_ODSTEP)} s. To przykład, nie stałe ustawienie.`)
        + (icdMag ? ' Magnes nad ICD zwykle zawiesza terapie, nie zmieniając stymulacji przy bradykardii. Strażak odkłada gaśnicę, a z zewnątrz tego nie widać.' + (icdState.textContent?.startsWith('Terapie zawieszone') ? '' : ' Bez arytmii: potrzebne są monitorowanie i gotowość do defibrylacji zewnętrznej.') : '');
      return;
    }
    if (mode === 'cwiczenie') { whyP.innerHTML = ''; return; }
    if (mode === 'usterki') {
      const fx = naprawione(usterka, ust);
      const txt: Record<Usterka, string> = {
        wychwyt: '<b>Co widzisz:</b> iglica jest, ale nie następuje po niej QRS. Pacjent z blokiem całkowitym zostaje ze swoim rytmem zastępczym. <b>Przyczyna tutaj:</b> zbyt mała zaprogramowana siła impulsu. <b>Napraw:</b> ustaw amplitudę z zapasem ponad próg.',
        stymulacja: '<b>Co widzisz:</b> pauza, która powinna wyzwolić stymulację, a iglicy brak. Odliczanie zaczyna się od ostatniego wykrytego pobudzenia komory: po 1 s powinna przyjść iglica. <b>Ustawieniem tego nie naprawisz:</b> dopiero odczyt urządzenia rozstrzygnie, czy impuls został wysłany, zahamowany, czy nie powstał z powodu usterki.',
        niedoczulosc: `<b>Co widzisz:</b> iglice wpadają w środek własnego rytmu, także w obręb T. Przy czułości 2 mV sygnał ${MV} może zostać pominięty. <b>Napraw:</b> ustaw czułość 1 mV. Mniejsza liczba mV oznacza wykrywanie słabszych sygnałów. Sama iglica na T nie jest jeszcze pobudzeniem typu R na T.`,
        nadczulosc: '<b>Co widzisz:</b> przy ruchu ręką urządzenie słyszy potencjały mięśnia piersiowego, uznaje je za pobudzenia i wstrzymuje stymulację. Pacjent jest zależny od stymulatora, więc komory stoją. <b>Ratunkowo</b> przyłóż magnes: urządzenie przestaje słuchać szumu i stymuluje. Przyczynę i ustawienia ustala kontrola programatorem.',
      };
      whyP.innerHTML = txt[usterka];
      const ratunek = usterka === 'nadczulosc' && fx;
      fixState.textContent = fx === null ? 'Ustawieniem nie naprawisz: potrzebna kontrola programatorem.'
        : ratunek ? 'Magnes przywrócił stymulację, ale to ratunek, nie naprawa. Reakcja na magnes może być wyłączona albo krótkotrwała.'
        : fx ? 'Naprawione ustawieniem. Obejrzyj kilka kolejnych cykli.' : usterka === 'nadczulosc' ? 'Usterka trwa. Przyłóż magnes.' : 'Usterka trwa. Zmień ustawienie.';
      fixState.className = 'hw-verdict ' + (ratunek || fx === null ? 'hw-warn' : fx ? 'hw-ok' : 'hw-bad');
      return;
    }
    whyP.innerHTML = konsolaText();
  }

  function konsolaText(): string {
    const I = odstep(ust.dolna), own = pac.zatoka, blok = pac.av === 'blok';
    const slyszyV = wykrywa(SYGNAL_MV, ust.czulosc);
    const wolny = own < ust.dolna;
    // czy w tym stanie urządzenie w ogóle wysyła impulsy
    const saIglice = ust.magnes
      || (ust.tryb === 'VVI' && (blok || wolny || !slyszyV))
      || (ust.tryb === 'AAI' && wolny)
      || (ust.tryb === 'DDD' && (wolny || blok || !slyszyV));
    const parts: string[] = [];
    if (ust.magnes) parts.push('<b>Magnes</b> zwykle przełącza na stymulację asynchroniczną, ze stałą częstością, bez nasłuchiwania. Iglice pojawiają się w stałym rytmie, nawet gdy serce pobudza się samo, i mogą wpaść w załamek T. Częstość stymulacji magnesowej zależy od urządzenia; tu model trzyma dolną częstość.');
    else if (ust.tryb === 'VVI') {
      if (!blok && own >= ust.dolna && slyszyV) parts.push(`<b>VVI:</b> własny rytm ${own}/min daje QRS co ${s2(odstep(own))} s, przed upływem ${s2(I)} s od wykrycia poprzedniego. Każdy wykryty QRS uruchamia odliczanie od nowa. Urządzenie milczy, bo milczeć powinno.`);
      else if (!blok && own >= ust.dolna) parts.push(`<b>VVI:</b> własny rytm ${own}/min jest szybszy, ale przy czułości ${ust.czulosc} mV sygnał ${MV} może zostać pominięty. Urządzenie nie słyszy własnych QRS i co ${s2(I)} s wysyła impuls, jakby ich nie było: iglice wpadają w środek własnego rytmu, także w obręb T (niedoczułość).`);
      else parts.push(`<b>VVI:</b> urządzenie czeka ${s2(I)} s od ostatniego wykrytego QRS albo impulsu. Gdy w tym oknie nic się nie wydarzy, wysyła impuls${ust.amplituda > ust.prog ? ': iglica, po niej szeroki QRS, który tak ma' : ''}.${ust.amplituda > ust.prog ? ' Załamki P wędrują względem stymulowanych QRS, bo VVI nie śledzi przedsionków.' : ''}`);
    } else if (ust.tryb === 'AAI') {
      parts.push(!wolny ? `<b>AAI:</b> własny P przychodzi przed upływem ${s2(I)} s i hamuje impuls przedsionkowy.` : `<b>AAI:</b> iglica, tuż po niej P, potem odstęp PQ ${s2(PQ)} s i własny wąski QRS. Stymulacja przedsionkowa podmienia dyrygenta, ale orkiestra gra po swojemu.`);
      if (blok) parts.push('Sam tryb AAI nie zabezpiecza komór przed blokiem AV: P jest, a QRS z przewodzenia brak.');
    } else {
      const a = !wolny ? 'własny P' : 'iglica przedsionkowa i P';
      const v = blok ? 'iglica komorowa i stymulowany QRS' : 'własny QRS';
      parts.push(`<b>DDD:</b> ${a}, potem ${v}. Po wykrytym albo wystymulowanym pobudzeniu przedsionka urządzenie odmierza opóźnienie AV ${fmtNum(OPOZNIENIE_AV * 1000)} ms, sztuczną wersję odźwiernego w bramie AV.`
        + (!blok && own >= ust.dolna && slyszyV ? ' Przy sprawnym własnym rytmie i przewodzeniu urządzenie tylko słucha i nie wysyła żadnego impulsu.' : '')
        + (!blok && !slyszyV ? ` Przy czułości ${ust.czulosc} mV własny QRS może zostać pominięty, więc po opóźnieniu AV pojawia się iglica komorowa w trakcie pobudzenia komory (niedoczułość).` : ''));
    }
    if (ust.amplituda <= ust.prog) parts.push(saIglice ? '<b>Amplituda poniżej progu:</b> iglica jest, ale tkanka nie odpowiada (brak wychwytu).' : '<b>Amplituda poniżej progu:</b> własny rytm hamuje stymulację, więc iglic nie ma i braku wychwytu tu nie zobaczysz.');
    if (ust.tryb !== 'AAI' && !ust.magnes && !slyszyV && (blok || (ust.tryb === 'VVI' && wolny))) parts.push(`<b>Czułość ${ust.czulosc} mV:</b> sygnał ${MV} może zostać pominięty (niedoczułość).`);
    return parts.join(' ');
  }

  function setMode(m: Tryby) {
    const prev = mode;
    mode = m;
    if (m !== 'cwiczenie') temat = m;
    modeCh.set(m === 'cwiczenie' ? 'sprawdz' : 'ucz'); tematCh.set(temat);
    tematCh.el.hidden = m === 'cwiczenie';
    marks = m !== 'cwiczenie';
    exPanel.hidden = m !== 'cwiczenie';
    ustPanel.hidden = m !== 'usterki';
    icdPanel.hidden = m !== 'icd';
    icdScena.hidden = m !== 'icd';
    prog.hidden = m === 'icd' || m === 'cwiczenie';
    pacPanel.hidden = m !== 'konsola';
    ruchBtn.hidden = m !== 'usterki' || usterka !== 'nadczulosc';
    if (m === 'icd') icdMagSlot.append(magBtn); else magSlot.append(magBtn);
    if (m === 'konsola' && prev !== 'konsola') { ust = { ...USTAWIENIA_KANON, tryb: ust.tryb }; pac = { ...PACJENT_KANON }; }
    paintLegend();
    if (m === 'icd' && mounted) oglosIcd = '';
    if (m === 'cwiczenie') ex.start();
    else swap(() => {});
  }

  ready = true;
  setMode(mode);
  mounted = true;
  return () => {
    fade.stop();
    mon.destroy();
    host.replaceChildren();
  };
}
