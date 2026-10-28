/**
 * Kardiomonitor — wstawka do wykładów i pytań.
 *
 * Opcje: scenariusz=<id> (lista w `kardiomonitor.scenariusze.ts`), wariant=kompakt,
 * pytanie=tak (w treści pytania: bez nazwy rozpoznania, bez opisu, bez tekstu alarmu i bez kolorów progów ST,
 * żeby nie zdradzać odpowiedzi), pytanie=odkryte (po sprawdzeniu odpowiedzi: ten sam monitor z nazwą i alarmem).
 * Bez scenariusza pokazuje wszystkie scenariusze w grupach (galeria).
 */
import { chips, h, shell, type WstawkaOpts } from './core/ui.js';
import { graj, kardiomonitor, type Scenariusz } from './core/kardiomonitor.js';
import { WSZYSTKIE, scenariusz } from './kardiomonitor.scenariusze.js';

const BEZ_GRUPY = 'Rytm i częstość';

/** Scenariusze pogrupowane w kolejności pierwszego wystąpienia grupy. */
export function wGrupach(lista: Scenariusz[] = WSZYSTKIE): Array<{ grupa: string; sc: Scenariusz[] }> {
  const out: Array<{ grupa: string; sc: Scenariusz[] }> = [];
  for (const s of lista) {
    const g = s.grupa ?? BEZ_GRUPY;
    const f = out.find((x) => x.grupa === g);
    if (f) f.sc.push(s); else out.push({ grupa: g, sc: [s] });
  }
  return out;
}

export function mountKardiomonitor(host: HTMLElement, opts: WstawkaOpts): () => void {
  const wybrany = opts.scenariusz ? scenariusz(opts.scenariusz) : undefined;
  const kompakt = opts.wariant === 'kompakt';

  if (wybrany && kompakt) {
    // sam monitor, bez nagłówka (np. w miejscu dawnego `::ekg`)
    const box = h('div', { class: 'hw', style: 'padding:0;border:0;background:transparent;margin:24px 0' });
    host.replaceChildren(box);
    const m = kardiomonitor(box, wybrany, { wariant: 'kompakt' });
    return () => { m.destroy(); host.replaceChildren(); };
  }

  if (wybrany && (opts.pytanie === 'tak' || opts.pytanie === 'odkryte')) {
    const odkryte = opts.pytanie === 'odkryte';
    const box = h('div', { class: 'hw', style: 'padding:0;border:0;background:transparent;margin:16px 0' });
    host.replaceChildren(box);
    const sc = odkryte ? wybrany : {
      ...wybrany,
      nazwa: 'pacjent do oceny',
      opis: `Kardiomonitor pacjenta, odprowadzenia ${wybrany.odprowadzenia.join(' i ')}. Oceń zapis i odpowiedz na pytanie.`,
      stNeutralne: true,
      alarm: wybrany.alarm ? { ...wybrany.alarm, tekst: 'Alarm' } : undefined,
    };
    const m = kardiomonitor(box, sc, { pytanie: !odkryte });
    box.append(h('div', { class: 'hw-row', style: 'margin-top:8px;align-items:center' },
      graj(m),
      h('span', { class: 'hw-note', text: odkryte ? `Na monitorze: ${wybrany.nazwa.charAt(0).toLowerCase()}${wybrany.nazwa.slice(1)}.` : 'Zatrzymaj zapis, żeby zmierzyć odstępy w kratkach.' })));
    return () => { m.destroy(); host.replaceChildren(); };
  }

  const sc0 = wybrany ?? WSZYSTKIE[0]!;
  const { body, live } = shell(host, {
    label: 'Wstawka · kardiomonitor',
    title: wybrany ? wybrany.nazwa : 'Kardiomonitor: rytmy i sytuacje z wykładów',
    intro: wybrany ? wybrany.opis : 'Wybierz scenariusz. Monitor liczy częstość z zespołów QRS, a fala SpO₂ pojawia się tylko wtedy, gdy pobudzenie daje tętno.',
  });
  const box = h('div', {});
  const m = kardiomonitor(box, sc0, { przyciskDzwieku: false });
  const opis = h('p', { class: 'hw-why', text: sc0.opis });
  const sterowanie = h('div', { class: 'hw-row' }, graj(m));
  if (!wybrany) {
    // chipy w grupach: wybór działa jak jedna grupa przełączników na całej liście
    const grupy = wGrupach();
    const zestawy: Array<ReturnType<typeof chips<string>>> = [];
    const wybierz = (v: string) => {
      const s = scenariusz(v);
      if (!s) return;
      zestawy.forEach((z) => z.set(v));
      m.ustaw(s); opis.textContent = s.opis; live(`${s.nazwa}. ${s.opis}`);
    };
    const lista = h('div', { class: 'hw-grid', style: 'gap:12px' });
    for (const g of grupy) {
      const z = chips(g.sc.map((s) => ({ v: s.id, label: s.nazwa })), sc0.id, wybierz, { label: g.grupa, small: true });
      zestawy.push(z);
      lista.append(h('div', { class: 'hw-grid', style: 'gap:6px' }, h('p', { class: 'hw-label', text: `${g.grupa} · ${g.sc.length}` }), z.el));
    }
    body.append(lista);
  }
  body.append(box, sterowanie, wybrany ? h('span', {}) : opis);
  return () => { m.destroy(); host.replaceChildren(); };
}
