import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { opisPlanu, oszczednoscRoczna } from "@/lib/plany";
import type { Plan } from "@/types";

/** Co jest w kursie: to samo w każdym planie, plany różnią się tylko sposobem płacenia */
const W_KURSIE = [
  "Wszystkie wykłady i pytania z wyjaśnieniami",
  "Interaktywne wstawki i zapisy EKG w powiększeniu",
  "Postęp, powtórki i certyfikat ukończenia",
  "Nowe treści, gdy tylko się pojawią",
];

/** Cennik (tylko z kontem: trasa /pricing wymaga zalogowania, zakup idzie przez /checkout) */
export default function PricingSection() {
  const { data: plans, isLoading } = useQuery({
    queryKey: ["/api/plans"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/plans");
      return response.json() as Promise<Plan[]>;
    },
  });

  // miesięczny przed rocznym
  const plany = [...(plans ?? [])]
    .filter((p) => parseFloat(p.price) > 0)
    .sort((a, b) => (a.interval === "month" ? -1 : 0) - (b.interval === "month" ? -1 : 0) || a.durationDays - b.durationDays);

  if (isLoading) {
    return (
      <section className="py-20" id="pricing">
        <div className="flex justify-center"><LoadingSpinner size="lg" /></div>
      </section>
    );
  }

  return (
    <section className="wrap py-12 sm:py-16" id="pricing" aria-labelledby="pricing-title">
      <div className="mx-auto max-w-[56rem]">
        <p className="label">Dostęp do kursu</p>
        <h1 id="pricing-title" className="h2 mt-3 text-[var(--txt)]" style={{ textWrap: "balance" }}>
          Jeden kurs, dwa sposoby płacenia
        </h1>
        <p className="lead mt-3 max-w-[40rem]">
          W obu planach masz to samo: cały kurs, bez limitów. Wybierz, czy wolisz płacić co miesiąc, czy raz na rok.
        </p>

        <div className="mt-10 grid gap-4 sm:grid-cols-2">
          {plany.map((plan) => {
            const o = opisPlanu(plan);
            const taniej = oszczednoscRoczna(plany, plan);
            return (
              <div
                key={plan.id}
                className={`flex min-w-0 flex-col rounded-2xl border bg-[var(--panel)] p-6 ${taniej ? "border-[var(--puls)]" : "border-[var(--line)]"}`}
                data-testid={`pricing-plan-${plan.interval ?? plan.durationDays}`}
              >
                <div className="flex items-center justify-between gap-3">
                  <h2 className="font-heading text-lg font-medium text-[var(--txt)]">
                    {o.odnawiany ? "Miesięcznie" : "Na rok"}
                  </h2>
                  {taniej && (
                    <span className="rounded-full bg-[var(--tint)] px-3 py-1 text-xs font-medium text-[var(--puls)]">{taniej}</span>
                  )}
                </div>
                <p className="mt-4 flex items-baseline gap-2">
                  <span className="font-heading text-4xl font-medium tabular-nums text-[var(--txt)]">{o.cena}</span>
                  <span className="text-[var(--txt2)]">{o.okres}</span>
                </p>
                <p className="mt-3 text-sm text-[var(--txt2)]">{o.zasada}</p>
                <p className="mt-1 text-sm text-[var(--txt3)]">{o.metody}</p>

                <div className="mt-auto pt-6">
                  <Button asChild className="w-full min-h-11" variant={taniej ? "default" : "outline"} data-testid={`select-plan-${plan.interval ?? plan.durationDays}`}>
                    <Link href={`/checkout?plan=${plan.id}`}>Wybieram</Link>
                  </Button>
                </div>
              </div>
            );
          })}
        </div>

        <ul className="mt-10 grid gap-3 sm:grid-cols-2">
          {W_KURSIE.map((f) => (
            <li key={f} className="flex items-start gap-3 text-sm text-[var(--txt2)]">
              <Check className="mt-0.5 h-4 w-4 flex-shrink-0 text-[var(--puls)]" aria-hidden="true" />
              <span>{f}</span>
            </li>
          ))}
        </ul>
        <p className="mt-8 text-xs text-[var(--txt3)]">
          Ceny brutto. Płatności obsługuje Stripe; danych karty nie widzimy i nie przechowujemy.
        </p>
      </div>
    </section>
  );
}
