import { Link } from "wouter";
import { ArrowUpRight } from "lucide-react";
import Logo from "@/components/layout/Logo";
import { useAuth } from "@/lib/auth";

const linkClass =
  "inline-flex min-h-11 w-fit items-center gap-2 text-[var(--txt2)] transition-colors duration-200 hover:text-[var(--txt)]";

export default function Footer() {
  const { isAuthenticated } = useAuth();

  return (
    <footer className="mt-16 border-t border-[var(--line)] pb-8 pt-14 text-sm sm:mt-24" data-testid="footer">
      <div className="wrap">
        <div className="grid gap-12 md:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
          <div className="grid content-start gap-4">
            <Link
              href={isAuthenticated ? "/dashboard" : "/"}
              className="inline-flex w-fit rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              aria-label="helloEKG — strona główna"
            >
              <Logo animated={false} />
            </Link>
            <p className="max-w-[26em] text-[var(--txt2)]">
              Kurs EKG od podstaw: wykłady, pytania z wyjaśnieniami i powtórki, które utrwalają wiedzę.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
            <div className="grid content-start">
              <p className="label mb-1">Kurs</p>
              {isAuthenticated ? (
                <>
                  <Link href="/modules" className={linkClass}>Moduły</Link>
                  <Link href="/dashboard" className={linkClass}>Postęp</Link>
                  <Link href="/quiz?mode=review" className={linkClass}>Powtórka</Link>
                </>
              ) : (
                <Link href="/" className={linkClass}>O becie</Link>
              )}
            </div>

            <div className="grid content-start">
              <p className="label mb-1">Konto</p>
              {isAuthenticated ? (
                <Link href="/dashboard" className={linkClass}>Twój postęp</Link>
              ) : (
                <>
                  <Link href="/?auth=login" className={linkClass}>Zaloguj się</Link>
                  <Link href="/?auth=register" className={linkClass}>Załóż konto</Link>
                </>
              )}
              <Link href="/forgot-password" className={linkClass}>Nie pamiętasz hasła?</Link>
            </div>

            <div className="grid content-start">
              <p className="label mb-1">helloEKG</p>
              <a href="https://helloekg.pl" target="_blank" rel="noopener noreferrer" className={linkClass}>
                helloekg.pl
                <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
              </a>
              <a
                href="https://helloekg.pl/polityka-prywatnosci.html"
                target="_blank"
                rel="noopener noreferrer"
                className={linkClass}
              >
                Polityka prywatności
              </a>
            </div>
          </div>
        </div>

        <div className="mt-12 flex flex-col gap-2 border-t border-[var(--line)] pt-6 text-[.8125rem] text-[var(--label)] md:flex-row md:justify-between md:gap-6">
          <p>© 2026 helloEKG · Wersja beta</p>
          {/* Atrybucja wymagana licencją CC BY 4.0 modelu serca 3D (symulator) */}
          <p data-testid="heart-model-attribution">
            Model serca 3D:{" "}
            <a
              href="https://sketchfab.com/3d-models/anatomically-correct-human-heart-54fa880728d14c11afff78be8721620a"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 transition-colors hover:text-[var(--txt)]"
            >
              Pigcraft
            </a>
            ,{" "}
            <a
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noopener noreferrer"
              className="underline underline-offset-2 transition-colors hover:text-[var(--txt)]"
            >
              CC BY 4.0
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
