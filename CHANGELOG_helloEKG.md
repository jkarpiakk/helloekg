# CHANGELOG — helloEKG rebuild (branch `feat/helloekg-rebrand`)

Rebuild w miejscu istniejącego kodu EKGQuiz → marka **helloEKG**. Praca w repo, potem push na GitHub, potem import do Replita. **Replit nie był dotykany bezpośrednio.**

> ⚠️ Weryfikacja: ta gałąź powstała na maszynie **bez Node.js**, więc `tsc`, `npm install`, `db:push` i testy **nie były uruchomione lokalnie** — edycje są poprawne „z inspekcji". Pełną weryfikację (build + typy + runtime) trzeba wykonać w Replicie po imporcie. Kroki niżej.

---

## Zrobione i zacommitowane

### Faza A — wydajność i bezpieczeństwo (`453752c`)
- **Indeksy FK** (`shared/schema.ts`): 13 indeksów na gorących kolumnach — `attempts(user_id, question_id, user+question)`, `questions(section_id, status, section+status)`, `sections(module_id)`, `subscriptions(user_id, status)`, `progress(user_id, user+section)`, `certificates(user_id)`, `lecture_chapters(section_id)`. Składnia drizzle 0.39 (forma tablicowa).
- **Naprawa N+1**:
  - `storage.getModulesWithSections()` — było zapytanie/moduł w pętli → teraz 2 zapytania (batch `inArray` + grupowanie w pamięci).
  - `quizService.initializeExam()` — było zapytanie/sekcja → teraz jedno `getAllQuestions("published")`.
  - `storage.reorderModules/reorderSections` — owinięte w transakcję (atomowość).
- **Pool Neon** (`server/db.ts`): jawne `max` / `idleTimeoutMillis` / `connectionTimeoutMillis`, nadpisywalne przez ENV.
- **`trust proxy`** (`server/index.ts`): `app.set('trust proxy', 1)` — bez tego za proxy Replita `req.ip` = IP proxy dla wszystkich, przez co per-IP rate-limit działał de facto globalnie (audyt sugerował „globalny limiter" — faktyczna przyczyna to brak trust proxy). Naprawia też secure-cookie i IP w audit logu.
- **Webhook hardening** (`server/webhookHandlers.ts`): błąd zapisu audit logu nie wywala już opłaconego zdarzenia Stripe (był ukryty bug: `actorId: 'system'` łamie FK `uuid`).

### Faza B — rebrand marki (`093f036`)
- **Tokeny** (`client/src/index.css`): pełna paleta helloEKG jako zmienne CSS. **Ciemny motyw domyślny** (`:root, .dark`), jasny opt-in (`.light`). Kontrasty wg handoffu. `quiz-option` → styl brandowy (poprawna = obwódka + tinta, błędna = neutralna). Zamiana niebieskich akcentów na zieleń.
- **`client/index.html`**: `lang="pl"`, `<title>` + meta description, **slim fontów** do Space Grotesk + Inter + JetBrains Mono (było ~30 rodzin — realny zysk LCP), skrypt „no-flash" dla motywu.
- **Tailwind**: rodzina `display` (Space Grotesk).
- **Komponenty marki** (`client/src/components/brand/`): `Logo` („żywy znak", warianty A–D, puls 72 BPM), `EKGDivider`, `ProgressBar`, `Loader`, `ThemeToggle`, `Hero3DHeart` (lazy three.js, proceduralna chmura punktów + **TODO: wymiana na próbkowanie z `.glb`**).
- **Hooki**: `usePrefersReducedMotion`, `useTheme` (zapis preferencji).
- **Header/Footer**: PNG-logo → `<Logo>`, dodany `<ThemeToggle>`.
- **Rename** „EKG Academy" → „helloEKG" (47 miejsc: UI, i18n, maile, certyfikaty).
- Wszystkie animacje respektują `prefers-reduced-motion`; three.js poza głównym bundlem (dynamiczny import).
- `client/src/types/three.d.ts`: ambient shim (bez potrzeby `@types/three`).

### Faza E — code-splitting (`34589a1`)
- **`App.tsx`**: `React.lazy` dla wszystkich stron poza `Home` (LCP) i `NotFound`; `Suspense` z brandowym `Loader`.
- **`vite.config.ts`**: `manualChunks` (three / radix / tanstack / react-vendor / vendor). three pozostaje lazy.

---

## Do zrobienia (fazy C, D, F) — patrz raport

- **C — treść kursu**: import struktury 8 modułów + Modułu 1 jako seed (Draft, `is_visible=false`). Blokada: dostępność plików treści (curriculum.json jest, pełna treść Modułu 1 częściowo na Drive — patrz `DRIVE_CONTENT_MANIFEST.md`).
- **D — Stripe recurring + PDF certyfikatu + maile**: wymaga (1) **decyzji o cenach** (rekomendacja: 60 PLN/mies., 400 PLN/rok), (2) testów na żywo. Uwaga: Stripe działa przez `stripe-replit-sync` (managed webhook) — migracja na recurring musi współpracować z tym pakietem. Nie robione „na ślepo".
- **F — testy**: brak test-runnera w repo (żadnego `test` w `package.json`). Wymaga dodania (np. vitest) i uruchomienia w Replicie.

---

## Zmienne środowiskowe (Replit Secrets)

Istniejące (nie zmieniać, jeśli działają): `SESSION_SECRET`, `DATABASE_URL`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `SENDGRID_API_KEY`, `FROM_EMAIL`, `REPLIT_DOMAINS`.

Nowe/opcjonalne (mają sensowne domyślne — ustaw tylko do tuningu):
- `DB_POOL_MAX` (domyślnie 10)
- `DB_IDLE_TIMEOUT_MS` (domyślnie 30000)
- `DB_CONNECT_TIMEOUT_MS` (domyślnie 10000)

Do Fazy D (gdy ruszy): `STRIPE_PRICE_MONTHLY`, `STRIPE_PRICE_YEARLY`.

---

## Import do Replita (wykonuje człowiek)

1. Push gałęzi `feat/helloekg-rebrand` na GitHub (patrz niżej), potem w Replicie: Git → pull tej gałęzi (lub import repo).
2. `npm install` (podciąga zależności; nowych deps nie dodano w fazach A/B/E).
3. **Zastosuj indeksy**: `npm run db:push` — utworzy 13 nowych indeksów (operacja nieniszcząca; przy dużych tabelach `CREATE INDEX` blokuje zapisy — u nas tabele małe, OK).
4. Zbuduj/uruchom: `npm run build` (albo dev). Zweryfikuj `npm run check` (tsc) — jeśli coś zgłosi, to tu wychodzi po raz pierwszy.
5. Wejdź na stronę: sprawdź ciemny motyw, logo „żywy znak", przełącznik motywu, serce 3D w hero, brak niebieskiego.
6. Faza D dopiero po decyzji o cenach.

## Weryfikacja (checklist — do odhaczenia w Replicie)
- [ ] `npm run check` (tsc) zielone
- [ ] Strona ładuje się w ciemnym motywie; przełącznik zapamiętuje jasny
- [ ] Logo animowane; `prefers-reduced-motion` zatrzymuje animacje
- [ ] Serce 3D renderuje się w hero; three.js nie w głównym bundlu (analiza `dist`)
- [ ] `/api/modules` bez N+1 (log zapytań)
- [ ] Indeksy obecne (`\d+` na tabelach w psql)
