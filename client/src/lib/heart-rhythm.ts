/**
 * Wspólny rytm serca marki helloEKG.
 *
 * Hero3DHeart i HeroEKGStrip dzielą zegar (performance.now modulo cykl), więc
 * puls chmury punktów i zapis P-QRS-T pod nim biegną w tej samej fazie. Stała
 * MUSI być jedna — wcześniej była skopiowana do obu plików i utrzymywana
 * komentarzem „musi być identyczne", co rozjechałoby się przy pierwszej zmianie.
 */

/**
 * Tempo WIZUALNE cyklu. Fizjologiczne 72 BPM (0,83 s) jest zbyt szybkie, żeby
 * prześledzić sekwencję SA → AV → QRS → T, dlatego cykl jest zwolniony ~3×
 * dla czytelności dydaktycznej.
 */
export const CYCLE_SECONDS = 2.6;

/** Faza cyklu (0..1) dla podanego czasu w sekundach z performance.now(). */
export function cyclePhase(seconds: number): number {
  return ((seconds % CYCLE_SECONDS) + CYCLE_SECONDS) % CYCLE_SECONDS / CYCLE_SECONDS;
}
