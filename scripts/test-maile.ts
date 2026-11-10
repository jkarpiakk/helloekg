/**
 * Test dostarczalności: wysyła każdy szablon maila aplikacji na podany adres, z linkami-atrapami
 * (token TEST…, który nic nie otwiera). Uruchamiać na serwerze z konfiguracją SMTP (sekrety zostają w zmiennych
 * procesu, nic nie jest wypisywane):
 *   sudo bash -c 'set -a; . /etc/helloekg-kurs.env; set +a; cd /opt/helloekg-kurs && sudo -E -u kurs node dist/test-maile.js adres@domena.pl [szablon]'
 * Szablony: potwierdzenie, reset, haslo-zmienione, konto-istnieje, konto-usuniete, platnosc, platnosc-gosc, certyfikat
 */
import { emailService } from "../server/services/emailService";

const BASE = (process.env.APP_BASE_URL || "https://kurs.helloekg.pl").replace(/\/+$/, "");
const ATRAPA = "TEST-link-nie-dziala-0000000000000000";

const SZABLONY: Record<string, () => { subject: string; html: string; text: string }> = {
  potwierdzenie: () => emailService.getEmailVerificationTemplate("Ola", `${BASE}/verify-email?token=${ATRAPA}`),
  reset: () => emailService.getPasswordResetTemplate("Ola", `${BASE}/reset-password?token=${ATRAPA}`),
  "haslo-zmienione": () => emailService.getPasswordChangedTemplate("Ola"),
  "konto-istnieje": () => emailService.getAccountExistsTemplate(),
  "konto-usuniete": () => emailService.getAccountDeletedTemplate("Ola"),
  platnosc: () => emailService.getSubscriptionConfirmationTemplate("Ola", "Dostęp do kursu (TEST)", "10.12.2026"),
  "platnosc-gosc": () => emailService.getGuestPaymentConfirmationTemplate("Dostęp do kursu (TEST)", "10.12.2026", `${BASE}/reset-password?token=${ATRAPA}`),
  certyfikat: () => emailService.getCertificateTemplate("Ola", "EKG-TEST-0000", `${BASE}/certificate/EKG-TEST-0000`),
};

async function main() {
  const [adres, tylko] = process.argv.slice(2);
  if (!adres || !/^[^@\s]+@[^@\s]+$/.test(adres)) {
    console.error("Podaj adres: node dist/test-maile.js adres@domena.pl [szablon]");
    process.exit(2);
  }
  const lista = tylko ? [tylko] : Object.keys(SZABLONY);
  for (const nazwa of lista) {
    const t = SZABLONY[nazwa];
    if (!t) { console.error(`nieznany szablon: ${nazwa}`); process.exit(2); }
    const s = t();
    await emailService.sendEmail(adres, { ...s, subject: `${s.subject} [test ${nazwa}]` });
    console.log(`wysłany: ${nazwa}`);
  }
}
main().catch((e) => { console.error("błąd:", e?.message); process.exit(1); });
