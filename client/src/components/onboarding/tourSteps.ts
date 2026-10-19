/**
 * Instrukcja „na start” — kroki prowadzenia po aplikacji (coach marks).
 * Cele to atrybuty `data-tour="…"` na prawdziwych elementach (Header, panel postępu, kurs, wykład,
 * przycisk zgłoszeń). Krok może mieć kilka celów — wygrywa pierwszy widoczny (np. link „Kurs” na
 * komputerze, a na telefonie najpierw „Kurs” w otwartym menu, inaczej przycisk menu).
 */
import { WELCOME_EVENT, readStore, writeStore } from "./onboardingStore";

/** Ponowne uruchomienie instrukcji (np. „Obejrzyj instrukcję jeszcze raz”) */
export const TOUR_EVENT = WELCOME_EVENT;
export const startTour = () => window.dispatchEvent(new CustomEvent(TOUR_EVENT));

export const tourKey = (userId: string) => `hk-tour-v1:${userId}`;

/** Zapis: "done" albo numer bieżącego kroku (przeładowanie w połowie wraca do niego) */
export function readTour(userId: string): "done" | number | null {
  const raw = readStore(tourKey(userId));
  if (!raw) return null;
  if (raw === "done") return "done";
  const n = Number(raw);
  return Number.isInteger(n) && n >= 0 ? n : null;
}
export const saveTourStep = (userId: string, index: number) => writeStore(tourKey(userId), String(index));
export const saveTourDone = (userId: string) => writeStore(tourKey(userId), "done");

export interface TourTarget {
  selector: string;
  /** Polecenie przy kroku-działaniu, gdy wskazany jest ten cel */
  hint?: string;
  /** Inny opis, gdy wskazany jest ten cel (np. na telefonie) */
  body?: string;
}

export type ResumeTo = "dashboard" | "modules" | "lecture";

export interface TourStep {
  id: string;
  /** info: „Dalej”; action: krok kończy się dopiero, gdy kursant zrobi to, o co prosimy */
  kind: "info" | "action";
  title: string;
  body: string;
  /** Brak = karta na środku, bez wycięcia */
  targets?: TourTarget[];
  /** Na jakiej trasie krok ma sens; brak = na każdej */
  route?: (path: string) => boolean;
  /** Cofa stan, który kończy krok-działanie (używane przy „Wstecz”) */
  undo?: () => void;
  /** Dokąd prowadzi „Wróć do instrukcji”, gdy kursant jest gdzie indziej */
  resume?: ResumeTo;
  /** Krok-działanie: czy już zrobione (trasa / stan DOM) */
  done?: (path: string) => boolean;
  /** Cel na pewno się nie pojawi (np. wykład ma jeden rozdział) — pomiń bez czekania 4 s */
  skipIf?: () => boolean;
  primary?: string;
}

const isDashboard = (p: string) => p === "/dashboard";
const isModules = (p: string) => p === "/modules";
export const isLecturePath = (p: string) => /^\/lecture\/[^/]+/.test(p);

const q = (s: string) => document.querySelector(s);

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    kind: "info",
    title: "Witaj w helloEKG",
    body: "Pokażę ci w minutę, jak tu się uczyć. Możesz przerwać w każdej chwili.",
    route: isDashboard,
    resume: "dashboard",
    primary: "Zaczynamy",
  },
  {
    id: "continue",
    kind: "info",
    title: "Kontynuuj",
    body: "Tu zawsze wrócisz tam, gdzie przerwano naukę.",
    targets: [{ selector: '[data-tour="continue"]' }],
    route: isDashboard,
    resume: "dashboard",
    skipIf: () => !!q("#dashboard-title"),
  },
  {
    id: "overall-progress",
    kind: "info",
    title: "Twój postęp",
    body: "Postęp liczymy z twoich odpowiedzi na pytania, nie z samego czytania.",
    targets: [{ selector: '[data-tour="overall-progress"]' }],
    route: isDashboard,
    resume: "dashboard",
    skipIf: () => !!q("#dashboard-title"),
  },
  {
    id: "nav-kurs",
    kind: "action",
    title: "Kurs",
    body: "Cały kurs jest w zakładce Kurs. Kliknij ją.",
    targets: [
      { selector: '[data-tour="nav-kurs"]', hint: "Kliknij „Kurs” w menu" },
      { selector: '[data-tour="mobile-nav-kurs"]', hint: "Kliknij „Kurs”" },
      { selector: '[data-tour="menu-button"]', hint: "Otwórz menu", body: "Cały kurs jest w zakładce Kurs, w menu." },
    ],
    route: isDashboard,
    resume: "dashboard",
    done: isModules,
  },
  {
    id: "module-first",
    kind: "action",
    title: "Moduły",
    body: "Kurs ma 7 modułów. Kliknij pierwszy, żeby zobaczyć jego tematy.",
    targets: [{ selector: '[data-tour="module-first"]', hint: "Kliknij pierwszy moduł" }],
    route: isModules,
    resume: "modules",
    done: () => !!(q('[data-tour="module-first"]')?.parentElement as HTMLDetailsElement | null)?.open,
    // „Wstecz” do tego kroku: zwijamy moduł, żeby krok nie uznał się od razu za zrobiony
    undo: () => {
      const d = q('[data-tour="module-first"]')?.parentElement as HTMLDetailsElement | null;
      if (d) d.open = false;
    },
  },
  {
    id: "section-first-lecture",
    kind: "action",
    title: "Wykład i pytania",
    body: "Każdy temat to wykład i pytania. Otwórz pierwszy wykład.",
    targets: [
      { selector: 'details[open] [data-tour="section-first-lecture"]', hint: "Kliknij pierwszy temat" },
      // Moduł zwinięty (np. po „Wstecz” albo gdy kursant go zamknął) — najpierw wskazujemy moduł
      { selector: '[data-tour="module-first"]', hint: "Najpierw rozwiń pierwszy moduł", body: "Każdy temat to wykład i pytania. Rozwiń pierwszy moduł, a potem otwórz pierwszy wykład." },
    ],
    route: isModules,
    resume: "modules",
    done: isLecturePath,
    // Otwarty moduł nie ma wykładu — nie ma czego kliknąć
    skipIf: () => !!q("details[open] > [data-tour]") && !q('details[open] [data-tour="section-first-lecture"]'),
  },
  {
    id: "chapter-bar",
    kind: "info",
    title: "Rozdziały",
    body: "Wykład czytasz rozdział po rozdziale. Tu widzisz, gdzie jesteś.",
    targets: [{ selector: '[data-tour="chapter-bar"]' }],
    route: isLecturePath,
    resume: "lecture",
    skipIf: () => !!q('[data-testid="empty-lecture"], [data-testid="error-lecture"]'),
  },
  {
    id: "chapter-next",
    kind: "info",
    title: "Następny rozdział",
    body: "Ten przycisk przenosi do następnego rozdziału. Na końcu wykładu czekają pytania.",
    targets: [{ selector: '[data-tour="chapter-next"]' }],
    route: isLecturePath,
    resume: "lecture",
    // Wykład z jednym rozdziałem nie ma tego przycisku
    skipIf: () => !!q('[data-tour="chapter-bar"]') || !!q('[data-testid="empty-lecture"], [data-testid="error-lecture"]'),
  },
  {
    id: "feedback-fab",
    kind: "info",
    title: "Zgłoś uwagę",
    body: "Coś nie działa albo jest niejasne? Daj znać tutaj — czytam każde zgłoszenie.",
    targets: [{ selector: '[data-tour="feedback-fab"]' }],
  },
  {
    id: "nav-powtorka",
    kind: "info",
    title: "Powtórka",
    body: "Błędne odpowiedzi wracają w Powtórce. Gotowe — możesz czytać dalej.",
    targets: [
      { selector: '[data-tour="nav-powtorka"]' },
      {
        selector: '[data-tour="menu-button"]',
        body: "Błędne odpowiedzi wracają w Powtórce — znajdziesz ją w menu. Gotowe, możesz czytać dalej.",
      },
    ],
    primary: "Koniec",
  },
];

/**
 * Trasy, na których instrukcja milknie całkiem (bez karty i bez pigułki „Wróć”):
 * panel admina, trwający quiz, formularz zgłoszenia.
 */
export const isQuietRoute = (p: string) => p.startsWith("/admin") || p.startsWith("/quiz") || p.startsWith("/zgloszenie");
