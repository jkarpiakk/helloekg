import { useEffect, useState } from "react";
import { useLocation, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { CheckCircle, XCircle, Mail } from "lucide-react";

export default function VerifyEmail() {
  const [, setLocation] = useLocation();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('token'));
  }, []);

  const { data, isLoading, error, isError } = useQuery({
    queryKey: ['/api/auth/verify-email', token],
    queryFn: async () => {
      if (!token) throw new Error('Brak tokenu');
      const response = await fetch(`/api/auth/verify-email?token=${token}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Błąd weryfikacji');
      }
      return data;
    },
    enabled: !!token,
    retry: false,
  });

  if (!token) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-app-lg">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Brak tokenu weryfikacyjnego
            </h1>
            <p className="text-muted-foreground mb-6">
              Link weryfikacyjny jest nieprawidłowy. Sprawdź czy skopiowałeś cały link z e-maila.
            </p>
            <Button asChild className="w-full">
              <Link href="/">Wróć na stronę główną</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-app-lg">
          <CardContent className="pt-8 pb-8 text-center">
            <LoadingSpinner size="lg" className="mx-auto mb-6" />
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Weryfikacja adresu e-mail...
            </h1>
            <p className="text-muted-foreground">
              Proszę czekać
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md w-full shadow-app-lg">
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-6">
              <XCircle className="w-10 h-10 text-destructive" />
            </div>
            <h1 className="text-2xl font-bold text-foreground mb-2">
              Błąd weryfikacji
            </h1>
            <p className="text-muted-foreground mb-6">
              {(error as Error)?.message || 'Nie udało się zweryfikować adresu e-mail'}
            </p>
            <div className="space-y-3">
              <Button asChild variant="outline" className="w-full">
                <Link href="/">Wróć na stronę główną</Link>
              </Button>
              <p className="text-xs text-muted-foreground">
                Token mógł wygasnąć. Spróbuj zalogować się i poprosić o nowy link weryfikacyjny.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-app-lg">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="w-16 h-16 rounded-full bg-chart-2/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-chart-2" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            E-mail zweryfikowany!
          </h1>
          <p className="text-muted-foreground mb-6">
            Twój adres e-mail został potwierdzony. Zaloguj się i wybierz plan, aby uzyskać pełny dostęp do kursu.
          </p>
          <Button asChild className="w-full min-h-[48px] rounded-xl shadow-app-lg">
            <Link href="/pricing">Wybierz plan</Link>
          </Button>
          <Button asChild variant="ghost" className="w-full mt-2">
            <Link href="/">Zaloguj się później</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
