import { useState } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { X } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { courseItems, earlierUnpassed, hasLecture, lectureFinished, type OrderModule } from "@/lib/courseOrder";

const pad = (n: number) => String(n).padStart(2, "0");

/**
 * Miękka kolejność: gdy kursant wchodzi w temat, przed którym zostały nieprzerobione,
 * mówimy spokojnie, od czego warto zacząć — ale niczego nie blokujemy (decyzja JK, beta).
 */
export default function OrderHint({ sectionId }: { sectionId: string }) {
  const [closed, setClosed] = useState(false);
  const { data } = useQuery({
    queryKey: ["/api/modules"],
    queryFn: async () => (await apiRequest("GET", "/api/modules")).json() as Promise<OrderModule[]>,
  });
  if (closed || !data) return null;
  const items = courseItems(data);
  const before = earlierUnpassed(items, sectionId);
  if (!before.length) return null;
  const first = before[0];
  const href = hasLecture(first.section) && !lectureFinished(first.section) ? `/lecture/${first.section.id}` : `/quiz?sectionId=${first.section.id}`;
  const more = before.length - 1;
  const range = `Moduł ${pad(first.moduleNo)} · Temat ${pad(first.sectionNo)}${more > 0 ? ` (i ${more} ${more === 1 ? "kolejny" : more < 5 ? "kolejne" : "kolejnych"})` : ""}`;

  return (
    <aside
      className="mb-8 flex items-start gap-3 rounded-[12px] border border-[var(--line2)] bg-[var(--panel)] px-4 py-3 text-[.9375rem] leading-relaxed text-[var(--txt2)]"
      data-testid="order-hint"
    >
      <p className="min-w-0 flex-1">
        Kurs prowadzi po kolei. Przed tym tematem nieprzerobiony jest jeszcze {range}.{" "}
        <Link href={href} className="inline-flex min-h-11 items-center font-medium text-[var(--txt)] underline underline-offset-4">
          Zacznij od „{first.section.title}”
        </Link>{" "}
        albo zostań tutaj.
      </p>
      <button
        type="button"
        onClick={() => setClosed(true)}
        aria-label="Zamknij podpowiedź"
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-[var(--txt2)] transition-colors hover:text-[var(--txt)] active:scale-95"
      >
        <X className="h-4 w-4" aria-hidden />
      </button>
    </aside>
  );
}
