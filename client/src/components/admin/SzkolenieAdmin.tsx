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
import { IZBY_LEKARSKIE, NAZWA_ZAWODU, czyZawod } from "@shared/szkolenie";

interface Uczestnik {
  id: string;
  participantId: string;
  kontoUsuniete: boolean;
  email: string | null;
  zawod: string;
  zawodNazwa: string;
  pwz: string | null;
  pwzUwaga: string | null;
  pwzOverride: boolean;
  pwzSprawdzonyAt: string | null;
  pwzSprawdzil: string | null;
  specjalizacja: string | null;
  izba: string | null;
  imie: string;
  nazwisko: string;
  zapisAt: string;
  zablokowany: boolean;
  modulyUkonczone: number;
  test: { procent: string; zaliczony: boolean; at: string } | null;
  podejscia: number;
  zaswiadczenia: Array<{ numer: string; rodzaj: "punkty" | "ukonczenie" }>;
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
  nrlResolution: string | null;
  formInfoAcceptedAt: string | null;
  decisionNumber: string | null;
  pointsMode: "godziny" | "decyzja";
  pointsGranted: string | null;
  formText: string | null;
  dziala: boolean;
  /** Czego brakuje aktywnej regule, żeby dawała punkty */
  braki: string[];
  inactiveReason: string | null;
  nrlResolutionAt: string | null;
  obowiazujeOd: string | null;
  obowiazujeDo: string | null;
  obowiazujeOdPodpowiedz: string | null;
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
      <BrakiOrganizatora />
      <Tabs defaultValue="uczestnicy" className="space-y-6">
        <TabsList>
          <TabsTrigger value="uczestnicy">Uczestnicy</TabsTrigger>
          <TabsTrigger value="reguly">Reguły punktów</TabsTrigger>
          <TabsTrigger value="ankieta">Ankieta</TabsTrigger>
          {wlasciciel && <TabsTrigger value="ustawienia">Ustawienia szkolenia</TabsTrigger>}
        </TabsList>
        <TabsContent value="uczestnicy"><div className="space-y-6"><Uczestnicy /><RaportIzby /><PulaTestu /></div></TabsContent>
        <TabsContent value="reguly"><Reguly edycja={wlasciciel} /></TabsContent>
        <TabsContent value="ankieta"><RaportAnkiety /></TabsContent>
        {wlasciciel && <TabsContent value="ustawienia"><UstawieniaSzkolenia /></TabsContent>}
      </Tabs>
    </div>
  );
}

/** Zaświadczenia z punktami są wstrzymane, dopóki dane organizatora nie są kompletne (uczestnik dostaje ukończenie) */
function BrakiOrganizatora() {
  const { data } = useQuery<{ organizator: string[] }>({
    queryKey: ["/api/admin/szkolenie/braki"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/szkolenie/braki")).json(),
    staleTime: 0,
  });
  if (!data?.organizator.length) return null;
  return (
    <Card className="border-destructive" data-testid="braki-organizatora">
      <CardContent className="pt-6 text-sm">
        <p className="font-medium">Zaświadczenia z punktami są wstrzymane: brakuje danych organizatora.</p>
        <p className="text-muted-foreground">Uzupełnij w Ustawieniach szkolenia: {data.organizator.join(", ")}. Do tego czasu uczestnicy widzą „zaświadczenie z punktami czeka na uzupełnienie danych organizatora” i mogą pobrać zaświadczenie ukończenia bez punktów.</p>
      </CardContent>
    </Card>
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
  const { toast } = useToast();
  const qc = useQueryClient();
  const { user } = useAuth();
  // wysyłamy dane, które admin widzi na liście: serwer zatwierdzi je tylko, jeśli się nie zmieniły
  const sprawdz = useMutation({
    mutationFn: async ({ u, sprawdzony }: { u: Uczestnik; sprawdzony: boolean }) =>
      (await apiRequest("POST", `/api/admin/szkolenie/zapisy/${u.id}/pwz-sprawdzony`, sprawdzony
        ? { sprawdzony, pwz: u.pwz, imie: u.imie, nazwisko: u.nazwisko }
        : { sprawdzony })).json(),
    onSuccess: () => {
      toast({ title: "Zapisane w dzienniku" });
      qc.invalidateQueries({ queryKey: ["/api/admin/szkolenie/uczestnicy"] });
    },
    onError: (e) => {
      toast({ title: "Nie udało się", description: bladSerwera(e), variant: "destructive" });
      qc.invalidateQueries({ queryKey: ["/api/admin/szkolenie/uczestnicy"] });
    },
  });
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
                    {u.izba && <div className="text-muted-foreground">{u.izba}</div>}
                    <div className="text-muted-foreground" data-testid={`pwz-stan-${u.id}`}>
                      {u.pwzSprawdzonyAt ? `PWZ sprawdzony ${dataGodzinaPL(u.pwzSprawdzonyAt)}${u.pwzSprawdzil ? ` (${u.pwzSprawdzil})` : ""}` : "PWZ niesprawdzony w rejestrze"}
                    </div>
                    {u.pwzOverride && <Badge variant="destructive" title={u.pwzUwaga ?? ""}>PWZ bez walidacji</Badge>}
                    {u.zablokowany && <Badge variant="secondary">zablokowane</Badge>}
                  </td>
                  <td className="py-2 pr-4">{u.modulyUkonczone}/{data.modulyWszystkie}</td>
                  <td className="py-2 pr-4">
                    {u.test ? `${liczbaPL(Number(u.test.procent))}% ${u.test.zaliczony ? "zaliczony" : "niezaliczony"}` : "brak"}
                    <div className="text-muted-foreground">podejścia: {u.podejscia}</div>
                  </td>
                  <td className="py-2 pr-4">
                    {u.zaswiadczenia.length ? u.zaswiadczenia.map((c) => (
                      <div key={c.numer}><a className="underline" href={`/api/szkolenie/zaswiadczenia/${c.numer}/pdf`}>{c.numer}</a> {c.rodzaj === "punkty" ? "z punktami" : "bez punktów"}</div>
                    )) : "brak"}
                  </td>
                  <td className="py-2 space-x-2 space-y-1 whitespace-nowrap">
                    <Button size="sm" variant={u.pwzSprawdzonyAt ? "ghost" : "default"} disabled={sprawdz.isPending || (!u.pwzSprawdzonyAt && u.participantId === user?.id)}
                      onClick={() => sprawdz.mutate({ u, sprawdzony: !u.pwzSprawdzonyAt })} data-testid={`pwz-sprawdzony-${u.id}`}
                      title={u.participantId === user?.id ? "Własnego PWZ nie sprawdzasz: poproś inną osobę z zespołu" : "Porównaj imię, nazwisko i numer z publicznym rejestrem NIL albo NIPiP"}>
                      {u.pwzSprawdzonyAt ? "Cofnij sprawdzenie PWZ" : "PWZ sprawdzony w publicznym rejestrze"}
                    </Button>
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
  const [izba, setIzba] = useState(u.izba ?? "");
  const [pomin, setPomin] = useState(u.pwzOverride);
  const [powod, setPowod] = useState("");
  const zapis = useMutation({
    mutationFn: async () => (await apiRequest("PUT", `/api/admin/szkolenie/zapisy/${u.id}`, {
      imie, nazwisko, pwz: pwz || null, specjalizacja: spec || null, izba: izba || null, pominWalidacje: pomin, powod,
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
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={pomin} onChange={(e) => setPomin(e.target.checked)} />Pomiń walidację formatu PWZ (wyjątek, np. PWZ warunkowe; trafia do dziennika)</label>
          <label className="grid gap-1 text-sm">Specjalizacja<Input value={spec} onChange={(e) => setSpec(e.target.value)} /></label>
          <label className="grid gap-1 text-sm">Okręgowa izba lekarska
            <select className="rounded-md border border-border bg-background px-2 py-2 text-sm" value={izba} onChange={(e) => setIzba(e.target.value)}>
              <option value="">nie wybrano</option>{IZBY_LEKARSKIE.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>
          </label>
          <label className="grid gap-1 text-sm">Powód zmiany (do dziennika)<Textarea rows={2} value={powod} onChange={(e) => setPowod(e.target.value)} data-testid="edycja-powod" /></label>
          <p className="text-xs text-muted-foreground">Wydane zaświadczenia to kopie z chwili wydania; po zmianie danych unieważnij stare zaświadczenie, a uczestnik odbierze nowe. Zmiana imienia, nazwiska albo PWZ cofa sprawdzenie w rejestrze.</p>
          <Button onClick={() => zapis.mutate()} disabled={zapis.isPending}>Zapisz</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function Dziennik({ u, onClose }: { u: Uczestnik; onClose: () => void }) {
  const { data } = useQuery<Array<{ typ: string; nazwa: string; atPL: string; details: Record<string, unknown>; wykonawca: { email: string; imie: string | null; rola: string } | null }>>({
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
                {typeof w.details?.rozdzial === "number" && <span> · rozdział {w.details.rozdzial}</span>}
                {w.wykonawca && <span className="text-muted-foreground"> · wykonał: {w.wykonawca.imie ? `${w.wykonawca.imie}, ` : ""}{w.wykonawca.email} ({w.wykonawca.rola})</span>}
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
        Zaświadczenie zapisuje kopię reguły z chwili wydania, razem z okresem obowiązywania. Punkty tylko wtedy, gdy całe szkolenie uczestnika
        (zapis i zaliczenie testu) mieści się w okresie „obowiązuje od/do”: bez daty „od” reguła nie daje punktów. Reguła lekarzy działa
        dopiero z uchwałą NRL, numerem wpisu i datą przyjęcia informacji o formie; „od” to domyślnie późniejsza z dat uchwały i informacji.
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
      pointsMode: d.pointsMode, pointsGranted: num(d.pointsGranted), nrlResolution: d.nrlResolution || null,
      formInfoAcceptedAt: d.formInfoAcceptedAt || null, decisionNumber: d.decisionNumber || null, formText: d.formText || null,
      nrlResolutionAt: d.nrlResolutionAt || null, obowiazujeOd: d.obowiazujeOd || null, obowiazujeDo: d.obowiazujeDo || null,
      testRequired: d.testRequired, registryRequired: d.registryRequired, registryNumber: d.registryNumber || null, inactiveReason: d.inactiveReason || null,
    })).json(),
    onSuccess: () => {
      toast({ title: "Reguła zapisana" });
      qc.invalidateQueries({ queryKey: ["/api/admin/szkolenie/reguly"] });
    },
    onError: (e) => toast({ title: "Nie udało się", description: bladSerwera(e), variant: "destructive" }),
  });
  const pole = (k: keyof Regula, label: string, typ: "text" | "number" | "date" = "text") => (
    <label className="grid gap-1 text-sm">{label}
      <Input type={typ} value={(d[k] as string | null) ?? ""} disabled={!edycja} onChange={(e) => setD({ ...d, [k]: e.target.value })} />
    </label>
  );
  return (
    <Card data-testid={`regula-${r.profession}`}>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="first-letter:uppercase">{czyZawod(r.profession) ? NAZWA_ZAWODU[r.profession] : r.profession}</CardTitle>
        <div className="flex items-center gap-3">
          <Badge variant={r.dziala ? "default" : "secondary"} data-testid={`regula-dziala-${r.profession}`}>{r.dziala ? "daje punkty" : "nie daje punktów"}</Badge>
          <label className="flex items-center gap-2 text-sm">Aktywna<Switch checked={d.active} disabled={!edycja} onCheckedChange={(v) => setD({ ...d, active: v })} /></label>
        </div>
      </CardHeader>
      <CardContent className="grid gap-3 sm:grid-cols-2">
        <label className="grid gap-1 text-sm">Sposób przyznania punktów
          <select className="rounded-md border border-border bg-background px-2 py-2 text-sm" disabled={!edycja} value={d.pointsMode} onChange={(e) => setD({ ...d, pointsMode: e.target.value as Regula["pointsMode"] })}>
            <option value="godziny">z godzin (punkty za godzinę dydaktyczną)</option>
            <option value="decyzja">z uchwały / decyzji (przyznana liczba)</option>
          </select>
        </label>
        {r.active && r.braki.length > 0 && (
          <p className="sm:col-span-2 text-sm text-destructive" data-testid={`regula-braki-${r.profession}`}>Reguła nie daje punktów, brakuje: {r.braki.join(", ")}.</p>
        )}
        {d.pointsMode === "decyzja" ? pole("pointsGranted", "Punkty przyznane w uchwale / decyzji", "number") : pole("pointsPerHour", r.profession === "ratownik" ? "Punkty za godzinę dydaktyczną (45 min)" : "Punkty za godzinę programu", "number")}
        {pole("maxPoints", "Maks. punktów (puste = bez limitu)", "number")}
        {pole("obowiazujeOd", r.obowiazujeOdPodpowiedz && !d.obowiazujeOd ? `Obowiązuje od (podpowiedź: ${r.obowiazujeOdPodpowiedz})` : "Obowiązuje od (punkty nie działają wstecz)", "date")}
        {pole("obowiazujeDo", "Obowiązuje do (puste = bez końca)", "date")}
        {pole("minHours", "Min. godzin (puste = bez minimum)", "number")}
        {d.registryRequired && pole("nrlResolution", "Uchwała Naczelnej Rady Lekarskiej (numer)")}
        {d.registryRequired && pole("nrlResolutionAt", "Data uchwały NRL", "date")}
        {d.registryRequired && pole("registryNumber", "Numer wpisu do rejestru (RR-NNNNNN-00X-ZZZZ)")}
        {d.registryRequired && pole("formInfoAcceptedAt", "Data przyjęcia informacji o formie (RRRR-MM-DD)")}
        {!d.registryRequired && d.pointsMode === "decyzja" && pole("decisionNumber", "Numer decyzji (np. NRPiP)")}
        <div className="sm:col-span-2">{pole("formText", "Forma kształcenia na zaświadczeniu (słowami przepisu)")}</div>
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
  const [od, setOd] = useState("");
  const [doM, setDoM] = useState("");
  const parametry = new URLSearchParams({ ...(od ? { od } : {}), ...(doM ? { do: doM } : {}) }).toString();
  const { data, isLoading } = useQuery<{ odpowiedzi: number; tekstyWidoczne: boolean; minOdpowiedzi: number; pytania: Array<{ id: string; typ: string; tresc: string; n: number; srednia?: number | null; rozklad?: number[]; tak?: number; nie?: number; teksty?: string[]; tekstyUkryte?: boolean }> }>({
    queryKey: ["/api/admin/szkolenie/ankieta", parametry],
    queryFn: async () => (await apiRequest("GET", `/api/admin/szkolenie/ankieta${parametry ? `?${parametry}` : ""}`)).json(),
    staleTime: 0,
  });
  return (
    <Card data-testid="raport-ankiety">
      <CardHeader><CardTitle>Raport ankiety{data ? ` (${data.odpowiedzi} ${data.odpowiedzi === 1 ? "odpowiedź" : "odpowiedzi"})` : ""}</CardTitle></CardHeader>
      <CardContent className="space-y-5">
        <p className="text-sm text-muted-foreground">Ankieta jest anonimowa: odpowiedzi nie mają powiązania z kontem ani dokładnej daty (tylko miesiąc).</p>
        <div className="flex flex-wrap items-end gap-3 text-sm">
          <label className="grid gap-1">Od miesiąca<Input type="month" value={od} onChange={(e) => setOd(e.target.value)} /></label>
          <label className="grid gap-1">Do miesiąca<Input type="month" value={doM} onChange={(e) => setDoM(e.target.value)} /></label>
          {(od || doM) && <Button variant="ghost" size="sm" onClick={() => { setOd(""); setDoM(""); }}>Cały okres</Button>}
        </div>
        {isLoading || !data ? <div className="flex justify-center py-6"><LoadingSpinner /></div> : (
          <>
            {!data.tekstyWidoczne && (
              <p className="text-sm text-muted-foreground" data-testid="ankieta-teksty-ukryte">
                Odpowiedzi tekstowe pokażemy, gdy w wybranym okresie będzie co najmniej {data.minOdpowiedzi} ankiet (teraz: {data.odpowiedzi}). Przy mniejszej liczbie łatwo rozpoznać autora.
              </p>
            )}
            {data.pytania.map((p) => (
              <div key={p.id} className="border-t border-border pt-3 text-sm">
                <p className="font-medium">{p.tresc}</p>
                {p.typ === "skala" && <p>Średnia: {p.srednia ?? "brak"} (n = {p.n}) · rozkład od 1 do 5: {p.rozklad?.join(" / ")}</p>}
                {p.typ === "tak_nie" && <p>Tak: {p.tak} · Nie: {p.nie}</p>}
                {p.typ === "tekst" && (p.teksty?.length
                  ? <ul className="list-disc pl-5">{p.teksty.map((t, i) => <li key={i}>{t}</li>)}</ul>
                  : <p className="text-muted-foreground">{p.tekstyUkryte ? `Uwagi ukryte (${p.n}), za mało ankiet w okresie.` : "Brak uwag."}</p>)}
              </div>
            ))}
          </>
        )}
      </CardContent>
    </Card>
  );
}

type UstawieniaCme = {
  szkolenie_wlaczone: boolean;
  cwiczenia_wymagane: boolean;
  weryfikacja_pwz_reczna: boolean;
  weryfikacja_pwz_dni: number;
  test_limit_minut: number;
  test_wglad: string;
  cme_miejsce: string;
  cme_kierownik_naukowy_tytul: string;
  cme_organizator_podpisujacy: string;
  cme_podpis_organizator: string;
  cme_podpis_kierownik: string;
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
      cme_kierownik_naukowy_tytul: data.cme_kierownik_naukowy_tytul, cme_organizator_podpisujacy: data.cme_organizator_podpisujacy, cme_miejsce: data.cme_miejsce,
      test_limit_minut: String(data.test_limit_minut), weryfikacja_pwz_dni: String(data.weryfikacja_pwz_dni),
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
          {przelacznik("weryfikacja_pwz_reczna", "Ręczne sprawdzenie PWZ przed zaświadczeniem z punktami", "Zespół porównuje dane z publicznym rejestrem NIL albo NIPiP (Uczestnicy → „PWZ sprawdzony”). Do tego czasu uczestnik może pobrać zaświadczenie ukończenia bez punktów.")}
          <div className="flex items-start justify-between gap-6 py-3">
            <div><p className="font-medium">Wgląd w oceniony test</p><p className="text-sm text-muted-foreground">Po zaliczeniu albo po ostatnim podejściu: całe podejście (pytania, odpowiedzi, klucz, uzasadnienia) albo tylko błędne. Wcześniej uczestnik widzi tylko wynik i odsetek poprawnych w modułach.</p></div>
            <select className="rounded-md border border-border bg-background px-2 py-1 text-sm" value={data.test_wglad} onChange={(e) => ustaw("test_wglad", e.target.value)}>
              <option value="pelny">całe podejście</option><option value="bledne">tylko błędne</option>
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
          {liczba("test_limit_minut", "Limit czasu testu (minuty, 0 = bez limitu)")}
          {liczba("weryfikacja_pwz_dni", "Sprawdzenie PWZ: zwykle do (dni roboczych)")}
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Zaświadczenie</CardTitle></CardHeader>
        <CardContent className="grid gap-3">
          {tekst("cme_tytul", "Tytuł szkolenia")}
          {tekst("cme_forma", "Forma szkolenia")}
          {tekst("cme_kierownik_naukowy", "Kierownik naukowy (lekarz): imię i nazwisko")}
          {tekst("cme_kierownik_naukowy_tytul", "Kierownik naukowy: tytuł i specjalizacja")}
          {tekst("cme_organizator_podpisujacy", "Podpis za organizatora: imię, nazwisko, funkcja")}
          {tekst("cme_miejsce", "Miejsce szkolenia")}
          <div className="grid gap-3 sm:grid-cols-2">
            <Podpis klucz="cme_podpis_organizator" tytul="Skan podpisu organizatora" obecny={data.cme_podpis_organizator} onZapisz={ustaw} />
            <Podpis klucz="cme_podpis_kierownik" tytul="Skan podpisu kierownika naukowego" obecny={data.cme_podpis_kierownik} onZapisz={ustaw} />
          </div>
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
      <Retencja />
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

/** Skan podpisu: PNG albo JPEG do 200 KB, zapis jako base64 w ustawieniach (kopia trafia do zaświadczenia) */
function Podpis({ klucz, tytul, obecny, onZapisz }: { klucz: string; tytul: string; obecny: string; onZapisz: (k: string, v: unknown) => void }) {
  const { toast } = useToast();
  const wczytaj = (f: File | undefined) => {
    if (!f) return;
    if (f.size > 200_000) return toast({ title: "Plik ma więcej niż 200 KB", variant: "destructive" });
    const r = new FileReader();
    r.onload = () => onZapisz(klucz, String(r.result).replace(/^data:[^,]+,/, ""));
    r.readAsDataURL(f);
  };
  return (
    <div className="grid gap-2 text-sm">
      <p>{tytul}</p>
      {obecny ? <img src={`data:image/png;base64,${obecny}`} alt="" className="h-12 w-auto self-start bg-white p-1 rounded" /> : <p className="text-muted-foreground">brak (na zaświadczeniu sam podpis drukowany)</p>}
      <div className="flex gap-2">
        <Input type="file" accept="image/png,image/jpeg" onChange={(e) => wczytaj(e.target.files?.[0])} />
        {obecny && <Button variant="outline" size="sm" onClick={() => onZapisz(klucz, "")}>Usuń</Button>}
      </div>
    </div>
  );
}

/** Raport dla okręgowej izby lekarskiej (lekarze z zaświadczeniem), opcjonalnie jedna izba */
function RaportIzby() {
  const [izba, setIzba] = useState("");
  return (
    <Card>
      <CardHeader><CardTitle>Raport dla okręgowej izby lekarskiej</CardTitle></CardHeader>
      <CardContent className="flex flex-wrap items-end gap-3 text-sm">
        <p className="w-full text-muted-foreground">Lekarze i lekarze dentyści z ważnym zaświadczeniem: imię, nazwisko, PWZ, data ukończenia, punkty, numer zaświadczenia.</p>
        <select className="rounded-md border border-border bg-background px-2 py-2 text-sm" value={izba} onChange={(e) => setIzba(e.target.value)}>
          <option value="">wszystkie izby</option>{IZBY_LEKARSKIE.map((i) => <option key={i} value={i}>{i}</option>)}
        </select>
        <Button asChild variant="outline" size="sm">
          <a href={`/api/admin/szkolenie/raport-orl.csv${izba ? `?izba=${encodeURIComponent(izba)}` : ""}`} download data-testid="raport-orl-csv"><Download className="h-4 w-4" />Pobierz CSV</a>
        </Button>
      </CardContent>
    </Card>
  );
}

/** Pula testu: pytania, które nie spełniają warunku (≥ 5 odpowiedzi, dokładnie 1 poprawna), są pomijane */
function PulaTestu() {
  const { data } = useQuery<{ kwalifikuje: number; liczbaPytan: number; zaMala: boolean; odrzucone: Array<{ id: string; externalId: string | null; tytul: string | null; powod: string }> }>({
    queryKey: ["/api/admin/szkolenie/pula-testu"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/szkolenie/pula-testu")).json(),
    staleTime: 0,
  });
  if (!data) return null;
  return (
    <Card data-testid="pula-testu">
      <CardHeader><CardTitle>Pula testu: {data.kwalifikuje} pytań w losowaniu</CardTitle></CardHeader>
      <CardContent className="text-sm space-y-2">
        {data.zaMala && (
          <p className="text-destructive" data-testid="pula-za-mala">
            Pula jest mała: {data.kwalifikuje} pytań przy {data.liczbaPytan} w teście. Zalecane co najmniej {2 * data.liczbaPytan}, inaczej kolejne podejścia mają prawie ten sam zestaw pytań. Test działa, to tylko ostrzeżenie.
          </p>
        )}
        {data.odrzucone.length === 0 ? (
          <p className="text-muted-foreground">Wszystkie opublikowane pytania puli testu spełniają warunek: co najmniej 5 odpowiedzi i dokładnie 1 poprawna.</p>
        ) : (
          <>
            <p className="text-muted-foreground mb-2">Pominięte w losowaniu ({data.odrzucone.length}): każde pytanie testu musi mieć co najmniej 5 odpowiedzi i dokładnie 1 poprawną.</p>
            <ul className="list-disc pl-5">{data.odrzucone.map((o) => <li key={o.id}>{o.externalId ?? o.tytul ?? o.id}: {o.powod}</li>)}</ul>
          </>
        )}
      </CardContent>
    </Card>
  );
}

/** Przechowywanie 5 lat od końca roku wydania zaświadczenia: przegląd i usunięcie (to samo co server/scripts/szkolenieRetencja.ts) */
function Retencja() {
  const { toast } = useToast();
  const [wynik, setWynik] = useState<{ sprawdzone: number; doUsuniecia: number; usunieto: number } | null>(null);
  const run = useMutation({
    mutationFn: async (usun: boolean) => (await apiRequest("POST", "/api/admin/szkolenie/retencja", { usun })).json(),
    onSuccess: (w) => setWynik(w),
    onError: (e) => toast({ title: "Nie udało się", description: bladSerwera(e), variant: "destructive" }),
  });
  return (
    <Card>
      <CardHeader><CardTitle>Przechowywanie danych szkolenia</CardTitle></CardHeader>
      <CardContent className="grid gap-3 text-sm">
        <p className="text-muted-foreground">
          Osoby z zaświadczeniem: rejestr zostaje 5 lat od końca roku wydania, także po usunięciu konta. Osoby bez zaświadczenia znikają razem z kontem.
          Tu usuniesz rejestr osób bez konta, którym minął okres przechowywania. Uruchamiaj raz w roku, w styczniu, po kopii bazy.
        </p>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" disabled={run.isPending} onClick={() => run.mutate(false)}>Sprawdź (nic nie usuwa)</Button>
          <Button variant="destructive" size="sm" disabled={run.isPending || !wynik?.doUsuniecia} onClick={() => run.mutate(true)}>Usuń przeterminowane</Button>
        </div>
        {wynik && <p>Osób bez konta w rejestrze: {wynik.sprawdzone}, po okresie przechowywania: {wynik.doUsuniecia}{wynik.usunieto ? `, usunięto: ${wynik.usunieto}` : ""}.</p>}
      </CardContent>
    </Card>
  );
}
