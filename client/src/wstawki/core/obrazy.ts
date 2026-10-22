/**
 * Ilustracje marki (rastry z biblioteki GPT, te same co w statycznych grafikach studia) dla wstawek.
 * Źródła: ~/Claude/Projects/JK Enterprise/grafiki_studio/gpt_raw/ → WebP w `../obrazy/` (przycięte, ≤ 160 KB).
 *
 * Zasada marki: raster to scenografia bez tekstu; fakty (drogi, punkty, krzywe, podpisy) rysuje kod
 * NA rastrze, w jego współrzędnych pikselowych (`w` × `h`).
 *
 * Tła rastrów są prawie czarne (#0A0E12–#0C0F13). Na panelu wstawki stapiają się z nim dzięki
 * `mix-blend-mode: lighten` (klasa `hw-raster`), więc nie widać prostokąta obrazu.
 */
import { h, s } from './ui.js';
import sercePrzod from '../obrazy/serce-przod.webp';
import sylwetka from '../obrazy/sylwetka.webp';
import przekrojKlatki from '../obrazy/przekroj-klatki.webp';
import kamera from '../obrazy/kamera.webp';
import odzSpokojny from '../obrazy/odzwierny-spokojny.webp';
import odzZmeczony from '../obrazy/odzwierny-zmeczony.webp';
import odzSenny from '../obrazy/odzwierny-senny.webp';
import odzRozbudzony from '../obrazy/odzwierny-rozbudzony.webp';
import bramaZamknieta from '../obrazy/brama-zamknieta.webp';
import bramaOtwarta from '../obrazy/brama-otwarta.webp';
import bramaUchylona from '../obrazy/brama-uchylona.webp';
import bramaSkrot from '../obrazy/brama-skrot.webp';
import orkiestraGra from '../obrazy/orkiestra-gra.webp';
import dyrygentMilczy from '../obrazy/dyrygent-milczy.webp';
import orkiestraCisza from '../obrazy/orkiestra-cisza.webp';
import orkiestraChaos from '../obrazy/orkiestra-chaos.webp';
import strazak from '../obrazy/strazak.webp';
import autostrady from '../obrazy/autostrady.webp';
import autostradaObjazd from '../obrazy/autostrada-objazd.webp';
import autostrada1 from '../obrazy/autostrada-1-zamkniety.webp';
import autostrada2 from '../obrazy/autostrada-2-zamkniete.webp';

export interface Obraz { url: string; w: number; h: number; opis: string }

export const OBRAZY = {
  /** Serce od przodu (powierzchnia mostkowo-żebrowa), prawa strona pacjenta po lewej, koniuszek w dół w prawo. Szare naczynia wieńcowe widoczne. */
  sercePrzod: { url: sercePrzod, w: 1000, h: 1000, opis: 'Serce widziane od przodu' },
  /** Sylwetka od przodu, półprzezroczysta skóra z widocznym mostkiem i żebrami; nadgarstki i kostki odsłonięte. */
  sylwetka: { url: sylwetka, w: 900, h: 1200, opis: 'Sylwetka człowieka od przodu' },
  /** Przekrój poprzeczny klatki widziany od stóp: mostek u góry, kręgosłup u dołu, prawa strona pacjenta po lewej (jak w GFX-0039). */
  przekrojKlatki: { url: przekrojKlatki, w: 1200, h: 900, opis: 'Przekrój poprzeczny klatki piersiowej widziany od stóp' },
  /** Kamera (ikona odprowadzenia). */
  kamera: { url: kamera, w: 300, h: 174, opis: 'Kamera' },
  odzwiernySpokojny: { url: odzSpokojny, w: 900, h: 329, opis: 'Odźwierny spokojnie stoi przy otwartej bramie' },
  odzwiernyZmeczony: { url: odzZmeczony, w: 900, h: 333, opis: 'Zmęczony odźwierny opiera się o bramę' },
  odzwiernySenny: { url: odzSenny, w: 900, h: 337, opis: 'Senny odźwierny oparty o mur obok bramy' },
  odzwiernyRozbudzony: { url: odzRozbudzony, w: 900, h: 322, opis: 'Rozbudzony odźwierny przy otwartej bramie' },
  bramaZamknieta: { url: bramaZamknieta, w: 900, h: 329, opis: 'Zamknięta brama, odźwierny obok' },
  bramaOtwarta: { url: bramaOtwarta, w: 900, h: 285, opis: 'Otwarta brama w murze' },
  bramaUchylona: { url: bramaUchylona, w: 900, h: 457, opis: 'Uchylona brama w murze' },
  bramaSkrot: { url: bramaSkrot, w: 900, h: 454, opis: 'Brama i wybity w murze skrót obok niej' },
  orkiestraGra: { url: orkiestraGra, w: 900, h: 542, opis: 'Dyrygent prowadzi orkiestrę' },
  dyrygentMilczy: { url: dyrygentMilczy, w: 900, h: 490, opis: 'Dyrygent stoi bez ruchu, orkiestra czeka' },
  orkiestraCisza: { url: orkiestraCisza, w: 900, h: 545, opis: 'Dyrygent z uniesioną batutą, orkiestra w ciszy' },
  orkiestraChaos: { url: orkiestraChaos, w: 900, h: 542, opis: 'Muzycy grają każdy po swojemu' },
  strazak: { url: strazak, w: 900, h: 693, opis: 'Dyrygent i strażak obok siebie' },
  autostrady: { url: autostrady, w: 900, h: 600, opis: 'Rozgałęziona sieć autostrad z lotu ptaka' },
  autostradaObjazd: { url: autostradaObjazd, w: 900, h: 600, opis: 'Sieć autostrad z zamkniętą jezdnią' },
  autostrada1: { url: autostrada1, w: 900, h: 600, opis: 'Trzy pasy autostrady, jeden zamknięty' },
  autostrada2: { url: autostrada2, w: 900, h: 600, opis: 'Trzy pasy autostrady, dwa zamknięte' },
} as const satisfies Record<string, Obraz>;
export type ObrazId = keyof typeof OBRAZY;

/** Raster jako zwykły obraz (np. scena metafory nad zapisem). */
export function scena(id: ObrazId, o: { alt?: string; maxH?: number } = {}): HTMLImageElement {
  const ob = OBRAZY[id];
  return h('img', {
    class: 'hw-raster', src: ob.url, width: ob.w, height: ob.h, alt: o.alt ?? ob.opis, loading: 'lazy', decoding: 'async',
    style: `display:block;width:100%;height:auto;${o.maxH ? `max-height:${o.maxH}px;object-fit:contain;` : ''}`,
  });
}

/**
 * Raster jako tło SVG: zwraca <svg viewBox="0 0 w h"> z obrazem na całości, żeby nakładki
 * (ścieżki, punkty, podpisy) rysować w pikselach rastra.
 */
export function svgNaRastrze(id: ObrazId, o: { label: string; crop?: { x: number; y: number; w: number; h: number } }): { svg: SVGSVGElement; img: SVGImageElement; nakladka: SVGGElement } {
  const ob = OBRAZY[id];
  const vb = o.crop ?? { x: 0, y: 0, w: ob.w, h: ob.h };
  const svg = s('svg', { viewBox: `${vb.x} ${vb.y} ${vb.w} ${vb.h}`, class: 'hw-svg', role: 'img', 'aria-label': o.label, style: 'touch-action:manipulation' });
  const img = s('image', { href: ob.url, x: 0, y: 0, width: ob.w, height: ob.h, preserveAspectRatio: 'xMidYMid meet', class: 'hw-raster' }, svg);
  const nakladka = s('g', {}, svg);
  return { svg, img, nakladka };
}

/** Zamiana sceny z przenikaniem (dwie warstwy, bez morfingu). */
export function scenaPrzenikana(start: ObrazId, o: { maxH?: number } = {}): { el: HTMLElement; set(id: ObrazId): void } {
  const el = h('div', { style: 'position:relative;display:grid' });
  let cur = scena(start, o);
  cur.style.gridArea = '1/1';
  el.append(cur);
  return {
    el,
    set(id) {
      if (cur.getAttribute('src') === OBRAZY[id].url) return;
      const next = scena(id, o);
      next.style.gridArea = '1/1'; next.style.opacity = '0'; next.style.transition = 'opacity .5s cubic-bezier(.2,.7,.2,1)';
      el.append(next);
      const old = cur; cur = next;
      requestAnimationFrame(() => requestAnimationFrame(() => { next.style.opacity = '1'; old.style.transition = 'opacity .5s'; old.style.opacity = '0'; }));
      setTimeout(() => old.remove(), 600);
    },
  };
}
