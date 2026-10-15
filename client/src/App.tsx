import { lazy, Suspense } from "react";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { authService } from "./lib/auth";
import { LoadingSpinner } from "./components/ui/loading-spinner";
import { ThemeProvider } from "@/hooks/use-theme";
import { ErrorBoundary } from "@/components/ErrorBoundary";
import { MotionConfig } from "framer-motion";
import { spring } from "@/lib/motion";

// Pages
import Home from "@/pages/home";
import Quiz from "@/pages/quiz";
import Dashboard from "@/pages/dashboard";
import Modules from "@/pages/modules";

import Pricing from "@/pages/pricing";
import Checkout from "@/pages/checkout";
import PaymentSuccess from "@/pages/payment-success";
import VerifyEmail from "@/pages/verify-email";
import ResetPassword from "@/pages/reset-password";
import ForgotPassword from "@/pages/forgot-password";
import VerifyCertificate from "@/pages/verify-certificate";
import Blog from "@/pages/blog";
import BlogPost from "@/pages/blog-post";
import NotFound from "@/pages/not-found";

// Ciężkie widoki poza głównym bundle (React.lazy + Suspense)
const Lecture = lazy(() => import("@/pages/lecture"));
const DynamicLecture = lazy(() => import("@/pages/dynamic-lecture"));
const Module3Lecture = lazy(() => import("@/pages/module3-lecture"));
const Admin = lazy(() => import("@/pages/admin"));
const CertificatePage = lazy(() => import("@/pages/certificate"));
const CertificatePreviewPage = lazy(() => import("@/pages/certificate-preview"));
const EKGSimulator = lazy(() => import("@/pages/ekg-simulator"));

// Layout
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";

// Loader zgodny z marką: sygnet H z szybszym impulsem jako fallback Suspense
const LOADER_H_PATH =
  "M4,50 L18,50 L26,14 L34,86 L40,50 L60,50 L66,14 L74,86 L80,50 L96,50";

function RouteLoader() {
  return (
    <div className="min-h-[50vh] flex items-center justify-center" role="status" aria-label="Ładowanie">
      <svg width={56} height={56} viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path
          d={LOADER_H_PATH}
          stroke="#1E4536"
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d={LOADER_H_PATH}
          stroke="#3EE6A8"
          strokeWidth={7}
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="90 450"
          className="logo-pulse-path"
          style={{ animationDuration: "1.4s" }}
        />
      </svg>
    </div>
  );
}

function AppContent() {
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
        <Suspense fallback={<RouteLoader />}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/quiz" component={Quiz} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/modules" component={Modules} />
          <Route path="/lecture/:sectionId" component={DynamicLecture} />
          <Route path="/lecture" component={Lecture} />
          <Route path="/module3-lecture" component={Module3Lecture} />
          <Route path="/blog" component={Blog} />
          <Route path="/blog/:slug" component={BlogPost} />
          <Route path="/admin" component={Admin} />
          <Route path="/pricing" component={Pricing} />
          <Route path="/checkout" component={Checkout} />
          <Route path="/payment-success" component={PaymentSuccess} />
          <Route path="/verify-email" component={VerifyEmail} />
          <Route path="/reset-password" component={ResetPassword} />
          <Route path="/forgot-password" component={ForgotPassword} />
          <Route path="/simulator" component={EKGSimulator} />
          <Route path="/certificate/preview" component={CertificatePreviewPage} />
          <Route path="/certificate/:certificateId" component={CertificatePage} />
          <Route path="/verify/:certificateId" component={VerifyCertificate} />
          <Route component={NotFound} />
        </Switch>
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        {/* Wszystkie animacje framer-motion: sprężyna bez odbicia; „Ogranicz ruch” respektowane globalnie */}
        <MotionConfig reducedMotion="user" transition={spring}>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <Toaster />
            <ErrorBoundary>
              <AppContent />
            </ErrorBoundary>
          </TooltipProvider>
        </QueryClientProvider>
        </MotionConfig>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
