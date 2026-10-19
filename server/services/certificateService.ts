import { randomBytes } from "crypto";
import { storage } from "../storage";
import { emailService } from "./emailService";
import type { User } from "@shared/schema";

export class CertificateService {
  generateCertificateId(): string {
    // Kryptograficznie losowe (nie do odgadnięcia/wyliczenia): EKG-XXXXXXXX-XXXXXXXX
    const hex = randomBytes(8).toString("hex").toUpperCase();
    return `EKG-${hex.slice(0, 8)}-${hex.slice(8)}`;
  }

  async isEligibleForCertificate(userId: string): Promise<boolean> {
    // Check if user completed required modules and has minimum score
    const userStats = await storage.getUserStatistics(userId);
    const progress = await storage.getUserProgress(userId);
    
    // Requirements: at least 80% success rate and completed all modules
    const requiredSuccessRate = 0.8;
    if (userStats.successRate < requiredSuccessRate) {
      return false;
    }

    // Wymagane są tylko tematy z pytaniami — postęp (opanowanie) liczy się z odpowiedzi,
    // więc temat z samym wykładem nigdy nie miałby 100% i blokowałby certyfikat na zawsze
    const published = await storage.getAllQuestions("published");
    const requiredSectionIds = new Set(published.map((q) => q.sectionId));
    const mastered = new Set(
      progress.filter((p) => parseFloat(p.completionPercentage) >= 100).map((p) => p.sectionId),
    );
    return requiredSectionIds.size > 0 && Array.from(requiredSectionIds).every((id) => mastered.has(id));
  }

  async generateCertificate(userId: string): Promise<{ certificateId: string; pdfUrl: string }> {
    const user = await storage.getUser(userId);
    if (!user) {
      throw new Error("Użytkownik nie znaleziony");
    }

    const isEligible = await this.isEligibleForCertificate(userId);
    if (!isEligible) {
      throw new Error("Nie spełniasz wymagań do otrzymania certyfikatu");
    }

    // Check if user already has a certificate
    const existingCertificates = await storage.getUserCertificates(userId);
    if (existingCertificates.length > 0) {
      const latest = existingCertificates[0];
      return {
        certificateId: latest.certificateId,
        pdfUrl: latest.pdfUrl || ""
      };
    }

    const certificateId = this.generateCertificateId();
    const userStats = await storage.getUserStatistics(userId);
    
    // Generate PDF (simplified - would use a PDF library like puppeteer or pdfkit)
    const pdfUrl = await this.generateCertificatePDF(user, certificateId, userStats.successRate);

    // Save certificate to database
    await storage.createCertificate({
      userId,
      certificateId,
      score: userStats.successRate.toString(),
      pdfUrl,
    });

    // Send email notification
    const verificationUrl = `${process.env.FRONTEND_URL}/verify/${certificateId}`;
    const emailTemplate = emailService.getCertificateTemplate(
      user.firstName,
      certificateId,
      verificationUrl
    );
    
    try {
      await emailService.sendEmail(user.email, emailTemplate);
    } catch (error) {
      console.error("Failed to send certificate email:", error);
      // Don't fail the certificate generation if email fails
    }

    return { certificateId, pdfUrl };
  }

  private async generateCertificatePDF(user: User, certificateId: string, score: number): Promise<string> {
    // This would typically use a PDF generation library
    // For now, return a placeholder URL
    const fileName = `certificate-${certificateId}.pdf`;
    const pdfUrl = `/api/certificates/pdf/${fileName}`;
    
    // TODO: Implement actual PDF generation using puppeteer or similar
    // The PDF should include:
    // - User name
    // - Certificate ID
    // - Date of issue
    // - QR code with verification URL
    // - EKG Academy branding
    // - Score achieved
    
    return pdfUrl;
  }

  async verifyCertificate(certificateId: string) {
    const certificate = await storage.getCertificateByPublicId(certificateId);
    if (!certificate) {
      return null;
    }

    const user = await storage.getUser(certificate.userId);
    if (!user) {
      return null;
    }

    // Publiczna weryfikacja: tylko imię i nazwisko, kurs, data, numer (+ ważność).
    // Bez wyniku, zawodu, userId i innych pól wewnętrznych.
    return {
      certificate: {
        certificateId: certificate.certificateId,
        issuedAt: certificate.issuedAt,
        course: "Kurs EKG — helloEKG",
      },
      user: {
        firstName: user.firstName,
        lastName: user.lastName,
      },
      isValid: certificate.isValid && (!certificate.expiresAt || new Date() < certificate.expiresAt),
    };
  }
}

export const certificateService = new CertificateService();
