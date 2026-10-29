import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { Switch, Route, Redirect, useLocation, useSearch } from "wouter";
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
import VerifyEmail from "@/pages/verify-email";
import ResetPassword from "@/pages/reset-password";
import ForgotPassword from "@/pages/forgot-password";
import NotFound from "@/pages/not-found";

// Ciężkie widoki poza głównym bundle (React.lazy + Suspense)
const DynamicLecture = lazy(() => import("@/pages/dynamic-lecture"));
const Admin = lazy(() => import("@/pages/admin"));
const CertificatePage = lazy(() => import("@/pages/certificate"));
const CertificatePreviewPage = lazy(() => import("@/pages/certificate-preview"));
const FeedbackPage = lazy(() => import("@/pages/feedback"));

// Layout
import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import FeedbackFab from "@/components/feedback/FeedbackFab";
import Tour from "@/components/onboarding/Tour";

const LOADER_DELAY_MS = 300;

/** Fallback Suspense: ten sam sygnet co przy ładowaniu danych, ale dopiero po 300 ms — szybkie wczytanie trasy nie miga loaderem */
function RouteLoader() {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), LOADER_DELAY_MS);
    return () => clearTimeout(t);
  }, []);

  // Miejsce zarezerwowane od razu (bez skoku układu), treść po opóźnieniu
  if (!visible) return <div className="min-h-[50vh]" aria-hidden="true" />;

  return (
    <div className="min-h-[50vh] flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  );
}

/** Stare adresy bloga → blog na helloekg.pl (pełne przeładowanie, inna domena) */
function BlogRedirect() {
  useEffect(() => {
    window.location.replace("https://helloekg.pl/blog/");
  }, []);
  return <RouteLoader />;
}

/**
 * Nowa strona zaczyna się od góry. Wouter (pushState) nie przewija sam, więc wejście w pytania
 * z przewiniętej listy kursu otwierało quiz w połowie (zgłoszenie JK 21.10). Wyjątki: „wstecz”
 * (przeglądarka przywraca miejsce) i adresy z #kotwicą (wykład sam ustawia rozdział).
 */
function ScrollToTopOnNavigate() {
  const [path] = useLocation();
  const search = useSearch();
  const fromHistory = useRef(false);
  useEffect(() => {
    const onPop = () => { fromHistory.current = true; };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, []);
  useEffect(() => {
    const back = fromHistory.current;
    fromHistory.current = false;
    if (back || window.location.hash) return;
    window.scrollTo({ top: 0, left: 0, behavior: "instant" as ScrollBehavior });
  }, [path, search]);
  return null;
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
      <ScrollToTopOnNavigate />
      {/* Dolny odstęp: pływający „Zgłoś uwagę” nie zasłania ostatnich linii treści */}
      <main className="pb-24">
        <Suspense fallback={<RouteLoader />}>
        <Switch>
          <Route path="/" component={Home} />
          <Route path="/quiz" component={Quiz} />
          <Route path="/dashboard" component={Dashboard} />
          <Route path="/modules" component={Modules} />
          <Route path="/lecture/:sectionId" component={DynamicLecture} />
          {/* Stare trasy: wykład statyczny i symulator → kurs; blog → helloekg.pl; płatności → panel (beta bez płatności) */}
          <Route path="/lecture"><Redirect to="/modules" replace /></Route>
          <Route path="/module3-lecture"><Redirect to="/modules" replace /></Route>
          <Route path="/simulator"><Redirect to="/modules" replace /></Route>
          <Route path="/blog" component={BlogRedirect} />
          <Route path="/blog/*" component={BlogRedirect} />
          <Route path="/pricing"><Redirect to="/dashboard" replace /></Route>
          <Route path="/checkout"><Redirect to="/dashboard" replace /></Route>
          <Route path="/payment-success"><Redirect to="/dashboard" replace /></Route>
          <Route path="/admin" component={Admin} />
          <Route path="/verify-email" component={VerifyEmail} />
          <Route path="/reset-password" component={ResetPassword} />
          <Route path="/forgot-password" component={ForgotPassword} />
          <Route path="/zgloszenie" component={FeedbackPage} />
          <Route path="/certificate/preview" component={CertificatePreviewPage} />
          <Route path="/certificate/:certificateId" component={CertificatePage} />
          <Route component={NotFound} />
        </Switch>
        </Suspense>
      </main>
      <Footer />
      {/* Zgłoszenia testerów (beta) — tylko dla zalogowanych */}
      {user && <FeedbackFab />}
      {/* Instrukcja przy pierwszym logowaniu — poza trasami, więc przeżywa nawigację */}
      {user && <Tour key={user.id} userId={String(user.id)} />}
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
