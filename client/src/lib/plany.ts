import type { Plan } from "@/types";

/** Kwota po polsku: „49 zł”, „499 zł”, „49,50 zł” */
export const kwota = (cena: string | number) => {
  const n = typeof cena === "string" ? parseFloat(cena) : cena;
  return `${Number.isInteger(n) ? n : n.toFixed(2).replace(".", ",")} zł`;
};

export type OpisPlanu = {
  cena: string;
  /** „/ miesiąc”, „/ rok” */
  okres: string;
  odnawiany: boolean;
  /** Jedno zdanie o tym, jak działa płatność */
  zasada: string;
  metody: string;
};

/**
 * Jak płaci się za plan. Plan z interval to subskrypcja odnawiana kartą (BLIK i Przelewy24 nie obsługują
 * płatności cyklicznych). Plan bez interval to jednorazowa płatność za durationDays dni.
 */
export function opisPlanu(plan: Pick<Plan, "price" | "durationDays" | "interval">): OpisPlanu {
  const cena = kwota(plan.price);
  if (plan.interval === "month" || plan.interval === "year") {
    const okres = plan.interval === "year" ? "rok" : "miesiąc";
    return {
      cena,
      okres: `/ ${okres}`,
      odnawiany: true,
      zasada: `Odnawia się co ${okres}. Anulujesz w każdej chwili, dostęp zostaje do końca opłaconego okresu.`,
      metody: "Karta, Apple Pay, Google Pay",
    };
  }
  const rok = plan.durationDays >= 365;
  return {
    cena,
    okres: rok ? "/ rok" : `/ ${plan.durationDays} dni`,
    odnawiany: false,
    zasada: `Jedna płatność za ${rok ? "12 miesięcy" : `${plan.durationDays} dni`} dostępu. Bez automatycznego odnawiania.`,
    metody: "Karta, BLIK, Przelewy24",
  };
}

/** Ile oszczędza plan roczny wobec 12 miesięcy planu miesięcznego (null, gdy nic) */
export function oszczednoscRoczna(plany: Pick<Plan, "price" | "durationDays" | "interval">[], plan: Pick<Plan, "price" | "durationDays" | "interval">): string | null {
  const miesieczny = plany.find((p) => p.interval === "month");
  if (!miesieczny || plan.interval === "month" || plan.durationDays < 365) return null;
  const roznica = parseFloat(miesieczny.price) * 12 - parseFloat(plan.price);
  return roznica > 0 ? `${kwota(roznica)} taniej niż 12 miesięcy` : null;
}

export const ZGODA_NATYCHMIAST =
  "Chcę dostać dostęp od razu, przed upływem 14 dni na odstąpienie od umowy. Wiem, że przez to tracę prawo odstąpienia.";
