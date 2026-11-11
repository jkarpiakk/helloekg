import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { bladSerwera, dataGodzinaPL, liczbaPL } from "@/lib/szkolenie";
import { NAZWA_ZAWODU, czyZawod } from "@shared/szkolenie";

interface Uczestnik {
  id: string;
  participantId: string;
  kontoUsuniete: boolean;
  email: string | null;
  zawod: string;
  zawodNazwa: string;
  pwz: string | null;
  pwzOstrzezenie: string | null;
  specjalizacja: string | null;
  imie: string;
  nazwisko: string;
  zapisAt: string;
  zablokowany: boolean;
  modulyUkonczone: number;
  test: { procent: string; zaliczony: boolean; at: string } | null;
  podejscia: number;
  zaswiadczenie: string | null;
}

interface Regula {
  profession: string;
  active: boolean;
  legalBasis: string | null;
  pointsFormula: string | null;
  pointsPerHour: string;
  maxPoints: string | null;
  minHours: string | null;
  testRequired: boolean;
  registryRequired: boolean;
  registryNumber: string | null;
  inactiveReason: string | null;
  updatedAt: string;
}

/** Szkolenie z punktami w panelu: uczestnicy i lista obecności, reguły punktów, raport ankiety, ustawienia */
export default function SzkolenieAdmin() {
  const { hasRole } = useAuth();
  const wlasciciel = hasRole("owner");
  return (
    <div className="space-y-6" data-testid="admin-szkolenie">
      <div>
        <h2 className="text-2xl font-bold">Szkolenie z punktami</h2>
        <p className="text-muted-foreground">Zapisy, dziennik i lista obecności zostają 5 lat, także po usunięciu konta. Czas w strefie Polski.</p>
      </div>
      <Tabs defaultValue="uczestnicy" className="space-y-6">
        <TabsList>
          <TabsTrigger value="uczestnicy">Uczestnicy</TabsTrigger>
          <TabsTrigger value="reguly">Reguły punktów</TabsTrigger>
          <TabsTrigger value="ankieta">Ankieta</TabsTrigger>
          {wlasciciel && <TabsTrigger value="ustawienia">Ustawienia szkolenia</TabsTrigger>}
        </TabsList>
        <TabsContent value="uczestnicy"><Uczestnicy /></TabsContent>
        <TabsContent value="reguly"><Reguly edycja={wlasciciel} /></TabsContent>
        <TabsContent value="ankieta"><RaportAnkiety /></TabsContent>
        {wlasciciel && <TabsContent value="ustawienia"><UstawieniaSzkolenia /></TabsContent>}
      </Tabs>
    </div>
  );
}

function Uczestnicy() {
  const { data, isLoading } = useQuery<{ modulyWszystkie: number; uczestnicy: Uczestnik[] }>({
    queryKey: ["/api/admin/szkolenie/uczestnicy"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/szkolenie/uczestnicy")).json(),
    staleTime: 0,
  });
  const [edytowany, setEdytowany] = useState<Uczestnik | null>(null);
  const [dziennik, setDziennik] = useState<Uczestnik | null>(null);
  if (isLoading || !data) return <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>;
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle>Uczestnicy ({data.uczestnicy.length})</CardTitle>
        <Button asChild variant="outline" size="sm">
          <a href="/api/admin/szkolenie/lista-obecnosci.csv" download data-testid="lista-obecnosci-csv"><Download className="h-4 w-4" />Lista obecności (CSV)</a>
        </Button>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        {data.uczestnicy.length === 0 ? (
          <p className="text-muted-foreground">Nikt jeszcze się nie zapisał.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-muted-foreground">
              <tr>
                <th className="py-2 pr-4">Uczestnik</th><th className="py-2 pr-4">Zawód i PWZ</th><th className="py-2 pr-4">Moduły</th>
                <th className="py-2 pr-4">Test</th><th className="py-2 pr-4">Zaświadczenie</th><th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {data.uczestnicy.map((u) => (
                <tr key={u.id} className="border-t border-border align-top" data-testid={`uczestnik-${u.id}`}>
                  <td className="py-2 pr-4">
                    <div className="font-medium">{u.imie} {u.nazwisko}</div>
                    <div className="text-muted-foreground">{u.kontoUsuniete ? "konto usunięte" : u.email}</div>
                    <div className="text-muted-foreground">zapis {dataGodzinaPL(u.zapisAt)}</div>
                  </td>
                  <td className="py-2 pr-4">
                    <div>{u.zawodNazwa}</div>
                    <div>{u.pwz ?? "brak PWZ"}{u.specjalizacja ? ` · ${u.specjalizacja}` : ""}</div>
                    {u.pwzOstrzezenie && <Badge variant="destructive" title={u.pwzOstrzezenie}>PWZ do sprawdzenia</Badge>}
                    {u.zablokowany && <Badge variant="secondary">zablokowane</Badge>}
                  </td>
                  <td className="py-2 pr-4">{u.modulyUkonczone}/{data.modulyWszystkie}</td>
                  <td className="py-2 pr-4">
                    {u.test ? `${liczbaPL(Number(u.test.procent))}% ${u.test.zaliczony ? "zaliczony" : "niezaliczony"}` : "brak"}
                    <div className="text-muted-foreground">podejścia: {u.podejscia}</div>
                  </td>
                  <td className="py-2 pr-4">{u.zaswiadczenie ? <a className="underline" href={`/api/szkolenie/zaswiadczenia/${u.zaswiadczenie}/pdf`}>{u.zaswiadczenie}</a> : "brak"}</td>
                  <td className="py-2 space-x-2 whitespace-nowrap">
                    <Button size="sm" variant="outline" onClick={() => setEdytowany(u)} data-testid={`edytuj-${u.id}`}>Edytuj dane</Button>
                    <Button size="sm" variant="ghost" onClick={() => setDziennik(u)}>Dziennik</Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </CardContent>
      {edytowany && <EdycjaZapisu u={edytowany} onClose={() => setEdytowany(null)} />}
      {dziennik && <Dziennik u={dziennik} onClose={() => setDziennik(null)} />}
    </Card>
  );
}

function EdycjaZapisu({ u, onClose }: { u: Uczestnik; onClose: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [imie, setImie] = useState(u.imie);
  const [nazwisko, setNazwisko] = useState(u.nazwisko);
  const [pwz, setPwz] = useState(u.pwz ?? "");
  const [spec, setSpec] = useState(u.specjalizacja ?? "");
  const [powod, setPowod] = useState("");
  const zapis = useMutation({
    mutationFn: async () => (await apiRequest("PUT", `/api/admin/szkolenie/zapisy/${u.id}`, {
      imie, nazwisko, pwz: pwz || null, specjalizacja: spec || null, powod,
    })).json(),
    onSuccess: () => {
      toast({ title: "Zapisane, zmiana jest w dzienniku" });
      qc.invalidateQueries({ queryKey: ["/api/admin/szkolenie/uczestnicy"] });
      onClose();
    },
    onError: (e) => toast({ title: "Nie udało się", description: bladSerwera(e), variant: "destructive" }),
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Dane uczestnika: {u.zawodNazwa}</DialogTitle></DialogHeader>
        <div className="grid gap-3">
          <label className="grid gap-1 text-sm">Imię<Input value={imie} onChange={(e) => setImie(e.target.value)} /></label>
          <label className="grid gap-1 text-sm">Nazwisko<Input value={nazwisko} onChange={(e) => setNazwisko(e.target.value)} /></label>
          <label className="grid gap-1 text-sm">Numer PWZ<Input value={pwz} onChange={(e) => setPwz(e.target.value)} /></label>
          <label className="grid gap-1 text-sm">Specjalizacja<Input value={spec} onChange={(e) => setSpec(e.target.value)} /></label>
          <label className="grid gap-1 text-sm">Powód zmiany (do dziennika)<Textarea rows={2} value={powod} onChange={(e) => setPowod(e.target.value)} data-testid="edycja-powod" /></label>
          <p className="text-xs text-muted-foreground">Wydane zaświadczenia to kopie z chwili wydania; po zmianie danych unieważnij stare zaświadczenie, a uczestnik odbierze nowe.</p>
          <Button onClick={() => zapis.mutate()} disabled={zapis.isPending}>Zapisz</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Dziennik({ u, onClose }: { u: Uczestnik; onClose: () => void }) {
  const { data } = useQuery<Array<{ typ: string; nazwa: string; atPL: string; details: Record<string, unknown> }>>({
    queryKey: ["/api/admin/szkolenie/dziennik", u.participantId],
    queryFn: async () => (await apiRequest("GET", `/api/admin/szkolenie/dziennik/${u.participantId}`)).json(),
    staleTime: 0,
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Dziennik: {u.imie} {u.nazwisko}</DialogTitle></DialogHeader>
        {!data ? <LoadingSpinner /> : (
          <ol className="grid gap-2 text-sm">
            {data.map((w, i) => (
              <li key={i} className="border-b border-border pb-2">
                <span className="font-mono text-xs text-muted-foreground">{w.atPL}</span> <b>{w.nazwa}</b>
                {typeof w.details?.tytul === "string" && <span> · {w.details.tytul}</span>}
                {typeof w.details?.procent === "number" && <span> · {liczbaPL(w.details.procent)}%</span>}
                {typeof w.details?.numer === "string" && <span> · {w.details.numer}</span>}
                {typeof w.details?.powod === "string" && <span> · powód: {w.details.powod}</span>}
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Reguly({ edycja }: { edycja: boolean }) {
  const { data, isLoading } = useQuery<Regula[]>({
    queryKey: ["/api/admin/szkolenie/reguly"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/szkolenie/reguly")).json(),
  });
  if (isLoading || !data) return <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>;
  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Zaświadczenie zapisuje kopię reguły z chwili wydania. Reguła lekarzy działa dopiero z numerem wpisu do rejestru.
        {!edycja && " Zmienia je tylko właściciel."}
      </p>
      {data.map((r) => <RegulaKarta key={r.profession} r={r} edycja={edycja} />)}
    </div>
  );
}

function RegulaKarta({ r, edycja }: { r: Regula; edycja: boolean }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const [d, setD] = useState(r);
  useEffect(() => setD(r), [r]);
  const num = (v: string | null) => (v === null || v === "" ? null : Number(v));
  const zapis = useMutation({
    mutationFn: async () => (await apiRequest("PUT", `/api/admin/szkolenie/reguly/${r.profession}`, {
      active: d.active, legalBasis: d.legalBasis || null, pointsFormula: d.pointsFormula || null,
      pointsPerHour: Number(d.pointsPerHour) || 0, maxPoints: num(d.maxPoints), minHours: num(d.minHours),
      testRequired: d.testRequired, registryRequired: d.registryRequired, registryNumber: d.registryNumber || null, inactiveReason: d.inactiveReason || null,
    })).json(),
    onSuccess: () => {
      toast({ title: "Reguła zapisana" });
      qc.invalidateQueries({ queryKey: ["/api/admin/szkolenie/reguly"] });
    },
    onError: (e) => toast({ title: "Nie udało się", description: bladSerwera(e), variant: "destructive" }),
  });
  const pole = (k: keyof Regula, label: string, typ: "text" | "number" = "text") => (
    <label className="grid gap-1 text-sm">{label}
      <Input type={typ} value={(d[k] as string | null) ?? ""} disabled={!edycja} onChange={(e) => setD({ ...d, [k]: e.target.value })} />
    </label>
  );
  return (
    <Card data-testid={`regula-${r.profession}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="first-letter:uppercase">{czyZawod(r.profession) ? NAZWA_ZAWODU[r.profession] : r.profession}</CardTitle>
        <label className="flex items-center gap-2 text-sm">Aktywna<Switch checked={d.active} disabled={!edycja} onCheckedChange={(v) => setD({ ...d, active: v })} /></label>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        {pole("pointsPerHour", "Punkty za godzinę", "number")}
        {pole("maxPoints", "Maks. punktów (puste = bez limitu)", "number")}
        {pole("minHours", "Min. godzin (puste = bez minimum)", "number")}
        {pole("registryNumber", "Numer wpisu do rejestru / decyzji")}
        <div className="sm:col-span-2">{pole("legalBasis", "Podstawa prawna")}</div>
        <div className="sm:col-span-2">{pole("pointsFormula", "Sposób liczenia (na zaświadczeniu)")}</div>
        <div className="sm:col-span-2">{pole("inactiveReason", "Komunikat, gdy reguła nie działa")}</div>
        <label className="flex items-center gap-2 text-sm">Test wymagany<Switch checked={d.testRequired} disabled={!edycja} onCheckedChange={(v) => setD({ ...d, testRequired: v })} /></label>
        <label className="flex items-center gap-2 text-sm">Wymaga numeru rejestru<Switch checked={d.registryRequired} disabled={!edycja} onCheckedChange={(v) => setD({ ...d, registryRequired: v })} /></label>
        {edycja && <div className="sm:col-span-2"><Button onClick={() => zapis.mutate()} disabled={zapis.isPending}>Zapisz regułę</Button></div>}
      </CardContent>
    </Card>
  );
}

function RaportAnkiety() {
  const { data, isLoading } = useQuery<{ odpowiedzi: number; pytania: Array<{ id: string; typ: string; tresc: string; n: number; srednia?: number | null; rozklad?: number[]; tak?: number; nie?: number; teksty?: string[] }> }>({
    queryKey: ["/api/admin/szkolenie/ankieta"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/szkolenie/ankieta")).json(),
    staleTime: 0,
  });
  if (isLoading || !data) return <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>;
  return (
    <Card>
      <CardHeader><CardTitle>Raport ankiety ({data.odpowiedzi} {data.odpowiedzi === 1 ? "odpowiedź" : "odpowiedzi"})</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">Ankieta jest anonimowa: odpowiedzi nie mają powiązania z kontem ani dokładnej daty (tylko miesiąc).</p>
        {data.pytania.map((p) => (
          <div key={p.id} className="border-t border-border pt-3 text-sm">
            <p className="font-medium">{p.tresc}</p>
            {p.typ === "skala" && <p>Średnia: {p.srednia ?? "brak"} (n = {p.n}) · rozkład od 1 do 5: {p.rozklad?.join(" / ")}</p>}
            {p.typ === "tak_nie" && <p>Tak: {p.tak} · Nie: {p.nie}</p>}
            {p.typ === "tekst" && (p.teksty?.length ? <ul className="list-disc pl-5">{p.teksty.map((t, i) => <li key={i}>{t}</li>)}</ul> : <p className="text-muted-foreground">Brak uwag.</p>)}
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

type UstawieniaCme = {
  szkolenie_wlaczone: boolean;
  cwiczenia_wymagane: boolean;
  pwz_kontrola_lekarz: string;
  regulamin_szkolenia_opublikowany: boolean;
  cme_godziny: number;
  cme_test_liczba_pytan: number;
  cme_test_prog_procent: number;
  cme_test_limit_podejsc: number;
  cme_test_przerwa_po: number;
  cme_test_przerwa_godziny: number;
  cme_tytul: string;
  cme_forma: string;
  cme_organizator: Record<string, string>;
  cme_kierownik_naukowy: string;
  cme_ankieta: unknown;
};

/** Ustawienia szkolenia (tylko właściciel): ta sama trasa co inne przełączniki, wpis w audycie */
function UstawieniaSzkolenia() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data } = useQuery<UstawieniaCme>({
    queryKey: ["/api/admin/ustawienia"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/ustawienia")).json(),
  });
  const [org, setOrg] = useState<Record<string, string>>({});
  const [ankieta, setAnkieta] = useState("");
  const [teksty, setTeksty] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!data) return;
    setOrg(data.cme_organizator);
    setAnkieta(JSON.stringify(data.cme_ankieta, null, 2));
    setTeksty({
      cme_tytul: data.cme_tytul, cme_forma: data.cme_forma, cme_kierownik_naukowy: data.cme_kierownik_naukowy,
      cme_godziny: String(data.cme_godziny), cme_test_liczba_pytan: String(data.cme_test_liczba_pytan), cme_test_prog_procent: String(data.cme_test_prog_procent),
      cme_test_limit_podejsc: String(data.cme_test_limit_podejsc), cme_test_przerwa_po: String(data.cme_test_przerwa_po), cme_test_przerwa_godziny: String(data.cme_test_przerwa_godziny),
    });
  }, [data]);
  const zapis = useMutation({
    mutationFn: async ({ klucz, wartosc }: { klucz: string; wartosc: unknown }) => (await apiRequest("PUT", "/api/admin/ustawienia", { klucz, wartosc })).json(),
    onSuccess: () => {
      toast({ title: "Zapisane (działa do 10 s)" });
      qc.invalidateQueries({ queryKey: ["/api/admin/ustawienia"] });
    },
    onError: (e) => toast({ title: "Nie udało się", description: bladSerwera(e), variant: "destructive" }),
  });
  if (!data) return <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>;
  const ustaw = (klucz: string, wartosc: unknown) => zapis.mutate({ klucz, wartosc });
  const przelacznik = (klucz: keyof UstawieniaCme, tytul: string, opis: string) => (
    <div className="flex items-start justify-between gap-6 border-b border-border py-3">
      <div><p className="font-medium">{tytul}</p><p className="text-sm text-muted-foreground">{opis}</p></div>
      <Switch checked={!!data[klucz]} onCheckedChange={(v) => ustaw(klucz, v)} data-testid={`ustawienie-${klucz}`} />
    </div>
  );
  const liczba = (klucz: string, label: string) => (
    <label className="grid gap-1 text-sm">{label}
      <div className="flex gap-2">
        <Input type="number" value={teksty[klucz] ?? ""} onChange={(e) => setTeksty({ ...teksty, [klucz]: e.target.value })} />
        <Button variant="outline" size="sm" onClick={() => ustaw(klucz, Number(teksty[klucz]))}>Zapisz</Button>
      </div>
    </label>
  );
  const tekst = (klucz: string, label: string) => (
    <label className="grid gap-1 text-sm">{label}
      <div className="flex gap-2">
        <Input value={teksty[klucz] ?? ""} onChange={(e) => setTeksty({ ...teksty, [klucz]: e.target.value })} />
        <Button variant="outline" size="sm" onClick={() => ustaw(klucz, teksty[klucz])}>Zapisz</Button>
      </div>
    </label>
  );
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader><CardTitle>Przełączniki</CardTitle></CardHeader>
        <CardContent>
          {przelacznik("szkolenie_wlaczone", "Szkolenie widoczne dla kursantów", "Zapis, test, ankieta i zaświadczenia. Wyłączone widzi tylko zespół (podgląd).")}
          {przelacznik("cwiczenia_wymagane", "Ćwiczenia wymagane do ukończenia modułu", "Każdy temat z pytaniami opanowany (wariant B).")}
          {przelacznik("regulamin_szkolenia_opublikowany", "Regulamin szkolenia opublikowany", "Po publikacji zapis wymaga akceptacji regulaminu.")}
          <div className="flex items-start justify-between gap-6 py-3">
            <div><p className="font-medium">Cyfra kontrolna PWZ lekarza</p><p className="text-sm text-muted-foreground">Ostrzeżenie, dopóki algorytm nie jest potwierdzony na prawdziwych numerach.</p></div>
            <select className="rounded-md border border-border bg-background px-2 py-1 text-sm" value={data.pwz_kontrola_lekarz} onChange={(e) => ustaw("pwz_kontrola_lekarz", e.target.value)}>
              <option value="ostrzezenie">ostrzeżenie</option><option value="blokada">blokada</option><option value="wylaczona">bez sprawdzania</option>
            </select>
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Test i godziny</CardTitle></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2">
          {liczba("cme_godziny", "Liczba godzin szkolenia")}
          {liczba("cme_test_liczba_pytan", "Pytań w teście")}
          {liczba("cme_test_prog_procent", "Próg zaliczenia (%)")}
          {liczba("cme_test_limit_podejsc", "Limit podejść")}
          {liczba("cme_test_przerwa_po", "Przerwa po którym niezaliczonym")}
          {liczba("cme_test_przerwa_godziny", "Przerwa (godziny)")}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Zaświadczenie</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          {tekst("cme_tytul", "Tytuł szkolenia")}
          {tekst("cme_forma", "Forma szkolenia")}
          {tekst("cme_kierownik_naukowy", "Kierownik naukowy")}
          <div className="grid gap-2 sm:grid-cols-2">
            {(["nazwa", "adres", "krs", "nip", "email", "reklamacje"] as const).map((k) => (
              <label key={k} className="grid gap-1 text-sm">Organizator: {k}
                <Input value={org[k] ?? ""} onChange={(e) => setOrg({ ...org, [k]: e.target.value })} />
              </label>
            ))}
          </div>
          <div><Button variant="outline" onClick={() => ustaw("cme_organizator", org)}>Zapisz dane organizatora</Button></div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Pytania ankiety (JSON)</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          <p className="text-sm text-muted-foreground">{"{ wersja, pytania: [{ id, typ: skala | tak_nie | tekst, tresc, wymagane }] }"}. Zmiana pytań: podnieś wersję.</p>
          <Textarea rows={14} className="font-mono text-xs" value={ankieta} onChange={(e) => setAnkieta(e.target.value)} />
          <div>
            <Button variant="outline" onClick={() => {
              try { ustaw("cme_ankieta", JSON.parse(ankieta)); } catch { toast({ title: "To nie jest poprawny JSON", variant: "destructive" }); }
            }}>Zapisz ankietę</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
