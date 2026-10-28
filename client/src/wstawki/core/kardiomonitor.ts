/**
 * Kardiomonitor przy łóżku, w stylu monitora z landingu helloekg.pl: jedna jasnozielona linia rysowana
 * przesuwem z przerwą wymazywania, delikatna kratka, obok parametry (HR, NIBP, SpO₂, ST) i alarm.
 *
 * HR liczy monitor sam, z ostatnich zespołów QRS na pasku (jak prawdziwy aparat), a fala SpO₂
 * pojawia się tylko po pobudzeniach z tętnem — dlatego przy PEA i VT bez tętna pletyzmogram jest płaski.
 */
import { C, ensureStyle, h, loop, reducedMotion, type MountFn } from './ui.js';
import { LEADS, stAt, type LeadName } from './model.js';
import { Strip, type QEvent } from './rytm.js';
import type { Generator } from './rytmy.js';
import { przyciskDzwieku, tor } from './dzwiek.js';

export interface Scenariusz {
  id: string;
  /** Nazwa w galerii, np. „STEMI ściany dolnej z blokiem AV III°”. */
  nazwa: string;
  /** Jedno zdanie o pacjencie albo o tym, co widać (dla kursanta i dla czytnika ekranu). */
  opis: string;
  /** Pasek nad zapisem, np. „ŁÓŻKO 4 · SOR”. */
  miejsce?: string;
  odprowadzenia: LeadName[];
  rytm: () => Generator;
  nibp?: string;
  spo2?: number | null;
  /** Pokaż pletyzmogram SpO₂ (fala tętna). Domyślnie tak, gdy jest spo2. */
  pleth?: boolean;
  /** Pokaż odchylenia ST w mm dla wyświetlanych odprowadzeń (liczone z modelu). */
  st?: boolean;
  /** Okienko ST bez kolorów progów (w pytaniu kolor zdradzałby, czy kryterium jest spełnione). */
  stNeutralne?: boolean;
  /** Komunikat alarmu (czerwony pasek), np. „VF”, „ASYSTOLIA”. Z `od` — od której sekundy. */
  alarm?: { tekst: string; od?: number };
  /** Godzina startowa zegara, np. „03:12:40”. */
  zegar?: string;
  /**
   * Sekunda zapisu, która ma być widoczna na pierwszym ekranie (np. początek pauzy albo VT).
   * Ważne przy „Ogranicz ruch”, bo monitor stoi wtedy na pierwszym ekranie.
   */
  start?: number;
  /** Najkrótsze okno zapisu w s (np. 8, gdy cała pauza albo blok ma się zmieścić na ekranie telefonu). */
  okno?: number;
  /** Grupa w galerii, np. „Przewodzenie i bloki”. */
  grupa?: string;
}

export interface KardiomonitorOpts {
  /** 'pelny' — kilka odprowadzeń i panel parametrów; 'kompakt' — jedno odprowadzenie i HR (dla `::ekg`). */
  wariant?: 'pelny' | 'kompakt';
  /** Wysokość jednego wiersza zapisu w px (domyślnie dobierana do szerokości). */
  wiersz?: number;
  /** Zatrzymaj od razu (np. w ćwiczeniu do chwili odpowiedzi). */
  pauza?: boolean;
  /**
   * Monitor w treści pytania: alarm milczy, a ton QRS ma stałą wysokość (bez saturacji),
   * żeby dźwięk nie podpowiadał rozpoznania.
   */
  pytanie?: boolean;
  /** Własny przełącznik dźwięku na pasku (domyślnie tak; nie, gdy monitor siedzi we wstawce z przełącznikiem w nagłówku). */
  przyciskDzwieku?: boolean;
}

const CSS = `
.km{background:#05080B;border:1px solid var(--hw-line,#1A222B);border-radius:14px;overflow:hidden;color:#F2F6F4;font-family:var(--hw-f-t,Inter,system-ui,sans-serif)}
.km__bar{display:flex;flex-wrap:wrap;gap:4px 14px;justify-content:space-between;align-items:center;padding:8px 12px;border-bottom:1px solid #141C24;font:500 12px/1.3 var(--hw-f-m,"JetBrains Mono",monospace);letter-spacing:.06em;text-transform:uppercase;color:#7E8B94}
.km__bar b{color:#3EE6A8;font-weight:500}
.km__live{display:inline-block;width:7px;height:7px;border-radius:50%;background:#3EE6A8;margin-right:7px;vertical-align:1px}
.km__body{display:grid;grid-template-columns:minmax(0,1fr)}
@container hw (min-width:560px){.km__body{grid-template-columns:minmax(0,1fr) 168px}}
.km__traces{position:relative;min-width:0}
.km__traces canvas{display:block;width:100%}
.km__lead{position:absolute;left:10px;font:500 12px/1 var(--hw-f-m,monospace);color:#A3AFB7;letter-spacing:.04em;pointer-events:none}
.km__vit{display:grid;grid-template-columns:repeat(auto-fit,minmax(96px,1fr));gap:0;border-top:1px solid #141C24;align-content:start}
@container hw (min-width:560px){.km__vit{border-top:0;border-left:1px solid #141C24;grid-template-columns:1fr}}
.km__v{padding:10px 12px;border-bottom:1px solid #141C24;display:grid;gap:2px}
.km__v dt{font:500 12px/1.2 var(--hw-f-m,monospace);letter-spacing:.07em;text-transform:uppercase;color:#7E8B94;display:flex;justify-content:space-between}
.km__v dd{margin:0;font:500 22px/1.05 var(--hw-f-d,"Space Grotesk",sans-serif);font-variant-numeric:tabular-nums;color:#F2F6F4}
.km__v dd small{font-size:13px;color:#A3AFB7;margin-left:2px}
.km__hr dd{font-size:44px;color:#3EE6A8;letter-spacing:-.02em}
.km__hr.is-alarm dd{color:#E24B4A}
.km__spo2 dd{color:#6CB4FF}
.km__heart{display:inline-block;width:14px;height:14px;color:#3EE6A8;opacity:.35;transition:opacity .12s,transform .12s;vertical-align:2px;margin-left:6px}
.km__heart.is-on{opacity:1}
.km__st dd{font:500 13px/1.6 var(--hw-f-m,monospace);color:#A3AFB7;display:flex;flex-wrap:wrap;gap:0 10px}
.km__st dd i{font-style:normal;color:#7E8B94;margin-right:4px}
.km__st dd .up{color:#E24B4A}.km__st dd .down{color:#E8B04A}
.km__alarm{display:none;align-items:center;gap:8px;padding:7px 12px;background:rgba(226,75,74,.14);border-bottom:1px solid rgba(226,75,74,.5);color:#FF8A89;font:500 13px/1.2 var(--hw-f-m,monospace);letter-spacing:.08em;text-transform:uppercase}
.km__alarm.is-on{display:flex}
.km__alarm i{width:9px;height:9px;border-radius:50%;background:#E24B4A;animation:km-blink 1s steps(2,start) infinite}
@keyframes km-blink{to{visibility:hidden}}
@media (prefers-reduced-motion:reduce){.km__alarm i{animation:none}.km__heart{transition:none}}
.km--kompakt .km__body{grid-template-columns:minmax(0,1fr) 92px}
.km--kompakt .km__vit{border-top:0;border-left:1px solid #141C24;grid-template-columns:1fr}
.km--kompakt .km__hr dd{font-size:32px}
.km__pauza{appearance:none;font:500 12px/1 var(--hw-f-m,monospace);letter-spacing:.06em;text-transform:uppercase;color:#A3AFB7;background:transparent;border:1px solid #223040;border-radius:999px;min-height:32px;padding:0 12px;cursor:pointer;transition:transform .1s}
.km__pauza:active{transform:scale(.96)}
`;
let styled = false;
function ensureKmStyle(): void {
  if (styled || typeof document === 'undefined') return;
  styled = true;
  const s = document.createElement('style');
  s.setAttribute('data-km', '');
  s.textContent = CSS;
  document.head.appendChild(s);
}

const SERCE = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 13.5S2 10 2 5.8A3 3 0 0 1 8 4.4a3 3 0 0 1 6 1.4C14 10 8 13.5 8 13.5z" fill="currentColor"/></svg>';
const fmtMm = (mv: number) => { const mm = Math.round(mv * 10 * 2) / 2; return (mm > 0 ? '+' : mm < 0 ? '−' : '') + String(Math.abs(mm)).replace('.', ','); };

/** Fala tętna w pletyzmogramie: szybki narost, wcięcie dykrotyczne, powolny spadek. */
function plethFala(dt: number): number {
  if (dt < 0 || dt > 0.9) return 0;
  const narost = Math.exp(-((dt - 0.13) ** 2) / (2 * 0.045 ** 2));
  const odbicie = 0.38 * Math.exp(-((dt - 0.36) ** 2) / (2 * 0.06 ** 2));
  const ogon = dt > 0.13 ? 0.55 * Math.exp(-(dt - 0.13) / 0.32) : 0;
  return Math.max(narost, ogon) + odbicie;
}

export interface Kardiomonitor {
  el: HTMLElement;
  strip: Strip;
  now(): number;
  setPaused(p: boolean): void;
  paused(): boolean;
  /** Podmiana scenariusza bez tworzenia monitora od nowa (np. w ćwiczeniu). */
  ustaw(s: Scenariusz): void;
  destroy(): void;
}

/** Tworzy kardiomonitor w `parent` dla scenariusza `sc`. */
export function kardiomonitor(parent: HTMLElement, sc0: Scenariusz, o: KardiomonitorOpts = {}): Kardiomonitor {
  ensureStyle(); ensureKmStyle();
  const kompakt = o.wariant === 'kompakt';
  let sc = sc0;

  const miejsce = h('span', {});
  const skala = h('span', {});
  const zegar = h('span', {});
  const bar = h('div', { class: 'km__bar' }, miejsce, skala, zegar);
  const pauzaBtn = kompakt ? h('button', { type: 'button', class: 'km__pauza' }) : null;
  if (kompakt) { zegar.hidden = true; }
  if (pauzaBtn) bar.append(pauzaBtn);
  if (o.przyciskDzwieku !== false) bar.append(przyciskDzwieku({ maly: true }));
  const alarm = h('div', { class: 'km__alarm', role: 'status' }, h('i', { 'aria-hidden': 'true' }), h('span', {}));
  const canvas = h('canvas', { 'aria-hidden': 'true' });
  const traces = h('div', { class: 'km__traces' }, canvas);
  const vit = h('dl', { class: 'km__vit' });
  const body = h('div', { class: 'km__body' }, traces, vit);
  const el = h('figure', { class: 'km' + (kompakt ? ' km--kompakt' : ''), role: 'img', style: 'margin:0' }, bar, alarm, body);
  parent.append(el);
  // dźwięk ciągły: z kilku widocznych monitorów gra tylko najbardziej widoczny
  const snd = tor(el, { ciagly: true });
  let alarmNext = 0;

  // parametry
  const heart = h('span', { class: 'km__heart', html: SERCE });
  const hrDd = h('dd', { text: '--' });
  const hrBox = h('div', { class: 'km__v km__hr' }, h('dt', {}, h('span', { text: 'HR' }), heart), hrDd);
  const nibpDd = h('dd', {});
  const nibpBox = h('div', { class: 'km__v' }, h('dt', { text: 'NIBP' }), nibpDd);
  const spoDd = h('dd', {});
  const spoBox = h('div', { class: 'km__v km__spo2' }, h('dt', { text: 'SpO₂' }), spoDd);
  const stDd = h('dd', {});
  const stBox = h('div', { class: 'km__v km__st' }, h('dt', { text: 'ST mm' }), stDd);
  vit.append(hrBox, nibpBox, spoBox, stBox);

  const strip = new Strip();
  let gen: Generator = sc.rytm();
  let now = 0, isPaused = !!o.pauza || reducedMotion();
  let sec = 0, pps = 100, rowH = 110, pxPerMv = 44, plethH = 0, W = 0, H = 0, dpr = 1;
  let lastX = 0, lastY: number[] = [];
  const leadEls: HTMLElement[] = [];
  const ctx = canvas.getContext('2d')!;

  /** Chwila pierwszego ekranu: pełny obieg, a gdy scenariusz ma `start`, tak żeby ta sekunda była widoczna. */
  const poczatek = () => Math.max(sec * 0.995, (sc.start ?? 0) + sec * 0.7);
  const rows = () => (kompakt ? sc.odprowadzenia.slice(0, 1) : sc.odprowadzenia);
  const hasPleth = () => !kompakt && (sc.pleth ?? (sc.spo2 !== undefined && sc.spo2 !== null));

  function pasek() {
    if (pauzaBtn) { pauzaBtn.textContent = isPaused ? 'Graj' : 'Pauza'; pauzaBtn.setAttribute('aria-pressed', isPaused ? 'true' : 'false'); }
    if (kompakt) { miejsce.textContent = isPaused ? 'Zatrzymany' : ''; return; }
    miejsce.innerHTML = `<span class="km__live" aria-hidden="true"${isPaused ? ' style="background:#5C6870"' : ''}></span>${sc.miejsce ?? 'Monitor'} · ${isPaused ? 'Zatrzymany' : 'Na żywo'}`;
  }

  function opisz() {
    pasek();
    skala.textContent = `${rows().join(' · ')} · 25 mm/s · 10 mm/mV`;
    nibpDd.innerHTML = sc.nibp ? sc.nibp : '<small>---</small>';
    nibpBox.hidden = kompakt || !sc.nibp;
    spoBox.hidden = kompakt || sc.spo2 === undefined;
    stBox.hidden = kompakt || !sc.st;
    el.setAttribute('aria-label', `Kardiomonitor: ${sc.nazwa}. ${sc.opis}`);
    leadEls.forEach((e) => e.remove()); leadEls.length = 0;
    rows().forEach((n) => { const e = h('span', { class: 'km__lead', text: n }); traces.append(e); leadEls.push(e); });
    if (sc.st) {
      const b = strip.events.find((e): e is QEvent => e.kind === 'QRS')?.beat;
      stDd.innerHTML = b ? rows().map((n) => {
        const v = stAt(b, LEADS[n]);
        // progi uniesienia jak w S3_05: V2-V3 2 mm, V3R-V4R i V7-V9 0,5 mm, pozostałe 1 mm
        const prog = n === 'V2' || n === 'V3' ? 0.2 : ['V3R', 'V4R', 'V7', 'V8', 'V9'].includes(n) ? 0.05 : 0.1;
        const cls = sc.stNeutralne ? '' : v >= prog ? 'up' : v <= -0.05 ? 'down' : '';
        return `<span><i>${n}</i><span class="${cls}">${fmtMm(v)}</span></span>`;
      }).join('') : '';
    }
  }

  function uklad() {
    const w = Math.max(200, Math.round(traces.clientWidth || parent.clientWidth || 600));
    dpr = Math.min(window.devicePixelRatio || 1, 2);
    sec = Math.max(sc.okno ?? 5, Math.min(8, w / 112));
    // w pierwszym obiegu (także przy zatrzymanym monitorze) ekran ma być pełny po każdej zmianie szerokości
    if (now < poczatek()) { now = poczatek(); gen(strip, now + 3); }
    pps = w / sec;
    const mm = pps / 25;
    rowH = o.wiersz ?? Math.round(Math.max(84, Math.min(140, w * 0.2)));
    if (kompakt) rowH = o.wiersz ?? 96;
    pxPerMv = Math.min(mm * 10, rowH * 0.36);
    plethH = hasPleth() ? Math.round(rowH * 0.55) : 0;
    W = w; H = rowH * rows().length + plethH;
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
    canvas.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    // kratka 1 i 5 mm jako tło kontenera (rysowana raz, bez kosztu na klatkę)
    const m = mm.toFixed(2), m5 = (mm * 5).toFixed(2);
    traces.style.backgroundImage = `linear-gradient(rgba(62,230,168,.10) 1px,transparent 1px),linear-gradient(90deg,rgba(62,230,168,.10) 1px,transparent 1px),linear-gradient(rgba(62,230,168,.04) 1px,transparent 1px),linear-gradient(90deg,rgba(62,230,168,.04) 1px,transparent 1px)`;
    traces.style.backgroundSize = `${m5}px ${m5}px,${m5}px ${m5}px,${m}px ${m}px,${m}px ${m}px`;
    leadEls.forEach((e, i) => { e.style.top = `${i * rowH + 8}px`; });
    pelne();
  }

  const yLead = (i: number, mv: number) => i * rowH + rowH * 0.58 - mv * pxPerMv;
  const yPleth = (v: number) => rowH * rows().length + plethH * 0.86 - v * plethH * 0.62;

  function plethAt(t: number): number {
    let v = 0;
    const evs = strip.inRange(t - 1.0, t);
    for (const e of evs) if (e.kind === 'QRS' && e.tag === 'qrs') v += plethFala(t - e.at - 0.18);
    return v;
  }

  function sygnal(i: number, t: number): number {
    const n = rows()[i]!;
    return strip.volt(t, n);
  }

  /** Rysuje odcinek przesuwu od lastX do x (czas ekranu liczy się od początku obiegu). */
  function rysujOdcinek(x0: number, x1: number, tBaseSweep: number) {
    const gap = Math.max(16, W * 0.03);
    // wymazywanie przed piórem: stary obieg znika pasem szerokości `gap`
    ctx.clearRect(Math.ceil(x0) + 1, 0, x1 - x0 + gap, H);
    if (x1 + gap > W) ctx.clearRect(0, 0, x1 + gap - W, H);
    ctx.lineWidth = 1.8; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    const n = rows().length;
    for (let i = 0; i <= n; i++) {
      const pleth = i === n;
      if (pleth && !plethH) continue;
      ctx.strokeStyle = pleth ? C.blue : C.puls;
      ctx.beginPath();
      let first = true;
      for (let x = x0; x <= x1 + 0.01; x += 1) {
        const t = tBaseSweep + x / pps;
        // nadpróbkowanie: szczyt R nie gubi się między pikselami
        let ex = 0;
        for (let k = 0; k < 3; k++) {
          const v = pleth ? plethAt(t + k / (3 * pps)) : sygnal(i, t + k / (3 * pps));
          if (k === 0 || Math.abs(v) > Math.abs(ex)) ex = v;
        }
        const y = pleth ? yPleth(ex) : yLead(i, ex);
        const py = lastY[i];
        if (first) { if (py !== undefined && x === x0 && x0 > 0) ctx.moveTo(x - 1, py); else ctx.moveTo(x, y); first = false; }
        ctx.lineTo(x, y);
        lastY[i] = y;
      }
      ctx.stroke();
    }
    // iglice stymulatora
    for (const sp of strip.spikes(tBaseSweep + x0 / pps, tBaseSweep + x1 / pps)) {
      const x = Math.round((sp.at - tBaseSweep) * pps) + 0.5;
      ctx.strokeStyle = C.txt; ctx.lineWidth = 1.3;
      for (let i = 0; i < n; i++) { ctx.beginPath(); ctx.moveTo(x, yLead(i, 0) + 2); ctx.lineTo(x, yLead(i, sp.amp)); ctx.stroke(); }
    }
  }

  /** Przerysowanie całego ekranu (start, zmiana rozmiaru, pauza): bieżący obieg + resztka poprzedniego. */
  function pelne() {
    ctx.clearRect(0, 0, W, H);
    const sweepStart = Math.floor(now / sec) * sec;
    const xNow = (now - sweepStart) * pps;
    const gap = Math.max(16, W * 0.03);
    gen(strip, now + 3);
    lastY = [];
    if (now > sec && xNow + gap < W) rysujOdcinek(xNow + gap, W, sweepStart - sec);
    lastY = [];
    rysujOdcinek(0, xNow, sweepStart);
    lastX = xNow;
  }

  let lastBeatAt = -1;
  const ostatnie: { hr: string; alarm: boolean | null; spo2: string } = { hr: '', alarm: null, spo2: '' };
  function parametry() {
    // HR z dwóch ostatnich QRS (z tętnem albo bez — monitor liczy zespoły, nie tętno)
    const qs = strip.inRange(now - 6, now).filter((e) => e.kind === 'QRS');
    const a = qs[qs.length - 1], b = qs[qs.length - 2];
    const hr = a && b && now - a.at < 3.5 ? Math.round(60 / (a.at - b.at)) : null;
    // DOM tylko przy zmianie wartości (bez zapisu co klatkę)
    const hrTxt = hr ? String(hr) : '---';
    if (hrTxt !== ostatnie.hr) { hrDd.textContent = hrTxt; ostatnie.hr = hrTxt; }
    if (a && a.at !== lastBeatAt) {
      lastBeatAt = a.at;
      // serduszko: samo krycie, bez skalowania i bez timera
      heart.animate?.([{ opacity: 1 }, { opacity: 0.35 }], { duration: 220, easing: 'ease-out' });
    }
    const alarmOn = !!sc.alarm && now >= (sc.alarm.od ?? 0);
    if (alarmOn !== ostatnie.alarm) {
      ostatnie.alarm = alarmOn;
      alarm.classList.toggle('is-on', alarmOn);
      (alarm.lastElementChild as HTMLElement).textContent = sc.alarm?.tekst ?? '';
      hrBox.classList.toggle('is-alarm', alarmOn);
    }
    if (sc.spo2 !== undefined) {
      const sp = sc.spo2 === null || (alarmOn && !qs.some((e) => e.tag === 'qrs')) ? '<small>---</small>' : `${sc.spo2}<small>%</small>`;
      if (sp !== ostatnie.spo2) { spoDd.innerHTML = sp; ostatnie.spo2 = sp; }
    }
  }

  /** Dźwięki z odcinka (prev, t]: ton każdego QRS (monitor liczy zespoły, więc w PEA też piszczy), iglice, alarm. */
  function dzwiek(prev: number, t: number) {
    if (!snd.aktywny()) return;
    const spo2 = o.pytanie ? null : sc.spo2;
    for (const e of strip.inRange(prev, t)) {
      if (e.at <= prev || e.at > t) continue;
      if (e.kind === 'QRS') snd.qrs(spo2);
      else if (e.kind === 'spike') snd.iglica();
    }
    // alarm wysokiego priorytetu (VF, VT, asystolia); w pytaniu cisza, żeby nie podpowiadał
    if (!o.pytanie && sc.alarm && t >= (sc.alarm.od ?? 0) && t >= alarmNext) {
      const d = snd.alarm('wysoki');
      if (d) alarmNext = t + d + 1.9;
    }
  }

  // zegar
  let zegarS = 0;
  const ustawZegar = () => {
    const [g = 3, m = 12, s = 40] = (sc.zegar ?? '03:12:40').split(':').map(Number);
    zegarS = g * 3600 + m * 60 + s;
  };
  const pokazZegar = () => {
    const t = Math.floor(zegarS + now);
    const p = (v: number) => String(v).padStart(2, '0');
    const txt = `${p(Math.floor(t / 3600) % 24)}:${p(Math.floor(t / 60) % 60)}:${p(t % 60)}`;
    if (zegar.textContent !== txt) zegar.textContent = txt;
  };

  function start(nowy: Scenariusz) {
    sc = nowy;
    alarmNext = 0;
    strip.clear(); strip.backgrounds.length = 0;
    gen = sc.rytm();
    // pełny ekran od razu: najpierw szerokość ekranu w sekundach, potem przewinięcie o prawie cały obieg
    const w = Math.max(200, Math.round(traces.clientWidth || parent.clientWidth || 600));
    sec = Math.max(sc.okno ?? 5, Math.min(8, w / 112));
    now = poczatek();
    gen(strip, now + 3);
    ustawZegar();
    opisz(); uklad(); parametry(); pokazZegar();
  }

  const ro = new ResizeObserver(() => { const w = Math.round(traces.clientWidth); if (Math.abs(w - W) > 1) uklad(); });
  ro.observe(traces);

  const lp = loop(el, (_t, dt) => {
    if (isPaused || !W) return;
    const prev = now;
    now += dt;
    gen(strip, now + 3);
    strip.prune(now - sec - 8);
    dzwiek(prev, now);
    const s0 = Math.floor(prev / sec) * sec, s1 = Math.floor(now / sec) * sec;
    if (s1 !== s0) {
      rysujOdcinek(lastX, W, s0);
      lastY = [];
      lastX = 0;
    }
    const xNow = (now - s1) * pps;
    if (xNow > lastX) { rysujOdcinek(lastX, xNow, s1); lastX = xNow; }
    parametry(); pokazZegar();
  });

  sec = 5;
  start(sc);
  pauzaBtn?.addEventListener('click', () => { isPaused = !isPaused; pasek(); if (!isPaused) pelne(); });

  return {
    el, strip,
    now: () => now,
    setPaused: (p) => { isPaused = p; pasek(); if (!p) pelne(); },
    paused: () => isPaused,
    ustaw: (s) => start(s),
    destroy: () => { lp.stop(); ro.disconnect(); el.remove(); },
  };
}

/** Przycisk Pauza / Graj dla kardiomonitora. */
export function graj(m: Kardiomonitor): HTMLButtonElement {
  const b = h('button', { class: 'hw-chip hw-chip--sm', type: 'button' });
  // nazwa = widoczny tekst; stan przez aria-pressed (wciśnięty = zatrzymany)
  const paint = () => { b.textContent = m.paused() ? 'Graj' : 'Pauza'; b.setAttribute('aria-pressed', m.paused() ? 'true' : 'false'); };
  b.addEventListener('click', () => { m.setPaused(!m.paused()); paint(); });
  paint();
  return b;
}

export type { MountFn };
