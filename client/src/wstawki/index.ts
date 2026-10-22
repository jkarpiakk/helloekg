/**
 * Rejestr wstawek interaktywnych. Każda ładuje się dopiero, gdy jest potrzebna (osobny plik po zbudowaniu).
 * Lista nazw i podpisy żyją w `@helloekg/shared` (WSTAWKI), bo parser treści musi je znać.
 */
import type { WstawkaId } from '@helloekg/shared';
import type { MountFn } from './core/ui.js';

export const LOADERS: Record<WstawkaId, () => Promise<MountFn>> = {
  'droga-impulsu': () => import('./droga-impulsu.js').then((m) => m.mountDrogaImpulsu),
  'kompas-osi': () => import('./kompas-osi.js').then((m) => m.mountKompasOsi),
  'mapa-zawalu': () => import('./mapa-zawalu.js').then((m) => m.mountMapaZawalu),
  'wezel-av': () => import('./wezel-av.js').then((m) => m.mountWezelAv),
  'petla-qrs': () => import('./petla-qrs.js').then((m) => m.mountPetlaQrs),
  'pomiary': () => import('./pomiary.js').then((m) => m.mountPomiary),
  'stymulator': () => import('./stymulator.js').then((m) => m.mountStymulator),
  'adenozyna': () => import('./adenozyna.js').then((m) => m.mountAdenozyna),
  'potas': () => import('./potas.js').then((m) => m.mountPotas),
  'elektrody': () => import('./elektrody.js').then((m) => m.mountElektrody),
  'nzk': () => import('./nzk.js').then((m) => m.mountNzk),
  'kardiomonitor': () => import('./kardiomonitor.js').then((m) => m.mountKardiomonitor),
};

/** Podpina wstawkę do elementu. Zwraca sprzątanie (działa także, gdy ładowanie jeszcze trwa). */
export function mountWstawka(host: HTMLElement, id: WstawkaId, opts: Record<string, string> = {}): () => void {
  let dead = false;
  let cleanup: (() => void) | null = null;
  const load = LOADERS[id];
  if (!load) { host.textContent = `Nieznana wstawka: ${id}`; return () => {}; }
  load().then((mount) => { if (!dead) cleanup = mount(host, opts); }).catch((e: unknown) => {
    host.textContent = `Nie udało się wczytać wstawki „${id}”. Odśwież stronę.`;
    console.error(e);
  });
  return () => { dead = true; cleanup?.(); };
}
