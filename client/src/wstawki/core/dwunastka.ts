/**
 * Widok 12 odprowadzeń (i dodatkowych) na papierze: po jednym pobudzeniu na odprowadzenie,
 * w układzie jak na wydruku (I, II, III / aVR, aVL, aVF / V1–V3 / V4–V6).
 * Każde pole pokazuje P–QRS–T jednego pobudzenia, liczone z modelu.
 */
import { C, h, paper, surface, trace, type Surface } from './ui.js';
import { volt, type Beat, type LeadName } from './model.js';

export interface TwelveOpts {
  leads?: LeadName[][];
  /** Okno czasu wokół QRS [s]: od −0,22 (przed P) do 0,5 (po T). */
  t0?: number; t1?: number;
  /** Ile mV mieści się w połowie wysokości pola. */
  halfMv?: number;
  label: string;
  /**
   * Wyróżnienie pola: 'up' — patologia w tym odprowadzeniu (np. uniesienie ST, czerwień),
   * 'down' — obraz przeciwstronny (bursztyn), 'focus' — „tu patrz” (zieleń impulsu).
   */
  mark?: (lead: LeadName) => 'up' | 'down' | 'focus' | null;
  /** Kliknięcie w pole odprowadzenia. */
  onPick?: (lead: LeadName) => void;
}

export const LAYOUT_12: LeadName[][] = [['I', 'aVR', 'V1', 'V4'], ['II', 'aVL', 'V2', 'V5'], ['III', 'aVF', 'V3', 'V6']];

export function twelve(parent: HTMLElement, getBeat: (lead: LeadName) => Beat, o: TwelveOpts): { el: HTMLElement; redraw(): void; destroy(): void } {
  const rows = o.leads ?? LAYOUT_12;
  const cols = Math.max(...rows.map((r) => r.length));
  const el = h('div', { class: 'hw-screen' });
  parent.append(el);
  const t0 = o.t0 ?? -0.22, t1 = o.t1 ?? 0.52;
  const hit: Array<{ x: number; y: number; w: number; h: number; lead: LeadName }> = [];

  let S: Surface | null = null;
  const draw = () => {
    if (!S) return;
    const { ctx, w, h: H } = S;
    if (!w) return;
    ctx.clearRect(0, 0, w, H);
    const cw = w / cols, ch = H / rows.length;
    // kratka w milimetrach liczona z czasu: szerokość pola = (t1 − t0) s × 25 mm/s
    const mm = cw / ((t1 - t0) * 25);
    paper(ctx, 0, 0, w, H, mm, { bg: C.screen });
    hit.length = 0;
    rows.forEach((row, r) => row.forEach((lead, c) => {
      const x = c * cw, y = r * ch, y0 = y + ch * 0.56;
      const pxPerMv = Math.min(mm * 10, (ch * 0.5) / (o.halfMv ?? 1.5));
      const b = getBeat(lead);
      const m = o.mark?.(lead) ?? null;
      if (m) {
        ctx.fillStyle = m === 'up' ? 'rgba(226,75,74,.10)' : m === 'down' ? 'rgba(232,176,74,.08)' : 'rgba(62,230,168,.08)';
        ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2);
      }
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, cw, ch); ctx.clip();
      trace(ctx, (t) => volt(b, lead, t), { x: x + 4, w: cw - 8, t0, t1, y0, pxPerMv, color: C.puls, width: 1.5 });
      ctx.restore();
      ctx.fillStyle = m === 'up' ? C.alarm : m === 'down' ? C.warn : m === 'focus' ? C.puls : C.txt2;
      ctx.font = `500 ${Math.max(10, Math.min(13, cw * 0.075))}px ${C.fontMono}`;
      ctx.fillText(lead, x + 7, y + 15);
      ctx.strokeStyle = C.line2; ctx.lineWidth = 1;
      if (c > 0) { ctx.beginPath(); ctx.moveTo(Math.round(x) + 0.5, y); ctx.lineTo(Math.round(x) + 0.5, y + ch); ctx.stroke(); }
      if (r > 0) { ctx.beginPath(); ctx.moveTo(x, Math.round(y) + 0.5); ctx.lineTo(x + cw, Math.round(y) + 0.5); ctx.stroke(); }
      hit.push({ x, y, w: cw, h: ch, lead });
    }));
  };
  const sf = surface(el, { ratio: (rows.length * 0.62) / cols * 1.55, min: 150, max: 460, label: o.label }, (x) => { S = x; draw(); });
  if (o.onPick) {
    sf.s.canvas.style.cursor = 'pointer';
    sf.s.canvas.addEventListener('click', (e) => {
      const r = sf.s.canvas.getBoundingClientRect();
      const x = e.clientX - r.left, y = e.clientY - r.top;
      const f = hit.find((q) => x >= q.x && x < q.x + q.w && y >= q.y && y < q.y + q.h);
      if (f) o.onPick?.(f.lead);
    });
  }
  return { el, redraw: draw, destroy: () => sf.destroy() };
}
