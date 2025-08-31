import { Link } from "wouter";
import { Heart, Facebook, Twitter, Linkedin, Instagram } from "lucide-react";

export default function Footer() {
  return (
    <footer className="bg-card border-t border-border mt-20">
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="grid md:grid-cols-4 gap-8">
          {/* Company info */}
          <div className="space-y-4">
            <div className="flex items-center space-x-3">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center">
                <Heart className="h-5 w-5 text-primary-foreground" />
              </div>
              <span className="text-lg font-bold text-foreground">EKG Academy</span>
            </div>
            <p className="text-muted-foreground text-sm">
              Profesjonalna platforma do nauki interpretacji EKG dla studentów medycyny i profesjonalistów.
            </p>
          </div>

          {/* Courses Links */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Kursy</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
                  Podstawy EKG
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
                  Rytmy serca
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
                  Zawał serca
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-muted-foreground hover:text-foreground transition-colors">
                  Arytmie
                </Link>
              </li>
            </ul>
          </div>

          {/* Support Links */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Wsparcie</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/faq" className="text-muted-foreground hover:text-foreground transition-colors">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-muted-foreground hover:text-foreground transition-colors">
                  Kontakt
                </Link>
              </li>
              <li>
                <Link href="/verify" className="text-muted-foreground hover:text-foreground transition-colors">
                  Weryfikacja certyfikatu
                </Link>
              </li>
              <li>
                <Link href="/support" className="text-muted-foreground hover:text-foreground transition-colors">
                  Pomoc techniczna
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal Links */}
          <div>
            <h3 className="font-semibold text-foreground mb-4">Prawne</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/terms" className="text-muted-foreground hover:text-foreground transition-colors">
                  Regulamin
                </Link>
              </li>
              <li>
                <Link href="/privacy" className="text-muted-foreground hover:text-foreground transition-colors">
                  Polityka prywatności
                </Link>
              </li>
              <li>
                <Link href="/cookies" className="text-muted-foreground hover:text-foreground transition-colors">
                  Cookies
                </Link>
              </li>
              <li>
                <Link href="/gdpr" className="text-muted-foreground hover:text-foreground transition-colors">
                  RODO
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-border mt-8 pt-8 flex flex-col md:flex-row justify-between items-center">
          <p className="text-sm text-muted-foreground">
            © 2024 EKG Academy. Wszystkie prawa zastrzeżone.
          </p>
          <div className="flex items-center space-x-4 mt-4 md:mt-0">
            <a
              href="#"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Facebook"
            >
              <Facebook className="h-5 w-5" />
            </a>
            <a
              href="#"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Twitter"
            >
              <Twitter className="h-5 w-5" />
            </a>
            <a
              href="#"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="LinkedIn"
            >
              <Linkedin className="h-5 w-5" />
            </a>
            <a
              href="#"
              className="text-muted-foreground hover:text-foreground transition-colors"
              aria-label="Instagram"
            >
              <Instagram className="h-5 w-5" />
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
