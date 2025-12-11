import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Check, CreditCard, Smartphone, Loader2 } from "lucide-react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useToast } from "@/hooks/use-toast";
import type { Plan } from "@/types";

interface PricingSectionProps {
  onOpenAuth?: () => void;
}

interface PlanExtras {
  savings?: string;
  isPopular?: boolean;
  features: string[];
}

const planFeatures: Record<number, PlanExtras> = {
  30: {
    features: [
      "Pełny dostęp do quizów",
      "Natychmiastowe wyjaśnienia",
      "Śledzenie postępów",
      "Certyfikat ukończenia"
    ]
  },
  90: {
    savings: "Oszczędź 80 zł",
    isPopular: true,
    features: [
      "Pełny dostęp do quizów",
      "Natychmiastowe wyjaśnienia",
      "Śledzenie postępów",
      "Certyfikat ukończenia",
      "Priorytetowe wsparcie"
    ]
  },
  365: {
    savings: "Oszczędź 551 zł",
    features: [
      "Pełny dostęp do quizów",
      "Natychmiastowe wyjaśnienia",
      "Śledzenie postępów",
      "Certyfikat ukończenia",
      "Priorytetowe wsparcie",
      "Dostęp do nowych treści"
    ]
  }
};

export default function PricingSection({ onOpenAuth }: PricingSectionProps) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { toast } = useToast();
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [guestEmail, setGuestEmail] = useState("");

  const guestCheckoutMutation = useMutation({
    mutationFn: async ({ email, planId }: { email: string; planId: string }) => {
      const response = await apiRequest("POST", "/api/stripe/guest-checkout", { email, planId });
      return response.json();
    },
    onSuccess: (data) => {
      if (data.url) {
        window.location.href = data.url;
      }
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się rozpocząć płatności",
        variant: "destructive",
      });
    },
  });

  const handleGuestCheckout = (planId: string) => {
    if (!guestEmail || !guestEmail.includes("@")) {
      toast({
        title: "Podaj email",
        description: "Wprowadź poprawny adres email",
        variant: "destructive",
      });
      return;
    }
    guestCheckoutMutation.mutate({ email: guestEmail, planId });
  };

  const { data: plans, isLoading } = useQuery({
    queryKey: ["/api/plans"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/plans");
      return response.json() as Promise<Plan[]>;
    },
  });

  // Remove duplicates and sort by duration
  const uniquePlans = plans?.reduce((acc: Plan[], plan) => {
    if (!acc.find(p => p.durationDays === plan.durationDays)) {
      acc.push(plan);
    }
    return acc;
  }, []).sort((a, b) => a.durationDays - b.durationDays);

  if (isLoading) {
    return (
      <section className="py-20" id="pricing">
        <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-center">
            <LoadingSpinner size="lg" />
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="py-12 sm:py-16 lg:py-20" id="pricing">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-10 sm:mb-16">
          <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground mb-3 sm:mb-4">
            {t("pricing.title")}
          </h2>
          <p className="text-sm sm:text-base lg:text-xl text-muted-foreground">
            {t("pricing.subtitle")}
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 sm:gap-8 max-w-5xl mx-auto">
          {uniquePlans?.map((plan) => {
            const extras: PlanExtras = planFeatures[plan.durationDays] || { features: [] };
            const duration = plan.durationDays === 30 ? "1 miesiąc dostępu" 
              : plan.durationDays === 90 ? "3 miesiące dostępu"
              : "12 miesięcy dostępu";
            
            return (
              <Card 
                key={plan.id}
                className={`relative hover:shadow-app-lg transition-all hover:-translate-y-2 rounded-2xl shadow-app ${
                  extras.isPopular ? 'border-2 border-primary' : ''
                }`}
                data-testid={`pricing-plan-${plan.durationDays}`}
              >
                {extras.isPopular && (
                  <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-3 sm:px-4 py-1 text-xs sm:text-sm">
                      {t("pricing.popular")}
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="text-center pb-4 sm:pb-8 pt-6 sm:pt-8">
                  <CardTitle className="text-lg sm:text-2xl font-bold text-foreground mb-2">
                    {plan.name}
                  </CardTitle>
                  <div className="text-2xl sm:text-4xl font-bold text-primary mb-2">
                    {plan.price} zł
                  </div>
                  <p className="text-xs sm:text-base text-muted-foreground">{duration}</p>
                  {extras.savings && (
                    <Badge variant="outline" className="bg-chart-2/10 text-chart-2 mt-2 text-xs">
                      {extras.savings}
                    </Badge>
                  )}
                </CardHeader>
                
                <CardContent className="space-y-4 sm:space-y-6 pb-6">
                  <ul className="space-y-2 sm:space-y-4">
                    {extras.features.map((feature, index) => (
                      <li key={index} className="flex items-center text-foreground text-sm sm:text-base">
                        <Check className="h-4 w-4 sm:h-5 sm:w-5 text-chart-2 mr-2 sm:mr-3 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  {isAuthenticated ? (
                    <Button 
                      className={`w-full min-h-[44px] rounded-xl active:scale-[0.97] transition-transform text-sm sm:text-base ${
                        extras.isPopular 
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-app-lg' 
                          : ''
                      }`}
                      variant={extras.isPopular ? "default" : "outline"}
                      asChild
                      data-testid={`select-plan-${plan.durationDays}`}
                    >
                      <Link href={`/checkout?plan=${plan.id}`}>
                        {t("pricing.cta")}
                      </Link>
                    </Button>
                  ) : (
                    <div className="space-y-3">
                      {selectedPlanId === plan.id ? (
                        <>
                          <Input
                            type="email"
                            placeholder="Twój adres email"
                            value={guestEmail}
                            onChange={(e) => setGuestEmail(e.target.value)}
                            className="w-full min-h-[44px] rounded-xl text-sm sm:text-base"
                            data-testid={`email-input-${plan.durationDays}`}
                          />
                          <Button 
                            className={`w-full min-h-[44px] rounded-xl active:scale-[0.97] transition-transform text-sm sm:text-base ${
                              extras.isPopular 
                                ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-app-lg' 
                                : ''
                            }`}
                            variant={extras.isPopular ? "default" : "outline"}
                            onClick={() => handleGuestCheckout(plan.id)}
                            disabled={guestCheckoutMutation.isPending}
                            data-testid={`checkout-plan-${plan.durationDays}`}
                          >
                            {guestCheckoutMutation.isPending ? (
                              <Loader2 className="h-4 w-4 animate-spin mr-2" />
                            ) : null}
                            Przejdź do płatności
                          </Button>
                          <p className="text-xs text-muted-foreground text-center">
                            Konto zostanie utworzone automatycznie
                          </p>
                        </>
                      ) : (
                        <Button 
                          className={`w-full min-h-[44px] rounded-xl active:scale-[0.97] transition-transform text-sm sm:text-base ${
                            extras.isPopular 
                              ? 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-app-lg' 
                              : ''
                          }`}
                          variant={extras.isPopular ? "default" : "outline"}
                          onClick={() => setSelectedPlanId(plan.id)}
                          data-testid={`select-plan-${plan.durationDays}`}
                        >
                          {t("pricing.cta")}
                        </Button>
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Payment methods */}
        <div className="text-center mt-8 sm:mt-12">
          <p className="text-muted-foreground mb-3 sm:mb-4 text-xs sm:text-base">
            {t("pricing.payment.title")}
          </p>
          <div className="flex justify-center items-center gap-3 sm:gap-6 flex-wrap">
            <div className="flex items-center space-x-1 sm:space-x-2">
              <CreditCard className="h-4 w-4 sm:h-6 sm:w-6 text-muted-foreground" />
              <span className="text-muted-foreground text-xs sm:text-base">Visa</span>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2">
              <CreditCard className="h-4 w-4 sm:h-6 sm:w-6 text-muted-foreground" />
              <span className="text-muted-foreground text-xs sm:text-base">Mastercard</span>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2">
              <Smartphone className="h-4 w-4 sm:h-6 sm:w-6 text-muted-foreground" />
              <span className="text-muted-foreground text-xs sm:text-base">Apple Pay</span>
            </div>
            <div className="flex items-center space-x-1 sm:space-x-2">
              <Smartphone className="h-4 w-4 sm:h-6 sm:w-6 text-muted-foreground" />
              <span className="text-muted-foreground text-xs sm:text-base">Google Pay</span>
            </div>
            <span className="text-muted-foreground font-semibold text-xs sm:text-base">PayU</span>
          </div>
        </div>
      </div>
    </section>
  );
}
