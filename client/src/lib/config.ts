import { useQuery } from "@tanstack/react-query";

/** Ustawienia widoczne publicznie (GET /api/config): rejestracja, dokumenty, płatności */
export type AppConfig = {
  rejestracjaOtwarta: boolean;
  dokumentyOpublikowane: boolean;
  platnosci: boolean;
};

export function useAppConfig() {
  return useQuery<AppConfig>({
    queryKey: ["/api/config"],
    queryFn: async () => {
      const res = await fetch("/api/config", { credentials: "include" });
      if (!res.ok) throw new Error(`${res.status}`);
      return res.json();
    },
    staleTime: 60_000,
  });
}
