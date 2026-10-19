import { useEffect, useState } from "react";
import { Link, useLocation, useSearch } from "wouter";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Menu, X, LogOut, Settings, Trash2 } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { spring } from "@/lib/motion";
import Logo from "@/components/layout/Logo";
import { ThemeToggle } from "@/components/ui/theme-toggle";

type NavItem = {
  href: string;
  label: string;
  testId: string;
  /** Kotwica instrukcji (data-tour) */
  tour: string;
  isActive: (path: string, search: URLSearchParams) => boolean;
};

/** Nawigacja zalogowanego w becie (docs/design-system.md → Architektura informacji) */
const NAV_ITEMS: NavItem[] = [
  {
    href: "/modules",
    label: "Kurs",
    testId: "modules",
    tour: "kurs",
    isActive: (p) => p === "/modules" || p.startsWith("/lecture"),
  },
  {
    href: "/dashboard",
    label: "Postęp",
    testId: "dashboard",
    tour: "postep",
    isActive: (p) => p === "/dashboard",
  },
  {
    href: "/quiz?mode=review",
    label: "Powtórka",
    testId: "review",
    tour: "powtorka",
    isActive: (p, s) => p === "/quiz" && s.get("mode") === "review",
  },
];

/** Inicjał do awatara: imię, a gdy go brak (nowe konta) — pierwsza litera e-maila */
function initialOf(user: { firstName?: string | null; email?: string | null } | null): string {
  const source = user?.firstName?.trim() || user?.email?.trim() || "";
  return source ? source[0].toUpperCase() : "?";
}

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const { user, isAuthenticated, logout } = useAuth();
  const { toast } = useToast();

  const searchParams = new URLSearchParams(search);
  const canSeeAdmin = user?.role === "owner" || user?.role === "admin" || user?.role === "reviewer";

  // Linia pod belką pojawia się dopiero po przewinięciu (jak na helloekg.pl)
  useEffect(() => {
    const onScroll = () => setIsScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // Zmiana trasy zamyka menu mobilne
  useEffect(() => {
    setIsMobileMenuOpen(false);
  }, [location, search]);

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const handleDeleteAccount = async () => {
    setIsDeleting(true);
    try {
      await apiRequest("DELETE", "/api/auth/account");
      toast({ title: "Konto zostało usunięte." });
      setShowDeleteDialog(false);
      setLocation("/");
      window.location.reload();
    } catch (error) {
      toast({ title: "Nie udało się usunąć konta. Spróbuj ponownie za chwilę.", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const openAuth = (mode: "login" | "register") => setLocation(`/?auth=${mode}`);

  const linkClass = (active: boolean) =>
    `text-sm transition-colors duration-200 ${active ? "text-[var(--txt)]" : "text-[var(--txt2)] hover:text-[var(--txt)]"}`;

  return (
    <nav
      className={`material-bar sticky top-0 z-50 border-b transition-[border-color] duration-300 ${
        isScrolled || isMobileMenuOpen ? "border-[var(--line)]" : "border-transparent"
      }`}
      style={{ paddingTop: "env(safe-area-inset-top, 0px)" }}
      aria-label="Główna nawigacja"
    >
      <div className="wrap flex h-16 items-center justify-between gap-6">
        <Link
          href={isAuthenticated ? "/dashboard" : "/"}
          className="flex items-center rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          data-testid="logo-link"
          aria-label="helloEKG — strona główna"
        >
          <Logo />
        </Link>

        {isAuthenticated && (
          <div className="hidden md:flex items-center gap-7">
            {NAV_ITEMS.map((item) => {
              const active = item.isActive(location, searchParams);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={linkClass(active)}
                  aria-current={active ? "page" : undefined}
                  data-testid={`nav-${item.testId}`}
                  data-tour={`nav-${item.tour}`}
                >
                  {item.label}
                </Link>
              );
            })}
          </div>
        )}

        <div className="flex items-center gap-2 sm:gap-3">
          <ThemeToggle />

          {isAuthenticated ? (
            <>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="flex h-11 w-11 items-center justify-center rounded-full transition-transform duration-100 active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    aria-label="Menu konta"
                    data-testid="user-menu-trigger"
                  >
                    <span className="flex h-8 w-8 items-center justify-center rounded-full border border-[var(--line2)] font-heading text-sm font-medium text-[var(--txt)]">
                      {initialOf(user)}
                    </span>
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-60" align="end">
                  {user?.email && (
                    <>
                      <DropdownMenuLabel className="truncate text-xs font-normal text-[var(--txt2)]">
                        {user.email}
                      </DropdownMenuLabel>
                      <DropdownMenuSeparator />
                    </>
                  )}
                  {canSeeAdmin && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="flex items-center" data-testid="menu-admin">
                        <Settings className="mr-2 h-4 w-4" />
                        Panel admina
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleLogout} data-testid="menu-logout">
                    <LogOut className="mr-2 h-4 w-4" />
                    Wyloguj się
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem
                    onClick={() => setShowDeleteDialog(true)}
                    className="text-[var(--alarm)] focus:text-[var(--alarm)]"
                    data-testid="menu-delete-account"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Usuń konto
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>

              <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Na pewno chcesz usunąć konto?</AlertDialogTitle>
                    <AlertDialogDescription>
                      Tego nie da się cofnąć. Usuniemy twoje dane, postęp w nauce,
                      certyfikaty i aktywne subskrypcje.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel disabled={isDeleting}>Anuluj</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={handleDeleteAccount}
                      disabled={isDeleting}
                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                    >
                      {isDeleting ? "Usuwam…" : "Tak, usuń konto"}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                className="hidden sm:inline-flex"
                onClick={() => openAuth("login")}
                data-testid="login-button"
              >
                Zaloguj się
              </Button>
              <Button size="sm" onClick={() => openAuth("register")} data-testid="register-button">
                Załóż konto
              </Button>
            </>
          )}

          <Button
            variant="ghost"
            size="icon"
            className={isAuthenticated ? "md:hidden" : "sm:hidden"}
            onClick={() => setIsMobileMenuOpen((open) => !open)}
            aria-label={isMobileMenuOpen ? "Zamknij menu" : "Otwórz menu"}
            aria-expanded={isMobileMenuOpen}
            aria-controls="mobile-menu"
            data-testid="mobile-menu-toggle"
            data-tour="menu-button"
          >
            {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      <AnimatePresence initial={false}>
        {isMobileMenuOpen && (
          <motion.div
            key="mobile-menu"
            id="mobile-menu"
            className={`${isAuthenticated ? "md:hidden" : "sm:hidden"} overflow-hidden`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={spring}
            data-testid="mobile-menu"
          >
            <div className="wrap pb-3">
              <ul className="border-t border-[var(--line)]">
                {isAuthenticated ? (
                  NAV_ITEMS.map((item) => {
                    const active = item.isActive(location, searchParams);
                    return (
                      <li key={item.href} className="border-b border-[var(--line)]">
                        <Link
                          href={item.href}
                          className={`flex h-12 items-center text-[15px] transition-colors active:opacity-70 ${
                            active ? "text-[var(--txt)]" : "text-[var(--txt2)]"
                          }`}
                          aria-current={active ? "page" : undefined}
                          onClick={() => setIsMobileMenuOpen(false)}
                          data-testid={`mobile-nav-${item.testId}`}
                          data-tour={`mobile-nav-${item.tour}`}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })
                ) : (
                  <li className="border-b border-[var(--line)]">
                    <button
                      type="button"
                      className="flex h-12 w-full items-center text-left text-[15px] text-[var(--txt2)] active:opacity-70"
                      onClick={() => {
                        setIsMobileMenuOpen(false);
                        openAuth("login");
                      }}
                      data-testid="mobile-login-button"
                    >
                      Zaloguj się
                    </button>
                  </li>
                )}
              </ul>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}
