import { useEffect, useState, type ReactNode } from "react";
import { Link } from "wouter";
import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { authService, useAuth } from "@/lib/auth";
import { queryClient } from "@/lib/queryClient";
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

  // token z linku zapamiętany w stanie i usunięty z paska adresu (nie trafi do historii ani nagłówka Referer)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setToken(params.get('token'));
    if (params.has('token')) window.history.replaceState(null, '', window.location.pathname);
  }, []);

  const potwierdz = useMutation({
    mutationFn: async () => {
      if (!token) throw new Error('Brak tokenu');
      const response = await fetch('/api/auth/verify-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ token }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Błąd weryfikacji');
      }
      // zapamiętany użytkownik w sesji przeglądarki: od teraz z potwierdzonym adresem (otwiera treść kursu)
      authService.updateUser({ emailVerified: true });
      queryClient.invalidateQueries({ queryKey: ['/api/certificates/eligibility'] });
      queryClient.invalidateQueries({ queryKey: ['/api/auth/me'] });
      return data;
    },
  });
  const { error, isError } = potwierdz;

  const continueAction = isAuthenticated ? (
    <Button asChild>
      <Link href="/modules">Przejdź do kursu</Link>
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
          <Link href={isAuthenticated ? "/modules" : "/?auth=login"}>
            {isAuthenticated ? "Przejdź do kursu" : "Zaloguj się"}
          </Link>
        </Button>
      </Screen>
    );
  }

  if (potwierdz.isIdle || potwierdz.isPending) {
    return (
      <Screen
        stateKey="confirm"
        label="Ostatni krok"
        title="Potwierdź adres e-mail"
        lead="Kliknij przycisk, żeby potwierdzić, że ten adres należy do ciebie."
      >
        <Button onClick={() => potwierdz.mutate()} disabled={potwierdz.isPending} data-testid="verify-email-confirm">
          {potwierdz.isPending ? <><LoadingSpinner size="sm" className="mr-2" />Potwierdzam…</> : "Potwierdzam adres"}
        </Button>
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
        lead={`${(error as Error)?.message || "Link mógł wygasnąć."} Zaloguj się. Jeśli konto nadal wymaga potwierdzenia, poprosisz o nowy link.`}
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
