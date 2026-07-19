import { Button } from "@/components/ui/button";
import { Award, ArrowLeft, CheckCircle } from "lucide-react";
import { Link } from "wouter";

export default function CertificatePreviewPage() {
  const previewData = {
    firstName: "Jan",
    lastName: "Kowalski",
    score: 95,
    certificateId: "CERT-2025-DEMO-12345",
    issuedAt: new Date().toISOString(),
  };

  const issueDate = new Date(previewData.issuedAt);

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-yellow-100 dark:bg-yellow-900/20 border-b border-yellow-300">
        <div className="max-w-7xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-2xl">👁️</span>
              <span className="font-semibold text-yellow-900 dark:text-yellow-100">
                Podgląd certyfikatu (Demo)
              </span>
            </div>
            <Link href="/dashboard">
              <Button variant="ghost" size="sm">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Wróć do panelu
              </Button>
            </Link>
          </div>
        </div>
      </div>

      {/* Certificate - Printable */}
      <div className="max-w-5xl mx-auto px-4 py-12">
        <div className="bg-white text-black p-12 rounded-lg shadow-2xl border-8 border-double border-gray-800">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="flex justify-center mb-4">
              <div className="w-20 h-20 bg-[#0B7E54] rounded-full flex items-center justify-center">
                <Award className="h-12 w-12 text-white" />
              </div>
            </div>
            <h1 className="text-4xl font-bold text-gray-900 mb-2">Certyfikat Ukończenia</h1>
            <div className="w-32 h-1 bg-[#0B7E54] mx-auto mb-4"></div>
            <p className="text-xl text-gray-700">helloEKG</p>
          </div>

          {/* Main Content */}
          <div className="text-center mb-8">
            <p className="text-lg text-gray-600 mb-6">Niniejszym poświadcza się, że</p>
            <h2 className="text-3xl font-bold text-gray-900 mb-6 border-b-2 border-gray-300 pb-2 inline-block px-8">
              {previewData.firstName} {previewData.lastName}
            </h2>
            <p className="text-lg text-gray-600 mb-4">ukończył z wynikiem</p>
            <div className="inline-block bg-[#3EE6A8]/10 border-2 border-[#0B7E54] rounded-lg px-8 py-3 mb-6">
              <p className="text-4xl font-bold text-[#0B7E54]">{previewData.score}%</p>
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
              <p className="font-mono text-lg font-semibold text-gray-900">{previewData.certificateId}</p>
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
                <span className="font-mono">{window.location.origin}/verify/{previewData.certificateId}</span>
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

        {/* Info */}
        <div className="mt-6 p-4 bg-[#3EE6A8]/[0.06] rounded-lg border border-[#223040]">
          <p className="text-sm text-muted-foreground">
            ℹ️ To jest podgląd demonstracyjny certyfikatu. Prawdziwe certyfikaty są generowane automatycznie 
            po ukończeniu kursu z wynikiem minimum 80%. Użytkownicy mogą je wydrukować lub zapisać jako PDF.
          </p>
        </div>
      </div>
    </div>
  );
}
