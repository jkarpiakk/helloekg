import { useEffect, useState } from "react";

/**
 * Czy użytkownik prosi o ograniczenie ruchu (prefers-reduced-motion: reduce).
 *
 * Nasłuchuje zmian, więc przełączenie preferencji w systemie działa bez
 * przeładowania strony. Jedno źródło prawdy dla logo, separatora, serca 3D,
 * paska EKG i symulatora — wcześniej każdy z nich miał własną kopię.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return reduced;
}
