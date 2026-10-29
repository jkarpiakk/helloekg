import { useEffect, useState, type FormEvent } from "react";
import { Link, useLocation } from "wouter";
import { motion } from "framer-motion";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { rise } from "@/lib/motion";
import type { Certificate } from "@/types";

interface Eligibility {
  isEligible: boolean;
  masteredSections: number;
  requiredSections: number;
  firstName: string;
  lastName: string;
  emailVerified: boolean;
  email: string;
}

/** Komunikat z odpowiedzi serwera („400: {"error":"…"}”) albo ogólny */
function serverMessage(e: unknown): string {
  const raw = e instanceof Error ? e.message.replace(/^\d+:\s*/, "") : "";
  try {
    return (JSON.parse(raw) as { error?: string }).error || "Spróbuj jeszcze raz za chwilę.";
  } catch {
    return "Spróbuj jeszcze raz za chwilę.";
  }
}

/**
 * Certyfikat w Postępie: ile tematów do końca → po opanowaniu wszystkich pytanie
 * o imię i nazwisko (tak, jak mają stać na certyfikacie) → link do certyfikatu.
 */
export default function CertificateCard() {
  const [, setLocation] = useLocation();
  const { data: elig } = useQuery<Eligibility>({
    queryKey: ["/api/certificates/eligibility"],
    queryFn: async () => (await apiRequest("GET", "/api/certificates/eligibility")).json(),
    // potwierdzenie adresu zwykle w innej karcie (link z maila): po powrocie stan ma się odświeżyć
    staleTime: 30_000,
    refetchOnWindowFocus: true,
  });
  const { data: mine } = useQuery<Certificate[]>({
    queryKey: ["/api/certificates/my"],
    queryFn: async () => (await apiRequest("GET", "/api/certificates/my")).json(),
  });

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (!elig) return;
    setFirstName((v) => v || elig.firstName);
    setLastName((v) => v || elig.lastName);
  }, [elig]);

  const claim = useMutation({
    mutationFn: async () => {
      const r = await apiRequest("POST", "/api/certificates/generate", { firstName, lastName });
      return r.json() as Promise<{ certificateId: string }>;
    },
    onSuccess: async ({ certificateId }) => {
      // arkusz bierze imię i nazwisko z tych zapytań: najpierw świeże dane, potem przejście
      await Promise.all([
        queryClient.refetchQueries({ queryKey: ["/api/certificates/my"] }),
        queryClient.refetchQueries({ queryKey: ["/api/certificates/eligibility"] }),
      ]);
      setLocation(`/certificate/${certificateId}`);
    },
    onError: (e: unknown) => setError(serverMessage(e)),
  });

  const [linkSent, setLinkSent] = useState(false);
  const resend = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/auth/resend-verification", { email: elig?.email })).json(),
    onSuccess: () => setLinkSent(true),
    onError: (e: unknown) => setError(serverMessage(e)),
  });

  const certificate = mine?.[0];
  if (!elig || (!certificate && elig.requiredSections === 0)) return null;

  if (certificate) {
    return (
      <motion.section variants={rise} className="surface p-6 grid gap-3" aria-labelledby="cert-title">
        <p className="label label--g">Certyfikat</p>
        <h2 id="cert-title" className="h3">Twój certyfikat jest gotowy</h2>
        <p className="muted text-[15px]">Wydany {new Date(certificate.issuedAt).toLocaleDateString("pl-PL")}</p>
        <div>
          <Button asChild variant="outline" size="sm" data-testid="button-view-certificate">
            <Link href={`/certificate/${certificate.certificateId}`}>Zobacz certyfikat</Link>
          </Button>
        </div>
      </motion.section>
    );
  }

  if (!elig.isEligible) {
    const left = elig.requiredSections - elig.masteredSections;
    return (
      <motion.section variants={rise} className="surface p-6 grid gap-3" aria-labelledby="cert-title" data-testid="certificate-progress">
        <p className="label">Certyfikat</p>
        <h2 id="cert-title" className="h3">
          <span className="num">{elig.masteredSections}</span> z <span className="num">{elig.requiredSections}</span> tematów opanowanych
        </h2>
        <div className="progress" aria-hidden>
          <span style={{ width: `${(elig.masteredSections / elig.requiredSections) * 100}%` }} />
        </div>
        <p className="muted text-[15px]">
          Certyfikat odbierzesz, gdy opanujesz {left === 1 ? "ostatni temat" : "wszystkie tematy"}: ostatnia odpowiedź na
          każde pytanie musi być poprawna. Dawne pomyłki się nie liczą.
        </p>
      </motion.section>
    );
  }

  if (!elig.emailVerified) {
    return (
      <motion.section variants={rise} className="surface p-6 grid gap-3" aria-labelledby="cert-title" data-testid="certificate-verify-email">
        <p className="label label--g">Certyfikat</p>
        <h2 id="cert-title" className="h3">Kurs ukończony. Potwierdź adres e-mail</h2>
        <p className="muted text-[15px]">
          Certyfikat wydajemy na potwierdzony adres. Kliknij link w mailu od helloEKG wysłanym na{" "}
          <span className="text-[var(--txt)]">{elig.email}</span>, a potem wróć tutaj.
        </p>
        {error && (
          <p className="text-[14px] text-[var(--alarm)]" role="alert">
            {error}
          </p>
        )}
        <div role="status">
          {linkSent ? (
            <p className="text-[15px] text-[var(--txt)]">Wysłaliśmy nowy link. Zajrzyj też do spamu.</p>
          ) : (
            <Button variant="outline" size="sm" onClick={() => { setError(null); resend.mutate(); }} disabled={resend.isPending} data-testid="button-resend-verification">
              {resend.isPending ? "Wysyłam…" : "Wyślij link jeszcze raz"}
            </Button>
          )}
        </div>
      </motion.section>
    );
  }

  const submit = (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!firstName.trim() || !lastName.trim()) {
      setError("Wpisz imię i nazwisko.");
      return;
    }
    claim.mutate();
  };

  return (
    <motion.section variants={rise} className="surface p-6 grid gap-4" aria-labelledby="cert-title" data-testid="certificate-claim">
      <div className="grid gap-2">
        <p className="label label--g">Certyfikat</p>
        <h2 id="cert-title" className="h3">Kurs ukończony</h2>
        <p className="muted text-[15px]">Wpisz imię i nazwisko tak, jak mają stać na certyfikacie. Po wydaniu nie da się ich zmienić.</p>
      </div>
      <form className="grid gap-3" onSubmit={submit} noValidate>
        <div className="grid gap-1.5">
          <Label htmlFor="cert-first">Imię</Label>
          <Input id="cert-first" value={firstName} onChange={(e) => setFirstName(e.target.value)} autoComplete="given-name" maxLength={60} data-testid="cert-first-name" />
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="cert-last">Nazwisko</Label>
          <Input id="cert-last" value={lastName} onChange={(e) => setLastName(e.target.value)} autoComplete="family-name" maxLength={60} data-testid="cert-last-name" />
        </div>
        {error && (
          <p className="text-[14px] text-[var(--alarm)]" role="alert">
            {error}
          </p>
        )}
        <div>
          <Button type="submit" disabled={claim.isPending} data-testid="button-generate-certificate">
            {claim.isPending ? "Wydaję certyfikat…" : "Odbierz certyfikat"}
          </Button>
        </div>
      </form>
    </motion.section>
  );
}
