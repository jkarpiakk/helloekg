import { useEffect, useState } from "react";
import { useLocation } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "wouter";

export default function PaymentSuccess() {
  const [, setLocation] = useLocation();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [error, setError] = useState<string | null>(null);
  const [isNewAccount, setIsNewAccount] = useState(false);

  const confirmPaymentMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      // Use finalize-payment endpoint which handles guest account creation + auto-login
      const response = await apiRequest("POST", "/api/stripe/finalize-payment", { sessionId });
      return response.json();
    },
    onSuccess: (data) => {
      setStatus('success');
      setIsNewAccount(data.isNewAccount);
      // Invalidate auth cache to reflect logged-in state
      queryClient.invalidateQueries({ queryKey: ["/api/auth/me"] });
      queryClient.invalidateQueries({ queryKey: ["/api/subscription/status"] });
      setTimeout(() => {
        setLocation("/dashboard");
      }, 3000);
    },
    onError: (error: any) => {
      setStatus('error');
      setError(error.message || "Wystąpił błąd podczas potwierdzania płatności");
    },
  });

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sessionId = params.get('session_id');
    
    if (sessionId) {
      confirmPaymentMutation.mutate(sessionId);
    } else {
      setStatus('error');
      setError("Brak identyfikatora sesji płatności");
    }
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="max-w-md w-full shadow-app-lg">
        <CardContent className="pt-8 pb-8 text-center">
          {status === 'processing' && (
            <>
              <LoadingSpinner size="lg" className="mx-auto mb-6" />
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Przetwarzanie płatności...
              </h1>
              <p className="text-muted-foreground">
                Proszę czekać, potwierdzamy Twoją płatność
              </p>
            </>
          )}

          {status === 'success' && (
            <>
              <div className="w-16 h-16 rounded-full bg-chart-2/20 flex items-center justify-center mx-auto mb-6">
                <CheckCircle className="w-10 h-10 text-chart-2" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                {isNewAccount ? "Witaj w EKG Academy!" : "Płatność zakończona sukcesem!"}
              </h1>
              <p className="text-muted-foreground mb-6">
                {isNewAccount 
                  ? "Twoje konto zostało utworzone i dostęp aktywowany. Za chwilę przejdziesz do panelu nauki."
                  : "Twój dostęp został aktywowany. Za chwilę zostaniesz przekierowany do panelu."
                }
              </p>
              {isNewAccount && (
                <p className="text-sm text-muted-foreground mb-4 bg-muted/50 rounded-lg p-3">
                  💡 Sprawdź email - wyślemy Ci link do ustawienia hasła
                </p>
              )}
              <Button asChild className="w-full">
                <Link href="/dashboard">Przejdź do panelu</Link>
              </Button>
            </>
          )}

          {status === 'error' && (
            <>
              <div className="w-16 h-16 rounded-full bg-destructive/20 flex items-center justify-center mx-auto mb-6">
                <XCircle className="w-10 h-10 text-destructive" />
              </div>
              <h1 className="text-2xl font-bold text-foreground mb-2">
                Wystąpił problem
              </h1>
              <p className="text-muted-foreground mb-6">
                {error}
              </p>
              <div className="space-y-3">
                <Button asChild variant="outline" className="w-full">
                  <Link href="/dashboard">Wróć do panelu</Link>
                </Button>
                <p className="text-xs text-muted-foreground">
                  Jeśli płatność została pobrana, skontaktuj się z nami - aktywujemy Twój dostęp ręcznie.
                </p>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
