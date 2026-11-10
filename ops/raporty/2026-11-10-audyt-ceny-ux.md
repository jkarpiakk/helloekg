# Audyt bezpieczeństwa, ceny, audyt UX i otwarcie rejestracji (10.11.2026, po południu)

Polecenie JK: pełny audyt bezpieczeństwa, ceny 49 zł miesięcznie (subskrypcja) lub 499 zł za rok, audyt UX, wprowadzenie wszystkich zmian, otwarcie rejestracji.

## Stan na produkcji (15:20)

- **Rejestracja otwarta.** Regulamin bety i polityka prywatności 1.0 opublikowane (administrator: Cardiomind sp. z o.o., decyzja JK). Przełączniki `dokumenty_opublikowane` i `rejestracja_otwarta` włączone, wpis w `audit_log`.
- **Sprawdzone na produkcji prawdziwym mailem** (alias Gmail JK): rejestracja z telefonu → mail w Odebranych → przycisk „Potwierdzam adres” → logowanie → „Twój postęp” → usunięcie konta (200, w bazie 0 wierszy). Konsola bez błędów.
- **Bez konta:** API zamknięte 33/33, grafiki 420/420 (`tests/e2e/bez-konta.cjs`). TRACE 405.
- **Płatności:** nadal wyłączone (brak kluczy Stripe). Cennik gotowy w bazie i w kodzie.

Kopie przed zmianami: baza `/var/backups/helloekg-kurs/kurs-przed-audyt-20261110-1510.dump`, kod `/opt/helloekg-kurs/dist.przed-audyt-20261110-1510`, konfiguracja `/root/*.przed-audyt-*` (kurs.caddy, Caddyfile, utwardzenie.conf, 50-cloud-init.conf). Migracje wyłącznie dodające.

**Wycofanie:** `dist` z kopii + `systemctl restart helloekg-kurs`; Caddy: `Caddyfile` i `kurs.caddy` z `/root`, usunąć `/etc/systemd/system/caddy.service.d/admin-gniazdo.conf`, `daemon-reload`, `restart caddy`. Rejestrację zamyka panel → Ustawienia.

## 1. Ceny

| Plan | Cena | Jak działa | Metody |
|---|---|---|---|
| Miesięcznie | 49 zł / miesiąc | subskrypcja Stripe, odnawia się co miesiąc, anulowanie na koniec okresu (portal Stripe z menu konta: „Płatności”) | karta, Apple Pay, Google Pay |
| Na rok | 499 zł / rok | jedna płatność za 365 dni, bez odnawiania | karta, BLIK, Przelewy24 |

Roczny jest jednorazowy, bo BLIK i Przelewy24 nie obsługują w Stripe płatności cyklicznych, a w Polsce to główne metody. Jeśli roczny też ma się odnawiać: w tabeli `plans` ustawić `interval='year'` (tylko karta). Oszczędność rocznego pokazuje cennik: 89 zł taniej niż 12 × 49 zł.

Przed płatnością kursant zaznacza zgodę na dostęp przed upływem 14 dni (utrata prawa odstąpienia, art. 38 pkt 13 ustawy o prawach konsumenta). Zgoda trafia do `user_consents` (`dostep_przed_14_dniami`) i do maila z potwierdzeniem płatności.

Obsługa subskrypcji: `checkout.session.completed` (pierwszy okres), `invoice.paid` (odnowienia, koniec dostępu = koniec okresu + 2 dni), `customer.subscription.deleted` (koniec), `charge.refunded` i `charge.dispute.created` (dostęp odebrany, odnawianie anulowane w Stripe). Usunięcie konta i „odbierz dostęp” w panelu anulują subskrypcję w Stripe. Druga subskrypcja albo subskrypcja przy opłaconym roku: 409. Zakup bez konta (guest checkout, finalize-payment) usunięty: cała aplikacja i tak wymaga konta.

**Przy włączaniu płatności (JK):** w panelu Stripe webhook musi wysyłać `checkout.session.completed, checkout.session.async_payment_succeeded, invoice.paid, customer.subscription.deleted, charge.refunded, charge.dispute.created`; potem `node dist/stripe-przygotuj.js --zapisz` (konfiguracja portalu klienta). Przed sprzedażą regulamin płatny (obecny dotyczy bezpłatnej bety) i polityka z sekcją o płatnościach.

## 2. Audyt bezpieczeństwa

Trzy niezależne przeglądy: aplikacja (uwierzytelnianie, sesje, dostęp), płatności i klient z zależnościami, infrastruktura serwera. **Krytycznych: 0.** Szczegóły z dowodami: `~/helloEKG/raport_audyt_2026-11-10/` (A, B, C; poza repozytorium).

### Naprawione i wdrożone

| Waga | Znalezisko | Naprawa |
|---|---|---|
| wysokie (infra) | kopie studia czytelne dla procesu kursu | `/var/backups`, `/etc/caddy`, `/opt/mission-control` niewidoczne dla usługi kursu (InaccessiblePaths) |
| średnie | zalew `/api/feedback` (21 MB JSON przed limitem) | limit dzienny i jedno zgłoszenie naraz na konto przed odczytem treści, 4 naraz w procesie, `MemoryMax=1G`, Caddy `max_size 22MB` |
| średnie | `rate_limit_store` rośnie od losowych ścieżek | ogólny limit API jednym kluczem na adres (300/min), sprzątanie co 10 min |
| średnie | API administracyjne Caddy na 127.0.0.1:2019 dla każdego | tylko gniazdo `/run/caddy/admin.sock` (0200, caddy) |
| średnie | Caddy 2.11.4, Node 24.21 | Caddy 2.11.9, Node 24.22.2 (kurs zrestartowany; studio i druga aplikacja dostaną nowego Node przy swoim restarcie) |
| średnie | płatności: podwójne subskrypcje, zwrot bez anulowania, panel admina bez anulowania, lista zdarzeń, portal po zakupie gościa | wszystko wyżej w sekcji 1 |
| niskie | potwierdzenie e-mail przez GET (skaner poczty) i bez wylogowania obcych sesji | przycisk (POST), inne sesje konta wylogowane, token znika z paska adresu |
| niskie | czas odpowiedzi forgot/resend zdradza konto | odpowiedź od razu, praca w tle |
| niskie | IPv6: limit na pełny adres | klucz na sieć /64 |
| niskie | ocena szkiców pytań i ukrytych sekcji | kursant: tylko opublikowane w widocznych sekcjach (404) |
| niskie | `/api/report-error` bez limitu, 500 przy złym id | uuid, istniejące pytanie, 20 na dobę |
| niskie | ścieżka `/\t/host` w zgłoszeniach i `?from=` | znaki sterujące i białe odrzucane (serwer, strona zgłoszeń, panel) |
| niskie | imię z kropką w nagłówku maila („evil.com”) | imię bez kropek |
| niskie | ostatni właściciel mógł usunąć siebie | 409 |
| niskie | dziennik: parametry SQL (e-maile, skróty haseł), surowy JSON przy błędzie | filtr dziennika (`server/logBezDanych.ts`), 4xx bez treści żądania |
| niskie | Referer z tokenem w logu Caddy | Referer usuwany z logu; tokeny znikają też z adresu w przeglądarce |
| niskie | adres powrotu Stripe z nagłówka Host | na produkcji tylko `APP_BASE_URL` |
| niskie | SSH: `PasswordAuthentication yes` w 50-cloud-init, MaxAuthTries 6, przekazywanie | `no`, 3, tylko lokalne przekazywanie (tunel bazy działa) |
| niskie | bazy testowe z CONNECT dla wszystkich, stare kopie Caddy czytelne | CONNECT tylko `kurs_dev`, kopie 600 |
| info | `id in DOKUMENTY`, unikalny e-mail bez wielkości liter | `Object.hasOwn`, indeks `lower(email)` |

### Zostaje (decyzja albo dostęp JK)

1. **Kopie poza serwerem i szyfrowane (wysokie).** Dziś kopie leżą na tym samym dysku. Potrzebne konto magazynu (OVH Object Storage albo Backblaze B2) i hasło szyfrowania trzymane poza serwerem. Gotowe polecenia w raporcie C.
2. **Studio:** słabe utwardzenie systemd (8.3) i uprawnienia kopii studia 755/644. Nie ruszałem, bo zasada „niczego w studiu”. Kurs już ich nie widzi. Do zrobienia przy najbliższym wdrożeniu studia.
3. **Druga aplikacja na tym samym serwerze** (jarvis): poza zakresem pentestu, dopisane w `docs/pentest/README.md`. Docelowo osobny serwer.
4. Edytor pytań w panelu używa `quill 1.3.7` (znana podatność XSS, tylko recenzent i wyżej, ograniczona przez DOMPurify i CSP). Wymiana edytora to osobne zadanie.
5. Blokada logowania na cudzy e-mail z kilku sieci (50 prób → 15 min): świadomy kompromis, właściciel z innej sieci loguje się dalej.
6. Rekord CAA w DNS i DMARC: czekają na „tak” (patrz niżej).

## 3. Audyt UX

Pełne przejście jak nowy kursant (telefon 375 px i komputer 1280 px): strony bez konta, rejestracja, mail, potwierdzenie, panel, kurs, wykład, pytania, powtórka, zgłoszenie, certyfikat, menu konta, usunięcie konta. Skan dostępności axe (WCAG 2.1 AA) na każdym ekranie.

| Znalezisko | Naprawa |
|---|---|
| Pusty formularz rejestracji: błąd tylko przy imieniu. Komunikat po wyjściu z pola przesuwał przycisk, pierwsze kliknięcie trafiało obok i formularz się nie wysyłał | walidacja po „Załóż konto”, potem na bieżąco; teraz 6 komunikatów naraz (także logowanie) |
| Brak zmiany hasła po zalogowaniu (tylko reset mailem) | „Zmień hasło” w menu konta: obecne + nowe, inne urządzenia wylogowane, mail z potwierdzeniem |
| Stopka zalogowanego: „Nie pamiętasz hasła?”; przed potwierdzeniem adresu linki do kursu, które odbijały | stopka zależna od stanu konta |
| Linki w dokumentach różniły się od tekstu tylko kolorem; tabela bez dostępu z klawiatury (axe: serious) | podkreślenie, przewijana tabela z fokusem |
| Cennik: stare pakiety 30/90/365 dni, „PayU”, „Priorytetowe wsparcie” | nowy cennik (dwa plany, jak działa płatność, metody), ekran płatności ze zgodą, strona po płatności z ponawianiem |
| Okno logowania bez opisu dla czytnika ekranu (ostrzeżenie Radix) | poprawione |

Po poprawkach axe: 0 naruszeń poza chwilą otwartego menu konta (Radix ukrywa resztę strony, zamierzone). Wyglądało na problem, a nie jest: pływający przycisk „Zgłoś uwagę” na telefonie chowa się przy przewijaniu wykładu (zrzuty całej strony pokazują go w miejscu).

## 4. Testy

| Test | Wynik |
|---|---|
| `otwarcie.cjs` (rejestracja, potwierdzenie POST, wylogowanie obcych sesji, reset, przełączniki) | 62/62 |
| `stripe.cjs` (webhook, zwroty, subskrypcja, blokada drugiej subskrypcji, zgoda) | 35/35 |
| `audyt-1110.cjs` (nowy: zmiana hasła, właściciel, szkice, report-error, zgłoszenia, limity, IPv6) | 16/16 |
| `bezpieczenstwo.cjs` | 12/12 |
| `bez-konta.cjs` na produkcji | 33/33 API, 420/420 grafik |
| przejście UX (telefon + komputer, 27 ekranów × 2) | bez błędów, axe czysty |
| produkcja: rejestracja → mail (Gmail, Odebrane) → potwierdzenie → logowanie → usunięcie | OK |

## 5. Czeka na JK

1. **Dane rejestrowe Cardiomind sp. z o.o.** (KRS, NIP, adres siedziby). Ustawa o świadczeniu usług drogą elektroniczną (art. 5) wymaga ich w regulaminie. Dziś dokumenty podają nazwę i kontakt@helloekg.pl, tak jak landing. W rejestrze nie znalazłem spółki o tej nazwie: warto sprawdzić dokładną nazwę. Po podaniu: wersja 1.1 dokumentów (bez ponownej zgody, to tylko dane identyfikacyjne).
2. **DNS:** „tak” dla DMARC i SPF z raportu otwarcia, plus rekord CAA (`0 issue "letsencrypt.org"`). Wiadomość „tak btw to maile przyszły wszystkie” zrozumiałem jako potwierdzenie maili, nie jako zgodę na DNS: rekordów nie dodałem.
3. **Klucze Stripe (test)**, potem zdarzenia webhooka z sekcji 1 i test zakupu (kartę testową wpisujesz sam).
4. **Kopie poza serwerem:** wybór magazynu i konto.
5. Kursanci, którzy zarejestrują się od dziś, dostają znacznik testera bety: pełny dostęp za darmo, dopóki płatności są wyłączone. Po włączeniu płatności dostęp testerów się kończy. Jeśli testerzy mają zachować dostęp po starcie sprzedaży, trzeba zdecydować jak (np. ręcznie nadany dostęp na X miesięcy).
