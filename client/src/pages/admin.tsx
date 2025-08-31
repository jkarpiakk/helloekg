import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import AdminPanel from "@/components/admin/AdminPanel";

export default function Admin() {
  const { isAuthenticated, canReviewContent } = useAuth();
  const [, setLocation] = useLocation();

  if (!isAuthenticated) {
    setLocation("/?auth=login");
    return null;
  }

  if (!canReviewContent) {
    setLocation("/dashboard");
    return null;
  }

  return <AdminPanel />;
}
