import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { StronaBledu } from "@/components/bledy/StronaBledu";

/** 404: pobudzenie zablokowane. Serwer odpowiada wtedy kodem 404 (server/static.ts, shared/trasy.ts). */
export default function NotFound() {
  const { isAuthenticated } = useAuth();
  // Tylko podgląd lokalny (npm run dev): ?__awaria pokazuje ekran awarii widoku (ErrorBoundary)
  if (import.meta.env.DEV && new URLSearchParams(window.location.search).has("__awaria")) {
    throw new Error("Podgląd ekranu awarii widoku");
  }

  return (
    <StronaBledu
      kod="404"
      rodzaj="blok"
      etykieta="Błąd 404 · nie ma takiej strony"
      tytul="Ten adres nie przewodzi"
      dzialania={
        <Button asChild>
          <Link href={isAuthenticated ? "/modules" : "/?auth=login"}>{isAuthenticated ? "Wróć do kursu" : "Zaloguj się"}</Link>
        </Button>
      }
      dopisek={
        isAuthenticated ? (
          <>
            Link do tej strony był w kursie albo w mailu?{" "}
            <Link href="/zgloszenie" className="text-[var(--txt)] underline underline-offset-4">
              Daj nam znać
            </Link>
            , poprawimy go.
          </>
        ) : undefined
      }
    >
      <p>
        Impuls doszedł pod ten adres i dalej nie poszedł, jak załamek P bez zespołu QRS. Link mógł się zmienić albo ma
        literówkę. Reszta kursu działa normalnie.
      </p>
    </StronaBledu>
  );
}
