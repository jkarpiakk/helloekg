import nodemailer from "nodemailer";

export interface EmailTemplate {
  subject: string;
  html: string;
  text: string;
}

interface SendGridDynamicData {
  [key: string]: string | number | boolean;
}

export class EmailService {
  private transporter: nodemailer.Transporter;
  private useSendGrid: boolean;
  private sendGridApiKey: string | undefined;

  constructor() {
    this.sendGridApiKey = process.env.SENDGRID_API_KEY;
    this.useSendGrid = !!this.sendGridApiKey;

    // Fallback to nodemailer if no SendGrid key
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

  private async sendViaSendGrid(
    to: string, 
    templateId: string, 
    dynamicData: SendGridDynamicData
  ): Promise<void> {
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.sendGridApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: to }],
          dynamic_template_data: dynamicData
        }],
        from: { 
          email: process.env.FROM_EMAIL || 'noreply@ekgacademy.pl',
          name: 'helloEKG'
        },
        template_id: templateId
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('SendGrid error:', response.status, errorText);
      throw new Error(`SendGrid error: ${response.status}`);
    }
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

  async sendEmailVerification(to: string, firstName: string, verificationUrl: string): Promise<void> {
    if (this.useSendGrid) {
      await this.sendViaSendGrid(to, 'd-5f81b219d046408fb87a30768ac6a66f', {
        firstName,
        verificationUrl,
        subject: 'Potwierdź swój adres e-mail - helloEKG'
      });
    } else {
      const template = this.getEmailVerificationTemplate(firstName, verificationUrl);
      await this.sendEmail(to, template);
    }
  }

  async sendPasswordReset(to: string, firstName: string, resetUrl: string): Promise<void> {
    if (this.useSendGrid) {
      await this.sendViaSendGrid(to, 'd-5f81b219d046408fb87a30768ac6a66f', {
        firstName,
        resetUrl,
        subject: 'Reset hasła - helloEKG',
        isPasswordReset: true
      });
    } else {
      const template = this.getPasswordResetTemplate(firstName, resetUrl);
      await this.sendEmail(to, template);
    }
  }

  async sendSubscriptionConfirmation(to: string, firstName: string, planName: string, endDate: string): Promise<void> {
    if (this.useSendGrid) {
      await this.sendViaSendGrid(to, 'd-5f81b219d046408fb87a30768ac6a66f', {
        firstName,
        planName,
        endDate,
        subject: 'Potwierdzenie płatności - helloEKG',
        isSubscription: true
      });
    } else {
      const template = this.getSubscriptionConfirmationTemplate(firstName, planName, endDate);
      await this.sendEmail(to, template);
    }
  }

  async sendCertificate(to: string, firstName: string, certificateId: string, verificationUrl: string): Promise<void> {
    if (this.useSendGrid) {
      await this.sendViaSendGrid(to, 'd-5f81b219d046408fb87a30768ac6a66f', {
        firstName,
        certificateId,
        verificationUrl,
        subject: 'Gratulacje! Otrzymałeś certyfikat - helloEKG',
        isCertificate: true
      });
    } else {
      const template = this.getCertificateTemplate(firstName, certificateId, verificationUrl);
      await this.sendEmail(to, template);
    }
  }

  getEmailVerificationTemplate(firstName: string, verificationUrl: string): EmailTemplate {
    return {
      subject: "Potwierdź swój adres e-mail - helloEKG",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Witaj w helloEKG!</h1>
          <p>Cześć ${firstName},</p>
          <p>Dziękujemy za rejestrację w helloEKG. Aby ukończyć proces rejestracji, potwierdź swój adres e-mail klikając w poniższy link:</p>
          <a href="${verificationUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Potwierdź adres e-mail</a>
          <p>Link jest ważny przez 24 godziny.</p>
          <p>Jeśli nie rejestrowałeś się w naszym serwisie, zignoruj tę wiadomość.</p>
          <p>Pozdrawiamy,<br>Zespół helloEKG</p>
        </div>
      `,
      text: `Witaj ${firstName}! Potwierdź swój adres e-mail klikając w link: ${verificationUrl}`
    };
  }

  getPasswordResetTemplate(firstName: string, resetUrl: string): EmailTemplate {
    return {
      subject: "Reset hasła - helloEKG",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #2563eb;">Reset hasła</h1>
          <p>Cześć ${firstName},</p>
          <p>Otrzymaliśmy prośbę o reset hasła do Twojego konta w helloEKG.</p>
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Ustaw nowe hasło</a>
          <p>Link jest ważny przez 1 godzinę.</p>
          <p>Jeśli nie prosiłeś o reset hasła, zignoruj tę wiadomość.</p>
          <p>Pozdrawiamy,<br>Zespół helloEKG</p>
        </div>
      `,
      text: `Reset hasła: ${resetUrl}`
    };
  }

  getSubscriptionConfirmationTemplate(firstName: string, planName: string, endDate: string): EmailTemplate {
    return {
      subject: "Potwierdzenie płatności - helloEKG",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #059669;">Płatność potwierdzona!</h1>
          <p>Cześć ${firstName},</p>
          <p>Dziękujemy za zakup! Twój dostęp do helloEKG został aktywowany.</p>
          <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h3>Szczegóły subskrypcji:</h3>
            <p><strong>Plan:</strong> ${planName}</p>
            <p><strong>Aktywny do:</strong> ${endDate}</p>
          </div>
          <a href="${process.env.FRONTEND_URL}/dashboard" style="display: inline-block; padding: 12px 24px; background-color: #2563eb; color: white; text-decoration: none; border-radius: 6px; margin: 16px 0;">Rozpocznij naukę</a>
          <p>Pozdrawiamy,<br>Zespół helloEKG</p>
        </div>
      `,
      text: `Płatność potwierdzona! Plan: ${planName}, aktywny do: ${endDate}`
    };
  }

  getCertificateTemplate(firstName: string, certificateId: string, verificationUrl: string): EmailTemplate {
    return {
      subject: "Gratulacje! Otrzymałeś certyfikat - helloEKG",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #059669;">Gratulacje ${firstName}!</h1>
          <p>Ukończyłeś pomyślnie kurs helloEKG i otrzymałeś certyfikat!</p>
          <div style="background-color: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
            <h3>Szczegóły certyfikatu:</h3>
            <p><strong>ID Certyfikatu:</strong> ${certificateId}</p>
            <p><strong>Weryfikacja online:</strong> <a href="${verificationUrl}">${verificationUrl}</a></p>
          </div>
          <p>Certyfikat z unikalnym ID i możliwością publicznej weryfikacji - idealny do CV!</p>
          <p>Pozdrawiamy,<br>Zespół helloEKG</p>
        </div>
      `,
      text: `Gratulacje! Certyfikat ID: ${certificateId}, weryfikacja: ${verificationUrl}`
    };
  }
}

export const emailService = new EmailService();
