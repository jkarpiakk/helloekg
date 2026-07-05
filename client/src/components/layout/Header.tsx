import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Menu, X, User, LogOut, Settings, BookOpen } from "lucide-react";
import { Logo } from "@/components/brand/Logo";
import { ThemeToggle } from "@/components/brand/ThemeToggle";

export default function Header() {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [location] = useLocation();
  const { t } = useTranslation();
  const { user, isAuthenticated, logout } = useAuth();

  const handleLogout = async () => {
    try {
      await logout();
    } catch (error) {
      console.error("Logout failed:", error);
    }
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  return (
    <nav className="sticky top-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b border-border">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo — helloEKG "żywy znak" */}
          <Link href="/" className="flex items-center" data-testid="logo-link" aria-label="helloEKG — strona główna">
            <Logo variant="A" animated size={30} bpm={72} />
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center space-x-8">
            <Link href="/" className={`transition-colors ${location === '/' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`} data-testid="nav-home">
              {t("nav.home")}
            </Link>
            <Link href="/blog" className={`transition-colors ${location.startsWith('/blog') ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`} data-testid="nav-blog">
              {t("nav.blog")}
            </Link>
            {isAuthenticated && (
              <>
                <Link href="/dashboard" className={`transition-colors ${location === '/dashboard' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`} data-testid="nav-dashboard">
                  {t("nav.dashboard")}
                </Link>
                <Link href="/modules" className={`transition-colors ${location === '/modules' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`} data-testid="nav-modules">
                  Moduły
                </Link>
                <Link href="/quiz" className={`transition-colors ${location === '/quiz' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`} data-testid="nav-quiz">
                  {t("nav.quiz")}
                </Link>
                <Link href="/lecture" className={`transition-colors ${location === '/lecture' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`} data-testid="nav-lecture">
                  Wykłady
                </Link>
              </>
            )}
            <Link href="/pricing" className={`transition-colors ${location === '/pricing' ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`} data-testid="nav-pricing">
              {t("nav.pricing")}
            </Link>
          </div>

          {/* User Actions */}
          <div className="flex items-center space-x-2 sm:space-x-4">
            {/* Language Selector - hidden on mobile */}
            <select 
              className="hidden sm:block bg-background border border-border rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
              defaultValue="pl"
              data-testid="language-selector"
            >
              <option value="pl">🇵🇱 PL</option>
              <option value="en" disabled>🇬🇧 EN (wkrótce)</option>
              <option value="es" disabled>🇪🇸 ES (wkrótce)</option>
            </select>

            <ThemeToggle />

            {isAuthenticated ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" className="relative h-8 w-8 rounded-full" data-testid="user-menu-trigger">
                    <Avatar className="h-8 w-8">
                      <AvatarFallback>
                        {user?.firstName[0]}{user?.lastName[0]}
                      </AvatarFallback>
                    </Avatar>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent className="w-56" align="end">
                  <DropdownMenuItem asChild>
                    <Link href="/dashboard" className="flex items-center" data-testid="menu-dashboard">
                      <User className="mr-2 h-4 w-4" />
                      {t("nav.dashboard")}
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild>
                    <Link href="/quiz" className="flex items-center" data-testid="menu-quiz">
                      <BookOpen className="mr-2 h-4 w-4" />
                      {t("nav.quiz")}
                    </Link>
                  </DropdownMenuItem>
                  {(user?.role === 'owner' || user?.role === 'admin' || user?.role === 'reviewer') && (
                    <DropdownMenuItem asChild>
                      <Link href="/admin" className="flex items-center" data-testid="menu-admin">
                        <Settings className="mr-2 h-4 w-4" />
                        {t("nav.admin")}
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem onClick={handleLogout} data-testid="menu-logout">
                    <LogOut className="mr-2 h-4 w-4" />
                    {t("auth.logout")}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <>
                <Button 
                  variant="ghost"
                  size="sm"
                  className="hidden sm:inline-flex"
                  onClick={() => window.location.href = "/?auth=login"}
                  data-testid="login-button"
                >
                  {t("auth.login")}
                </Button>
                <Button 
                  size="sm"
                  className="hidden sm:inline-flex"
                  onClick={() => window.location.href = "/?auth=register"}
                  data-testid="register-button"
                >
                  {t("auth.register")}
                </Button>
              </>
            )}

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="sm"
              className="md:hidden"
              onClick={toggleMobileMenu}
              data-testid="mobile-menu-toggle"
            >
              {isMobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <div className="md:hidden border-t border-border" data-testid="mobile-menu">
          <div className="px-4 py-3 space-y-3">
            <Link
              href="/"
              className="block text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
              data-testid="mobile-nav-home"
            >
              {t("nav.home")}
            </Link>
            <Link
              href="/blog"
              className="block text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
              data-testid="mobile-nav-blog"
            >
              {t("nav.blog")}
            </Link>
            {isAuthenticated && (
              <>
                <Link
                  href="/dashboard"
                  className="block text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                  data-testid="mobile-nav-dashboard"
                >
                  {t("nav.dashboard")}
                </Link>
                <Link
                  href="/modules"
                  className="block text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                  data-testid="mobile-nav-modules"
                >
                  Moduły
                </Link>
                <Link
                  href="/quiz"
                  className="block text-muted-foreground hover:text-foreground transition-colors"
                  onClick={() => setIsMobileMenuOpen(false)}
                  data-testid="mobile-nav-quiz"
                >
                  {t("nav.quiz")}
                </Link>
              </>
            )}
            <Link
              href="/pricing"
              className="block text-muted-foreground hover:text-foreground transition-colors"
              onClick={() => setIsMobileMenuOpen(false)}
              data-testid="mobile-nav-pricing"
            >
              {t("nav.pricing")}
            </Link>
            
            {/* Mobile Auth Buttons */}
            {!isAuthenticated && (
              <div className="pt-3 space-y-2 border-t border-border">
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    window.location.href = "/?auth=login";
                  }}
                  data-testid="mobile-login-button"
                >
                  {t("auth.login")}
                </Button>
                <Button
                  className="w-full"
                  onClick={() => {
                    setIsMobileMenuOpen(false);
                    window.location.href = "/?auth=register";
                  }}
                  data-testid="mobile-register-button"
                >
                  {t("auth.register")}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
