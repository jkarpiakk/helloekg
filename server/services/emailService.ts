import nodemailer from "nodemailer";

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor() {
    // Configure with environment variables
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
  }

  async sendEmail(to: string, template: EmailTemplate): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: process.env.FROM_EMAIL || "noreply@ekgacademy.pl",
        to,
        subject: template.subject,
        html: template.html,
        text: template.text,
      });
    } catch (error) {
      console.error("Email sending failed:", error);
      throw new Error("Nie udało się wysłać e-maila");
    }
  }

  getEmailVerificationTemplate(firstName: string, verificationUrl: string): EmailTemplate {
    return {
      subject: "Potwierdź swój adres e-mail - EKG Academy",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Witaj w EKG Academy!</h1>
          <p>Cześć ${firstName},</p>
          <p>Dziękujemy za rejestrację w EKG Academy. Aby ukończyć proces rejestracji, potwierdź swój adres e-mail klikając w poniższy link:</p>
          <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Potwierdź adres e-mail</a>
          <p>Link jest ważny przez 24 godziny.</p>
          <p>Jeśli nie rejestrowałeś się w naszym serwisie, zignoruj tę wiadomość.</p>
          <p>Pozdrawiamy,<br>Zespół EKG Academy</p>
        </div>
      `,
      text: `Witaj ${firstName}! Potwierdź swój adres e-mail klikając w link: ${verificationUrl}`
    };
  }

  getPasswordResetTemplate(firstName: string, resetUrl: string): EmailTemplate {
    return {
      subject: "Reset hasła - EKG Academy",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Reset hasła</h1>
          <p>Cześć ${firstName},</p>
          <p>Otrzymaliśmy prośbę o reset hasła do Twojego konta w EKG Academy.</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Ustaw nowe hasło</a>
          <p>Link jest ważny przez 1 godzinę.</p>
          <p>Jeśli nie prosiłeś o reset hasła, zignoruj tę wiadomość.</p>
          <p>Pozdrawiamy,<br>Zespół EKG Academy</p>
        </div>
      `,
      text: `Reset hasła: ${resetUrl}`
    };
  }

  getSubscriptionConfirmationTemplate(firstName: string, planName: string, endDate: string): EmailTemplate {
    return {
      subject: "Potwierdzenie płatności - EKG Academy",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #059669;">Płatność potwierdzona!</h1>
          <p>Cześć ${firstName},</p>
          <p>Dziękujemy za zakup! Twój dostęp do EKG Academy został aktywowany.</p>
          <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h3>Szczegóły subskrypcji:</h3>
            <p><strong>Plan:</strong> ${planName}</p>
            <p><strong>Aktywny do:</strong> ${endDate}</p>
          </div>
          <a href="${process.env.FRONTEND_URL}/dashboard" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Rozpocznij naukę</a>
          <p>Pozdrawiamy,<br>Zespół EKG Academy</p>
        </div>
      `,
      text: `Płatność potwierdzona! Plan: ${planName}, aktywny do: ${endDate}`
    };
  }

  getCertificateTemplate(firstName: string, certificateId: string, verificationUrl: string): EmailTemplate {
    return {
      subject: "Gratulacje! Otrzymałeś certyfikat - EKG Academy",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #059669;">Gratulacje ${firstName}!</h1>
          <p>Ukończyłeś pomyślnie kurs EKG Academy i otrzymałeś certyfikat!</p>
          <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h3>Szczegóły certyfikatu:</h3>
            <p><strong>ID Certyfikatu:</strong> ${certificateId}</p>
            <p><strong>Weryfikacja online:</strong> <a href="${verificationUrl}">${verificationUrl}</a></p>
          </div>
          <p>Certyfikat z unikalnym ID i możliwością publicznej weryfikacji - idealny do CV!</p>
          <p>Pozdrawiamy,<br>Zespół EKG Academy</p>
        </div>
      `,
      text: `Gratulacje! Certyfikat ID: ${certificateId}, weryfikacja: ${verificationUrl}`
    };
  }
}

export const emailService = new EmailService();
