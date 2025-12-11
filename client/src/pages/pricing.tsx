import { useState } from "react";
import { useLocation } from "wouter";
import PricingSection from "@/components/payment/PricingSection";
import AuthForms from "@/components/auth/AuthForms";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";

export default function Pricing() {
  const [authMode, setAuthMode] = useState<"login" | "register" | null>(null);
  const [, setLocation] = useLocation();

  const handleAuthSuccess = () => {
    setAuthMode(null);
    setLocation("/dashboard");
  };

  return (
    <div className="min-h-screen bg-background">
      <div className="pt-20">
        <PricingSection onOpenAuth={() => setAuthMode("register")} />
      </div>
      
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
