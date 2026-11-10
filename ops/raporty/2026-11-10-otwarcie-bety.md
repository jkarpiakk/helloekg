# Otwarcie bety kurs.helloekg.pl: bezpieczeństwo, rejestracja, maile, Stripe, gotowość do pentestu (10.11.2026)

Zlecenie: `~/Claude/Projects/JK Enterprise/PROMPT_cc_kurs_otwarcie_bety.md` (decyzje JK z 10.11).
Gałąź `otwarcie-bety` (commity 3f72b54, ac9e119, c9c0a32, 1dc91f4), przewinięta też `deploy/kurs-beta`. Nie wypchnięte na GitHub.

## Stan po wdrożeniu (produkcja, 12:52)

- **Bramka `?beta=` zdjęta.** Aplikacja jest publiczna, treść chroni logowanie i potwierdzony e-mail.
- **Rejestracja: technicznie gotowa, na razie zamknięta.** Formularz mówi „rejestracja chwilowo zamknięta”. Otworzy się, gdy JK zaakceptuje regulamin bety i politykę prywatności i przełączę „dokumenty opublikowane” w panelu. Bez opublikowanych dokumentów nie ma do czego wyrazić zgody. `REJESTRACJA_OTWARTA` jest domyślnie włączona.
- **Indeksowanie:** `X-Robots-Tag: noindex, nofollow` i `robots.txt` z `Disallow: /` (aplikacja, przełącznik `INDEKSOWANIE`).
- **Płatności:** wyłączone (`PLATNOSCI_WLACZONE` nieustawione), kluczy Stripe na serwerze jeszcze nie ma.

## Kopie przed zmianami

| Co | Gdzie |
|---|---|
| baza | `/var/backups/helloekg-kurs/kurs-przed-otwarcie-20261110-1236.dump`, `…-otwarcie-2-20261110-1252.dump` |
| pliki (grafiki, załączniki) | `/var/backups/helloekg-kurs/pliki-przed-otwarcie-20261110-1236.tgz` |
| kod | `/opt/helloekg-kurs/dist.przed-otwarcie-20261110-1236`, `dist.przed-otwarcie-2-20261110-1252` |
| zależności | `/opt/helloekg-kurs-node_modules.przed-otwarcie-20261110-1236`, `package*.json.przed-otwarcie-…` |
| konfiguracja | `/etc/helloekg-kurs.env.przed-otwarcie-20261110-1236`, `/etc/caddy/kurs.caddy.przed-otwarcie-20261110-1236` |

**Wycofanie:**
1. Przywróć `dist`, `node_modules` i `env` z kopii, a `kurs.caddy` z kopii (bramka wraca).
2. `systemctl restart helloekg-kurs`, `systemctl reload caddy`.
3. Migracja jest wyłącznie dodająca, nie trzeba jej cofać.

## 1. Zaległe znaleziska bezpieczeństwa

### Naprawione teraz

| Źródło | Znalezisko | Naprawa |
|---|---|---|
| OWASP #8 | token potwierdzenia e-mail jawnie w bazie, bez terminu | SHA-256 w bazie, 24 h, jednorazowy; stare tokeny skasowane migracją |
| OWASP #13 | rejestracja zdradzała istnienie konta (inna treść odpowiedzi) | ta sama odpowiedź, właściciel adresu dostaje „Masz już konto”; skrót hasła liczony także dla zajętego adresu (czas odpowiedzi) |
| OWASP #3 | brak idempotencji webhooka po `event.id` | tabela `stripe_events`, błąd obsługi = 500 bez zapisu (Stripe ponawia) |
| OWASP #14 | zarządzany webhook Replita (biblioteka 0.0.x) | usunięty razem z `stripe-replit-sync` |
| OWASP #17 | trasy magazynu obiektów Replita (upload, publiczne obiekty) | usunięte (`objectStorage.ts`, `objectAcl.ts`, `@google-cloud/storage`) |
| OWASP #6 | limiter przy awarii bazy przepuszczał | logowanie, rejestracja, reset, płatności, usuwanie konta: 503 przy awarii bazy |
| OWASP #12 | martwe zależności | usunięte: passport, memorystore, @octokit/rest, Neon, ws, Uppy, @stripe/react-stripe-js i inne (16 pakietów) |
| OWASP #18 | `.env` nie w `.gitignore` | `.env` i `.env.*` (poza `.env.example`) |
| nowe | hasło: bcrypt obcina do 72 bajtów, minimum 8 | argon2id (wbudowany w Node 24), minimum 10, maksimum 1024 bez obcinania; bcrypt przeliczany przy logowaniu |
| nowe | e-mail z wielkimi literami = drugie konto | wyszukiwanie bez względu na wielkość liter |
| nowe | publiczne trasy EKGQuiz: blog, pytania demo, treść strony głównej, anonimowy support | usunięte (API i zakładki panelu), nieznane `/api/*` → 404 JSON |
| nowe | vite instalowany i importowany na produkcji | import tylko w podglądzie; na serwerze `npm ci --omit=dev` (322 pakiety, bez vite) |
| nowe | rola admin zawiesza i usuwa konta, ale nie widzi listy | lista kont dla owner, admin, reviewer |
| nowe | seed z „EKG Academy” i kontem `reviewer123` | usunięte wszystkie skrypty seed z EKGQuiz; „EKG Academy” nigdzie nie zostało |

### Zostało (ocena)

| Znalezisko | Ocena | Dlaczego zostaje |
|---|---|---|
| quill (edytor w panelu, XSS w eksporcie HTML) | niska | tylko recenzent i właściciel; treść renderowana po DOMPurify, CSP egzekwowana; nie ma wersji z poprawką |
| CSP `style-src 'unsafe-inline'` (ZAP: średnie) | niska | HTML wykładów ze studia używa atrybutów `style`; skrypty są zablokowane, więc wstrzyknięcie samego stylu ma ograniczone skutki |
| DOMPurify dopuszcza `id` (DOM clobbering, OWASP #9) | niska | treść pochodzi ze studia (zaufana), nie od kursantów |
| brak alertów (OWASP #15) | niska | dzienniki są; propozycja: prosty monitor dostępności i mail przy 5xx, do decyzji |
| certyfikat bez egzaminu (OWASP #2) | decyzja JK 28.10 | certyfikat potwierdza przejście kursu (opanowanie wszystkich tematów i potwierdzony adres) |
| moderate w narzędziach deweloperskich (drizzle-kit, typography) | brak | nie trafiają na serwer |

`npm audit`: 0 critical, 0 high (wcześniej 1 high: vite 5 → 6.4.6). Produkcyjne: 5 moderate (quill i narzędzia budowania).

## 2. Zdjęcie tokenu i zamknięcie treści

- Caddy bez bramki (`ops/caddy/kurs.caddy`).
- Dziennik żądań: `/var/log/caddy/kurs-access.log`, 30 dni. Token zastąpiony `REDACTED`, ciasteczek nie ma (sprawdzone).
- Wszystkie trasy treści i panelu wymagają sesji i potwierdzonego e-maila (`requireKonto`). Niepotwierdzone konto widzi tylko ekran „Potwierdź adres e-mail” (z ponownym wysłaniem).
- `/content-assets/*` tylko z sesją potwierdzonego konta, `Cache-Control: private`. Obrazy w kursie to adresy z tej samej domeny, przeglądarka dołącza ciasteczko sama. Publiczne adresy nie były potrzebne, sprawdzone testem CSP na 33 wykładach.
- `/.well-known/security.txt`: kontakt `kontakt@helloekg.pl`, ważny do 10.11.2027.
- **Lista ścieżek sprawdzonych bez konta na produkcji:** `ops/raporty/2026-11-10-sciezki-bez-konta.md`.
  - API: 34/34 zamknięte (401, a cennik i Stripe 404).
  - Grafiki: 420/420 plików zwraca 401.
  - Strony aplikacji zwracają sam szkielet, bez treści.
  - Test: `tests/e2e/bez-konta.cjs`, bezpieczny na produkcji, bo wysyła tylko GET.
- **Uwaga:** publiczny pakiet JS zawiera kod interfejsu i wstawek interaktywnych (rysowanie EKG, podpisy). Tak działa każda aplikacja SPA. Wykłady, pytania, wyjaśnienia i grafiki przychodzą wyłącznie z API.

## 3. Rejestracja

- **Formularz:** imię, e-mail, hasło (co najmniej 10 znaków) i powtórzenie hasła. Do tego dwa niezaznaczone checkboxy (regulamin bety, polityka prywatności) i ukryte pole-pułapka. Bez zgody marketingowej, bo MailerLite to osobna sprawa.
- **Po wysłaniu:** ekran „Sprawdź skrzynkę”. Rejestracja nie loguje, kurs otwiera się po kliknięciu linku.
- **Model danych:**
  - `user_consents`: dokument, wersja, data;
  - `users`: `tester_bety`, `email_verified_at`, `email_verification_expiry`, `pwz_number` (opcjonalny, formularz go nie zbiera). Pole `profession` już było.
- **Rola:** nowe konto dostaje rolę `student` (w panelu: „Kursant”) i `tester_bety=true`. Daje to pełny dostęp, dopóki płatności są wyłączone.
  - Rola w kodzie dalej nazywa się `student`, bo zmiana nazwy dotyka całej aplikacji bez zysku dla bezpieczeństwa.
  - Istniejące konto kursanta dostało `tester_bety` w migracji.
- **Ochrona:**
  - limity prób na IP i na konto (logowanie, rejestracja, reset, ponowne wysłanie, maile na adres);
  - pole-pułapka;
  - neutralne komunikaty;
  - reset hasła unieważnia sesje.
- **Panel admina:**
  - zakładka **Ustawienia** (właściciel): rejestracja otwarta, dokumenty opublikowane, wyjątki limitów dla IP pentestu;
  - **Użytkownicy**: data rejestracji i potwierdzenia, zgody, blokowanie, usunięcie konta z danymi (z potwierdzeniem mailem albo bez).
- **Dokumenty (projekty do akceptacji, niepublikowane):** `docs/dokumenty/regulamin-bety.md`, `docs/dokumenty/polityka-prywatnosci.md`. Właściciel widzi je w aplikacji pod `/regulamin-bety` i `/polityka-prywatnosci` jeszcze przed publikacją.
- „Zgłoś uwagę” przy wykładzie i pytaniu już było (zgłoszenia z załącznikami, lista w panelu).

## 4. Maile

| Mail | Kiedy | Link | Ważność |
|---|---|---|---|
| Potwierdź adres e-mail | rejestracja, ponowne wysłanie | `https://kurs.helloekg.pl/verify-email?token=…` | 24 h, jednorazowy |
| Masz już konto | rejestracja na zajęty adres | `/?auth=login` | brak tokenu |
| Ustaw nowe hasło | „Nie pamiętasz hasła?” | `/reset-password?token=…` | 1 h, jednorazowy |
| Hasło zostało zmienione | po resecie (sesje wylogowane) | `/?auth=login` | brak tokenu |
| Konto usunięte | samodzielnie albo przez admina | brak | |
| Płatność potwierdzona | zakup zalogowanego | `/dashboard` | |
| Płatność potwierdzona: ustaw hasło | zakup gościa | `/reset-password?token=…` | 1 h |
| Twój certyfikat | wydanie certyfikatu | `/certificate/<numer>` | |
| [Zgłoszenie] … | nowe zgłoszenie testera, do zespołu | panel | |

- **Nadawca:** `helloEKG <kurs@helloekg.pl>` (SMTP home.pl, STARTTLS 587), `Reply-To: kontakt@helloekg.pl` (nowe).
- **MailerLite:** maile transakcyjne przez niego nie idą. Logo w mailach jest tylko hostowane na jego CDN.
- **Rekomendacja:** zostać przy `kurs@helloekg.pl` z `Reply-To` na kontakt. Działa, ma DKIM i SPF, a odpowiedzi trafiają tam, gdzie ktoś czyta.
- **Linki:** zawsze z `FRONTEND_URL`, bez klucza bety.
- **Test:** `scripts/test-maile.ts` (na serwerze `dist/test-maile.js`) wysyła wszystkie szablony z linkami-atrapami.

| Skrzynka | Wynik |
|---|---|
| Gmail (jakub.karpiak@gmail.com) | 8/8 w Odebranych; `spf=pass`, `dkim=pass` (`d=helloekg.pl`, `s=dkim`); DMARC: brak rekordu |
| mail-tester.com | **10/10** („Nie jesteś w pełni uwierzytelniony”: brak DMARC; brak List-Unsubscribe, zbędny w transakcyjnych) |
| Outlook.com, WP, Onet, Interia | **nie wysłane:** potrzebne adresy testowe od JK (zakładania kont pocztowych nie robię) |

### DNS helloekg.pl (stan 10.11)

- **SPF:** `v=spf1 a mx include:_spf.mlsend.com ~all`. Przechodzi, bo IP serwera SMTP home.pl to akurat rekord A domeny. Po przeniesieniu strony gdzie indziej SPF przestanie działać.
- **DKIM:** selektor `dkim` (home.pl), podpis przechodzi.
- **DMARC:** brak. `_dmarc.helloekg.pl` trafia w wildcard CNAME na `helloekg.pl` i zwraca jego SPF.

**Do dodania w home.pl (dopiero po „tak” JK):**

| Typ | Nazwa | Wartość |
|---|---|---|
| TXT | `_dmarc` | `v=DMARC1; p=none; rua=mailto:kontakt@helloekg.pl; adkim=r; aspf=r; fo=1` |
| TXT (zmiana istniejącego SPF) | `@` | `v=spf1 a mx include:_spf.home.pl include:_spf.mlsend.com ~all` |

- Po 2 do 4 tygodniach raportów, jeśli wszystko przechodzi: `p=quarantine`.
- Rekord TXT pod `_dmarc` ma pierwszeństwo przed wildcard CNAME.
- Przed zmianą SPF sprawdzę limit 10 zapytań DNS (`include:_spf.home.pl` ma własne zagnieżdżenia).

## 5. Stripe (podpięty, wyłączony)

- **Przełącznik:** `PLATNOSCI_WLACZONE` (domyślnie wyłączone).
  - Wyłączony: cennik i strony zakupu przekierowują do panelu, `GET /api/plans`, `/api/stripe/config` i wszystkie trasy checkout zwracają 404.
  - Webhook działa zawsze, gdy jest sekret.
- **Checkout hostowany przez Stripe.** Metody: `STRIPE_METODY`, domyślnie `card,blik,p24`. BLIK i Przelewy24 trzeba włączyć w panelu Stripe (tryb testowy).
- **Tylko tryb testowy:** klucz `sk_live_` jest blokowany w kodzie, dopóki nie ma `STRIPE_LIVE_DOZWOLONE=1`.
- **Webhook:** podpis, idempotencja po `event.id`, przyznanie dostępu po `checkout.session.completed` lub `async_payment_succeeded`.
  - Zwrot całej kwoty (`charge.refunded`) odbiera dostęp i przesuwa późniejsze przedłużenia.
  - Zwrot częściowy niczego nie odbiera (do decyzji przy starcie płatności).
- **Testy:** `tests/e2e/stripe.cjs` 25/25 (bez łączenia ze Stripe, podpis liczony lokalnie).

**Ceny w kodzie:** dziś tylko techniczny plan „Manual” 0 zł (w migracji wyłączony z cennika). Propozycja jak w EKGQuiz, jednorazowo:

| Plan | Cena | Okres |
|---|---|---|
| Dostęp do kursu: 30 dni | 60 zł | 30 dni |
| Dostęp do kursu: 90 dni | 100 zł | 90 dni |
| Dostęp do kursu: 365 dni | 169 zł | 365 dni |

Założą się w Stripe test i w bazie jako nieaktywne skryptem `dist/stripe-test-ceny.js --zapisz`, gdy będą klucze. Wcześniej nie da się, bo nie ma klucza.

### Instrukcja dla JK: klucze testowe

1. Stripe → przełącznik **Test mode** → Developers → API keys: skopiuj **Publishable key** (`pk_test_…`) i **Secret key** (`sk_test_…`).
2. Developers → Webhooks → Add endpoint:
   - URL `https://kurs.helloekg.pl/api/stripe/webhook/manual`;
   - zdarzenia: `checkout.session.completed`, `checkout.session.async_payment_succeeded`, `charge.refunded`;
   - po zapisaniu odsłoń **Signing secret** (`whsec_…`).
3. Settings → Payment methods (test): włącz **BLIK** i **Przelewy24**.
4. Na serwerze:
   ```
   ssh helloekg-studio
   sudo nano /etc/helloekg-kurs.env
   ```
   Dopisz trzy linie: `STRIPE_SECRET_KEY=sk_test_…`, `STRIPE_PUBLISHABLE_KEY=pk_test_…`, `STRIPE_WEBHOOK_SECRET=whsec_…`. Zapisz (Ctrl+O, Enter, Ctrl+X), potem:
   ```
   sudo systemctl restart helloekg-kurs
   ```
5. Napisz „klucze są”. Sprawdzę log startu (pokazuje tryb klucza bez wartości), założę ceny i zrobię test e2e: zakup → webhook → dostęp → zwrot → brak dostępu.
   - Kartę testową 4242 i testowy BLIK na stronie Stripe wpisujesz Ty.
   - Na czas testu włączę `PLATNOSCI_WLACZONE` na kilkanaście minut.

### Checklista przed włączeniem płatności (nic z tego nie zrobione)

- [ ] regulamin sprzedaży;
- [ ] informacja o prawie odstąpienia i zgoda na rozpoczęcie dostarczania treści cyfrowych przed upływem 14 dni (checkbox przy zakupie, zapis zgody);
- [ ] faktury VAT dla JDG: Stripe Invoicing albo system zewnętrzny (z księgowością);
- [ ] klucze live i webhook live, `STRIPE_LIVE_DOZWOLONE=1`;
- [ ] ostateczne ceny (plany `is_active`);
- [ ] decyzja: zwrot częściowy a dostęp;
- [ ] test na żywo małą kwotą i zwrot;
- [ ] `PLATNOSCI_WLACZONE=1`, sprawdzenie, że testerzy bety tracą darmowy dostęp tylko wtedy, kiedy chcesz (dziś `tester_bety` daje dostęp wyłącznie przy wyłączonych płatnościach).

## 6. Gotowość do pentestu

- **Pakiet:** `docs/pentest/`:
  - `README.md`: zakres, zasady, okno, kontakt, format raportu z CVSS;
  - `ARCHITEKTURA.md`;
  - `ROLE.md`;
  - `openapi.yaml`: 85 operacji z warunkiem dostępu, generator `scripts/openapi-z-tras.py`;
  - `KONTA-TESTOWE.md`: instrukcja dla JK;
  - `PRZED-I-PO.md`.
- **Izolacja od studia:** sprawdzona.
  - Osobni użytkownicy systemowi i pliki konfiguracji. Brak wspólnych sekretów (porównanie skrótów wartości).
  - Kurs nie czyta bazy ani konfiguracji studia. Studio nie czyta konfiguracji, załączników ani kopii kursu.
  - Import ze studia działa w jedną stronę.
- **Utwardzenie dodane teraz:**
  - drop-in systemd: `ProtectHome`, `InaccessiblePaths` na katalogi studia, `PrivateDevices`, `Protect*`, pusty `CapabilityBoundingSet` i inne. Ocena `systemd-analyze security` 3.5 „OK”;
  - Postgres: CONNECT do `helloekg_kurs` tylko dla roli `kurs` (wcześniej PUBLIC);
  - kod studia w `/opt/helloekg-studio` jest czytelny dla innych użytkowników, ale nie ma w nim sekretów.
- **Kopia z próbą odtworzenia:**
  - nocna kopia obejmuje teraz także załączniki zgłoszeń;
  - odtworzenie `db-2026-11-10.dump` do bazy próbnej: 9 tabel, liczby wierszy zgodne;
  - archiwum plików: 420/420.
- **Dzienniki:**
  - aplikacja: ścieżka bez parametrów;
  - `audit_log`: logowania, nieudane logowania (HMAC e-maila), zmiany kont i ustawień, płatności;
  - Caddy: bez tokenów i ciasteczek.
- **Wyjątki od limitów dla IP firmy:** przełącznik w panelu, domyślnie wyłączony, test 25 prób bez blokady.
- **Nagłówki (produkcja):**
  - HSTS (includeSubDomains), CSP egzekwowana, `frame-ancestors 'none'` i `X-Frame-Options: DENY`, nosniff, `Referrer-Policy`, `Permissions-Policy`;
  - ciasteczko `HttpOnly; Secure; SameSite=Lax`.
- **OWASP ZAP 2.17.0 (spider + skan pasywny):**
  - produkcja bez konta i build produkcyjny po zalogowaniu kursanta;
  - 0 wysokich, 1 średnie (CSP `style-src 'unsafe-inline'`, opis wyżej), informacyjne: token w adresie linku z maila (z założenia: jednorazowy, skrót w bazie, krótki termin, wycięty z dzienników), SPA, Cache-Control `security.txt`.

### Do załatwienia przez JK (nie moje)

- umowa z firmą: zakres, pisemna zgoda na testy, NDA, odpowiedzialność;
- jeśli test będzie po rejestracji pierwszych testerów: umowa powierzenia przetwarzania danych (RODO art. 28);
- najprościej zrobić pentest przed zaproszeniem testerów: dziś w bazie są 3 konta zespołu.

## Testy

| Test | Wynik |
|---|---|
| `otwarcie.cjs` (rejestracja, potwierdzenie, reset, argon2id, przełączniki, usuwanie, wyjątki limitów) | 60/60 |
| `stripe.cjs` (wyłączone, webhook, event.id, zwroty, sk_live_) | 25/25 |
| `bezpieczenstwo.cjs` (regresje z 28.10) | 12/12 |
| `certyfikat.cjs` | 14/14 |
| `csp.cjs` (build produkcyjny: 33 wykłady, 8 typów pytań, 8 zakładek panelu) | 0 naruszeń |
| `bez-konta.cjs` na produkcji | 34/34 API, 420/420 grafik |

Testy uruchamiane na kopii bazy `helloekg_kurs_otwarcie` (z `helloekg_kurs_dev`) i podglądach z worktree `~/helloEKG/helloekg-otwarcie` (:5065 dev, :5066 Stripe testowe, :5067 build produkcyjny).
