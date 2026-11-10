import { useEffect, useState } from "react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { queryClient } from "@/lib/queryClient";

type Stan = { s: "czekam" } | { s: "gotowe"; doDnia: string } | { s: "blad"; tekst: string };

/**
 * Powrót ze Stripe Checkout. Dostęp przyznaje webhook; ta strona prosi serwer o to samo (sesja pobrana ze Stripe,
 * idempotentnie), gdyby webhook jeszcze nie dotarł. Numer sesji znika z paska adresu.
 */
export default function PaymentSuccess() {
  const [stan, setStan] = useState<Stan>({ s: "czekam" });

  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get("session_id");
    window.history.replaceState(null, "", window.location.pathname);
    if (!sessionId) {
      setStan({ s: "blad", tekst: "Brakuje numeru płatności w adresie." });
      return;
    }
    (async () => {
      // płatności odroczone (np. Przelewy24) potwierdzają się po chwili: kilka prób co 3 s
      for (let proba = 0; proba < 5; proba++) {
        const res = await fetch("/api/stripe/payment-success", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({ sessionId }),
        }).catch(() => null);
        if (res?.ok) {
          const data = await res.json();
          queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
          queryClient.invalidateQueries({ queryKey: ["/api/modules"] });
          setStan({ s: "gotowe", doDnia: new Date(data.subscription.endDate).toLocaleDateString("pl-PL") });
          return;
        }
        await new Promise((r) => setTimeout(r, 3000));
      }
      setStan({
        s: "blad",
        tekst: "Nie widzimy jeszcze potwierdzenia płatności. Jeśli pieniądze zeszły z konta, dostęp włączy się w ciągu kilku minut. Gdyby nie, napisz na kontakt@helloekg.pl.",
      });
    })();
  }, []);

  return (
    <div className="wrap">
      <div className="mx-auto max-w-[30rem] py-20 sm:py-28" role={stan.s === "blad" ? "alert" : "status"}>
        {stan.s === "czekam" && (
          <>
            <p className="label">Płatność</p>
            <h1 className="h2 mt-4 text-[var(--txt)]">Potwierdzam płatność…</h1>
            <p className="lead mt-4">To potrwa kilka sekund.</p>
            <LoadingSpinner size="lg" className="mt-8" />
          </>
        )}
        {stan.s === "gotowe" && (
          <>
            <p className="label label--g">Płatność przyjęta</p>
            <h1 className="h2 mt-4 text-[var(--txt)]">Dostęp jest aktywny</h1>
            <p className="lead mt-4">Kurs masz otwarty do {stan.doDnia}. Potwierdzenie wysłaliśmy mailem.</p>
            <Button asChild className="mt-8"><Link href="/modules">Przejdź do kursu</Link></Button>
          </>
        )}
        {stan.s === "blad" && (
          <>
            <p className="label text-[var(--alarm)]">Płatność</p>
            <h1 className="h2 mt-4 text-[var(--txt)]">Jeszcze chwila</h1>
            <p className="lead mt-4">{stan.tekst}</p>
            <Button asChild variant="outline" className="mt-8"><Link href="/dashboard">Wróć do kursu</Link></Button>
          </>
        )}
      </div>
    </div>
  );
}
