import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { Lock, CreditCard } from "lucide-react";
import type { Plan } from "@/types";

interface CheckoutFormProps {
  planId: string;
}

export default function CheckoutForm({ planId }: CheckoutFormProps) {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Fetch plan details
  const { data: plans } = useQuery({
    queryKey: ["/api/plans"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/plans");
      return response.json() as Promise<Plan[]>;
    },
  });

  const plan = plans?.find(p => p.id === planId);

  // Create payment intent mutation
  const createPaymentMutation = useMutation({
    mutationFn: async (planId: string) => {
      const response = await apiRequest("POST", "/api/create-payment-intent", { planId });
      return response.json();
    },
    onSuccess: (data) => {
      // In a real implementation, this would integrate with Stripe
      // For now, we'll simulate a successful payment
      toast({
        title: "Płatność zakończona sukcesem",
        description: "Twój dostęp został aktywowany",
      });
      window.location.href = "/dashboard";
    },
    onError: (error: any) => {
      toast({
        title: "Błąd płatności",
        description: error.message || "Nie udało się przetworzyć płatności",
        variant: "destructive",
      });
    },
  });

  const handlePayment = () => {
    if (!plan) return;
    setIsProcessing(true);
    createPaymentMutation.mutate(plan.id);
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

  return (
    <div className="min-h-screen bg-background py-12">
      <div className="max-w-2xl mx-auto px-4">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-foreground mb-4">Finalizuj zamówienie</h1>
          <p className="text-muted-foreground">Bezpieczna płatność za plan {plan.name}</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Order Summary */}
          <Card>
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
                <span>{plan.durationDays} dni</span>
              </div>
              <div className="border-t pt-4">
                <div className="flex justify-between text-lg font-bold">
                  <span>Razem</span>
                  <span>{plan.price} {plan.currency}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Form */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Lock className="h-5 w-5 mr-2" />
                Bezpieczna płatność
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Payment Demo */}
              <div className="bg-muted/50 p-6 rounded-lg text-center">
                <CreditCard className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground mb-4">
                  W pełnej wersji tutaj znajdzie się formularz płatności Stripe
                </p>
                <p className="text-xs text-muted-foreground">
                  SSL 256-bit • PCI DSS • Bezpieczne przetwarzanie
                </p>
              </div>

              <Button
                onClick={handlePayment}
                disabled={isProcessing || createPaymentMutation.isPending}
                className="w-full"
                size="lg"
                data-testid="complete-payment"
              >
                {isProcessing || createPaymentMutation.isPending ? (
                  <>
                    <LoadingSpinner size="sm" className="mr-2" />
                    Przetwarzanie...
                  </>
                ) : (
                  <>
                    Zapłać {plan.price} {plan.currency}
                  </>
                )}
              </Button>

              <p className="text-xs text-muted-foreground text-center">
                Klikając "Zapłać", wyrażasz zgodę na nasze warunki korzystania z usługi
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Security badges */}
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
