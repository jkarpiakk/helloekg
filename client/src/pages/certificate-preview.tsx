import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { ArrowLeft } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import CertificateSheet, { CertificatePrintCopy, type CertificateSheetProps } from "@/components/certificate/CertificateSheet";

/** Podgląd certyfikatu na przykładowych danych (dla autora i testerów bety). */
export default function CertificatePreviewPage() {
  const { data: modules } = useQuery({
    queryKey: ["/api/modules"],
    queryFn: async () => (await apiRequest("GET", "/api/modules")).json() as Promise<Array<{ title: string }>>,
  });

  const sheet: CertificateSheetProps = {
    name: "Jan Kowalski",
    certificateId: "EKG-3F9A21C7-8B04D6E1",
    issuedAt: new Date(),
    modules: (modules ?? []).map((m) => m.title),
  };

  return (
    <div className="wrap py-10 grid gap-6">
      <div className="grid gap-2">
        <Link href="/dashboard" className="inline-flex min-h-11 items-center gap-2 text-[14px] text-[var(--txt2)] hover:text-[var(--txt)] w-fit">
          <ArrowLeft className="h-4 w-4" aria-hidden /> Twój postęp
        </Link>
        <p className="label">Podgląd · dane przykładowe</p>
        <h1 className="h2">Tak wygląda certyfikat ukończenia</h1>
      </div>
      <div className="overflow-hidden rounded-[6px] border border-[var(--line)]">
        <CertificateSheet {...sheet} />
      </div>
      <CertificatePrintCopy {...sheet} />
    </div>
  );
}
