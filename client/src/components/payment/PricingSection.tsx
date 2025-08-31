import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { Check, CreditCard, Smartphone } from "lucide-react";
import { Link } from "wouter";

interface Plan {
  id: string;
  name: string;
  price: number;
  duration: string;
  savings?: string;
  isPopular?: boolean;
  features: string[];
}

const plans: Plan[] = [
  {
    id: "monthly",
    name: "Plan Miesięczny",
    price: 60,
    duration: "1 miesiąc dostępu",
    features: [
      "Pełny dostęp do quizów",
      "Natychmiastowe wyjaśnienia",
      "Śledzenie postępów",
      "Certyfikat ukończenia"
    ]
  },
  {
    id: "quarterly",
    name: "Plan Kwartalny",
    price: 100,
    duration: "3 miesiące dostępu",
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
  {
    id: "yearly",
    name: "Plan Roczny",
    price: 169,
    duration: "12 miesięcy dostępu",
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
];

export default function PricingSection() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();

  return (
    <section className="py-20" id="pricing">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl lg:text-4xl font-bold text-foreground mb-4">
            {t("pricing.title")}
          </h2>
          <p className="text-xl text-muted-foreground">
            {t("pricing.subtitle")}
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-5xl mx-auto">
          {plans.map((plan) => (
            <Card 
              key={plan.id}
              className={`relative hover:shadow-xl transition-all hover:-translate-y-2 ${
                plan.isPopular ? 'border-2 border-primary' : ''
              }`}
              data-testid={`pricing-plan-${plan.id}`}
            >
              {plan.isPopular && (
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
                <p className="text-muted-foreground">{plan.duration}</p>
                {plan.savings && (
                  <Badge variant="outline" className="bg-chart-2/10 text-chart-2 mt-2">
                    {plan.savings}
                  </Badge>
                )}
              </CardHeader>
              
              <CardContent className="space-y-6">
                <ul className="space-y-4">
                  {plan.features.map((feature, index) => (
                    <li key={index} className="flex items-center text-foreground">
                      <Check className="h-5 w-5 text-chart-2 mr-3 flex-shrink-0" />
                      <span>{feature}</span>
                    </li>
                  ))}
                </ul>
                
                <Button 
                  className={`w-full ${
                    plan.isPopular 
                      ? 'bg-primary text-primary-foreground hover:bg-primary/90' 
                      : ''
                  }`}
                  variant={plan.isPopular ? "default" : "outline"}
                  asChild
                  data-testid={`select-plan-${plan.id}`}
                >
                  {isAuthenticated ? (
                    <Link href={`/checkout?plan=${plan.id}`}>
                      {t("pricing.cta")}
                    </Link>
                  ) : (
                    <Link href="/?auth=register">
                      {t("pricing.cta")}
                    </Link>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))}
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
