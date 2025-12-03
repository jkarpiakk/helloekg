import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Check, CreditCard, Smartphone } from "lucide-react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
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
    <section className="py-20" id="pricing">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            {t("pricing.title")}
          </h2>
          <p className="text-xl text-muted-foreground">
            {t("pricing.subtitle")}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {uniquePlans?.map((plan) => {
            const extras: PlanExtras = planFeatures[plan.durationDays] || { features: [] };
            const duration = plan.durationDays === 30 ? "1 miesiąc dostępu" 
              : plan.durationDays === 90 ? "3 miesiące dostępu"
              : "12 miesięcy dostępu";
            
            return (
              <Card 
                key={plan.id}
                className={`relative hover:shadow-xl transition-all hover:-translate-y-2 ${
                  extras.isPopular ? 'border-2 border-primary' : ''
                }`}
                data-testid={`pricing-plan-${plan.durationDays}`}
              >
                {extras.isPopular && (
                  <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
                    <Badge className="bg-primary text-primary-foreground px-4 py-1">
                      {t("pricing.popular")}
                    </Badge>
                  </div>
                )}
                
                <CardHeader className="text-center pb-8">
                  <CardTitle className="text-2xl font-bold text-foreground mb-2">
                    {plan.name}
                  </CardTitle>
                  <div className="text-4xl font-bold text-primary mb-2">
                    {plan.price} zł
                  </div>
                  <p className="text-muted-foreground">{duration}</p>
                  {extras.savings && (
                    <Badge variant="outline" className="bg-chart-2/10 text-chart-2 mt-2">
                      {extras.savings}
                    </Badge>
                  )}
                </CardHeader>
                
                <CardContent className="space-y-6">
                  <ul className="space-y-4">
                    {extras.features.map((feature, index) => (
                      <li key={index} className="flex items-center text-foreground">
                        <Check className="h-5 w-5 text-chart-2 mr-3 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                  
                  {isAuthenticated ? (
                    <Button 
                      className={`w-full ${
                        extras.isPopular 
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
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
                    <Button 
                      className={`w-full ${
                        extras.isPopular 
                          ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                          : ''
                      }`}
                      variant={extras.isPopular ? "default" : "outline"}
                      onClick={onOpenAuth}
                      data-testid={`select-plan-${plan.durationDays}`}
                    >
                      {t("pricing.cta")}
                    </Button>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Payment methods */}
        <div className="text-center mt-12">
          <p className="text-muted-foreground mb-4">
            {t("pricing.payment.title")}
          </p>
          <div className="flex justify-center items-center space-x-6 flex-wrap">
            <div className="flex items-center space-x-2">
              <CreditCard className="h-6 w-6 text-muted-foreground" />
              <span className="text-muted-foreground">Visa</span>
            </div>
            <div className="flex items-center space-x-2">
              <CreditCard className="h-6 w-6 text-muted-foreground" />
              <span className="text-muted-foreground">Mastercard</span>
            </div>
            <div className="flex items-center space-x-2">
              <Smartphone className="h-6 w-6 text-muted-foreground" />
              <span className="text-muted-foreground">Apple Pay</span>
            </div>
            <div className="flex items-center space-x-2">
              <Smartphone className="h-6 w-6 text-muted-foreground" />
              <span className="text-muted-foreground">Google Pay</span>
            </div>
            <span className="text-muted-foreground font-semibold">PayU</span>
          </div>
        </div>
      </div>
    </section>
  );
}
