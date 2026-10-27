import { useQuery } from "@tanstack/react-query";
import { Link, useParams } from "wouter";
import { ArrowLeft, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { apiRequest } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import type { Certificate } from "@/types";
import CertificateSheet, { CertificatePrintCopy, type CertificateSheetProps } from "@/components/certificate/CertificateSheet";

/** Certyfikat kursanta (tylko własny, po zalogowaniu): arkusz A4 i druk do PDF. */
export default function CertificatePage() {
  const { certificateId } = useParams<{ certificateId: string }>();
  const { user } = useAuth();

  const { data: myCertificates, isLoading } = useQuery<Certificate[]>({
    queryKey: ["/api/certificates/my"],
    queryFn: async () => (await apiRequest("GET", "/api/certificates/my")).json(),
  });
  const { data: modules } = useQuery({
    queryKey: ["/api/modules"],
    queryFn: async () => (await apiRequest("GET", "/api/modules")).json() as Promise<Array<{ title: string }>>,
  });

  if (isLoading) {
    return (
      <div className="wrap grid min-h-[60vh] place-items-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const certificate = myCertificates?.find((c) => c.certificateId === certificateId);
  if (!certificate) {
    return (
      <div className="wrap wrap--narrow grid gap-4 py-16">
        <p className="label">Certyfikat</p>
        <h1 className="h2">Nie ma takiego certyfikatu</h1>
        <p className="muted">Na tym koncie nie ma certyfikatu o tym numerze. Twoje certyfikaty znajdziesz w panelu postępu.</p>
        <div>
          <Button asChild variant="outline">
            <Link href="/dashboard">Twój postęp</Link>
          </Button>
        </div>
      </div>
    );
  }

  const name = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || user?.email || "";
  const sheet: CertificateSheetProps = {
    name,
    certificateId: certificate.certificateId,
    issuedAt: certificate.issuedAt,
    modules: (modules ?? []).map((m) => m.title),
  };

  return (
    <div className="wrap py-10 grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="grid gap-2">
          <Link
            href="/dashboard"
            className="inline-flex min-h-11 w-fit items-center gap-2 text-[14px] text-[var(--txt2)] hover:text-[var(--txt)]"
            data-testid="back-to-dashboard"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden /> Twój postęp
          </Link>
          <p className="label label--g">Certyfikat</p>
          <h1 className="h2">Kurs ukończony</h1>
        </div>
        <Button onClick={() => window.print()} data-testid="button-print-certificate">
          <Printer className="h-4 w-4" aria-hidden /> Drukuj albo zapisz PDF
        </Button>
      </div>
      <div className="overflow-hidden rounded-[6px] border border-[var(--line)]">
        <CertificateSheet {...sheet} />
      </div>
      <p className="muted text-[14px]">W oknie drukowania wybierz „Zapisz jako PDF”, żeby mieć certyfikat w pliku. Arkusz ma format A4 poziomo.</p>
      <CertificatePrintCopy {...sheet} />
    </div>
  );
}
