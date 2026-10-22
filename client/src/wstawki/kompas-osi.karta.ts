import type { Karta } from './core/zrodla.js';

export const KARTA: Karta = {
  id: 'kompas-osi',
  miejsca: [
    { wyklad: 'S1_03', plansza: 'Czym jest oś elektryczna' },
    { wyklad: 'S1_03', plansza: 'Dokładniej: odprowadzenie izoelektryczne' },
    { wyklad: 'S1_03', plansza: 'Co oznaczają odchylenia osi' },
  ],
  zrodla: [
    { wartosc: 'Osie odprowadzeń: I 0°, II +60°, III +120°, aVF +90°, aVL −30°, aVR −150°', wyklad: 'S1_03', plansza: 'Czym jest oś elektryczna', cytat: 'Dodatni biegun odprowadzenia I wyznacza 0°, II odpowiada +60°, III +120°, aVF +90°, aVL −30°, a aVR −150°.' },
    { wartosc: 'Reguła kierunku: ku dodatniemu biegunowi QRS dodatni, od niego ujemny', wyklad: 'S1_03', plansza: 'Czym jest oś elektryczna', cytat: 'Gdy wypadkowy wektor biegnie ku dodatniemu biegunowi odprowadzenia, QRS jest przeważnie dodatni; gdy biegnie od niego, przeważnie ujemny.' },
    { wartosc: 'Prostopadle: QRS równofazowy', wyklad: 'S1_03', plansza: 'Czym jest oś elektryczna', cytat: 'Przy kierunku prostopadłym dodatnia i ujemna część zespołu w przybliżeniu się równoważą.' },
    { wartosc: 'Oś prawidłowa −30° do +90°', wyklad: 'S1_03', plansza: 'Co oznaczają odchylenia osi', cytat: 'Oś prawidłowa: od −30° do +90°, razem z wartościami granicznymi.' },
    { wartosc: 'Odchylenie w lewo: poniżej −30° do −90° włącznie', wyklad: 'S1_03', plansza: 'Co oznaczają odchylenia osi', cytat: 'Odchylenie w lewo (LAD): poniżej −30° do −90° włącznie.' },
    { wartosc: 'Odchylenie w prawo: powyżej +90° do +180° włącznie', wyklad: 'S1_03', plansza: 'Co oznaczają odchylenia osi', cytat: 'Odchylenie w prawo (RAD): powyżej +90° do +180° włącznie.' },
    { wartosc: 'Oś skrajna: między −90° a −180°', wyklad: 'S1_03', plansza: 'Co oznaczają odchylenia osi', cytat: 'Oś skrajna („północno-zachodnia”): między −90° a −180°, bez tych wartości granicznych.' },
    { wartosc: 'Blok przedniej wiązki: oś −45° do −90°', wyklad: 'S1_03', plansza: 'Co oznaczają odchylenia osi', cytat: 'w tym bloku oś zwykle mieści się od −45° do −90°.' },
  ],
  noweMorfologie: [
    'Zespoły QRS liczone z modelu wektorowego (siły przegrodowe, główne i końcowe). Przy −60° model daje qR w aVL i rS w II, III i aVF.',
  ],
  doOkaJK: [
    'Przykład „Odchylenie w prawo +120°” i „Skrajna −150°”: kształt zespołów tylko z obrotu osi, bez innych cech przerostu.',
    'Przykład „Blok przedniej wiązki lewej odnogi”: najpierw obrót wektora z prawidłowym zespołem, potem przenikanie paneli (0,3 s) do morfologii z modelu.',
    'Tolerancja w ćwiczeniu („Sprawdź się”): „Dobrze” do 15° i ta sama kategoria, „Blisko” do 30°.',
    'Po puszczeniu wektor ma pęd; w trybie „Ucz się” zatrzaskuje się na znaczniku co 30°, gdy rzut ruchu wypada do 6° od niego. W „Sprawdź się” bez zatrzasku.',
    'Napis kategorii w kole zmieniony z „NORMA” na „PRAWIDŁOWA” (jak „oś prawidłowa” w wykładzie i w odczycie).',
  ],
  stanKanoniczny: 'Wektor +60°, wybrane odprowadzenie II, tryb „Ucz się”.',
};
