import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { apiRequest } from "@/lib/queryClient";
import { opisPlanu, ZGODA_NATYCHMIAST } from "@/lib/plany";
import type { Plan } from "@/types";

interface CheckoutFormProps {
  planId: string;
}

function readableError(error: unknown): string {
  const msg = error instanceof Error ? error.message : "";
  const json = msg.replace(/^\d{3}:\s*/, "");
  try {
    return JSON.parse(json).error || "Nie udało się rozpocząć płatności";
  } catch {
    return json || "Nie udało się rozpocząć płatności";
  }
}

/** Podsumowanie przed przejściem do Stripe Checkout (zalogowany kursant) */
export default function CheckoutForm({ planId }: CheckoutFormProps) {
  const [zgoda, setZgoda] = useState(false);
  const [blad, setBlad] = useState<string | null>(null);

  const { data: plans, isLoading } = useQuery({
    queryKey: ["/api/plans"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/plans");
      return response.json() as Promise<Plan[]>;
    },
  });

  const plan = plans?.find((p) => p.id === planId);

  const checkoutMutation = useMutation({
    mutationFn: async (id: string) => {
      const response = await apiRequest("POST", "/api/stripe/checkout", { planId: id, zgodaNatychmiast: true });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) window.location.href = data.url;
      else setBlad("Nie udało się rozpocząć płatności. Spróbuj za chwilę.");
    },
    onError: (error) => setBlad(readableError(error)),
  });

  if (isLoading) {
    return <div className="flex min-h-[50vh] items-center justify-center"><LoadingSpinner size="lg" /></div>;
  }

  if (!plan) {
    return (
      <div className="wrap">
        <div className="mx-auto max-w-[32rem] py-20" role="status">
          <h1 className="h2 text-[var(--txt)]">Nie ma takiego planu</h1>
          <p className="lead mt-3">Wróć do cennika i wybierz plan jeszcze raz.</p>
          <Button asChild className="mt-6"><Link href="/pricing">Cennik</Link></Button>
        </div>
      </div>
    );
  }

  const o = opisPlanu(plan);
  const pracuje = checkoutMutation.isPending || checkoutMutation.isSuccess;

  return (
    <div className="wrap">
      <form
        className="mx-auto grid max-w-[32rem] gap-6 py-16"
        noValidate
        onSubmit={(e) => {
          e.preventDefault();
          setBlad(null);
          if (!zgoda) {
            setBlad("Zaznacz zgodę na dostęp od razu.");
            return;
          }
          checkoutMutation.mutate(plan.id);
        }}
      >
        <div>
          <p className="label">Płatność</p>
          <h1 className="h2 mt-3 text-[var(--txt)]">{o.odnawiany ? "Dostęp miesięczny" : "Dostęp na rok"}</h1>
        </div>

        <div className="rounded-2xl border border-[var(--line)] bg-[var(--panel)] p-6">
          <div className="flex items-baseline justify-between gap-4">
            <span className="text-[var(--txt2)]">{plan.name}</span>
            <span className="font-heading text-2xl font-medium tabular-nums text-[var(--txt)]">
              {o.cena} <span className="text-base text-[var(--txt2)]">{o.okres}</span>
            </span>
          </div>
          <p className="mt-4 text-sm text-[var(--txt2)]">{o.zasada}</p>
          <p className="mt-1 text-sm text-[var(--txt3)]">{o.metody}</p>
        </div>

        <label className="flex items-start gap-3 text-sm text-[var(--txt2)]">
          <Checkbox checked={zgoda} onCheckedChange={(c) => setZgoda(c === true)} className="mt-0.5" data-testid="zgoda-natychmiast" />
          <span>{ZGODA_NATYCHMIAST}</span>
        </label>

        {blad && <p role="alert" className="text-sm text-[var(--alarm)]">{blad}</p>}

        <Button type="submit" size="lg" className="min-h-12 w-full" disabled={pracuje} data-testid="complete-payment">
          {pracuje ? <><LoadingSpinner size="sm" className="mr-2" />Przechodzę do Stripe…</> : <><Lock className="mr-2 h-4 w-4" />Zapłać {o.cena}</>}
        </Button>
        <p className="text-xs text-[var(--txt3)]">
          Płatność przyjmuje Stripe; danych karty nie widzimy. Po płatności wrócisz do kursu.
          {o.odnawiany && " Subskrypcję anulujesz w menu konta: Płatności."}
        </p>
      </form>
    </div>
  );
}
