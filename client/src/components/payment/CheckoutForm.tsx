import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Lock, CreditCard, Shield, CheckCircle } from "lucide-react";
import type { Plan } from "@/types";

interface CheckoutFormProps {
  planId: string;
}

export default function CheckoutForm({ planId }: CheckoutFormProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const { data: plans } = useQuery({
    queryKey: ["/api/plans"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/plans");
      return response.json() as Promise<Plan[]>;
    },
  });

  const plan = plans?.find(p => p.id === planId);

  const checkoutMutation = useMutation({
    mutationFn: async (planId: string) => {
      const response = await apiRequest("POST", "/api/stripe/checkout", { planId });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      } else {
        toast({
          title: "Błąd",
          description: "Nie udało się utworzyć sesji płatności",
          variant: "destructive",
        });
        setIsProcessing(false);
      }
    },
    onError: (error: any) => {
      toast({
        title: "Błąd płatności",
        description: error.message || "Nie udało się przetworzyć płatności",
        variant: "destructive",
      });
      setIsProcessing(false);
    },
  });

  const handlePayment = () => {
    if (!plan) return;
    setIsProcessing(true);
    checkoutMutation.mutate(plan.id);
  };

  if (!plan) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">Plan nie znaleziony</h2>
          <p className="text-muted-foreground">Wybrany plan nie istnieje</p>
        </div>
      </div>
    );
  }

  const duration = plan.durationDays === 30 ? "1 miesiąc" 
    : plan.durationDays === 90 ? "3 miesiące"
    : "12 miesięcy";

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4">Finalizuj zamówienie</h1>
          <p className="text-muted-foreground">Bezpieczna płatność za plan {plan.name}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          <Card className="shadow-app">
            <CardHeader>
              <CardTitle>Podsumowanie zamówienia</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="font-medium">{plan.name}</span>
                <span className="font-bold">{plan.price} {plan.currency}</span>
              </div>
              <div className="flex justify-between text-sm text-muted-foreground">
                <span>Czas dostępu</span>
                <span>{duration}</span>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>Razem</span>
                  <span>{plan.price} {plan.currency}</span>
                </div>
              </div>

              <div className="pt-4 space-y-2">
                <div className="flex items-center text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 mr-2 text-chart-2" />
                  Pełny dostęp do wszystkich quizów
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 mr-2 text-chart-2" />
                  Natychmiastowe wyjaśnienia
                </div>
                <div className="flex items-center text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 mr-2 text-chart-2" />
                  Certyfikat ukończenia
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="shadow-app">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Lock className="h-5 w-5 mr-2" />
                Bezpieczna płatność
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="bg-muted/50 p-6 rounded-lg text-center">
                <CreditCard className="h-12 w-12 mx-auto mb-4 text-primary" />
                <p className="text-sm text-foreground mb-2 font-medium">
                  Płatność obsługiwana przez Stripe
                </p>
                <p className="text-xs text-muted-foreground">
                  Akceptujemy karty Visa, Mastercard, Apple Pay i Google Pay
                </p>
              </div>

              <Button
                onClick={handlePayment}
                disabled={isProcessing || checkoutMutation.isPending}
                className="w-full min-h-[48px] rounded-xl shadow-app-lg"
                size="lg"
                data-testid="complete-payment"
              >
                {isProcessing || checkoutMutation.isPending ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Przekierowywanie do płatności...
                  </>
                ) : (
                  <>
                    Zapłać {plan.price} {plan.currency}
                  </>
                )}
              </Button>

              <div className="flex items-center justify-center gap-4 pt-2">
                <div className="flex items-center text-xs text-muted-foreground">
                  <Shield className="h-3 w-3 mr-1" />
                  SSL 256-bit
                </div>
                <div className="text-xs text-muted-foreground">PCI DSS</div>
              </div>

              <p className="text-xs text-muted-foreground text-center">
                Klikając "Zapłać", wyrażasz zgodę na nasze warunki korzystania z usługi. 
                Po płatności zostaniesz przekierowany z powrotem do aplikacji.
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="mt-8 flex justify-center items-center space-x-6 text-sm text-muted-foreground">
          <div className="flex items-center">
            <Lock className="h-4 w-4 mr-1" />
            SSL Secure
          </div>
          <div>256-bit Encryption</div>
          <div>PCI DSS Compliant</div>
        </div>
      </div>
    </div>
  );
}
