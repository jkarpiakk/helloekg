import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useTranslation } from "@/lib/i18n";
import { apiRequest } from "@/lib/queryClient";
import { Award, CheckCircle, AlertTriangle, QrCode } from "lucide-react";
import type { CertificateVerification } from "@/types";

interface VerifyCertificateProps {
  params: { certificateId: string };
}

export default function VerifyCertificate({ params }: VerifyCertificateProps) {
  const { certificateId } = params;
  const { t } = useTranslation();

  const { data: verification, isLoading, error } = useQuery({
    queryKey: ["/api/certificates/verify", certificateId],
    queryFn: async () => {
      const response = await apiRequest("GET", `/api/certificates/verify/${certificateId}`);
      return response.json() as Promise<CertificateVerification>;
    },
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error || !verification) {
    return (
      <div className="min-h-screen bg-background py-20">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <div className="w-20 h-20 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertTriangle className="h-10 w-10 text-destructive" />
            </div>
            <h1 className="text-3xl font-bold text-foreground mb-4">Certyfikat nie znaleziony</h1>
            <p className="text-muted-foreground">
              Certyfikat o podanym ID nie istnieje lub jest nieważny
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background py-20">
      <div className="max-w-4xl mx-auto px-4">
        <div className="text-center mb-12">
          <div className="w-20 h-20 bg-chart-2/10 rounded-full flex items-center justify-center mx-auto mb-6">
            <Award className="h-10 w-10 text-chart-2" />
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-4" data-testid="verification-title">
            {t("certificate.verification")}
          </h1>
          <p className="text-muted-foreground">
            {t("certificate.checkAuthenticity")}
          </p>
        </div>

        {/* Certificate Details */}
        <Card className="shadow-lg">
          <CardContent className="p-8">
            <div className="flex items-start space-x-6">
              {/* Certificate Icon */}
              <div className="w-16 h-16 bg-chart-2/10 rounded-xl flex items-center justify-center flex-shrink-0">
                <Award className="h-8 w-8 text-chart-2" />
              </div>
              
              {/* Certificate Info */}
              <div className="flex-1">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h2 className="text-2xl font-bold text-foreground">Certyfikat EKG Academy</h2>
                    <p className="text-muted-foreground">Profesjonalna nauka interpretacji EKG</p>
                  </div>
                  <Badge className={`px-4 py-2 ${
                    verification.isValid 
                      ? "bg-chart-2/10 text-chart-2 border-chart-2/20" 
                      : "bg-destructive/10 text-destructive border-destructive/20"
                  }`}>
                    <CheckCircle className="h-4 w-4 mr-2" />
                    {verification.isValid ? t("certificate.verified") : "Nieważny"}
                  </Badge>
                </div>

                {/* Certificate Details Grid */}
                <div className="grid md:grid-cols-2 gap-6">
                  <div>
                    <h3 className="font-semibold text-foreground mb-4">{t("certificate.certificateData")}</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("certificate.certificateId")}</span>
                        <span className="font-mono text-foreground" data-testid="certificate-id">
                          {verification.certificate.certificateId}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("certificate.issueDate")}</span>
                        <span className="text-foreground" data-testid="issue-date">
                          {new Date(verification.certificate.issuedAt).toLocaleDateString('pl-PL')}
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("certificate.examScore")}</span>
                        <span className="text-foreground font-semibold" data-testid="exam-score">
                          {Math.round(parseFloat(verification.certificate.score) * 100)}%
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("certificate.status")}</span>
                        <span className={`font-semibold ${
                          verification.isValid ? "text-chart-2" : "text-destructive"
                        }`} data-testid="certificate-status">
                          {verification.isValid ? t("certificate.active") : "Nieważny"}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="font-semibold text-foreground mb-4">{t("certificate.owner")}</h3>
                    <div className="space-y-3">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("certificate.name")}</span>
                        <span className="text-foreground" data-testid="certificate-owner-name">
                          {verification.user.firstName} {verification.user.lastName}
                        </span>
                      </div>
                      {verification.user.profession && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t("certificate.profession")}</span>
                          <span className="text-foreground" data-testid="certificate-owner-profession">
                            {verification.user.profession}
                          </span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("certificate.completedModules")}</span>
                        <span className="text-foreground">5/5</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">{t("certificate.studyTime")}</span>
                        <span className="text-foreground">24 godziny</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* QR Code Section */}
                <div className="mt-8 pt-6 border-t border-border">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="font-semibold text-foreground mb-2">{t("certificate.qrCode")}</h3>
                      <p className="text-sm text-muted-foreground">{t("certificate.scanToVerify")}</p>
                    </div>
                    <div className="w-24 h-24 bg-muted rounded-lg flex items-center justify-center">
                      <QrCode className="h-12 w-12 text-muted-foreground" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Verification Info */}
        <div className="mt-8 text-center">
          <p className="text-sm text-muted-foreground">
            {t("certificate.issued")}
            <br />
            {t("certificate.contact")}
          </p>
        </div>
      </div>
    </div>
  );
}
