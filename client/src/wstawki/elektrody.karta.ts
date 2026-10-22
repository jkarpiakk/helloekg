import type { Karta } from './core/zrodla.js';

const ZLE = 'Gdy elektrody są źle podłączone';
const DZ = 'Dziesięć elektrod, dwanaście odprowadzeń';
const EIN = 'Odprowadzenia dwubiegunowe Einthovena: I, II, III';
const GOL = 'Odprowadzenia wzmocnione: aVR, aVL, aVF';

export const KARTA: Karta = {
  id: 'elektrody',
  miejsca: [
    { wyklad: 'S1_01', plansza: ZLE },
    { wyklad: 'S1_01', plansza: EIN },
  ],
  zrodla: [
    /* jak aparat liczy odprowadzenia */
    { wartosc: 'Cztery elektrody kończynowe: prawa i lewa ręka, prawa i lewa noga', wyklad: 'S1_01', plansza: DZ, cytat: 'Cztery elektrody umieszczamy na kończynach (prawa i lewa ręka, prawa i lewa noga)' },
    { wartosc: 'Prawa noga (PN) nie tworzy własnego odprowadzenia', wyklad: 'S1_01', plansza: DZ, cytat: 'Elektroda na prawej nodze nie tworzy własnego odprowadzenia.' },
    { wartosc: 'Odprowadzenia kończynowe z trzech potencjałów: PR, LR, LN', wyklad: 'S1_01', plansza: DZ, cytat: 'Do wyznaczenia wszystkich odprowadzeń kończynowych wystarczają mu trzy potencjały: prawej ręki, lewej ręki i lewej nogi.' },
    { wartosc: 'V1-V6 względem średniej PR, LR, LN (końcówka Wilsona)', wyklad: 'S1_01', plansza: DZ, cytat: 'obliczanym ze średniej potencjałów prawej ręki, lewej ręki i lewej nogi' },
    { wartosc: 'Zamiana dwóch przewodów kończynowych zmienia kilka odprowadzeń naraz', wyklad: 'S1_01', plansza: DZ, cytat: 'Zamiana dwóch przewodów kończynowych miesza natomiast kilka odprowadzeń naraz' },
    { wartosc: 'I = LR − PR, II = LN − PR, III = LN − LR; skróty LR i PR', wyklad: 'S1_01', plansza: EIN, cytat: 'Odprowadzenie I rejestruje różnicę między lewą a prawą ręką (LR względem PR), II między lewą nogą a prawą ręką, a III między lewą nogą a lewą ręką.' },
    { wartosc: 'Kolejność odejmowania w I', wyklad: 'S1_01', plansza: EIN, cytat: 'W odprowadzeniu I aparat odejmuje potencjał prawej ręki od potencjału lewej ręki' },
    { wartosc: 'Prawo Einthovena II = I + III (sprawdza test)', wyklad: 'S1_01', plansza: EIN, cytat: 'prawem Einthovena: II = I + III' },
    { wartosc: 'Po zamianie te same działania matematyczne', wyklad: 'S1_01', plansza: EIN, cytat: 'Po zamianie elektrod aparat nadal tworzy odprowadzenia przez te same działania matematyczne' },
    { wartosc: 'Widok od przodu: lewa strona pacjenta po prawej', wyklad: 'S1_01', plansza: EIN, cytat: 'Gdy stoisz naprzeciwko niego, jego lewa strona znajduje się po twojej prawej' },
    { wartosc: 'aVR = PR − (LR + LN)/2, aVL = LR − (PR + LN)/2, aVF = LN − (PR + LR)/2', wyklad: 'S1_01', plansza: GOL, cytat: 'W aVR aparat porównuje prawą rękę ze średnią potencjałów lewej ręki i lewej nogi, w aVL lewą rękę ze średnią potencjałów prawej ręki i lewej nogi, a w aVF lewą nogę ze średnią potencjałów obu rąk.' },
    { wartosc: 'Kierunki miejsc: PR −150°, LR −30°, nogi +90° (tylko w obliczeniach)', wyklad: 'S1_01', plansza: GOL, cytat: 'aVL patrzy w lewo i ku górze (−30°), aVF prosto w dół (+90°), a aVR w prawo i ku górze (−150°)' },
    { wartosc: 'Wzmocnienie odprowadzeń jednobiegunowych półtora raza', wyklad: 'S1_01', plansza: GOL, cytat: 'Pominięcie jej w tej średniej zwiększa napięcie o 50%, czyli sygnał jest półtora raza większy.' },
    { wartosc: 'W prawidłowym zapisie aVR zwykle ujemne', wyklad: 'S1_01', plansza: GOL, cytat: 'Dlatego w prawidłowym zapisie aVR jest zwykle ujemne' },
    /* zamiana rąk */
    { wartosc: 'Zamiana rąk: I się odwraca', wyklad: 'S1_01', plansza: ZLE, cytat: 'Najczęstszy błąd to zamiana elektrod rąk (lewa/prawa): odprowadzenie I się odwraca' },
    { wartosc: 'Zamiana rąk: każde wychylenie w I zmienia znak', wyklad: 'S1_01', plansza: ZLE, cytat: 'W odprowadzeniu I aparat odejmuje te same dwa potencjały w przeciwnej kolejności, więc każde wychylenie zmienia znak' },
    { wartosc: 'Zamiana rąk: II↔III, aVR↔aVL', wyklad: 'S1_01', plansza: ZLE, cytat: 'Odprowadzenia II i III zamieniają się obrazami, podobnie aVR i aVL.' },
    { wartosc: 'Zamiana rąk: dodatni QRS może pojawić się w aVR', wyklad: 'S1_01', plansza: ZLE, cytat: 'Ponieważ prawidłowe aVL często ma dodatni QRS, po zamianie dodatni QRS może pojawić się w aVR.' },
    { wartosc: 'Zamiana rąk: aVF bez zmian', wyklad: 'S1_01', plansza: ZLE, cytat: 'Bez zmian zostaje tylko aVF, bo średnia potencjałów obu rąk nie zależy od tego, która ręka jest którą.' },
    { wartosc: 'Zamiana rąk: przedsercowe bez zmian (Wilson ten sam)', wyklad: 'S1_01', plansza: ZLE, cytat: 'Taka zamiana nie zmienia też średniej potencjałów trzech kończyn, z której powstaje punkt odniesienia Wilsona, dlatego odprowadzenia przedsercowe pozostają bez zmian.' },
    { wartosc: 'Odwrócone I + dodatnie P w aVR + prawidłowa progresja R = zamiana rąk', wyklad: 'S1_01', plansza: ZLE, cytat: 'połączenie odwróconego I, dodatniego P w aVR i prawidłowej progresji R w odprowadzeniach przedsercowych mocno sugeruje zamianę elektrod rąk' },
    /* dekstrokardia */
    { wartosc: 'Dekstrokardia: podobny obraz odprowadzeń kończynowych', wyklad: 'S1_01', plansza: ZLE, cytat: 'Podobny obraz odprowadzeń kończynowych może wystąpić w dekstrokardii, czyli położeniu serca po prawej stronie klatki piersiowej.' },
    { wartosc: 'Dekstrokardia: zmienia się też widok z kamer przedsercowych', wyklad: 'S1_01', plansza: ZLE, cytat: 'Tu jednak serce naprawdę znajduje się po drugiej stronie, więc zmienia się także widok z kamer przedsercowych.' },
    { wartosc: 'Dekstrokardia: R zmniejsza się w kierunku V6', wyklad: 'S1_01', plansza: ZLE, cytat: 'ma zwykle odwróconą progresję R: R zmniejsza się w kierunku V6' },
    { wartosc: 'Zamiana rąk: progresja przedsercowa prawidłowa', wyklad: 'S1_01', plansza: ZLE, cytat: 'Przy samej zamianie przewodów rąk progresja przedsercowa pozostaje prawidłowa.' },
    /* papier */
    { wartosc: '25 mm/s, 10 mm/mV', wyklad: 'S1_01', plansza: ZLE, cytat: 'Standardowo papier przesuwa się z prędkością 25 mm/s, a cecha wynosi 10 mm/mV.' },
  ],
  noweMorfologie: [
    'Lustrzana dekstrokardia (całe pobudzenie P-QRS-T odbite lewo-prawo): ujemne P i QRS w I, odprowadzenia kończynowe jak po zamianie rąk, R maleje od V1 do V6.',
    'Zapisy po zamianach przewodów, których wykład nie omawia (LR↔LN, PR↔LN, zamiany z prawą nogą): policzone z tych samych definicji, np. PR↔PN daje prawie płaskie II, LN↔PN niczego nie zmienia.',
  ],
  doOkaJK: [
    'Oznaczenia klipsów: PR i LR z tekstu (S1_01), PN i LN dopisane analogicznie. Kolorów przewodów wykład nie podaje, więc ich nie ma.',
    'Wnioski pokazujemy tylko dla zamiany rąk (i dla prawidłowego podłączenia). Dla innych zamian tylko opis wyliczony ze wzorów („jak odwrócone III”, „prawie płaskie”) i notka, że wykład ich nie omawia. Czy zostawić je w trybie „Ucz się”?',
    'Prawa noga ma ten sam kierunek co lewa (+90°), więc LN↔PN nie zmienia zapisu. Zamiana z PN zmienia też V1-V6 przez inną średnią Wilsona: wniosek logiczny z tekstu, nie cytat.',
    'Wzmocnienie aparatu (1/√3 dla I-III, 1/1,5 dla aVR-aVF) dobrane tak, żeby poprawny zapis był identyczny z modelem z innych wstawek. Same zamiany nie zależą od tego wyboru.',
    'Serce: QRS z normy wstawki petla-qrs (oś ok. +56°, w ćwiczeniu od +44° do +62°), P obrócony o −15° względem core (oś P ok. +38°), żeby dodatnie P w aVR po zamianie rąk było widoczne (ok. 0,8 mm).',
    'Ćwiczenie: 5 zapisów 12-odprowadzeniowych (2 × zamiana rąk, 2 × dekstrokardia, 1 × prawidłowy); do wyboru te trzy odpowiedzi. Różnica zamiana rąk / dekstrokardia widoczna tylko w V1-V6, tak jak w tekście.',
  ],
  stanKanoniczny: 'Tryb „Ucz się”, podłączenie prawidłowe, 12 odprowadzeń z linią przerywaną zapisu wzorcowego.',
};
