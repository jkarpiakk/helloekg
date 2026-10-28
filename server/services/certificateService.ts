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

  /**
   * Warunek ukończenia (decyzja JK 28.10): każdy temat z opublikowanymi pytaniami opanowany,
   * czyli ostatnia odpowiedź na każde jego pytanie poprawna. Dawne pomyłki się nie liczą.
   * Temat z samym wykładem nie jest wymagany (nie da się go „opanować” odpowiedziami).
   */
  async getCompletion(userId: string): Promise<{ mastered: number; required: number; isEligible: boolean }> {
    const [published, progress] = await Promise.all([storage.getAllQuestions("published"), storage.getUserProgress(userId)]);
    const required = new Set(published.map((q) => q.sectionId));
    const done = new Set(progress.filter((p) => parseFloat(p.completionPercentage) >= 100).map((p) => p.sectionId));
    const mastered = Array.from(required).filter((id) => done.has(id)).length;
    return { mastered, required: required.size, isEligible: required.size > 0 && mastered === required.size };
  }

  async isEligibleForCertificate(userId: string): Promise<boolean> {
    return (await this.getCompletion(userId)).isEligible;
  }

  /** `name` = imię i nazwisko tak, jak mają stać na certyfikacie (zapisywane w koncie). */
  async generateCertificate(userId: string, name?: { firstName: string; lastName: string }): Promise<{ certificateId: string; pdfUrl: string }> {
    let user = await storage.getUser(userId);
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

    if (name) user = await storage.updateUser(userId, name);
    if (!user.firstName?.trim() || !user.lastName?.trim()) {
      throw new Error("Podaj imię i nazwisko, które mają być na certyfikacie");
    }

    const certificateId = this.generateCertificateId();
    
    // Generate PDF (simplified - would use a PDF library like puppeteer or pdfkit)
    const pdfUrl = await this.generateCertificatePDF(user, certificateId);

    // Save certificate to database
    await storage.createCertificate({
      userId,
      certificateId,
      // Ukończenie = pełne opanowanie wszystkich tematów
      score: "1",
      pdfUrl,
    });

    // Send email notification
    const base = (process.env.FRONTEND_URL || process.env.APP_BASE_URL || "http://localhost:5000").replace(/\/+$/, "");
    const certificateUrl = `${base}/certificate/${certificateId}`;
    const emailTemplate = emailService.getCertificateTemplate(
      user.firstName,
      certificateId,
      certificateUrl
    );
    
    try {
      await emailService.sendEmail(user.email, emailTemplate);
    } catch (error) {
      console.error("Failed to send certificate email:", error);
      // Don't fail the certificate generation if email fails
    }

    return { certificateId, pdfUrl };
  }

  private async generateCertificatePDF(user: User, certificateId: string): Promise<string> {
    // This would typically use a PDF generation library
    // For now, return a placeholder URL
    const fileName = `certificate-${certificateId}.pdf`;
    const pdfUrl = `/api/certificates/pdf/${fileName}`;
    
    // TODO: Implement actual PDF generation using puppeteer or similar
    // The PDF should include:
    // - User name
    // - Certificate ID
    // - Date of issue
    // - EKG Academy branding
    
    return pdfUrl;
  }
}

export const certificateService = new CertificateService();
