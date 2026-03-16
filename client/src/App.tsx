import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { authService } from "./lib/auth";
import { LoadingSpinner } from "./components/ui/loading-spinner";

// Pages
import Home from "@/pages/home";
import Quiz from "@/pages/quiz";
import Dashboard from "@/pages/dashboard";
import Modules from "@/pages/modules";
import Lecture from "@/pages/lecture";
import Module3Lecture from "@/pages/module3-lecture";
// import DynamicLecture from "@/pages/dynamic-lecture";
import Admin from "@/pages/admin";
import Pricing from "@/pages/pricing";
import Checkout from "@/pages/checkout";
import PaymentSuccess from "@/pages/payment-success";
import VerifyEmail from "@/pages/verify-email";
import ResetPassword from "@/pages/reset-password";
import VerifyCertificate from "@/pages/verify-certificate";
import CertificatePage from "@/pages/certificate";
import CertificatePreviewPage from "@/pages/certificate-preview";
import EKGSimulator from "@/pages/ekg-simulator";
import Blog from "@/pages/blog";
import BlogPost from "@/pages/blog-post";
import NotFound from "@/pages/not-found";

// Layout
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

function AppContent() {
  // Load current user on app start
  const { data: user, isLoading } = useQuery({
    queryKey: ["/api/auth/me"],
    queryFn: () => authService.getCurrentUser(),
    retry: false,
    staleTime: Infinity,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <Header />
      <main>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/quiz" component={Quiz} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/modules" component={Modules} />
          <Route path="/lecture" component={Lecture} />
          <Route path="/module3-lecture" component={Module3Lecture} />
          {/* <Route path="/lecture/:sectionId" component={DynamicLecture} /> */}
          <Route path="/blog" component={Blog} />
          <Route path="/blog/:slug" component={BlogPost} />
          <Route path="/admin" component={Admin} />
          <Route path="/pricing" component={Pricing} />
          <Route path="/checkout" component={Checkout} />
          <Route path="/payment-success" component={PaymentSuccess} />
          <Route path="/verify-email" component={VerifyEmail} />
          <Route path="/reset-password" component={ResetPassword} />
          <Route path="/simulator" component={EKGSimulator} />
          <Route path="/certificate/preview" component={CertificatePreviewPage} />
          <Route path="/certificate/:certificateId" component={CertificatePage} />
          <Route path="/verify/:certificateId" component={VerifyCertificate} />
          <Route component={NotFound} />
        </Switch>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
