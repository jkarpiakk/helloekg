import { useLocation } from "wouter";
import { useAuth } from "@/lib/auth";
import CheckoutForm from "@/components/payment/CheckoutForm";

export default function Checkout() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  // Parse plan ID from URL
  const urlParams = new URLSearchParams(window.location.search);
  const planId = urlParams.get('plan');

  if (!isAuthenticated) {
    setLocation("/?auth=login");
    return null;
  }

  if (!planId) {
    setLocation("/pricing");
    return null;
  }

  return <CheckoutForm planId={planId} />;
}
