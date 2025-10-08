import { useQuery } from "@tanstack/react-query";
import { useParams } from "wouter";
import { Button } from "@/components/ui/button";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { apiRequest } from "@/lib/queryClient";
import { Award, Printer, Download, ArrowLeft, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import type { Certificate } from "@/types";
import { useAuth } from "@/lib/auth";

export default function CertificatePage() {
  const params = useParams();
  const certificateId = params.certificateId as string;
  const { user } = useAuth();

  const { data: myCertificates, isLoading } = useQuery<Certificate[]>({
    queryKey: ["/api/certificates/my"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api/certificates/my");
      return response.json();
    },
  });

  const certificate = myCertificates?.find(c => c.certificateId === certificateId);

  const handlePrint = () => {
    window.print();
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!certificate) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Award className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-foreground mb-2">Certyfikat nie znaleziony</h2>
          <p className="text-muted-foreground mb-6">Nie znaleziono certyfikatu o podanym ID</p>
          <Link href="/dashboard">
            <Button>
              <ArrowLeft className="h-4 w-4 mr-2" />
              Wróć do panelu
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  const issueDate = new Date(certificate.issuedAt);
  const score = Math.round(parseFloat(certificate.score) * 100);

  return (
    <div className="min-h-screen bg-background">
      {/* Print Controls - Hidden when printing */}
      <div className="print:hidden bg-card border-b border-border">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link href="/dashboard">
              <Button variant="ghost" size="sm" data-testid="back-to-dashboard">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Wróć do panelu
              </Button>
            </Link>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handlePrint} data-testid="button-print-certificate">
                <Printer className="h-4 w-4 mr-2" />
                Drukuj / Zapisz PDF
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Certificate - Printable */}
      <div className="max-w-5xl mx-auto px-4 py-12 print:py-0">
        <div className="bg-white text-black p-12 rounded-lg shadow-2xl print:shadow-none border-8 border-double border-gray-800 print:border-black">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 bg-blue-600 rounded-full flex items-center justify-center">
                <Award className="h-12 w-12 text-white" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Certyfikat Ukończenia</h1>
            <div className="w-32 h-1 bg-blue-600 mx-auto mb-4"></div>
            <p className="text-xl text-gray-700">EKG Academy</p>
          </div>

          {/* Main Content */}
          <div className="text-center mb-8">
            <p className="text-lg text-gray-600 mb-6">Niniejszym poświadcza się, że</p>
            <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-gray-300 pb-2 inline-block px-8">
              {user?.firstName} {user?.lastName}
            </h2>
            <p className="text-lg text-gray-600 mb-4">ukończył z wynikiem</p>
            <div className="inline-block bg-blue-50 border-2 border-blue-600 rounded-lg px-8 py-3 mb-6">
              <p className="text-4xl font-bold text-blue-600">{score}%</p>
            </div>
            <p className="text-lg text-gray-600 mb-2">kurs</p>
            <h3 className="text-2xl font-semibold text-gray-900 mb-8">
              Profesjonalna Interpretacja EKG
            </h3>
          </div>

          {/* Details Grid */}
          <div className="grid md:grid-cols-2 gap-6 mb-8">
            <div className="border border-gray-300 rounded-lg p-4">
              <p className="text-sm text-gray-500 mb-1">ID Certyfikatu</p>
              <p className="font-mono text-lg font-semibold text-gray-900">{certificate.certificateId}</p>
            </div>
            <div className="border border-gray-300 rounded-lg p-4">
              <p className="text-sm text-gray-500 mb-1">Data wydania</p>
              <p className="text-lg font-semibold text-gray-900">{issueDate.toLocaleDateString('pl-PL', { 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}</p>
            </div>
          </div>

          {/* Verification */}
          <div className="border-t-2 border-gray-300 pt-6">
            <div className="flex items-center justify-center gap-3 text-green-700">
              <CheckCircle className="h-6 w-6" />
              <p className="text-sm">
                Certyfikat można zweryfikować pod adresem:{" "}
                <span className="font-mono">{window.location.origin}/verify/{certificate.certificateId}</span>
              </p>
            </div>
          </div>

          {/* Footer */}
          <div className="mt-8 text-center">
            <p className="text-sm text-gray-500">
              Ten certyfikat potwierdza ukończenie kompleksowego kursu interpretacji EKG,
              <br />
              obejmującego wszystkie kluczowe moduły i zagadnienia z zakresu elektrokardiografii.
            </p>
          </div>
        </div>

        {/* Print hint */}
        <div className="text-center mt-6 text-sm text-muted-foreground print:hidden">
          <p>💡 Wskazówka: Użyj "Drukuj / Zapisz PDF", aby zapisać certyfikat jako plik PDF na swoim komputerze</p>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          body {
            margin: 0;
            padding: 20mm;
          }
          @page {
            size: A4;
            margin: 20mm;
          }
        }
      `}</style>
    </div>
  );
}
