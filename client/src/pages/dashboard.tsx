import { useAuth } from "@/lib/auth";
import { useLocation } from "wouter";
import StudentDashboard from "@/components/dashboard/StudentDashboard";

export default function Dashboard() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();

  if (!isAuthenticated) {
    setLocation("/?auth=login");
    return null;
  }

  return <StudentDashboard />;
}
