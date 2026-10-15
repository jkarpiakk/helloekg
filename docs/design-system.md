# helloEKG — język wizualny aplikacji kursu

Aplikacja kursu (kurs.helloekg.pl) ma wyglądać i zachowywać się jak landing helloekg.pl
(źródło: `~/helloEKG/landing-pl/index.html`). Ruch i informacja zwrotna według zasad Apple
(*Designing Fluid Interfaces*, WWDC 2018; *The Details of UI Typography*, WWDC 2020).

## Zasady w jednym akapicie

Ciemne tło `--ink`, płaskie powierzchnie, **cienkie linie zamiast cieni**. Zero gradientów,
poświaty (`glow`), „glass” na kartach i kolorowych kafelków (teal/orange/purple). Listy to
**wiersze rozdzielone linią** (`.rows` / `.row`), nie siatka kart. Jeden akcent: zielony puls
`--puls`, oszczędnie — na CTA, postępie, poprawnej odpowiedzi. Nagłówki Space Grotesk 500
z ujemnym trackingiem, tekst Inter, etykiety JetBrains Mono wersalikami (`.label`).
Teksty po polsku, na „ty”, konkretne (komunikat mówi, co zrobić).

## Tokeny (CSS, `client/src/index.css`)

| Token | Ciemny (domyślny) | Do czego |
|---|---|---|
| `--ink` | #0B0F14 | tło strony |
| `--panel` | #0E141A | powierzchnia (`.surface`, Card) |
| `--line` / `--line2` | #1A222B / #223040 | linie podziału / krawędzie kontrolek |
| `--puls` | #3EE6A8 | akcent, CTA, postęp (na jasnym motywie #0B7E54) |
| `--puls-deep` / `--puls-dark` | #0B7E54 / #1E4536 | krawędź „poprawne” / tor paska postępu |
| `--txt` `--txt2` `--txt3` `--txt4` | #F2F6F4 #8A97A0 #5C6870 #3A4550 | tekst: główny / wtórny / wyciszony / linie |
| `--label` | #76838C | etykiety mono |
| `--alarm` | #E24B4A | błąd — oszczędnie |
| `--tint` | puls 6% | tło stanu „wybrane/poprawne” |

W Tailwind używaj ich przez wartości arbitralne: `text-[var(--txt2)]`, `border-[var(--line)]`,
`bg-[var(--panel)]`. Tokeny shadcn (`bg-background`, `text-muted-foreground`…) też działają.
**Nie wpisuj kolorów na sztywno** (żadnych `#…`, `bg-blue-500`, `text-red-600`, `teal`, `purple`).

## Klasy komponentów (już zdefiniowane)

- Układ: `.wrap` (max 1240 + gutter), `.wrap wrap--narrow` (880 — czytanie, quiz)
- Typografia: `.display`, `.h1`, `.h2`, `.h3`, `.lead`, `.muted`, `.label`, `.label--g`, `.num` (liczby tabelaryczne)
- Powierzchnia: `.surface` (panel + linia, promień 16)
- Listy: `.rows` > `.row` (siatka: `48px | treść | meta | 28px`) z `.row__n` (numer mono), `.row__t` (`<b>` tytuł + `<span>` opis), `.module-i` (kółko z ikoną, obraca się w `details[open]`)
- Odpowiedzi: `.opt` > `.opt__key` (A/B/C/D) + tekst + `.opt__mark`; stany `.is-right`, `.is-wrong`, `.is-dim`, `.is-picked`
- `.chips` > `.chip` (filtry, tryby; aktywny: `aria-pressed="true"` lub `.is-on`)
- `.progress` > `span` (pasek 4px, szerokość w `style`)
- `.material-bar` — półprzezroczysta belka (nawigacja, belki przyklejone)
- `.prose-hk` — treść wykładu (markdown)
- Komponenty ui (Button, Card, Input, Badge, Dialog, Sheet, Tabs, Progress) są już przestylowane — używaj ich zamiast własnych.

Button: `default` = zielona pigułka (główne działanie, **jedno na ekran**), `outline`/`secondary` = pigułka z linią, `ghost` = tekstowy. Rozmiary: `default` 48px, `sm` 38px, `lg` 52px.

## Typografia

- Skala z landingu, nie wymyślaj nowych rozmiarów. Tytuł ekranu: `.h1` lub `.h2`; nad nim `.label` (np. „MODUŁ 2 · WYKŁAD 3”).
- Tracking zależny od rozmiaru (już w klasach). Waga 500 dla nagłówków — **nie** `font-bold`/`font-semibold` 700.
- Tekst ciągły 16–17px, `leading` 1.65–1.75, szerokość ≤ 42em.

## Ruch (Apple)

- Reakcja **przy naciśnięciu**: `active:scale-[.97]` (już w Button, `.opt`, `.chip`, `.row`). Nigdy tylko po puszczeniu.
- Animacje framer-motion: presety z `@/lib/motion` (`spring`, `springSnappy`, `rise`, `stagger`, `press`, `project`, `rubberband`). Globalnie `MotionConfig` = sprężyna bez odbicia + `reducedMotion="user"`.
- Bez odbicia (bounce 0) domyślnie; odbicie tylko po geście z pędem (przeciągnięcie, rzut).
- Wejście treści: krótko i blisko (`rise`: 12px + krycie), lista: `stagger(0.04)`. Żadnych `scale` od 0, obrotów, pulsowania, „pop”.
- Spójność przestrzenna: element znika tą drogą, którą przyszedł; podgląd obrazka wyrasta z miniatury.
- Przeciąganie (drag&drop, sortowanie, hotspot, podgląd): Pointer Events + `setPointerCapture`, śledzenie 1:1 od miejsca chwytu, próg 10px, po puszczeniu sprężyna z prędkością gestu, gumowe granice.
- Postęp i liczby zmieniają się płynnie (szerokość paska przez transition, nie skok).
- Tylko `transform` i `opacity` w animacjach.

## Dostępność

- `prefers-reduced-motion`, `-transparency`, `-contrast` są obsłużone w CSS globalnie; w JS sprawdzaj `useReducedMotion()` z framer-motion przy własnych animacjach gestów.
- Cele dotyku ≥ 44px. Widoczny focus. Etykiety po polsku (`aria-label`).
- Stan poprawne/błędne nie tylko kolorem — także ikoną i tekstem.

## Architektura informacji (beta)

| Trasa | Ekran |
|---|---|
| `/` | gość: wejście do bety (logowanie/rejestracja); zalogowany: przekierowanie na `/dashboard` |
| `/dashboard` | „Twój postęp”: kontynuuj, powtórka, postęp modułów |
| `/modules` | „Kurs”: moduły jako wiersze `<details>`, w środku sekcje → wykład i pytania |
| `/lecture/:sectionId` | wykład z bazy (rozdziały `GET /api/sections/:id/chapters`), na końcu „Sprawdź się” → quiz tej sekcji |
| `/quiz?sectionId=…` | quiz sekcji; `/quiz?mode=review` powtórka; `/quiz?mode=exam` egzamin |
| `/blog`, `/pricing`, `/checkout` | poza nawigacją w becie (blog żyje na helloekg.pl/blog) |

Nawigacja zalogowanego: **Kurs** (`/modules`), **Postęp** (`/dashboard`), **Powtórka** (`/quiz?mode=review`).
Logo prowadzi do `/dashboard` (zalogowany) lub `/`. Link „helloekg.pl” w stopce.

## Czego nie robić

- Nie zmieniaj logiki zapytań, endpointów, oceniania odpowiedzi ani kształtu danych.
- Nie dodawaj zależności npm.
- Nie twórz liczb, opinii ani statystyk „na pokaz” (żadnych „2 500+ studentów”).
- Nie ruszaj panelu admina (`components/admin`, `pages/admin.tsx`) — dostaje wygląd z fundamentu.
