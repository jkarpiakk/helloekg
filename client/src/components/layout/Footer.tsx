import { Link } from "wouter";
import { Facebook, Twitter, Linkedin, Instagram } from "lucide-react";
import Logo from "@/components/layout/Logo";

export default function Footer() {
  return (
    <footer className="bg-card border-t border-border mt-12 sm:mt-20">
      <div className="max-w-[1800px] mx-auto px-4 sm:px-6 lg:px-8 py-8 sm:py-12">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 sm:gap-8">
          {/* Company info */}
          <div className="space-y-4 col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center">
              <Logo markSize={32} />
            </Link>
            <p className="text-muted-foreground text-xs sm:text-sm leading-relaxed">
              Profesjonalna platforma do nauki interpretacji EKG dla studentów medycyny i profesjonalistów.
            </p>
          </div>

          {/* Courses Links */}
          <div>
            <h3 className="font-semibold text-foreground mb-3 sm:mb-4 text-sm sm:text-base">Kursy</h3>
            <ul className="space-y-2 text-xs sm:text-sm">
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
            <h3 className="font-semibold text-foreground mb-3 sm:mb-4 text-sm sm:text-base">Wsparcie</h3>
            <ul className="space-y-2 text-xs sm:text-sm">
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
            <h3 className="font-semibold text-foreground mb-3 sm:mb-4 text-sm sm:text-base">Prawne</h3>
            <ul className="space-y-2 text-xs sm:text-sm">
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

        <div className="border-t border-border mt-6 sm:mt-8 pt-6 sm:pt-8 flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="text-center md:text-left space-y-1">
            <p className="text-xs sm:text-sm text-muted-foreground">
              © 2026 helloEKG. Wszystkie prawa zastrzeżone.
            </p>
            {/* Atrybucja wymagana licencją CC BY 4.0 modelu serca 3D */}
            <p className="text-xs text-muted-foreground" data-testid="heart-model-attribution">
              Model serca 3D:{" "}
              <a
                href="https://sketchfab.com/3d-models/anatomically-correct-human-heart-54fa880728d14c11afff78be8721620a"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors underline underline-offset-2"
              >
                Pigcraft
              </a>
              ,{" "}
              <a
                href="https://creativecommons.org/licenses/by/4.0/"
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-foreground transition-colors underline underline-offset-2"
              >
                CC BY 4.0
              </a>
            </p>
          </div>
          <div className="flex items-center space-x-4">
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
