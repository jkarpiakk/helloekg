import { useState } from "react";
import { useLocation, Link } from "wouter";
import PricingSection from "@/components/payment/PricingSection";
import AuthForms from "@/components/auth/AuthForms";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { ArrowRight } from "lucide-react";

export default function Pricing() {
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);
  const [, setLocation] = useLocation();
  const { user } = useAuth();

  const handleAuthSuccess = () => {
    setAuthMode(null);
    setLocation("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="pt-20">
        <PricingSection onOpenAuth={() => setAuthMode("register")} />
      </div>
      
      {user && (
        <div className="text-center pb-12">
          <Button asChild variant="ghost" className="text-muted-foreground">
            <Link href="/dashboard">
              Pomiń na razie i przejdź do panelu
              <ArrowRight className="ml-2 h-4 w-4" />
            </Link>
          </Button>
        </div>
      )}
      
      <Dialog open={authMode !== null} onOpenChange={() => setAuthMode(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle className="sr-only">
            {authMode === 'login' ? 'Zaloguj się' : 'Zarejestruj się'}
          </DialogTitle>
          {authMode && (
            <AuthForms 
              mode={authMode} 
              onSuccess={handleAuthSuccess}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
