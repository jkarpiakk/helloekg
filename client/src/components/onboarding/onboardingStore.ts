/**
 * Wspólny stan prowadzenia „na start”: co kursant już zrobił (kliknięcia, których serwer
 * nie zapisuje) i mała szyna zdarzeń do ponownego otwarcia instrukcji.
 * localStorage zawsze w try/catch — w trybie prywatnym może rzucać; wtedy trzymamy stan w pamięci.
 */
import { useQuery } from "@tanstack/react-query";
import { authService, useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import type { AuthUser } from "@/types";

/** Zdarzenie: „pokaż instrukcję jeszcze raz” */
export const WELCOME_EVENT = "hk:welcome";
/** Zdarzenie: zmienił się stan pierwszych kroków (ta sama karta) */
export const STEPS_EVENT = "hk:steps";

export const openWelcome = () => {
  window.dispatchEvent(new CustomEvent(WELCOME_EVENT));
};

export type StepFlag = "lecture" | "review" | "feedback" | "dismissed";
type StepFlags = Partial<Record<StepFlag, true>>;

const memory = new Map<string, string>();

export function readStore(key: string): string | null {
  try {
    // Gdy zapis się nie udał (np. brak miejsca), pamięć sesji i tak pamięta stan
    return window.localStorage.getItem(key) ?? memory.get(key) ?? null;
  } catch {
    return memory.get(key) ?? null;
  }
}

/** Zwraca false, gdy zapis do localStorage się nie udał (stan żyje tylko w tej sesji) */
export function writeStore(key: string, value: string): boolean {
  memory.set(key, value);
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export const welcomeKey = (userId: string) => `hk-welcome-v1:${userId}`;
export const stepsKey = (userId: string) => `hk-steps-v1:${userId}`;

export function readSteps(userId: string): StepFlags {
  const raw = readStore(stepsKey(userId));
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as StepFlags) : {};
  } catch {
    return {};
  }
}

export function markStep(userId: string | undefined, flag: StepFlag) {
  if (!userId) return;
  const next = { ...readSteps(userId), [flag]: true as const };
  writeStore(stepsKey(userId), JSON.stringify(next));
  window.dispatchEvent(new CustomEvent(STEPS_EVENT));
}

/** Bieżący użytkownik — z tej samej pamięci podręcznej co App (["/api/auth/me"]) */
export function useCurrentUser(): AuthUser | null {
  const { user } = useAuth();
  const { data } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: () => authService.getCurrentUser(),
    retry: false,
    staleTime: Infinity,
  });
  return data ?? user ?? null;
}

export interface OnbSection {
  id: string;
  order: number;
  completionPercentage?: number;
  lastActivity?: string | null;
  chapterCount?: number;
  questionCount?: number;
}
export interface OnbModule {
  id: string;
  order: number;
  sections: OnbSection[];
}

/** Ten sam klucz i kształt co w panelu postępu — dane dzielone z pamięci podręcznej */
export function useModules(enabled = true) {
  return useQuery({
    queryKey: ["/api/modules"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/modules");
      return response.json() as Promise<OnbModule[]>;
    },
    enabled,
  });
}

/** Pierwszy wykład kursu: pierwsza sekcja (wg kolejności) z opublikowanymi rozdziałami */
export function firstLectureHref(modules: OnbModule[] | undefined): string {
  const sorted = (modules ?? []).slice().sort((a, b) => a.order - b.order);
  for (const m of sorted) {
    const s = m.sections
      .slice()
      .sort((a, b) => a.order - b.order)
      .find((x) => (x.chapterCount ?? 0) > 0);
    if (s) return `/lecture/${s.id}`;
  }
  return "/modules";
}
