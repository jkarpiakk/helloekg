/**
 * „Wybierz zapis” (`image_choice`): karty z zapisami EKG, kursant wybiera właściwy.
 *
 * TEN SAM komponent w studiu (podgląd kursanta) i na becie: kurs dostaje kopię katalogu
 * `web/src/wybor-zapisu` (scripts/sync-wstawki.sh w repo kursu). Nie kopiuje się tylko
 * `zrodlo.ts` — przejściówka do logiki (`@helloekg/shared` w studiu, `@shared/wyborZapisu` w kursie).
 *
 * Komponent niczego nie losuje ani nie ocenia: dostaje opcje już w kolejności podejścia,
 * a wynik pokazuje z pól `isCorrect` / `explanationMd`, które host odsłania po sprawdzeniu.
 * Kolory bierze ze zmiennych `--wz-*`, które ustawia host. Powiększenie też należy do hosta
 * (w kursie lightbox z przybliżaniem palcami).
 */
import { useId } from 'react';
import './wybor-zapisu.css';
import { altZapisu, literaZapisu, type OpcjaZapisu } from './zrodlo';

export interface WyborZapisuProps {
  /** Opcje w kolejności tego podejścia. Litery nadawane są według tej kolejności. */
  opcje: OpcjaZapisu[];
  wybrane: string[];
  onZmiana: (ids: string[]) => void;
  /** Wiele poprawnych: karta przełącza się, zamiast zastępować wybór. */
  wielokrotny: boolean;
  zablokowane: boolean;
  /** Po sprawdzeniu: kolory, opisy pod kartami i pełny alt. */
  pokazWynik: boolean;
  /** Adres obrazu opcji; brak = zapis bez pliku (w studiu: ostrzeżenie, w kursie pytanie nie wchodzi). */
  src: (o: OpcjaZapisu) => string | undefined;
  /** Markdown → bezpieczny HTML (każdy host ma własny sanitizer). */
  md: (tekst: string) => string;
  /** Pełny ekran z przybliżaniem. Nie zmienia zaznaczenia. */
  onPowieksz: (src: string, alt: string, zrodlo: HTMLElement) => void;
}

export function WyborZapisu({
  opcje, wybrane, onZmiana, wielokrotny, zablokowane, pokazWynik, src, md, onPowieksz,
}: WyborZapisuProps) {
  const idPodpowiedzi = useId();
  const wybierz = (id: string) => {
    if (zablokowane) return;
    if (!wielokrotny) {
      if (wybrane.length !== 1 || wybrane[0] !== id) onZmiana([id]);
      return;
    }
    onZmiana(wybrane.includes(id) ? wybrane.filter((x) => x !== id) : [...wybrane, id]);
  };

  return (
    <div className="wz" data-testid="wybor-zapisu">
      {!pokazWynik ? (
        <p className="wz-podpowiedz" id={idPodpowiedzi}>
          {wielokrotny ? 'Wybierz wszystkie pasujące zapisy.' : 'Wybierz jeden zapis.'} Lupa powiększa zapis.
        </p>
      ) : null}
      <ul className="wz-siatka" aria-describedby={pokazWynik ? undefined : idPodpowiedzi}>
        {opcje.map((o, i) => {
          const litera = literaZapisu(i);
          const wybrany = wybrane.includes(o.id);
          const poprawny = pokazWynik && o.isCorrect;
          const bledny = pokazWynik && wybrany && !o.isCorrect;
          const przygaszony = pokazWynik && !poprawny && !bledny;
          const alt = altZapisu(o, i, pokazWynik);
          const adres = src(o);
          return (
            <li
              key={o.id}
              className={[
                'wz-karta',
                wybrany && !pokazWynik ? 'is-wybrany' : '',
                poprawny ? 'is-poprawny' : '',
                bledny ? 'is-bledny' : '',
                przygaszony ? 'is-przygaszony' : '',
              ].filter(Boolean).join(' ')}
              data-testid="wz-karta"
              data-litera={litera}
              data-opcja={o.id}
            >
              <button
                type="button"
                className="wz-wybor"
                aria-pressed={wybrany}
                disabled={zablokowane}
                onClick={() => wybierz(o.id)}
                data-testid="wz-wybor"
              >
                <span className="wz-litera" aria-hidden>{litera}</span>
                {adres ? (
                  <img className="wz-obraz" src={adres} alt={alt} loading="lazy" decoding="async" draggable={false} />
                ) : (
                  <span className="wz-brak" role="img" aria-label={alt}>Brak pliku zapisu</span>
                )}
                <span className="wz-znak" aria-hidden>
                  {poprawny ? <Ptaszek /> : bledny ? <Krzyzyk /> : null}
                </span>
                <span className="wz-sr">
                  {poprawny ? ', poprawny zapis' : ''}
                  {bledny ? ', twój wybór, błędny' : ''}
                  {!pokazWynik && wybrany ? ', wybrany' : ''}
                </span>
              </button>
              {adres ? (
                <button
                  type="button"
                  className="wz-lupa"
                  aria-label={`Powiększ zapis ${litera}`}
                  title="Powiększ"
                  onClick={(e) => onPowieksz(adres, alt, e.currentTarget.parentElement ?? e.currentTarget)}
                  data-testid="wz-powieksz"
                >
                  <Lupa />
                </button>
              ) : null}
              {pokazWynik && o.explanationMd?.trim() ? (
                <div className="wz-opis" data-testid="wz-opis" dangerouslySetInnerHTML={{ __html: md(o.explanationMd) }} />
              ) : null}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Lupa() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5M11 8v6M8 11h6" />
    </svg>
  );
}
function Ptaszek() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
function Krzyzyk() {
  return (
    <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
