import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

type Ustawienia = {
  rejestracja_otwarta: boolean;
  dokumenty_opublikowane: boolean;
  limit_wyjatki_wlaczone: boolean;
  limit_wyjatki_ip: string[];
  platnosci: boolean;
  indeksowanie: boolean;
};

function bladZSerwera(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  try {
    return JSON.parse(raw.slice(raw.indexOf("{"))).error ?? raw;
  } catch {
    return raw.replace(/^\d{3}:\s*/, "") || "Spróbuj ponownie.";
  }
}

/** Przełącznik z opisem: etykieta, co robi, stan */
function Przelacznik(props: { id: string; tytul: string; opis: string; wartosc: boolean; onZmiana?: (v: boolean) => void; tylkoOdczyt?: string }) {
  return (
    <div className="flex items-start justify-between gap-6 border-b border-[var(--line)] py-4 last:border-b-0">
      <div className="min-w-0 space-y-1">
        <label htmlFor={props.id} className="font-medium text-[var(--txt)]">{props.tytul}</label>
        <p className="text-sm text-[var(--txt2)]">{props.opis}</p>
        {props.tylkoOdczyt && <p className="text-note text-[var(--label)]">{props.tylkoOdczyt}</p>}
      </div>
      <Switch
        id={props.id}
        checked={props.wartosc}
        disabled={!props.onZmiana}
        onCheckedChange={(v) => props.onZmiana?.(v)}
        data-testid={`ustawienie-${props.id}`}
      />
    </div>
  );
}

/** Przełączniki aplikacji (tylko właściciel): rejestracja, dokumenty, wyjątki limitów dla pentestu */
export default function SettingsManager() {
  const { toast } = useToast();
  const { data, isLoading } = useQuery({
    queryKey: ["/api/admin/ustawienia"],
    queryFn: async () => (await apiRequest("GET", "/api/admin/ustawienia")).json() as Promise<Ustawienia>,
  });
  const [ipTekst, setIpTekst] = useState("");
  useEffect(() => {
    if (data) setIpTekst(data.limit_wyjatki_ip.join("\n"));
  }, [data]);

  const zapis = useMutation({
    mutationFn: async ({ klucz, wartosc }: { klucz: string; wartosc: unknown }) =>
      (await apiRequest("PUT", "/api/admin/ustawienia", { klucz, wartosc })).json(),
    onSuccess: () => {
      toast({ title: "Zapisane" });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/ustawienia"] });
      queryClient.invalidateQueries({ queryKey: ["/api/config"] });
    },
    onError: (e) => toast({ title: "Nie udało się zapisać", description: bladZSerwera(e), variant: "destructive" }),
  });

  if (isLoading || !data) {
    return <div className="flex justify-center py-12"><LoadingSpinner size="lg" /></div>;
  }

  const ustaw = (klucz: string) => (wartosc: unknown) => zapis.mutate({ klucz, wartosc });

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Ustawienia</h2>
        <p className="text-muted-foreground">Zmiany działają od razu (do 10 sekund) i trafiają do dziennika zdarzeń.</p>
      </div>

      <Card>
        <CardHeader><CardTitle>Rejestracja</CardTitle></CardHeader>
        <CardContent>
          <Przelacznik
            id="rejestracja_otwarta"
            tytul="Rejestracja otwarta"
            opis="Po wyłączeniu formularz mówi „rejestracja chwilowo zamknięta”. Istniejące konta działają dalej."
            wartosc={data.rejestracja_otwarta}
            onZmiana={ustaw("rejestracja_otwarta")}
          />
          <Przelacznik
            id="dokumenty_opublikowane"
            tytul="Regulamin bety i polityka prywatności opublikowane"
            opis="Bez opublikowanych dokumentów nie ma do czego wyrazić zgody, więc rejestracja jest zamknięta niezależnie od przełącznika wyżej."
            wartosc={data.dokumenty_opublikowane}
            onZmiana={ustaw("dokumenty_opublikowane")}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Test bezpieczeństwa (pentest)</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Przelacznik
            id="limit_wyjatki_wlaczone"
            tytul="Wyjątki od limitów prób"
            opis="Adresy IP z listy niżej nie trafiają na limity logowania, rejestracji i API. Włączaj tylko na okno testów."
            wartosc={data.limit_wyjatki_wlaczone}
            onZmiana={ustaw("limit_wyjatki_wlaczone")}
          />
          <div className="space-y-2">
            <label htmlFor="limit_wyjatki_ip" className="font-medium text-[var(--txt)]">Adresy IP firmy testującej</label>
            <p className="text-sm text-[var(--txt2)]">Jeden adres w linii (IPv4 albo IPv6), najwyżej 20.</p>
            <Textarea
              id="limit_wyjatki_ip"
              rows={4}
              value={ipTekst}
              onChange={(e) => setIpTekst(e.target.value)}
              className="font-mono"
              data-testid="ustawienie-limit_wyjatki_ip"
            />
            <Button
              variant="outline"
              disabled={zapis.isPending}
              onClick={() => ustaw("limit_wyjatki_ip")(ipTekst.split(/\s+/).map((a) => a.trim()).filter(Boolean))}
              data-testid="zapisz-ip"
            >
              Zapisz adresy
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Z konfiguracji serwera</CardTitle></CardHeader>
        <CardContent>
          <Przelacznik
            id="platnosci"
            tytul="Płatności"
            opis="Cennik, zakup i trasy checkout. Wyłączone: tester bety ma pełny dostęp bez płatności."
            wartosc={data.platnosci}
            tylkoOdczyt="Zmiana: PLATNOSCI_WLACZONE w /etc/helloekg-kurs.env i restart usługi."
          />
          <Przelacznik
            id="indeksowanie"
            tytul="Indeksowanie w wyszukiwarkach"
            opis="Wyłączone: nagłówek noindex i robots.txt z zakazem dla całego hosta."
            wartosc={data.indeksowanie}
            tylkoOdczyt="Zmiana: INDEKSOWANIE w /etc/helloekg-kurs.env i restart usługi."
          />
        </CardContent>
      </Card>
    </div>
  );
}
