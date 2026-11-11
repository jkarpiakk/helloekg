/**
 * Zaświadczenie szkolenia z punktami jako PDF generowany na serwerze (pdfkit + qrcode).
 * Wszystko z kopii zapisanej przy wydaniu (snapshot, rule_snapshot), więc PDF pobrany po latach
 * wygląda tak samo, nawet gdy zmienią się reguły, dane organizatora albo konto zniknie.
 * Font z polskimi znakami: DejaVu Sans (pakiet dejavu-fonts-ttf, wolna licencja Bitstream Vera/DejaVu).
 */
import { createRequire } from "node:module";
import PDFDocument from "pdfkit";
import QRCode from "qrcode";
import type { CmeCertificate } from "@shared/schema";
import { dataPL } from "./logika";

const require = createRequire(import.meta.url);
const FONT = require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans.ttf");
const FONT_BOLD = require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf");

const INK = "#0B0F14";
const MUTED = "#5C6870";
const GREEN = "#0B7E54";
const LINE = "#D5DDD9";

/** Link weryfikacji z losowym kluczem (nie z kolejnym numerem, którego nie wolno dać się wyliczać) */
export const adresWeryfikacji = (klucz: string) => {
  const base = (process.env.APP_BASE_URL || process.env.FRONTEND_URL || "https://kurs.helloekg.pl").replace(/\/+$/, "");
  return `${base}/zaswiadczenie/${encodeURIComponent(klucz)}`;
};

type Snapshot = {
  imie: string; nazwisko: string; zawod: string; zawodNazwa: string; pwz: string | null; specjalizacja: string | null;
  tytul: string; forma: string; godziny: number; dataRozpoczecia: string; dataZakonczenia: string;
  wynikTestu?: { wynik: number | null; maks: number | null; procent: number | null };
  punkty: number | null; powodBezPunktow: string | null;
  organizator: { nazwa: string; adres: string; krs: string; nip: string; email: string; reklamacje: string };
  kierownikNaukowy: string;
};

const liczba = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ","));

export async function pdfZaswiadczenia(c: CmeCertificate): Promise<Buffer> {
  const s = c.snapshot as unknown as Snapshot;
  const r = c.ruleSnapshot as Record<string, any>;
  const url = adresWeryfikacji(c.verificationToken);
  const qr = await QRCode.toBuffer(url, { margin: 0, width: 360, errorCorrectionLevel: "M", color: { dark: INK, light: "#FFFFFF" } });

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 48, bottom: 40, left: 56, right: 56 },
    info: { Title: `Zaświadczenie ${c.number}`, Author: s.organizator?.nazwa || "helloEKG", Subject: s.tytul, Creator: "helloEKG" },
  });
  const czesci: Buffer[] = [];
  doc.on("data", (b: Buffer) => czesci.push(b));
  const koniec = new Promise<Buffer>((resolve, reject) => {
    doc.on("end", () => resolve(Buffer.concat(czesci)));
    doc.on("error", reject);
  });

  doc.registerFont("Sans", FONT);
  doc.registerFont("SansBold", FONT_BOLD);
  const W = doc.page.width;
  const L = doc.page.margins.left;
  const P = W - L - doc.page.margins.right;

  // Nagłówek: znak marki i numer
  doc.font("SansBold").fontSize(20).fillColor(INK).text("hello", L, 48, { continued: true }).fillColor(GREEN).text("EKG");
  doc.font("Sans").fontSize(9).fillColor(MUTED).text(`Nr ${c.number}`, L, 56, { width: P, align: "right" });

  // Ozdobna linia EKG (rytm zatokowy)
  const y0 = 92;
  doc.save().lineWidth(1.2).strokeColor(GREEN);
  doc.moveTo(L, y0);
  for (let x = L; x < L + P - 60; x += 60) {
    doc.lineTo(x + 14, y0).quadraticCurveTo(x + 18, y0 - 4, x + 22, y0).lineTo(x + 28, y0)
      .lineTo(x + 30, y0 + 3).lineTo(x + 33, y0 - 16).lineTo(x + 36, y0 + 5).lineTo(x + 38, y0)
      .lineTo(x + 44, y0).bezierCurveTo(x + 47, y0 - 6, x + 52, y0 - 6, x + 55, y0).lineTo(x + 60, y0);
  }
  doc.lineTo(L + P, y0).stroke().restore();

  // Tytuł
  doc.font("SansBold").fontSize(26).fillColor(INK).text("ZAŚWIADCZENIE", L, 120, { width: P, align: "center", characterSpacing: 2 });
  doc.font("Sans").fontSize(13).fillColor(MUTED).text("o ukończeniu szkolenia", { width: P, align: "center" });
  doc.moveDown(1.2);
  doc.font("Sans").fontSize(10).fillColor(MUTED).text("Imię i nazwisko", { width: P, align: "center" });
  doc.font("SansBold").fontSize(22).fillColor(INK).text(`${s.imie} ${s.nazwisko}`, { width: P, align: "center" });
  doc.moveDown(1);

  // Dane w dwóch kolumnach: etykieta, wartość
  const wiersze: Array<[string, string]> = [];
  wiersze.push(["Zawód", s.zawodNazwa]);
  if (s.pwz) wiersze.push(["Numer prawa wykonywania zawodu", s.pwz]);
  if (s.specjalizacja) wiersze.push(["Specjalizacja", s.specjalizacja]);
  wiersze.push(["Tytuł szkolenia", s.tytul]);
  wiersze.push(["Forma szkolenia", s.forma]);
  wiersze.push(["Termin", `od ${dataPL(new Date(s.dataRozpoczecia))} do ${dataPL(new Date(s.dataZakonczenia))}`]);
  wiersze.push(["Liczba godzin", `${liczba(Number(s.godziny))} h`]);
  if (s.wynikTestu?.procent !== null && s.wynikTestu?.procent !== undefined) {
    wiersze.push(["Test końcowy", `zaliczony, ${liczba(s.wynikTestu.procent)}% (${s.wynikTestu.wynik} z ${s.wynikTestu.maks})`]);
  }
  if (s.punkty !== null) {
    wiersze.push(["Punkty edukacyjne", liczba(s.punkty)]);
    if (r.points_formula ?? r.pointsFormula) wiersze.push(["Sposób liczenia punktów", String(r.points_formula ?? r.pointsFormula)]);
    if (r.legal_basis ?? r.legalBasis) wiersze.push(["Podstawa prawna", String(r.legal_basis ?? r.legalBasis)]);
    if (r.registry_number ?? r.registryNumber) wiersze.push(["Numer wpisu do rejestru / decyzji", String(r.registry_number ?? r.registryNumber)]);
  }
  const org = s.organizator;
  const orgTekst = [org?.nazwa, org?.adres, org?.krs ? `KRS ${org.krs}` : "", org?.nip ? `NIP ${org.nip}` : ""].filter(Boolean).join(", ");
  wiersze.push(["Organizator", orgTekst || "helloEKG"]);
  if (s.kierownikNaukowy) wiersze.push(["Kierownik naukowy", s.kierownikNaukowy]);

  const kolEt = 190;
  let y = doc.y;
  for (const [et, wart] of wiersze) {
    doc.font("Sans").fontSize(9).fillColor(MUTED);
    const hEt = doc.heightOfString(et, { width: kolEt - 12 });
    doc.font("Sans").fontSize(10.5).fillColor(INK);
    const hW = doc.heightOfString(wart, { width: P - kolEt });
    const h = Math.max(hEt, hW);
    doc.moveTo(L, y).lineTo(L + P, y).lineWidth(0.5).strokeColor(LINE).stroke();
    doc.font("Sans").fontSize(9).fillColor(MUTED).text(et, L, y + 6, { width: kolEt - 12 });
    doc.font("Sans").fontSize(10.5).fillColor(INK).text(wart, L + kolEt, y + 5, { width: P - kolEt });
    y += h + 12;
  }
  doc.moveTo(L, y).lineTo(L + P, y).lineWidth(0.5).strokeColor(LINE).stroke();
  y += 12;

  // Bez punktów: jasny komunikat dlaczego
  if (s.punkty === null) {
    const tekst = `Zaświadczenie bez punktów edukacyjnych. ${s.powodBezPunktow ?? ""}`.trim();
    doc.font("Sans").fontSize(10);
    const h = doc.heightOfString(tekst, { width: P - 24 });
    doc.roundedRect(L, y, P, h + 20, 6).lineWidth(1).strokeColor(GREEN).stroke();
    doc.fillColor(INK).text(tekst, L + 12, y + 10, { width: P - 24 });
    y += h + 32;
  }

  // Stopka: QR, weryfikacja, data wydania, reklamacje
  const qrSize = 92;
  const yStopka = Math.max(y + 8, doc.page.height - doc.page.margins.bottom - qrSize - 8);
  doc.image(qr, L, yStopka, { width: qrSize, height: qrSize });
  const tx = L + qrSize + 16;
  const tw = P - qrSize - 16;
  doc.font("SansBold").fontSize(10).fillColor(INK).text(`Numer zaświadczenia: ${c.number}`, tx, yStopka, { width: tw });
  doc.font("Sans").fontSize(9.5).fillColor(INK).text(`Data wydania: ${dataPL(c.issuedAt)}`, { width: tw });
  doc.font("Sans").fontSize(9).fillColor(MUTED).text("Ważność sprawdzisz pod adresem:", { width: tw });
  doc.font("Sans").fontSize(9).fillColor(GREEN).text(url, { width: tw, link: url });
  const reklamacje = org?.reklamacje || org?.email;
  if (reklamacje) doc.font("Sans").fontSize(8.5).fillColor(MUTED).text(`Reklamacje i pytania: ${reklamacje}`, { width: tw });
  doc.font("Sans").fontSize(8).fillColor(MUTED).text("Dokument wygenerowany elektronicznie w serwisie helloEKG.", { width: tw });

  doc.end();
  return koniec;
}
