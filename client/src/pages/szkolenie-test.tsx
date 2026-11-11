import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Check, ChevronLeft, ChevronRight, Clock, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Wyjasnienie } from "@/components/quiz/Wyjasnienie";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { sanitizeMarkdown } from "@/lib/sanitize";
import { cn } from "@/lib/utils";
import { plural } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";
import { bladSerwera, dataGodzinaPL, liczbaPL, opisWgladu, SZKOLENIE_KEY, type StanPodejsc, type ZasadyTestu } from "@/lib/szkolenie";

interface PytanieTestu {
  id: string;
  nr: number;
  title: string;
  bodyMd: string;
  imageUrl: string | null;
  answers: Array<{ index: number; text: string }>;
}
interface Podejscie {
  id: string;
  startedAt: string;
  /** Termin oddania (null = bez limitu) i czas serwera w chwili odpowiedzi */
  termin: string | null;
  teraz: string;
  pytania: PytanieTestu[];
  odpowiedzi: Record<string, number>;
}
interface StanTestu {
  zapisany: boolean;
  odblokowany: boolean;
  zespol: boolean;
  brakujaceModuly: string[];
  pulaPusta: boolean;
  stan: StanPodejsc;
  zasady: ZasadyTestu;
  otwarte: Podejscie | null;
}
interface Wynik {
  id: string;
  wynik: number;
  maks: number;
  procent: number;
  zaliczony: boolean;
  prog: number;
  automatycznie: boolean;
  wglad: "pelny" | "bledne";
  /** "podsumowanie": niezaliczone, zostały podejścia (bez pytań, klucza i uzasadnień) */
  zakres: "pelny" | "bledne" | "podsumowanie";
  pozostale: number;
  moduly: Array<{ modul: string | null; tytul: string; dobrze: number; wszystkie: number }>;
  pytania: Array<{ nr: number; ok: boolean; title: string; bodyMd: string; imageUrl: string | null; answers: Array<{ index: number; text: string }>; wybrana: number | null; poprawne: number[]; wyjasnienie: string }>;
}

const mmss = (ms: number) => {
  const s = Math.max(0, Math.floor(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
};

const litera = (i: number) => String.fromCharCode(65 + i);

/**
 * Test końcowy szkolenia. Bez informacji zwrotnej w trakcie (odpowiedzi zapisują się na serwerze
 * bez oceny), limit czasu pilnuje serwer (tu tylko odliczanie i oddanie po czasie). Po oddaniu wgląd
 * w całe ocenione podejście (test_wglad = pelny) albo w błędne odpowiedzi. Bez treści sprzedażowych.
 */
export default function SzkolenieTest() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const qc = useQueryClient();
  useEffect(() => {
    if (!isAuthenticated) setLocation("/?auth=login");
  }, [isAuthenticated, setLocation]);

  const { data: stan, isLoading } = useQuery<StanTestu>({
    queryKey: ["/api/szkolenie/test"],
    queryFn: async () => (await apiRequest("GET", "/api/szkolenie/test")).json(),
    enabled: isAuthenticated,
    staleTime: 0,
  });
  const [podejscie, setPodejscie] = useState<Podejscie | null>(null);
  const [odpowiedzi, setOdpowiedzi] = useState<Record<string, number>>({});
  const [i, setI] = useState(0);
  const [wynik, setWynik] = useState<Wynik | null>(null);
  const [potwierdz, setPotwierdz] = useState(false);
  // Wgląd w wcześniejsze oddane podejście: /szkolenie/test?wglad=<id>
  const wgladId = new URLSearchParams(useSearch()).get("wglad");
  useEffect(() => {
    if (!wgladId || !isAuthenticated) return;
    apiRequest("GET", `/api/szkolenie/test/${wgladId}/wynik`).then((r) => r.json()).then(setWynik).catch(() => {});
  }, [wgladId, isAuthenticated]);
  // Odliczanie: termin z serwera przesunięty o różnicę zegarów
  const [pozostalo, setPozostalo] = useState<number | null>(null);
  useEffect(() => {
    if (!podejscie?.termin) return setPozostalo(null);
    const przesuniecie = Date.now() - new Date(podejscie.teraz).getTime();
    const koniec = new Date(podejscie.termin).getTime() + przesuniecie;
    const tik = () => setPozostalo(koniec - Date.now());
    tik();
    const t = setInterval(tik, 1000);
    return () => clearInterval(t);
  }, [podejscie]);

  useEffect(() => {
    if (stan?.otwarte && !podejscie) {
      setPodejscie(stan.otwarte);
      setOdpowiedzi(stan.otwarte.odpowiedzi ?? {});
    }
  }, [stan, podejscie]);

  const start = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/szkolenie/test/start")).json() as Promise<Podejscie>,
    onSuccess: (p) => {
      setPodejscie(p);
      setOdpowiedzi(p.odpowiedzi ?? {});
      setI(0);
      window.scrollTo(0, 0);
    },
    onError: (e) => toast({ title: "Nie udało się rozpocząć", description: bladSerwera(e), variant: "destructive" }),
  });

  const zapiszOdp = useMutation({
    mutationFn: async ({ questionId, answerIndex }: { questionId: string; answerIndex: number }) =>
      apiRequest("PUT", `/api/szkolenie/test/${podejscie!.id}/odpowiedz`, { questionId, answerIndex }),
    onError: (e) => toast({ title: "Odpowiedź nie zapisała się", description: bladSerwera(e), variant: "destructive" }),
  });

  const oddaj = useMutation({
    mutationFn: async () => (await apiRequest("POST", `/api/szkolenie/test/${podejscie!.id}/oddaj`, { odpowiedzi })).json() as Promise<Wynik>,
    onSuccess: (w) => {
      setWynik(w);
      setPodejscie(null);
      setPotwierdz(false);
      qc.invalidateQueries({ queryKey: SZKOLENIE_KEY });
      qc.invalidateQueries({ queryKey: ["/api/szkolenie/test"] });
      window.scrollTo(0, 0);
    },
    onError: (e) => toast({ title: "Nie udało się oddać testu", description: bladSerwera(e), variant: "destructive" }),
  });

  // Koniec czasu: oddajemy to, co jest (serwer i tak oceni tylko odpowiedzi zapisane przed terminem)
  const oddanoPoCzasie = useRef(false);
  useEffect(() => {
    if (pozostalo !== null && pozostalo <= 0 && podejscie && !oddaj.isPending && !oddanoPoCzasie.current) {
      oddanoPoCzasie.current = true;
      oddaj.mutate();
    }
  }, [pozostalo, podejscie, oddaj]);

  const pytania = podejscie?.pytania ?? [];
  const q = pytania[Math.min(i, Math.max(0, pytania.length - 1))];
  const odpowiedziane = useMemo(() => pytania.filter((p) => odpowiedzi[p.id] !== undefined).length, [pytania, odpowiedzi]);

  if (!isAuthenticated) return null;
  if (isLoading || !stan) return <div className="min-h-[60vh] grid place-items-center"><LoadingSpinner size="lg" /></div>;

  const wroc = (
    <Link href="/szkolenie" className="inline-flex items-center gap-2 min-h-[44px] text-sub text-[var(--txt2)] no-underline hover:text-[var(--txt)]" data-testid="wroc-do-szkolenia">
      <ArrowLeft className="h-4 w-4" aria-hidden />Szkolenie
    </Link>
  );

  // Wynik po oddaniu
  if (wynik) {
    return (
      <div className="wrap wrap--narrow pt-6 pb-24 sm:pt-10 grid gap-8" data-testid="test-wynik">
        {wroc}
        <header className="grid gap-3">
          <p className={cn("label", wynik.zaliczony && "label--g")}>{wynik.zaliczony ? "Test zaliczony" : "Test niezaliczony"}</p>
          <h1 className="h1" data-testid="test-wynik-procent">{liczbaPL(wynik.procent)}%</h1>
          <p className="lead">
            {wynik.wynik} z {wynik.maks} poprawnych odpowiedzi, próg {liczbaPL(wynik.prog)}%.{" "}
            {wynik.automatycznie && "Czas minął: liczą się odpowiedzi zapisane przed końcem czasu. "}
            {wynik.zaliczony
              ? "Teraz krótka anonimowa ankieta, a po niej zaświadczenie."
              : wynik.zakres === "podsumowanie"
                ? "Kolejne podejście to nowy zestaw pytań. Pytania, klucz i uzasadnienia zobaczysz po zaliczeniu testu albo po wykorzystaniu wszystkich podejść."
                : "Przejrzyj uzasadnienia poniżej."}
          </p>
          <div className="flex flex-wrap gap-3">
            {wynik.zaliczony ? (
              <Button asChild data-testid="po-tescie-ankieta"><Link href="/szkolenie/ankieta">Przejdź do ankiety</Link></Button>
            ) : (
              <Button asChild variant="outline"><Link href="/szkolenie">Wróć do szkolenia</Link></Button>
            )}
          </div>
        </header>
        {wynik.moduly.length > 0 && (
          <section className="grid gap-3" aria-labelledby="moduly-wynik" data-testid="test-moduly">
            <h2 id="moduly-wynik" className="h3">Poprawne odpowiedzi w modułach</h2>
            <ul className="rows [&>li:last-child]:border-b-0">
              {wynik.moduly.map((m, k) => (
                <li key={k} className="row py-3 grid-cols-[minmax(0,1fr)_auto] gap-3">
                  <span className="text-body">{m.tytul.replace(/^\s*moduł\s*\d+\s*[:.-]\s*/i, "")}</span>
                  <span className="text-ui tabular-nums">{m.dobrze} z {m.wszystkie} ({m.wszystkie ? liczbaPL(Math.round((m.dobrze / m.wszystkie) * 100)) : 0}%)</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        {wynik.pytania.length > 0 && (
          <section className="grid gap-6" aria-labelledby="bledne">
            <h2 id="bledne" className="h3">
              {wynik.wglad === "pelny" ? `Wgląd w ocenione podejście (${wynik.pytania.length} pytań, błędne: ${wynik.pytania.filter((p) => !p.ok).length})` : `Błędne odpowiedzi (${wynik.pytania.length})`}
            </h2>
            {wynik.pytania.map((b) => (
              <article key={b.nr} className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-[clamp(18px,3vw,32px)] grid gap-4" data-testid={b.ok ? "test-dobra" : "test-bledna"}>
                <p className={cn("label", b.ok && "label--g")}>Pytanie {b.nr}: {b.ok ? "dobrze" : "źle"}</p>
                {b.title && <h3 className="h3">{b.title}</h3>}
                <div className="prose-hk max-w-none" dangerouslySetInnerHTML={sanitizeMarkdown(b.bodyMd)} />
                {b.imageUrl && <img src={b.imageUrl} alt="" className="max-w-full rounded-lg" />}
                <div className="grid gap-[10px]">
                  {b.answers.map((a, k) => {
                    const ok = b.poprawne.includes(a.index);
                    const zle = b.wybrana === a.index && !ok;
                    return (
                      <div key={a.index} className={cn("opt", ok && "is-right", zle && "is-wrong", !ok && !zle && "is-dim")}>
                        <span className="opt__key" aria-hidden>{litera(k)}</span>
                        <span>
                          {a.text}
                          {ok && <span className="sr-only"> (poprawna odpowiedź)</span>}
                          {zle && <span className="sr-only"> (twoja odpowiedź)</span>}
                        </span>
                        <span className="opt__mark" aria-hidden>{ok ? <Check className="h-[18px] w-[18px]" /> : zle ? <X className="h-[18px] w-[18px]" /> : null}</span>
                      </div>
                    );
                  })}
                </div>
                {b.wybrana === null && <p className="text-ui text-[var(--txt2)]">Bez odpowiedzi.</p>}
                {b.wyjasnienie && <Wyjasnienie md={b.wyjasnienie} />}
              </article>
            ))}
          </section>
        )}
      </div>
    );
  }

  // Ekran startowy
  if (!podejscie) {
    const z = stan.zasady;
    const s = stan.stan;
    const mozna = stan.odblokowany && (s.stan === "mozna" || s.stan === "w_toku");
    return (
      <div className="wrap wrap--narrow pt-6 pb-24 sm:pt-10 grid gap-6" data-testid="test-start">
        {wroc}
        <p className="label">Szkolenie z punktami</p>
        <h1 className="h1">Test końcowy</h1>
        <ul className="grid gap-2 text-body text-[var(--txt2)] list-disc pl-5">
          <li>{z.liczbaPytan} {plural(z.liczbaPytan, "pytanie", "pytania", "pytań")} jednokrotnego wyboru, losowanych z puli testu.</li>
          <li>Zaliczenie od {liczbaPL(z.prog)}% poprawnych odpowiedzi.</li>
          {z.limitMinut > 0 && <li>Na rozwiązanie masz {z.limitMinut} min. Po tym czasie test odda się sam z zapisanymi odpowiedziami.</li>}
          <li>Najwyżej {z.limit} {plural(z.limit, "podejście", "podejścia", "podejść")}; po {z.przerwaPo}. niezaliczonym {liczbaPL(z.przerwaGodziny)} h przerwy.</li>
          <li>W trakcie nie zobaczysz, czy odpowiedź jest dobra. Odpowiedzi zapisują się od razu, możesz wrócić do testu później.</li>
          <li>{opisWgladu(z.wglad)}</li>
        </ul>
        {!stan.zapisany ? (
          <p className="text-body">Najpierw <Link href="/szkolenie" className="underline">zapisz się na szkolenie</Link>.</p>
        ) : stan.zespol ? (
          <p className="text-body" data-testid="test-zespol">Podgląd zespołu: konta zespołu nie zdają testu (mają dostęp do klucza).</p>
        ) : !stan.odblokowany ? (
          <p className="text-body" data-testid="test-zablokowany">
            {stan.pulaPusta ? "Test jest w przygotowaniu." : `Test otworzy się po ukończeniu wszystkich modułów. Zostało: ${stan.brakujaceModuly.join(", ")}.`}
          </p>
        ) : s.stan === "zaliczony" ? (
          <p className="text-body">Test jest już zaliczony. <Link href="/szkolenie" className="underline">Wróć do szkolenia</Link>.</p>
        ) : s.stan === "przerwa" ? (
          <p className="text-body" data-testid="test-przerwa">Kolejne podejście od {dataGodzinaPL(s.od)}.</p>
        ) : s.stan === "wyczerpane" ? (
          <p className="text-body">Wykorzystano wszystkie podejścia. Napisz do nas: kontakt@helloekg.pl.</p>
        ) : null}
        {mozna && !stan.zespol && (
          <div>
            <Button onClick={() => start.mutate()} disabled={start.isPending} data-testid="test-rozpocznij">
              {s.stan === "w_toku" ? "Wróć do testu" : `Rozpocznij podejście ${s.wykorzystane + 1} z ${z.limit}`}
            </Button>
          </div>
        )}
      </div>
    );
  }

  // Pytanie
  const wybrana = q ? odpowiedzi[q.id] : undefined;
  const wybierz = (answerIndex: number) => {
    if (!q) return;
    setOdpowiedzi((prev) => ({ ...prev, [q.id]: answerIndex }));
    zapiszOdp.mutate({ questionId: q.id, answerIndex });
  };
  return (
    <div className="wrap wrap--narrow pt-6 pb-24 sm:pt-10 grid gap-6" data-testid="test-pytanie">
      <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <p className="label" data-testid="test-licznik">Pytanie {i + 1} z {pytania.length}</p>
        <p className="label">Odpowiedzi: {odpowiedziane}/{pytania.length}</p>
        {pozostalo !== null && (
          <p className={cn("label inline-flex items-center gap-1 num", pozostalo < 5 * 60_000 && "text-[var(--alarm)]")} role="timer" aria-live="off" data-testid="test-czas">
            <Clock className="h-3.5 w-3.5" aria-hidden />{mmss(pozostalo)}
          </p>
        )}
      </div>
      {q && (
        <article className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-[clamp(22px,3vw,40px)] grid gap-6" aria-labelledby="test-tresc">
          {q.title && <h1 className="h3" id="test-tresc">{q.title}</h1>}
          <div className="prose-hk max-w-none text-[var(--txt)]" id={q.title ? undefined : "test-tresc"} dangerouslySetInnerHTML={sanitizeMarkdown(q.bodyMd)} />
          {q.imageUrl && <img src={q.imageUrl} alt="" className="max-w-full rounded-lg" />}
          <div className="grid gap-[10px]" role="radiogroup" aria-label="Odpowiedzi">
            {q.answers.map((a, k) => (
              <button
                key={a.index}
                type="button"
                role="radio"
                aria-checked={wybrana === a.index}
                className={cn(
                  "opt",
                  wybrana === a.index && "!border-[var(--txt2)] bg-[color-mix(in_srgb,var(--txt)_5%,transparent)] [&_.opt__key]:border-[var(--txt2)] [&_.opt__key]:text-[var(--txt)]",
                )}
                onClick={() => wybierz(a.index)}
                data-testid={`test-odp-${k}`}
              >
                <span className="opt__key" aria-hidden>{litera(k)}</span>
                <span>{a.text}</span>
                <span className="opt__mark" aria-hidden />
              </button>
            ))}
          </div>
        </article>
      )}
      <div className="flex items-center justify-between gap-3">
        <Button variant="outline" onClick={() => setI((x) => Math.max(0, x - 1))} disabled={i === 0} data-testid="test-poprzednie">
          <ChevronLeft className="h-4 w-4" aria-hidden />Poprzednie
        </Button>
        {i < pytania.length - 1 ? (
          <Button onClick={() => { setI((x) => x + 1); window.scrollTo(0, 0); }} data-testid="test-nastepne">
            Następne<ChevronRight className="h-4 w-4" aria-hidden />
          </Button>
        ) : (
          <Button onClick={() => setPotwierdz(true)} data-testid="test-oddaj">Oddaj test</Button>
        )}
      </div>
      <nav aria-label="Pytania testu" className="flex flex-wrap gap-2">
        {pytania.map((p, k) => (
          <button
            key={p.id}
            type="button"
            onClick={() => setI(k)}
            aria-current={k === i ? "step" : undefined}
            aria-label={`Pytanie ${k + 1}${odpowiedzi[p.id] !== undefined ? ", z odpowiedzią" : ", bez odpowiedzi"}`}
            className={cn(
              "h-11 w-11 rounded-lg border text-ui num",
              k === i ? "border-[var(--txt)]" : "border-[var(--line2)]",
              odpowiedzi[p.id] !== undefined ? "bg-[color-mix(in_srgb,var(--txt)_8%,transparent)] text-[var(--txt)]" : "text-[var(--txt2)]",
            )}
          >
            {k + 1}
          </button>
        ))}
      </nav>
      {potwierdz && (
        <div className="rounded-2xl border border-[var(--line2)] p-5 grid gap-4" role="alertdialog" aria-labelledby="oddaj-tytul" data-testid="test-potwierdz">
          <p id="oddaj-tytul" className="text-body">
            {odpowiedziane < pytania.length
              ? `Bez odpowiedzi: ${pytania.length - odpowiedziane}. Pytanie bez odpowiedzi liczy się jako błędne. Oddać test?`
              : "Oddać test? Po oddaniu odpowiedzi nie da się zmienić."}
          </p>
          <div className="flex flex-wrap gap-3">
            <Button onClick={() => oddaj.mutate()} disabled={oddaj.isPending} data-testid="test-oddaj-potwierdz">
              {oddaj.isPending ? "Sprawdzam…" : "Oddaj test"}
            </Button>
            <Button variant="outline" onClick={() => setPotwierdz(false)}>Wróć do pytań</Button>
          </div>
        </div>
      )}
    </div>
  );
}
