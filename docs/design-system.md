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

| Token | Ciemny (domyślny) | Jasny | Do czego |
|---|---|---|---|
| `--ink` | #0B0F14 | #F8FAF9 | tło strony |
| `--panel` | #0E141A | #FFFFFF | powierzchnia (`.surface`, Card) |
| `--line` / `--line2` | #1A222B / #223040 | #E2E8E5 / #CFD9D4 | linie podziału / krawędzie kontrolek |
| `--puls` | #3EE6A8 | #0B7E54 | akcent, CTA, postęp |
| `--puls-deep` / `--puls-dark` | #0B7E54 / #1E4536 | #0B7E54 / #D5E3DD | krawędź „poprawne” / tor paska postępu |
| `--on-puls` | #07130E | #F8FAF9 | tekst na zielonym tle (Button `default`, zaznaczenie) |
| `--txt` `--txt2` `--txt3` `--txt4` | #F2F6F4 #9BA7AF #5C6870 #3A4550 | #0C1210 #46534F #7A8783 #B5C1BC | tekst: główny / wtórny (7.8:1, AAA) / wyciszony / linie |
| `--label` | #84919A | #5F6D68 | etykiety mono (6.0:1) |
| `--prose` | #C2CBD1 | #26302D | tekst do czytania (wykład, wyjaśnienia); pogrubienia w `--txt` |
| `--alarm` | #E24B4A | #C93B3A | błąd, oszczędnie |
| `--alarm-solid` | #B53130 | #B53130 | wypełnienie przycisku destrukcyjnego (jasny tekst ≥ 4.5:1) |
| `--field-border` | #6B7780 | #7A8783 | krawędź pól formularza (≥ 3:1 do tła) |
| `--tint` | puls 6% | puls 7% | tło stanu „wybrane/poprawne” |
| `--nav-bg` | ink 72% | ink 78% | tło półprzezroczystej belki (`.material-bar`) |

Pozostałe tokeny (bez motywu): `--ease` `cubic-bezier(.2,.7,.2,1)` i `--ease-out` `cubic-bezier(.2,.8,.2,1)` (przejścia CSS),
`--gutter` `clamp(16px, 4.5vw, 48px)` (margines boczny `.wrap`), `--maxw` 1240px, `--nav-h` 64px (wysokość belki),
`--font-sans` (Inter), `--font-heading` (Space Grotesk), `--font-mono` (JetBrains Mono). `--w` (0..1) to wypełnienie
`.progress > span`, ustawia je `ProgressLine`. Tryb „więcej kontrastu” podnosi `--line*`, `--txt2/3`, `--label`, `--prose`, `--field-border`.

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
- `.progress` > `span` (pasek 4px) — **nie składaj ręcznie**, użyj `ProgressLine` (niżej)
- `.material-bar` — półprzezroczysta belka (nawigacja, belki przyklejone)
- `.prose-hk` — treść wykładu (markdown)
- Komponenty ui (Button, Card, Input, Badge, Dialog, Sheet, Tabs, Progress) są już przestylowane — używaj ich zamiast własnych.

### Komponenty, których kurs naprawdę używa

- **`.surface`** — każdy panel/karta w treści (panel + linia 1px, promień 16, bez cienia). `Card` z ui wygląda tak samo.
- **`ProgressLine`** (`@/components/ui/progress-line`) — jedyny pasek postępu: `<ProgressLine value={pct} label="…" />`
  albo „X z N”: `<ProgressLine value={3} max={10} label="…" />`. Rośnie od zera przy wejściu, potem płynnie; `role="progressbar"`
  z aria-valuenow/max. Używają go: Postęp (kurs, następny krok, moduły), lista Kurs, sesja pytań, Pierwsze kroki.
  Wyjątki: `ReadingProgress` (belka wykładu: odcinek na rozdział, 2px, napędzany przewijaniem) i `ui/progress`
  (Radix, tylko panel admina).
- **`LoadingSpinner`** (`@/components/ui/loading-spinner`) — jedyny wskaźnik ładowania: sygnet H z biegnącym impulsem
  (jak logo w belce), przy „Ogranicz ruch” nieruchomy. Rozmiary `sm` 16 / `md` 32 / `lg` 56. Fallback tras (`RouteLoader`
  w `App.tsx`) to ten sam komponent, pokazany dopiero po 300 ms. Żadnych kręcących się kółek (`animate-spin`).

Button: `default` = zielona pigułka (główne działanie, **jedno na ekran**), `outline`/`secondary` = pigułka z linią, `ghost` = tekstowy. Rozmiary: `default` 48px, `sm` 38px, `lg` 52px.

## Typografia

- Skala z landingu, nie wymyślaj nowych rozmiarów. Tytuł ekranu: `.h1` lub `.h2`; nad nim `.label` (np. „MODUŁ 2 · WYKŁAD 3”).
- Tracking zależny od rozmiaru (już w klasach). Waga 500 dla nagłówków — **nie** `font-bold`/`font-semibold` 700.
- Tekst ciągły 16–17px, `leading` 1.65–1.75, szerokość ≤ 42em.

Skala (duże stopnie płynne, `clamp`, klasy w `index.css`): `.display` 40→92 · `.h1` 32→56 · `.h2` 28→44 · `.h3` 19→23 · `.lead` 17→20 ·
`.label` 12 mono wersaliki.

Stopnie komponentów (Tailwind, `tailwind.config.ts` → `fontSize`). Ustawiają **tylko** rozmiar, interlinię dobierasz `leading-*`.
Zamiast `text-[15px]` / `text-[.9375rem]` pisz nazwę ze skali:

| Klasa | px | Do czego |
|---|---|---|
| `text-meta` | 12 | metadane, podpisy pod liczbami, liczniki (mono wersalikami to `.label`) |
| `text-note` | 13 | przypisy, stopka, podpowiedzi pod polem |
| `text-ui` | 14 | elementy interfejsu: linki pomocnicze, przyciski tekstowe, komunikaty błędu pola |
| `text-sub` | 15 | tekst drugiego planu i kontrolek: opis wiersza, opcja odpowiedzi, przycisk, opis okna |
| `text-body` | 16 | tekst podstawowy (domyślny `body`) |
| `text-read` | 17 | tekst do czytania (`.prose-hk`), tytuły wierszy na telefonie |
| `text-item` | 18 | tytuł elementu: wiersz listy, belka rozdziału, logo |
| `text-heading` | 20 | tytuł okna, arkusza, karty, instrukcji |
| `text-figure` | 24 | duże liczby w panelu (z `.num`) |

Ułamki `em` (np. `text-[0.55em]` dla „%” przy dużej liczbie) zostają: to proporcja do liczby obok, nie osobny rozmiar.
`cn()` zna te nazwy (`lib/utils.ts`), więc `text-sub` nie znika, gdy dołożysz kolor `text-[var(--txt2)]`.

Wagi: pliki fontów są tylko te z landingu (`styles/fonts.css`): **Inter 400/500**, **Space Grotesk 500/600**, **JetBrains Mono 400/500**.
Pogrubienie w tekście (`strong`, `b`, `.prose-hk`) to Inter **500** + kolor `--txt`, nie 600: Inter 600 nie jest ładowany, więc
przeglądarka by go syntetyzowała (rozmyte, szersze litery). 600 tylko w Space Grotesk (wordmark „EKG”).

## Zaokrąglenia

Cztery wartości (`--radius` = 12px; w Tailwind `md` = `lg`):

| Klasa | px | Do czego |
|---|---|---|
| `rounded-sm` | 8 | drobne: klawisz A/B/C/D (`.opt__key`), miniatury, przyciski-ikony, znaczniki |
| `rounded-lg` (`md`, `xl`) | 12 | kontrolki i elementy w treści: pola, opcje (`.opt`), obrazy, ramki, elementy do przeciągania |
| `rounded-2xl` | 16 | powierzchnie: `.surface`, karta pytania, okno, arkusz, wstawka |
| `rounded-full` | — | pigułki (Button, `.chip`), kółka, paski postępu |

Bez `rounded-[NNpx]`. W CSS te same liczby (8 / 12 / 16 / 999px albo 50%).

## Ruch (Apple)

- Reakcja **przy naciśnięciu**: `active:scale-[.97]` (już w Button, `.opt`, `.chip`, `.row`). Nigdy tylko po puszczeniu.
- Animacje framer-motion: presety z `@/lib/motion` (`spring`, `springSnappy`, `rise`, `stagger`, `press`, `project`, `rubberband`). Globalnie `MotionConfig` = sprężyna bez odbicia + `reducedMotion="user"`.
- Bez odbicia (bounce 0) domyślnie; odbicie tylko po geście z pędem (przeciągnięcie, rzut).
- Wejście treści: krótko i blisko (`rise`: 12px + krycie), lista: `stagger(0.04)`. Żadnych `scale` od 0, obrotów, pulsowania, „pop”.
- Ilustracje z podświetleniem (np. „Serce to orkiestra”, `components/course/OrchestraMethod.tsx`): stan aktywny to kolor `--puls`
  (linia, wypełnienie `--tint`-owe, przycisk `.chip` z `aria-pressed`), zmieniany przejściem krycia. Bez `filter: blur`/`drop-shadow`
  (poświata) i bez zapętlonych animacji (pulsujące kropki).
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
| `/blog`, `/pricing`, `/checkout` | poza nawigacją w becie: `/blog` przekierowuje na helloekg.pl/blog, płatności na `/dashboard` |

Nawigacja zalogowanego: **Kurs** (`/modules`), **Postęp** (`/dashboard`), **Powtórka** (`/quiz?mode=review`).
Logo prowadzi do `/dashboard` (zalogowany) lub `/`. Link „helloekg.pl” w stopce.

## Czego nie robić

- Nie zmieniaj logiki zapytań, endpointów, oceniania odpowiedzi ani kształtu danych.
- Nie dodawaj zależności npm.
- Nie twórz liczb, opinii ani statystyk „na pokaz” (żadnych „2 500+ studentów”).
- Nie ruszaj panelu admina (`components/admin`, `pages/admin.tsx`) — dostaje wygląd z fundamentu.
