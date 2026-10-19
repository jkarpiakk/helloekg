import { useEffect, useState } from "react";
import { useLocation, useSearch } from "wouter";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/lib/auth";
import AuthForms from "@/components/auth/AuthForms";
import { rise, stagger } from "@/lib/motion";

type AuthMode = "login" | "register";

/** Co jest w kursie — tylko prawdziwe liczby (stan bety: 7 modułów, 28 wykładów, ~800 pytań) */
const INSIDE = [
  { n: "01", title: "7 modułów", text: "Ułożonych od podstaw, krok po kroku — każdy buduje na poprzednim." },
  { n: "02", title: "28 wykładów", text: "Krótkie rozdziały do czytania we własnym tempie." },
  { n: "03", title: "Około 800 pytań", text: "Każde z wyjaśnieniem, dlaczego ta odpowiedź jest poprawna." },
  { n: "04", title: "Powtórki", text: "Wracają pytania, które sprawiły ci trudność — aż wiedza się utrwali." },
];

export default function Home() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const [authMode, setAuthMode] = useState<AuthMode | null>(null);
  const { isAuthenticated } = useAuth();

  // Zalogowany nie ma tu czego szukać — od razu do postępu
  useEffect(() => {
    if (isAuthenticated) setLocation("/dashboard", { replace: true });
  }, [isAuthenticated, setLocation]);

  // ?auth=login|register otwiera okno logowania/rejestracji (linki z belki, stopki, e-maili)
  useEffect(() => {
    const authParam = new URLSearchParams(search).get("auth");
    if (authParam === "login" || authParam === "register") {
      setAuthMode(authParam);
    }
  }, [search]);

  const openAuth = (mode: AuthMode) => setAuthMode(mode);

  const closeAuth = () => {
    setAuthMode(null);
    // Czyścimy ?auth=…, żeby ten sam link z belki znów otwierał okno
    if (new URLSearchParams(search).has("auth")) setLocation("/", { replace: true });
  };

  const handleAuthSuccess = () => {
    setAuthMode(null);
    setLocation("/dashboard");
  };

  if (isAuthenticated) return null;

  return (
    <div className="overflow-x-hidden">
      <motion.section
        className="wrap pb-16 pt-16 sm:pb-24 sm:pt-24"
        variants={stagger(0.06)}
        initial="hidden"
        animate="show"
      >
        <div className="max-w-[46rem]">
          <motion.p variants={rise} className="label label--g" data-testid="hero-badge">
            Wersja beta
          </motion.p>
          <motion.h1 variants={rise} className="h1 mt-5 text-[var(--txt)]">
            Kurs EKG, który uczy rozumieć zapis.
          </motion.h1>
          <motion.p variants={rise} className="lead mt-6">
            Zamiast wkuwać schematy, poznajesz mechanizm: skąd bierze się każdy załamek i co znaczy jego zmiana.
            Po każdym wykładzie sprawdzasz się pytaniami z wyjaśnieniami.
          </motion.p>
          <motion.div variants={rise} className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Button onClick={() => openAuth("register")} data-testid="start-learning-button">
              Załóż konto
            </Button>
            <Button variant="outline" onClick={() => openAuth("login")} data-testid="have-account-button">
              Mam już konto
            </Button>
          </motion.div>
        </div>
      </motion.section>

      <section className="wrap pb-8" aria-labelledby="inside-title">
        <motion.div
          variants={stagger(0.04)}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-40px" }}
        >
          <motion.p variants={rise} id="inside-title" className="label mb-5">
            Co jest w środku
          </motion.p>
          <ul className="rows">
            {INSIDE.map((item) => (
              <motion.li
                key={item.n}
                variants={rise}
                className="row [grid-template-columns:48px_minmax(0,1fr)] active:transform-none"
              >
                <span className="row__n">{item.n}</span>
                <span className="row__t">
                  <b>{item.title}</b>
                  <span>{item.text}</span>
                </span>
              </motion.li>
            ))}
          </ul>
        </motion.div>
      </section>

      <section className="wrap py-12 sm:py-16">
        <motion.div
          variants={rise}
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: "-40px" }}
          className="max-w-[42em] border-l-2 border-[var(--puls-deep)] pl-5"
        >
          <p className="label mb-3">Dla testerów</p>
          <p className="text-[1.0625rem] leading-relaxed text-[var(--txt2)]">
            To wersja beta — kurs działa, ale wciąż go dopracowujemy. Jeśli coś jest niejasne albo nie działa,
            daj znać przyciskiem „Zgłoś błąd” przy pytaniu lub napisz na{" "}
            <a
              href="mailto:kontakt@helloekg.pl"
              className="text-[var(--txt)] underline underline-offset-2 hover:text-[var(--puls)]"
            >
              kontakt@helloekg.pl
            </a>
            . Każda uwaga pomaga.
          </p>
        </motion.div>
      </section>

      <Dialog open={authMode !== null} onOpenChange={(open) => { if (!open) closeAuth(); }}>
        <DialogContent className="sm:max-w-md">
          <DialogTitle className="sr-only">
            {authMode === "login" ? "Zaloguj się" : "Załóż konto"}
          </DialogTitle>
          {authMode && (
            <AuthForms
              mode={authMode}
              onSuccess={handleAuthSuccess}
              onSwitchMode={setAuthMode}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
