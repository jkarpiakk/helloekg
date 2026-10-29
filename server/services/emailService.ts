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
  private transporter: ReturnType<typeof nodemailer.createTransport>;
  private useSendGrid: boolean;
  private sendGridApiKey: string | undefined;

  constructor() {
    this.sendGridApiKey = process.env.SENDGRID_API_KEY;
    this.useSendGrid = !!this.sendGridApiKey;

    // Fallback to nodemailer if no SendGrid key
    this.transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST || "smtp.gmail.com",
      port: parseInt(process.env.SMTP_PORT || "587"),
      // 465 = TLS od początku; inne porty: STARTTLS wymuszony (bez wysyłki otwartym tekstem)
      secure: parseInt(process.env.SMTP_PORT || "587") === 465,
      requireTLS: true,
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
          email: process.env.FROM_EMAIL || 'kurs@helloekg.pl',
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
        from: process.env.FROM_EMAIL || "helloEKG <kurs@helloekg.pl>",
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
        subject: 'Potwierdź adres e-mail w helloEKG'
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
        subject: 'Ustaw nowe hasło w helloEKG',
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
        subject: 'Płatność potwierdzona: helloEKG',
        isSubscription: true
      });
    } else {
      const template = this.getSubscriptionConfirmationTemplate(firstName, planName, endDate);
      await this.sendEmail(to, template);
    }
  }

  async sendCertificate(to: string, firstName: string, certificateId: string, certificateUrl: string): Promise<void> {
    if (this.useSendGrid) {
      await this.sendViaSendGrid(to, 'd-5f81b219d046408fb87a30768ac6a66f', {
        firstName,
        certificateId,
        certificateUrl,
        subject: 'Gratulacje! Twój certyfikat helloEKG',
        isCertificate: true
      });
    } else {
      const template = this.getCertificateTemplate(firstName, certificateId, certificateUrl);
      await this.sendEmail(to, template);
    }
  }

  getEmailVerificationTemplate(firstName: string, verificationUrl: string): EmailTemplate {
    return {
      subject: "Potwierdź adres e-mail w helloEKG",
      html: brandEmail({
        preheader: "Jedno kliknięcie i Twoje konto w helloEKG jest gotowe.",
        label: "Konto · wersja beta",
        title: greeting(firstName, "potwierdź adres e-mail."),
        body: `<p ${P}>Dziękujemy za założenie konta w helloEKG. Kliknij przycisk poniżej, żeby potwierdzić, że ten adres należy do Ciebie.</p>`,
        cta: { href: verificationUrl, text: "Potwierdź adres e-mail" },
        note: "Link jest ważny przez 24 godziny. Jeśli nie zakładasz konta w helloEKG, zignoruj tę wiadomość.",
        reason: "Dostajesz tę wiadomość, bo ktoś założył konto z tym adresem na kurs.helloekg.pl.",
      }),
      text: `Potwierdź adres e-mail w helloEKG: ${verificationUrl}\n\nLink jest ważny przez 24 godziny.`,
    };
  }

  getPasswordResetTemplate(firstName: string, resetUrl: string): EmailTemplate {
    return {
      subject: "Ustaw nowe hasło w helloEKG",
      html: brandEmail({
        preheader: "Link do ustawienia nowego hasła jest ważny przez godzinę.",
        label: "Konto · nowe hasło",
        title: greeting(firstName, "ustaw nowe hasło."),
        body: `<p ${P}>Otrzymaliśmy prośbę o zmianę hasła do Twojego konta w helloEKG. Kliknij przycisk i wpisz nowe hasło.</p>`,
        cta: { href: resetUrl, text: "Ustaw nowe hasło" },
        note: "Link jest ważny przez 1 godzinę. Jeśli to nie Twoja prośba, zignoruj tę wiadomość: hasło zostaje bez zmian.",
        reason: "Dostajesz tę wiadomość, bo na kurs.helloekg.pl poproszono o zmianę hasła do tego konta.",
      }),
      text: `Ustaw nowe hasło w helloEKG: ${resetUrl}\n\nLink jest ważny przez 1 godzinę. Jeśli to nie Twoja prośba, zignoruj tę wiadomość.`,
    };
  }

  getSubscriptionConfirmationTemplate(firstName: string, planName: string, endDate: string): EmailTemplate {
    return {
      subject: "Płatność potwierdzona: helloEKG",
      html: brandEmail({
        preheader: "Twój dostęp do kursu jest aktywny.",
        label: "Płatność · potwierdzenie",
        title: greeting(firstName, "dostęp jest aktywny."),
        body: `<p ${P}>Dziękujemy za zakup. Możesz od razu wrócić do nauki.</p>${details([["Plan", planName], ["Aktywny do", endDate]])}`,
        cta: { href: `${appUrl()}/dashboard`, text: "Przejdź do kursu" },
        reason: "Dostajesz tę wiadomość, bo opłacono dostęp do kursu helloEKG.",
      }),
      text: `Płatność potwierdzona. Plan: ${planName}, aktywny do: ${endDate}. ${appUrl()}/dashboard`,
    };
  }

  async sendGuestPaymentConfirmation(
    to: string,
    planName: string,
    endDate: string,
    setPasswordUrl: string
  ): Promise<void> {
    const template = this.getGuestPaymentConfirmationTemplate(planName, endDate, setPasswordUrl);
    await this.sendEmail(to, template);
  }

  getGuestPaymentConfirmationTemplate(
    planName: string,
    endDate: string,
    setPasswordUrl: string
  ): EmailTemplate {
    return {
      subject: "Płatność potwierdzona: ustaw hasło do helloEKG",
      html: brandEmail({
        preheader: "Ustaw hasło, żeby zalogować się do kursu.",
        label: "Płatność · potwierdzenie",
        title: "Dostęp jest aktywny.",
        subtitle: "Zostało ustawić hasło.",
        body: `<p ${P}>Dziękujemy za zakup. Żeby się zalogować, ustaw hasło do swojego konta.</p>${details([["Plan", planName], ["Aktywny do", endDate]])}`,
        cta: { href: setPasswordUrl, text: "Ustaw hasło i zaloguj się" },
        note: "Link jest ważny przez 1 godzinę. Jeśli nie zamawiasz kursu, napisz do nas: kontakt@helloekg.pl.",
        reason: "Dostajesz tę wiadomość, bo opłacono dostęp do kursu helloEKG z tym adresem.",
      }),
      text: `Płatność potwierdzona. Plan: ${planName}, aktywny do: ${endDate}. Ustaw hasło: ${setPasswordUrl}`,
    };
  }

  getCertificateTemplate(firstName: string, certificateId: string, certificateUrl: string): EmailTemplate {
    return {
      subject: "Twój certyfikat helloEKG",
      html: brandEmail({
        preheader: "Kurs ukończony, certyfikat jest gotowy.",
        label: "Certyfikat",
        title: greeting(firstName, "gratulacje."),
        subtitle: "Kurs helloEKG ukończony.",
        body: `<p ${P}>Certyfikat znajdziesz po zalogowaniu w helloEKG.</p>${details([["Numer certyfikatu", certificateId]])}`,
        cta: { href: certificateUrl, text: "Zobacz certyfikat" },
        reason: "Dostajesz tę wiadomość, bo kurs helloEKG na Twoim koncie jest ukończony.",
      }),
      text: `Gratulacje! Certyfikat nr ${certificateId}: ${certificateUrl}`,
    };
  }

  /** Powiadomienie zespołu o nowym zgłoszeniu testera (beta) */
  getFeedbackNotificationTemplate(r: {
    id: string;
    userName: string;
    userEmail: string;
    areaLabel: string;
    typeLabel: string;
    description: string;
    pagePath?: string | null;
    attachmentCount: number;
    viewport?: string;
    appVersion?: string;
  }): EmailTemplate {
    const adminUrl = `${appUrl()}/admin?tab=zgloszenia&report=${encodeURIComponent(r.id)}`;
    const short = r.description.length > 70 ? `${r.description.slice(0, 70).trimEnd()}…` : r.description;
    const rows: Array<[string, string]> = [
      ["Typ", r.typeLabel],
      ["Obszar", r.areaLabel],
      ["Od", `${r.userName} · ${r.userEmail}`],
      ["Strona", r.pagePath || "brak"],
      ["Załączniki", String(r.attachmentCount)],
    ];
    if (r.viewport) rows.push(["Ekran", r.viewport]);
    if (r.appVersion) rows.push(["Wersja", r.appVersion]);
    const quote = `<p ${P.replace('color:#B8C2C9;', 'color:#F2F6F4;white-space:pre-wrap;border-left:2px solid #3EE6A8;padding-left:16px;')}>${esc(r.description)}</p>`;
    return {
      subject: `[Zgłoszenie] ${r.typeLabel}: ${short}`,
      html: brandEmail({
        preheader: short,
        label: "Zgłoszenie z bety",
        title: esc(r.typeLabel),
        subtitle: r.areaLabel,
        body: `${quote}${details(rows)}`,
        cta: { href: adminUrl, text: "Otwórz w panelu" },
        reason: "Dostajesz tę wiadomość, bo ten adres odbiera zgłoszenia testerów helloEKG.",
      }),
      text: `Nowe zgłoszenie (${r.typeLabel}, ${r.areaLabel}) od ${r.userName} <${r.userEmail}>\nStrona: ${r.pagePath || "brak"}\nZałączniki: ${r.attachmentCount}\n\n${r.description}\n\nPanel: ${adminUrl}`,
    };
  }
}

/* ---------- Szablon wiadomości w stylu marki (jak powitanie z listy startowej na helloekg.pl) ---------- */

const LOGO_URL = "https://storage.mlcdn.com/account_image/2636127/EUDAXhD74WEepXT6E3W2UwwTXKSoDqc8U0iHfxbi.png";
const LINE_URL = "https://storage.mlcdn.com/account_image/2636127/mThPsI7bGJAeXZr4clHjynYt2QRQdi3jMR1whUpl.png";
const P = `style="margin:0 0 22px 0;font-family:Inter,Helvetica,Arial,sans-serif;font-size:16px;line-height:1.65;color:#B8C2C9;"`;

export const esc = (v: string) =>
  String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

const appUrl = () => process.env.APP_BASE_URL || process.env.FRONTEND_URL || "https://kurs.helloekg.pl";

/** „Kuba, ustaw nowe hasło.” albo „Ustaw nowe hasło.”, gdy nie znamy imienia */
function greeting(firstName: string, rest: string): string {
  const name = (firstName || "").trim();
  return name ? `${esc(name)}, ${rest}` : rest.charAt(0).toUpperCase() + rest.slice(1);
}

function details(rows: Array<[string, string]>): string {
  const tr = rows
    .map(([k, v]) => `<tr><td style="padding:12px 0;border-bottom:1px solid #1A222B;font-family:'JetBrains Mono',Menlo,Consolas,monospace;font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#76838C;">${esc(k)}</td><td align="right" style="padding:12px 0;border-bottom:1px solid #1A222B;font-family:Inter,Helvetica,Arial,sans-serif;font-size:15px;color:#F2F6F4;">${esc(v)}</td></tr>`)
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 26px 0;border-top:1px solid #1A222B;">${tr}</table>`;
}

function brandEmail(o: {
  preheader: string;
  label: string;
  title: string;
  subtitle?: string;
  body: string;
  cta: { href: string; text: string };
  note?: string;
  reason: string;
}): string {
  const H = `font-family:'Space Grotesk',Helvetica,Arial,sans-serif;font-size:32px;line-height:1.1;font-weight:600;letter-spacing:-0.5px;`;
  return `<!doctype html>
<html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="dark"><meta name="supported-color-schemes" content="dark"></head>
<body style="margin:0;padding:0;background:#0B0F14;">
<div style="display:none;max-height:0;overflow:hidden;color:#0B0F14;">${esc(o.preheader)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#0B0F14;"><tr><td align="center" style="padding:32px 16px;">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px;">
<tr><td style="padding:0 4px 24px 4px;"><a href="${appUrl()}" style="text-decoration:none;"><img src="${LOGO_URL}" width="180" height="32" alt="helloEKG" style="display:block;border:0;width:180px;height:32px;"></a></td></tr>
<tr><td style="background:#0E141A;border:1px solid #1A222B;border-radius:16px;padding:36px 32px 32px 32px;">
<p style="margin:0 0 18px 0;font-family:'JetBrains Mono',Menlo,Consolas,monospace;font-size:11px;line-height:1.4;letter-spacing:2px;text-transform:uppercase;color:#3EE6A8;">${esc(o.label)}</p>
<h1 style="margin:0 0 ${o.subtitle ? "4px" : "22px"} 0;${H}color:#F2F6F4;">${o.title}</h1>
${o.subtitle ? `<p style="margin:0 0 22px 0;${H}color:#8A97A0;">${esc(o.subtitle)}</p>` : ""}
${o.body}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 24px 0;"><tr><td style="border-radius:999px;background:#3EE6A8;"><a href="${esc(o.cta.href)}" style="display:inline-block;padding:15px 28px;font-family:Inter,Helvetica,Arial,sans-serif;font-size:16px;font-weight:600;line-height:1;color:#07130E;text-decoration:none;border-radius:999px;">${esc(o.cta.text)}</a></td></tr></table>
<p style="margin:0 0 26px 0;font-family:Inter,Helvetica,Arial,sans-serif;font-size:13px;line-height:1.6;color:#76838C;">Przycisk nie działa? Skopiuj ten adres do przeglądarki:<br><a href="${esc(o.cta.href)}" style="color:#8A97A0;word-break:break-all;">${esc(o.cta.href)}</a></p>
${o.note ? `<p style="margin:0 0 26px 0;font-family:Inter,Helvetica,Arial,sans-serif;font-size:14px;line-height:1.6;color:#8A97A0;">${esc(o.note)}</p>` : ""}
<img src="${LINE_URL}" width="536" height="32" alt="" style="display:block;border:0;width:100%;max-width:536px;height:auto;margin:0 0 22px 0;">
<p style="margin:0;font-family:Inter,Helvetica,Arial,sans-serif;font-size:15px;line-height:1.6;color:#8A97A0;">Do usłyszenia,<br><b style="color:#F2F6F4;font-weight:600;">zespół helloEKG</b></p>
</td></tr>
<tr><td style="padding:22px 8px 0 8px;font-family:Inter,Helvetica,Arial,sans-serif;font-size:12px;line-height:1.6;color:#5C6870;text-align:center;">${esc(o.reason)}<br><a href="https://helloekg.pl/polityka-prywatnosci.html" style="color:#8A97A0;">Polityka prywatności</a> · <a href="mailto:kontakt@helloekg.pl" style="color:#8A97A0;">kontakt@helloekg.pl</a></td></tr>
</table></td></tr></table></body></html>`;
}

export const emailService = new EmailService();
