import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useQuery } from "@tanstack/react-query";
import { authService } from "./lib/auth";
import { LoadingSpinner } from "./components/ui/loading-spinner";
import { lazy, Suspense } from "react";
import { Loader } from "@/components/brand/Loader";

// Pages — eager: Home is the LCP landing, NotFound is tiny.
import Home from "@/pages/home";
import NotFound from "@/pages/not-found";

// Pages — lazy: split out of the initial bundle, loaded on navigation.
const Quiz = lazy(() => import("@/pages/quiz"));
const Dashboard = lazy(() => import("@/pages/dashboard"));
const Modules = lazy(() => import("@/pages/modules"));
const Lecture = lazy(() => import("@/pages/lecture"));
const Module3Lecture = lazy(() => import("@/pages/module3-lecture"));
const Admin = lazy(() => import("@/pages/admin"));
const Pricing = lazy(() => import("@/pages/pricing"));
const Checkout = lazy(() => import("@/pages/checkout"));
const PaymentSuccess = lazy(() => import("@/pages/payment-success"));
const VerifyEmail = lazy(() => import("@/pages/verify-email"));
const VerifyCertificate = lazy(() => import("@/pages/verify-certificate"));
const CertificatePage = lazy(() => import("@/pages/certificate"));
const CertificatePreviewPage = lazy(() => import("@/pages/certificate-preview"));
const EKGSimulator = lazy(() => import("@/pages/ekg-simulator"));
const Blog = lazy(() => import("@/pages/blog"));
const BlogPost = lazy(() => import("@/pages/blog-post"));

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
        <Suspense
          fallback={
            <div className="min-h-screen flex items-center justify-center bg-background">
              <Loader size={48} />
            </div>
          }
        >
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
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AppContent />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
