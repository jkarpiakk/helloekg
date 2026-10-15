import { useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useAuth } from "@/lib/auth";
import { rise, stagger } from "@/lib/motion";

/** Wąska kolumna wyśrodkowana: etykieta, tytuł, opis, jedno działanie */
function Screen({
  stateKey,
  label,
  labelClass = "",
  title,
  lead,
  children,
  role,
}: {
  stateKey: string;
  label: string;
  labelClass?: string;
  title: string;
  lead: string;
  children?: ReactNode;
  role?: string;
}) {
  return (
    <div className="wrap">
      <motion.div
        key={stateKey}
        role={role}
        className="mx-auto max-w-[30rem] py-20 sm:py-28"
        variants={stagger(0.05)}
        initial="hidden"
        animate="show"
      >
        <motion.p variants={rise} className={`label ${labelClass}`}>{label}</motion.p>
        <motion.h1 variants={rise} className="h2 mt-4 text-[var(--txt)]">{title}</motion.h1>
        <motion.p variants={rise} className="lead mt-4">{lead}</motion.p>
        {children && <motion.div variants={rise} className="mt-8">{children}</motion.div>}
      </motion.div>
    </div>
  );
}

export default function VerifyEmail() {
  const [token, setToken] = useState<string | null>(null);
  const { isAuthenticated } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('token'));
  }, []);

  const { isLoading, error, isError } = useQuery({
    queryKey: ['/api/auth/verify-email', token],
    queryFn: async () => {
      if (!token) throw new Error('Brak tokenu');
      const response = await fetch(`/api/auth/verify-email?token=${token}`);
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Błąd weryfikacji');
      }
      return data;
    },
    enabled: !!token,
    retry: false,
  });

  const continueAction = isAuthenticated ? (
    <Button asChild>
      <Link href="/dashboard">Przejdź do kursu</Link>
    </Button>
  ) : (
    <Button asChild>
      <Link href="/?auth=login">Zaloguj się</Link>
    </Button>
  );

  if (!token) {
    return (
      <Screen
        stateKey="no-token"
        role="alert"
        label="Nieprawidłowy link"
        labelClass="text-[var(--alarm)]"
        title="Brakuje kodu weryfikacyjnego"
        lead="Link z e-maila jest niepełny. Otwórz go jeszcze raz albo skopiuj w całości do paska adresu."
      >
        <Button asChild>
          <Link href="/">Wróć na stronę główną</Link>
        </Button>
      </Screen>
    );
  }

  if (isLoading) {
    return (
      <Screen
        stateKey="loading"
        role="status"
        label="Weryfikacja"
        title="Sprawdzam adres e-mail…"
        lead="To potrwa tylko chwilę."
      >
        <LoadingSpinner size="lg" />
      </Screen>
    );
  }

  if (isError) {
    return (
      <Screen
        stateKey="error"
        role="alert"
        label="Weryfikacja nieudana"
        labelClass="text-[var(--alarm)]"
        title="Nie udało się potwierdzić adresu"
        lead={`${(error as Error)?.message || "Link mógł wygasnąć."} Zaloguj się — jeśli konto nadal wymaga potwierdzenia, poprosisz o nowy link.`}
      >
        {continueAction}
      </Screen>
    );
  }

  return (
    <Screen
      stateKey="success"
      role="status"
      label="Adres potwierdzony"
      labelClass="label--g"
      title="Gotowe, możesz zaczynać"
      lead={isAuthenticated
        ? "Twój adres e-mail jest potwierdzony. Zacznij od pierwszego modułu."
        : "Twój adres e-mail jest potwierdzony. Zaloguj się i zacznij od pierwszego modułu."}
    >
      {continueAction}
    </Screen>
  );
}
