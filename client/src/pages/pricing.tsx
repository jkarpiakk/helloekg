import { Link } from "wouter";
import PricingSection from "@/components/payment/PricingSection";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";

/** Cennik: tylko z kontem (trasa za bramką konta w App.tsx), zakup przez /checkout */
export default function Pricing() {
  return (
    <div className="min-h-screen bg-background">
      <PricingSection />
      <div className="pb-12 text-center">
        <Button asChild variant="ghost" className="text-muted-foreground">
          <Link href="/dashboard">
            Wróć do kursu
            <ArrowRight className="ml-2 h-4 w-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
