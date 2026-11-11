import { useEffect, useState } from "react";
import { Link, useLocation } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronRight, Download, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { plural } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import FormularzZapisu from "@/components/szkolenie/FormularzZapisu";
import {
  bladSerwera,
  czyStan,
  dataGodzinaPL,
  dataPL,
  liczbaPL,
  SZKOLENIE_KEY,
  useSzkolenie,
  type StanModuluSzkolenia,
  type StanSzkolenia,
} from "@/lib/szkolenie";

const pad = (n: number) => String(n).padStart(2, "0");
const cleanTitle = (title: string) => title.replace(/^\s*moduł\s*\d+\s*[:.–—-]\s*/i, "");

/**
 * Szkolenie z punktami edukacyjnymi: zapis, moduły, test, ankieta, zaświadczenia.
 * Bez treści sprzedażowych (test e2e punkty.cjs to sprawdza).
 */
export default function SzkoleniePage() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  useEffect(() => {
    if (!isAuthenticated) setLocation("/?auth=login");
  }, [isAuthenticated, setLocation]);
  const { data, isLoading, isError, refetch } = useSzkolenie(isAuthenticated);
  const [edycja, setEdycja] = useState(false);

  if (!isAuthenticated) return null;
  if (isLoading) return <div className="min-h-[60vh] grid place-items-center"><LoadingSpinner size="lg" /></div>;
  if (isError || !data) {
    return (
      <div className="wrap wrap--narrow pt-16 pb-24 grid gap-4 justify-items-start">
        <p className="muted">Nie udało się wczytać szkolenia. Sprawdź połączenie i spróbuj jeszcze raz.</p>
        <Button variant="outline" size="sm" onClick={() => refetch()}>Spróbuj ponownie</Button>
      </div>
    );
  }
  if (!czyStan(data)) {
    return (
      <div className="wrap wrap--narrow pt-16 pb-24 grid gap-4">
        <p className="label">Szkolenie z punktami</p>
        <h1 className="h2">Szkolenie z punktami edukacyjnymi jest w przygotowaniu</h1>
        <p className="lead">Kurs działa jak dotąd. Gdy zapisy ruszą, zobaczysz je tutaj.</p>
      </div>
    );
  }
  const stan = data;
  const zapisany = stan.zapisy.length > 0;

  return (
    <div className="wrap wrap--narrow pt-12 pb-24 sm:pt-16 grid gap-14" data-testid="szkolenie">
      <header className="grid gap-4">
        <p className="label">Szkolenie z punktami edukacyjnymi{!stan.wlaczone && " · podgląd zespołu"}</p>
        <h1 className="h1">Zaświadczenie z punktami</h1>
        <p className="lead">
          {stan.tytul}: {liczbaPL(stan.godziny)} h nauki w modułach kursu i test końcowy. Po teście krótka anonimowa ankieta, potem zaświadczenie w PDF.
        </p>
        <p className="flex flex-wrap gap-x-5 gap-y-2 text-ui">
          <Link href="/program-szkolenia" className="underline" data-testid="link-program">Program szkolenia</Link>
          <Link href="/regulamin-szkolenia" className="underline" data-testid="link-regulamin">Regulamin szkolenia</Link>
        </p>
      </header>

      {/* 1. Zapis */}
      <section className="grid gap-5" aria-labelledby="krok-zapis">
        <h2 id="krok-zapis" className="h3">1. Zapis</h2>
        {!zapisany && !edycja && (
          <div className="grid gap-4 justify-items-start">
            <p className="text-body text-[var(--txt2)]">
              Podaj zawód, numer prawa wykonywania zawodu oraz imię i nazwisko. Na tej podstawie wystawimy zaświadczenie.
            </p>
            <Button onClick={() => setEdycja(true)} data-testid="chce-zaswiadczenie">Chcę zaświadczenie z punktami</Button>
          </div>
        )}
        {zapisany && !edycja && (
          <div className="grid gap-4">
            <ul className="rows [&>li:last-child]:border-b-0">
              {stan.zapisy.map((z) => (
                <li key={z.id} className="row py-4 grid-cols-[minmax(0,1fr)]" data-testid={`zapis-${z.zawod}`}>
                  <span className="row__t gap-1">
                    <b className="first-letter:uppercase">{z.zawodNazwa}</b>
                    <span className="!text-ui">
                      {z.imie} {z.nazwisko}{z.pwz ? ` · PWZ ${z.pwz}` : ""}{z.specjalizacja ? ` · ${z.specjalizacja}` : ""}
                    </span>
                    <span className="!text-ui">
                      {z.punkty !== null ? `Punkty edukacyjne: ${liczbaPL(z.punkty)}` : `Bez punktów: ${z.powodBezPunktow}`}
                    </span>
                    {z.zawod === "ratownik" && !z.pwz && <span className="!text-ui">Bez numeru PWZ: na zaświadczeniu „nie podano”.</span>}
                    {z.izba && <span className="!text-ui">Okręgowa izba lekarska: {z.izba}</span>}
                    {z.zablokowany && <span className="!text-ui inline-flex items-center gap-1"><Lock className="h-3.5 w-3.5" aria-hidden />Dane są na zaświadczeniu</span>}
                  </span>
                </li>
              ))}
            </ul>
            <div>
              <Button variant="outline" size="sm" onClick={() => setEdycja(true)} data-testid="zmien-dane">
                {stan.zapisy.some((z) => z.zablokowany) ? "Dodaj zawód" : "Zmień dane albo dodaj zawód"}
              </Button>
            </div>
          </div>
        )}
        {edycja && <FormularzZapisu stan={stan} onGotowe={() => setEdycja(false)} />}
      </section>

      {/* 2. Moduły */}
      <section className="grid gap-5" aria-labelledby="krok-moduly">
        <h2 id="krok-moduly" className="h3">2. Moduły</h2>
        <p className="text-body text-[var(--txt2)]">
          Moduł jest ukończony, gdy przeczytasz wszystkie wykłady do ostatniego rozdziału i otworzysz podsumowanie
          {stan.cwiczeniaWymagane ? ", a w każdym temacie z pytaniami ostatnie odpowiedzi będą poprawne" : ""}.
        </p>
        <ul className="rows [&>li:last-child]:border-b-0" data-testid="moduly-szkolenia">
          {stan.moduly.map((m, i) => <WierszModulu key={m.id} m={m} nr={i + 1} />)}
        </ul>
      </section>

      {/* 3. Test */}
      <section className="grid gap-5" aria-labelledby="krok-test">
        <h2 id="krok-test" className="h3">3. Test końcowy</h2>
        <OpisTestu stan={stan} zapisany={zapisany} />
      </section>

      {/* 4. Ankieta */}
      <section className="grid gap-4" aria-labelledby="krok-ankieta">
        <h2 id="krok-ankieta" className="h3">4. Ankieta</h2>
        {stan.ankieta.wypelniona ? (
          <p className="text-body inline-flex items-center gap-2" data-testid="ankieta-wypelniona"><Check className="h-4 w-4 text-[var(--puls)]" aria-hidden />Ankieta wypełniona. Dziękujemy!</p>
        ) : stan.ankieta.dostepna ? (
          <div className="grid gap-3 justify-items-start">
            <p className="text-body text-[var(--txt2)]">Kilka pytań o szkolenie. Odpowiedzi są anonimowe: nie łączymy ich z twoim kontem.</p>
            <Button asChild data-testid="do-ankiety"><Link href="/szkolenie/ankieta">Wypełnij ankietę</Link></Button>
          </div>
        ) : (
          <p className="text-body text-[var(--txt2)]">Otworzy się po zaliczeniu testu.</p>
        )}
      </section>

      {/* 5. Zaświadczenia */}
      <section className="grid gap-4" aria-labelledby="krok-zaswiadczenie">
        <h2 id="krok-zaswiadczenie" className="h3">5. Zaświadczenie</h2>
        <Zaswiadczenia stan={stan} />
      </section>
    </div>
  );
}

function WierszModulu({ m, nr }: { m: StanModuluSzkolenia; nr: number }) {
  const czesci = [
    `Wykłady ${m.wyklady.ukonczone}/${m.wyklady.wszystkie}`,
    m.podsumowanie.jest ? (m.podsumowanie.otwarte ? "podsumowanie otwarte" : "podsumowanie do otwarcia") : null,
    m.cwiczenia.wymagane && m.cwiczenia.wszystkie ? `ćwiczenia ${m.cwiczenia.opanowane}/${m.cwiczenia.wszystkie} tematów` : null,
  ].filter(Boolean);
  return (
    <li className="row group relative py-4 grid-cols-[32px_minmax(0,1fr)_auto]" data-testid={`modul-szkolenia-${m.externalId ?? m.id}`}>
      <span className="row__n">
        {m.ukonczony ? <span className="text-[var(--puls)] inline-flex"><Check className="h-4 w-4" aria-hidden /><span className="sr-only">Ukończony</span></span> : pad(nr)}
      </span>
      <span className="row__t gap-1">
        <Link href={`/modul/${m.id}`} className="text-[var(--txt)] no-underline after:absolute after:inset-0 after:content-['']">
          <b>{cleanTitle(m.tytul)}</b>
        </Link>
        <span className="!text-ui">{m.ukonczony && m.ukonczonyAt ? `Ukończony ${dataPL(m.ukonczonyAt)}` : czesci.join(" · ")}</span>
      </span>
      <ChevronRight className="h-4 w-4 text-[var(--txt3)]" aria-hidden />
    </li>
  );
}

function OpisTestu({ stan, zapisany }: { stan: StanSzkolenia; zapisany: boolean }) {
  const t = stan.test;
  const z = t.zasady;
  const zasady = `${z.liczbaPytan} ${plural(z.liczbaPytan, "pytanie", "pytania", "pytań")} jednokrotnego wyboru${z.limitMinut ? `, ${z.limitMinut} min na rozwiązanie` : ""}, próg ${liczbaPL(z.prog)}%, najwyżej ${z.limit} ${plural(z.limit, "podejście", "podejścia", "podejść")}. Po ${z.przerwaPo}. niezaliczonym podejściu ${liczbaPL(z.przerwaGodziny)} h przerwy. Każde podejście to nowy zestaw pytań. Po oddaniu zobaczysz ${z.wglad === "pelny" ? "całe ocenione podejście z kluczem i uzasadnieniami" : "uzasadnienia błędnych odpowiedzi"}.`;
  const oddane = t.podejscia.filter((p) => p.submittedAt);
  const ostatnie = t.podejscia.filter((p) => p.submittedAt).at(-1);
  return (
    <div className="grid gap-4 justify-items-start" data-testid="test-opis">
      <p className="text-body text-[var(--txt2)]">{zasady}</p>
      {ostatnie && (
        <p className="text-body" data-testid="test-ostatni-wynik">
          Ostatni wynik: {liczbaPL(ostatnie.procent ?? 0)}% ({ostatnie.wynik} z {ostatnie.maks}), {ostatnie.zaliczony ? "zaliczony" : "niezaliczony"}.
        </p>
      )}
      {oddane.length > 0 && (
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-ui" data-testid="test-wglad-linki">
          {oddane.map((p) => (
            <Link key={p.id} href={`/szkolenie/test?wglad=${p.id}`} className="underline">
              Wgląd: podejście {p.nr} ({liczbaPL(p.procent ?? 0)}%{p.automatycznie ? ", oddane po czasie" : ""})
            </Link>
          ))}
        </p>
      )}
      {!zapisany ? (
        <p className="text-body text-[var(--txt2)]">Najpierw zapisz się na szkolenie.</p>
      ) : t.stan.stan === "zaliczony" ? (
        <p className="text-body inline-flex items-center gap-2" data-testid="test-zaliczony"><Check className="h-4 w-4 text-[var(--puls)]" aria-hidden />Test zaliczony.</p>
      ) : t.pulaPusta ? (
        <p className="text-body text-[var(--txt2)]">Test jest w przygotowaniu.</p>
      ) : !t.odblokowany ? (
        <p className="text-body text-[var(--txt2)] inline-flex items-center gap-2" data-testid="test-zablokowany"><Lock className="h-4 w-4" aria-hidden />Otworzy się po ukończeniu wszystkich modułów.</p>
      ) : t.stan.stan === "przerwa" ? (
        <p className="text-body" data-testid="test-przerwa">Kolejne podejście od {dataGodzinaPL(t.stan.od)}.</p>
      ) : t.stan.stan === "wyczerpane" ? (
        <p className="text-body" data-testid="test-wyczerpane">Wykorzystano wszystkie podejścia. Napisz do nas: kontakt@helloekg.pl.</p>
      ) : (
        <Button asChild data-testid="do-testu">
          <Link href="/szkolenie/test">{t.stan.stan === "w_toku" ? "Wróć do testu" : `Rozpocznij test (podejście ${t.stan.wykorzystane + 1} z ${z.limit})`}</Link>
        </Button>
      )}
    </div>
  );
}

function Zaswiadczenia({ stan }: { stan: StanSzkolenia }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const wydaj = useMutation({
    mutationFn: async ({ zapisId, rodzaj }: { zapisId: string; rodzaj: "punkty" | "ukonczenie" }) =>
      (await apiRequest("POST", "/api/szkolenie/zaswiadczenia", { zapisId, rodzaj })).json(),
    onSuccess: () => {
      toast({ title: "Zaświadczenie gotowe" });
      qc.invalidateQueries({ queryKey: SZKOLENIE_KEY });
    },
    onError: (e) => toast({ title: "Nie udało się", description: bladSerwera(e), variant: "destructive" }),
  });
  const gotowe = stan.test.stan.stan === "zaliczony" && stan.ankieta.wypelniona;
  if (!stan.zapisy.length) return <p className="text-body text-[var(--txt2)]">Najpierw zapisz się na szkolenie.</p>;
  return (
    <ul className="rows [&>li:last-child]:border-b-0">
      {stan.zapisy.map((z) => {
        const wazneC = stan.zaswiadczenia.filter((x) => x.zawod === z.zawod && x.wazne);
        const zPunktami = wazneC.find((x) => x.rodzaj === "punkty");
        const ukonczenie = wazneC.find((x) => x.rodzaj === "ukonczenie");
        const dajePunkty = z.punkty !== null;
        return (
          <li key={z.id} className="row py-4 grid-cols-[minmax(0,1fr)] gap-3" data-testid={`zaswiadczenie-${z.zawod}`}>
            <span className="row__t gap-2">
              <b className="first-letter:uppercase">{z.zawodNazwa}</b>
              {!gotowe && <span className="!text-ui">Po teście i ankiecie.</span>}
              {gotowe && !dajePunkty && !ukonczenie && <span className="!text-ui">Bez punktów: {z.powodBezPunktow}</span>}
              {gotowe && dajePunkty && !zPunktami && z.czekaNaWeryfikacje && (
                <span className="!text-ui" data-testid={`czeka-${z.zawod}`}>
                  Zaświadczenie z punktami ({liczbaPL(z.punkty!)} pkt) czeka na weryfikację danych (zwykle do {stan.weryfikacjaDni} dni roboczych).
                  {!ukonczenie && " Już teraz możesz pobrać zaświadczenie ukończenia bez punktów."}
                </span>
              )}
              {[zPunktami, ukonczenie].filter(Boolean).map((c) => (
                <span key={c!.numer} className="!text-ui flex flex-wrap items-center gap-x-3 gap-y-2">
                  <span>
                    {c!.rodzaj === "punkty" ? `Z punktami (${liczbaPL(c!.punkty ?? 0)} pkt)` : "Ukończenie bez punktów"}: nr {c!.numer} z {dataPL(c!.wydano)}
                  </span>
                  <Link href={`/zaswiadczenie/${c!.klucz}`} className="underline" data-testid={`weryfikacja-link-${z.zawod}-${c!.rodzaj}`}>sprawdź ważność</Link>
                  <Button asChild variant="outline" size="sm">
                    <a href={`/api/szkolenie/zaswiadczenia/${c!.numer}/pdf`} download data-testid={`pdf-${z.zawod}-${c!.rodzaj}`}>
                      <Download className="h-4 w-4" aria-hidden />Pobierz PDF
                    </a>
                  </Button>
                </span>
              ))}
              {gotowe && (
                <span className="flex flex-wrap gap-3">
                  {dajePunkty && !zPunktami && !z.czekaNaWeryfikacje && (
                    <Button size="sm" disabled={wydaj.isPending} onClick={() => wydaj.mutate({ zapisId: z.id, rodzaj: "punkty" })} data-testid={`odbierz-${z.zawod}-punkty`}>
                      Odbierz zaświadczenie z punktami
                    </Button>
                  )}
                  {!ukonczenie && (!dajePunkty || (z.czekaNaWeryfikacje && !zPunktami)) && (
                    <Button size="sm" variant={dajePunkty ? "outline" : "default"} disabled={wydaj.isPending} onClick={() => wydaj.mutate({ zapisId: z.id, rodzaj: "ukonczenie" })} data-testid={`odbierz-${z.zawod}-ukonczenie`}>
                      {dajePunkty ? "Pobierz zaświadczenie ukończenia bez punktów" : "Odbierz zaświadczenie ukończenia"}
                    </Button>
                  )}
                </span>
              )}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
