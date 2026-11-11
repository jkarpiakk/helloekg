import { useMemo, useState } from "react";
import { Link } from "wouter";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { bladSerwera, SZKOLENIE_KEY, type StanSzkolenia } from "@/lib/szkolenie";
import {
  IZBY_LEKARSKIE,
  NAZWA_ZAWODU,
  OSWIADCZENIE,
  ZAWODY,
  ZAWODY_Z_PWZ,
  ZAWODY_ZE_SPECJALIZACJA,
  sprawdzPwz,
  type Zawod,
} from "@shared/szkolenie";

type DaneZawodu = { pwz: string; specjalizacja: string; izba: string; brakPwz: boolean };
const PUSTE: DaneZawodu = { pwz: "", specjalizacja: "", izba: "", brakPwz: false };
const LEKARSKIE: readonly Zawod[] = ["lekarz", "lekarz_dentysta"];

/**
 * „Chcę zaświadczenie z punktami”: zawód (kilka naraz), PWZ, specjalizacja (lekarze), imię i nazwisko
 * zgodne z PWZ, oświadczenie o prawdziwości danych. Format PWZ sprawdzamy od razu (ta sama walidacja
 * co na serwerze: lekarz z cyfrą kontrolną NIL, pielęgniarka P, położna A); ratownik może nie mieć numeru.
 */
export default function FormularzZapisu({ stan, onGotowe }: { stan: StanSzkolenia; onGotowe?: () => void }) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const zablokowaneImie = stan.zapisy.some((z) => z.zablokowany);
  const pierwszy = stan.zapisy[0];
  const [imie, setImie] = useState(pierwszy?.imie ?? "");
  const [nazwisko, setNazwisko] = useState(pierwszy?.nazwisko ?? "");
  const [wybrane, setWybrane] = useState<Set<Zawod>>(() => new Set(stan.zapisy.map((z) => z.zawod as Zawod)));
  const [dane, setDane] = useState<Record<string, DaneZawodu>>(() =>
    Object.fromEntries(stan.zapisy.map((z) => [z.zawod, { pwz: z.pwz ?? "", specjalizacja: z.specjalizacja ?? "", izba: z.izba ?? "", brakPwz: z.zawod === "ratownik" && !z.pwz }])),
  );
  const [oswiadczenie, setOswiadczenie] = useState(false);
  const [regulamin, setRegulamin] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  const zablokowanyZawod = (z: Zawod) => stan.zapisy.some((x) => x.zawod === z && x.zablokowany);
  const ostrzezenia = useMemo(() => {
    const w: Partial<Record<Zawod, string>> = {};
    for (const z of Array.from(wybrane)) {
      const d = dane[z] ?? PUSTE;
      if (!d.pwz.trim() || d.brakPwz) continue;
      const r = sprawdzPwz(z, d.pwz);
      if (r.blad) w[z] = r.blad;
    }
    return w;
  }, [wybrane, dane]);

  const zapis = useMutation({
    mutationFn: async () =>
      (await apiRequest("POST", "/api/szkolenie/zapis", {
        imie,
        nazwisko,
        oswiadczenie,
        regulamin: stan.regulaminOpublikowany ? regulamin : undefined,
        zawody: Array.from(wybrane).map((zawod) => ({
          zawod,
          pwz: ZAWODY_Z_PWZ.includes(zawod) && !(zawod === "ratownik" && dane[zawod]?.brakPwz) ? dane[zawod]?.pwz ?? "" : null,
          brakPwz: zawod === "ratownik" ? !!dane[zawod]?.brakPwz : undefined,
          specjalizacja: ZAWODY_ZE_SPECJALIZACJA.includes(zawod) ? dane[zawod]?.specjalizacja ?? "" : null,
          izba: LEKARSKIE.includes(zawod) ? dane[zawod]?.izba ?? "" : null,
        })),
      })).json(),
    onSuccess: () => {
      toast({ title: stan.zapisy.length ? "Dane zapisane" : "Zapis przyjęty" });
      qc.invalidateQueries({ queryKey: SZKOLENIE_KEY });
      onGotowe?.();
    },
    onError: (e) => setBlad(bladSerwera(e)),
  });

  const przelacz = (z: Zawod, on: boolean) =>
    setWybrane((prev) => {
      const n = new Set(prev);
      if (on) n.add(z);
      else n.delete(z);
      return n;
    });
  const ustaw = <K extends keyof DaneZawodu>(z: Zawod, pole: K, v: DaneZawodu[K]) =>
    setDane((prev) => ({ ...prev, [z]: { ...PUSTE, ...prev[z], [pole]: v } }));

  const wyslij = (e: React.FormEvent) => {
    e.preventDefault();
    setBlad(null);
    if (!wybrane.size) return setBlad("Wybierz co najmniej jeden zawód.");
    if (!oswiadczenie) return setBlad("Potwierdź oświadczenie o prawdziwości danych.");
    if (stan.regulaminOpublikowany && !regulamin) return setBlad("Zaakceptuj regulamin szkolenia.");
    zapis.mutate();
  };

  return (
    <form onSubmit={wyslij} className="grid gap-8" data-testid="formularz-zapisu" noValidate>
      <fieldset className="grid gap-3">
        <legend className="label mb-3">Zawód</legend>
        <p className="text-ui text-[var(--txt2)]">Możesz wybrać kilka. Na każdy zawód dostaniesz osobne zaświadczenie.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {ZAWODY.map((z) => (
            <label key={z} className="flex min-h-[44px] items-center gap-3 rounded-xl border border-[var(--line2)] px-4 py-2 cursor-pointer has-[:checked]:border-[var(--puls-deep)]">
              <input
                type="checkbox"
                className="h-4 w-4 accent-[var(--puls)]"
                checked={wybrane.has(z)}
                disabled={zablokowanyZawod(z)}
                onChange={(e) => przelacz(z, e.target.checked)}
                data-testid={`zawod-${z}`}
              />
              <span className="first-letter:uppercase">{NAZWA_ZAWODU[z]}</span>
            </label>
          ))}
        </div>
      </fieldset>

      {Array.from(wybrane).filter((z) => ZAWODY_Z_PWZ.includes(z) || ZAWODY_ZE_SPECJALIZACJA.includes(z)).map((z) => (
        <fieldset key={z} className="grid gap-3 border-t border-[var(--line)] pt-6">
          <legend className="label mb-3 first-letter:uppercase">{NAZWA_ZAWODU[z]}</legend>
          {ZAWODY_Z_PWZ.includes(z) && (
            <div className="grid gap-2">
              <label htmlFor={`pwz-${z}`} className="font-medium">Numer prawa wykonywania zawodu</label>
              <Input
                id={`pwz-${z}`}
                inputMode={z === "lekarz" || z === "lekarz_dentysta" ? "numeric" : "text"}
                autoComplete="off"
                maxLength={20}
                placeholder={z === "pielegniarka" ? "1234567P" : z === "polozna" ? "1234567A" : undefined}
                value={dane[z]?.pwz ?? ""}
                disabled={zablokowanyZawod(z) || (z === "ratownik" && !!dane[z]?.brakPwz)}
                onChange={(e) => ustaw(z, "pwz", e.target.value)}
                aria-describedby={ostrzezenia[z] ? `pwz-${z}-uwaga` : undefined}
                data-testid={`pwz-${z}`}
              />
              {ostrzezenia[z] && (
                <p id={`pwz-${z}-uwaga`} className="flex items-start gap-2 text-ui text-[var(--txt2)]" role="status" data-testid={`pwz-${z}-uwaga`}>
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--alarm)]" aria-hidden />
                  {ostrzezenia[z]}
                </p>
              )}
              {z === "ratownik" && (
                <label className="flex items-center gap-3 min-h-[44px] cursor-pointer text-ui">
                  <input
                    type="checkbox"
                    className="h-4 w-4 accent-[var(--puls)]"
                    checked={!!dane[z]?.brakPwz}
                    disabled={zablokowanyZawod(z)}
                    onChange={(e) => ustaw(z, "brakPwz", e.target.checked)}
                    data-testid="pwz-ratownik-brak"
                  />
                  Nie mam jeszcze numeru prawa wykonywania zawodu
                </label>
              )}
            </div>
          )}
          {ZAWODY_ZE_SPECJALIZACJA.includes(z) && (
            <div className="grid gap-2">
              <label htmlFor={`spec-${z}`} className="font-medium">Specjalizacja <span className="text-[var(--txt2)] font-normal">(opcjonalnie)</span></label>
              <Input
                id={`spec-${z}`}
                maxLength={200}
                value={dane[z]?.specjalizacja ?? ""}
                disabled={zablokowanyZawod(z)}
                onChange={(e) => ustaw(z, "specjalizacja", e.target.value)}
                data-testid={`spec-${z}`}
              />
            </div>
          )}
          {LEKARSKIE.includes(z) && (
            <div className="grid gap-2">
              <label htmlFor={`izba-${z}`} className="font-medium">Okręgowa izba lekarska <span className="text-[var(--txt2)] font-normal">(opcjonalnie)</span></label>
              <select
                id={`izba-${z}`}
                className="min-h-[44px] rounded-md border border-[var(--line2)] bg-transparent px-3 text-body"
                value={dane[z]?.izba ?? ""}
                onChange={(e) => ustaw(z, "izba", e.target.value)}
                data-testid={`izba-${z}`}
              >
                <option value="">nie wybrano</option>
                {IZBY_LEKARSKIE.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
          )}
        </fieldset>
      ))}

      <fieldset className="grid gap-4 border-t border-[var(--line)] pt-6">
        <legend className="label mb-3">Imię i nazwisko</legend>
        <p className="text-ui text-[var(--txt2)]">
          {zablokowaneImie
            ? "Imię i nazwisko są już na zaświadczeniu. Zmianę zrobi zespół helloEKG: napisz na kontakt@helloekg.pl."
            : "Tak, jak w prawie wykonywania zawodu. Te dane trafią na zaświadczenie."}
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-2">
            <label htmlFor="cme-imie" className="font-medium">Imię</label>
            <Input id="cme-imie" autoComplete="given-name" maxLength={60} value={imie} disabled={zablokowaneImie} onChange={(e) => setImie(e.target.value)} data-testid="cme-imie" />
          </div>
          <div className="grid gap-2">
            <label htmlFor="cme-nazwisko" className="font-medium">Nazwisko</label>
            <Input id="cme-nazwisko" autoComplete="family-name" maxLength={60} value={nazwisko} disabled={zablokowaneImie} onChange={(e) => setNazwisko(e.target.value)} data-testid="cme-nazwisko" />
          </div>
        </div>
      </fieldset>

      <div className="grid gap-3 border-t border-[var(--line)] pt-6">
        <label className="flex items-start gap-3 cursor-pointer">
          <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[var(--puls)]" checked={oswiadczenie} onChange={(e) => setOswiadczenie(e.target.checked)} data-testid="cme-oswiadczenie" />
          <span className="text-body">{OSWIADCZENIE}</span>
        </label>
        {stan.regulaminOpublikowany && (
          <label className="flex items-start gap-3 cursor-pointer">
            <input type="checkbox" className="mt-1 h-4 w-4 shrink-0 accent-[var(--puls)]" checked={regulamin} onChange={(e) => setRegulamin(e.target.checked)} data-testid="cme-regulamin" />
            <span className="text-body">
              Akceptuję <Link href="/regulamin-szkolenia" className="underline">regulamin szkolenia</Link>.
            </span>
          </label>
        )}
      </div>

      {blad && <p className="text-ui text-[var(--alarm)]" role="alert" data-testid="cme-blad">{blad}</p>}
      <div>
        <Button type="submit" disabled={zapis.isPending} data-testid="cme-zapisz">
          {zapis.isPending ? "Zapisuję…" : stan.zapisy.length ? "Zapisz dane" : "Zapisz mnie na szkolenie"}
        </Button>
      </div>
    </form>
  );
}
