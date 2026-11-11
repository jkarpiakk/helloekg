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
import { oczyscTekst } from "@shared/szkolenie";
import { dataPL, etykietaGodzin, zawodZweryfikowany } from "./logika";

const require = createRequire(import.meta.url);
const FONT = require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans.ttf");
const FONT_BOLD = require.resolve("dejavu-fonts-ttf/ttf/DejaVuSans-Bold.ttf");

const INK = "#0B0F14";
const MUTED = "#5C6870";
const GREEN = "#0B7E54";
const LINE = "#D5DDD9";
const ALARM = "#C0392B";

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
  kierownikNaukowyTytul?: string;
  podpisujacy?: string;
  miejsce?: string;
  rodzaj?: "punkty" | "ukonczenie";
  pwzSprawdzonyAt?: string | null;
  zawodZweryfikowany?: boolean;
  etykietaGodzin?: string;
  podpisOrganizatora?: string | null;
  podpisKierownika?: string | null;
};

const liczba = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(".", ","));

/** Tekst na PDF: bez znaków sterujących i kierunku pisma, z limitem długości (dane sprzed walidacji też) */
export const tekstPdf = (v: unknown, max = 400): string => {
  const t = oczyscTekst(String(v ?? ""));
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t;
};

/** Wiersze tabeli zaświadczenia (etykieta, wartość) z kopii z chwili wydania; bez PDF, do testów */
export function wierszeZaswiadczenia(c: Pick<CmeCertificate, "kind" | "snapshot" | "ruleSnapshot">): Array<[string, string]> {
  const s = c.snapshot as unknown as Snapshot;
  const r = c.ruleSnapshot as Record<string, any>;
  const wiersze: Array<[string, string]> = [];
  const pole = (k: string) => (r[k] === null || r[k] === undefined || String(r[k]).trim() === "" ? null : tekstPdf(r[k]));
  const zweryfikowany = s.zawodZweryfikowany ?? zawodZweryfikowany(c.kind, c.snapshot as Record<string, unknown>);
  if (zweryfikowany) {
    wiersze.push(["Zawód", tekstPdf(s.zawodNazwa, 100)]);
    if (s.pwz) wiersze.push(["Numer prawa wykonywania zawodu", tekstPdf(s.pwz, 20)]);
    else if (s.zawod === "ratownik") wiersze.push(["Numer prawa wykonywania zawodu", "nie podano"]);
    if (s.specjalizacja) wiersze.push(["Specjalizacja", tekstPdf(s.specjalizacja, 200)]);
  } else {
    // ukończenie bez sprawdzonego PWZ: bez numeru PWZ, zawód tylko jako deklarowany
    wiersze.push(["Deklarowany zawód", tekstPdf(s.zawodNazwa, 100)]);
    if (s.specjalizacja) wiersze.push(["Deklarowana specjalizacja", tekstPdf(s.specjalizacja, 200)]);
  }
  wiersze.push(["Tytuł szkolenia", tekstPdf(s.tytul, 200)]);
  wiersze.push(["Forma kształcenia", tekstPdf(s.forma, 500)]);
  wiersze.push(["Miejsce", tekstPdf(s.miejsce || "online", 100)]);
  wiersze.push(["Termin", `od ${dataPL(new Date(s.dataRozpoczecia))} do ${dataPL(new Date(s.dataZakonczenia))}`]);
  wiersze.push([s.etykietaGodzin || etykietaGodzin(s.zawod), liczba(Number(s.godziny))]);
  if (s.wynikTestu?.procent !== null && s.wynikTestu?.procent !== undefined) {
    wiersze.push(["Test końcowy", `zaliczony, ${liczba(s.wynikTestu.procent)}% (${s.wynikTestu.wynik} z ${s.wynikTestu.maks})`]);
  }
  if (s.punkty !== null) {
    wiersze.push(["Punkty edukacyjne", liczba(s.punkty)]);
    if (pole("pointsFormula")) wiersze.push(["Sposób liczenia punktów", pole("pointsFormula")!]);
    if (pole("legalBasis")) wiersze.push(["Podstawa prawna", pole("legalBasis")!]);
    if (pole("nrlResolution")) wiersze.push(["Uchwała Naczelnej Rady Lekarskiej", pole("nrlResolution")!]);
    if (pole("registryNumber")) wiersze.push(["Numer wpisu do rejestru", pole("registryNumber")!]);
    if (pole("decisionNumber")) wiersze.push(["Decyzja o przyznaniu punktów", pole("decisionNumber")!]);
  }
  const org = s.organizator;
  const orgTekst = [org?.nazwa, org?.adres, org?.krs ? `KRS ${org.krs}` : "", org?.nip ? `NIP ${org.nip}` : ""].filter(Boolean).map((x) => tekstPdf(x, 300)).join(", ");
  wiersze.push(["Organizator", orgTekst || "helloEKG"]);
  if (s.kierownikNaukowy) wiersze.push(["Kierownik naukowy", tekstPdf([s.kierownikNaukowy, s.kierownikNaukowyTytul].filter(Boolean).join(", "), 300)]);
  return wiersze;
}

export async function pdfZaswiadczenia(c: CmeCertificate): Promise<Buffer> {
  const s = c.snapshot as unknown as Snapshot;
  const url = adresWeryfikacji(c.verificationToken);
  const qr = await QRCode.toBuffer(url, { margin: 0, width: 360, errorCorrectionLevel: "M", color: { dark: INK, light: "#FFFFFF" } });

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 48, bottom: 40, left: 56, right: 56 },
    info: { Title: `Zaświadczenie ${c.number}${c.valid ? "" : " (UNIEWAŻNIONE)"}`, Author: tekstPdf(s.organizator?.nazwa, 200) || "helloEKG", Subject: tekstPdf(s.tytul, 200), Creator: "helloEKG" },
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
  // Imię i nazwisko: zmniejszamy czcionkę, aż zmieści się w jednym wierszu (od 22 do 14 pt); dłuższe łamiemy na najwyżej 2 wiersze
  const nazwa = tekstPdf(`${s.imie} ${s.nazwisko}`, 130);
  let rozmiar = 22;
  doc.font("SansBold");
  while (rozmiar > 14 && doc.fontSize(rozmiar).widthOfString(nazwa) > P) rozmiar -= 1;
  doc.font("SansBold").fontSize(rozmiar).fillColor(INK).text(nazwa, { width: P, align: "center", height: rozmiar * 2.6, ellipsis: true });
  doc.moveDown(1);

  const yTabela = doc.y;
  const kolEt = 190;
  const qrSize = 84;
  const wysPodpisu = 66;
  const yStopka = doc.page.height - doc.page.margins.bottom - qrSize - 4;
  const yMaksTresci = yStopka - wysPodpisu - 20;

  // Bez punktów: jasny komunikat dlaczego (a przy niesprawdzonym zawodzie: że to dane deklarowane)
  const zweryfikowany = s.zawodZweryfikowany ?? zawodZweryfikowany(c.kind, c.snapshot as Record<string, unknown>);
  const ramka = s.punkty === null
    ? tekstPdf(`Zaświadczenie bez punktów edukacyjnych. ${s.powodBezPunktow ?? ""}${zweryfikowany ? "" : " Zawód podany przez uczestnika, niesprawdzony w rejestrze zawodowym."}`, 600)
    : null;

  // Kontrola przepełnienia: tabela i ramka muszą zmieścić się nad podpisami. Najpierw mniejsza czcionka,
  // potem skracanie najdłuższych pól (podstawa prawna, sposób liczenia, adres).
  let wiersze = wierszeZaswiadczenia(c);
  const wysokosc = (w: Array<[string, string]>, et: number, wart: number) => {
    let h = 0;
    for (const [e, v] of w) {
      doc.font("Sans").fontSize(et);
      const hEt = doc.heightOfString(e, { width: kolEt - 12 });
      doc.fontSize(wart);
      h += Math.max(hEt, doc.heightOfString(v, { width: P - kolEt })) + 9;
    }
    if (ramka) h += 12 + doc.font("Sans").fontSize(wart + 0.5).heightOfString(ramka, { width: P - 24 }) + 32;
    return h + 12;
  };
  let [fEt, fWart] = [8.5, 9.5];
  const miejsce = yMaksTresci - yTabela;
  for (const [e, v] of [[8.5, 9.5], [8, 9], [7.5, 8.5], [7, 8]] as const) {
    [fEt, fWart] = [e, v];
    if (wysokosc(wiersze, fEt, fWart) <= miejsce) break;
  }
  for (const limit of [240, 160, 100, 60]) {
    if (wysokosc(wiersze, fEt, fWart) <= miejsce) break;
    wiersze = wiersze.map(([e, v]) => [e, tekstPdf(v, limit)]);
  }

  let y = yTabela;
  for (const [et, wart] of wiersze) {
    doc.font("Sans").fontSize(fEt);
    const hEt = doc.heightOfString(et, { width: kolEt - 12 });
    doc.fontSize(fWart);
    const hW = doc.heightOfString(wart, { width: P - kolEt });
    const h = Math.max(hEt, hW);
    doc.moveTo(L, y).lineTo(L + P, y).lineWidth(0.5).strokeColor(LINE).stroke();
    doc.font("Sans").fontSize(fEt).fillColor(MUTED).text(et, L, y + 5, { width: kolEt - 12 });
    doc.font("Sans").fontSize(fWart).fillColor(INK).text(wart, L + kolEt, y + 4, { width: P - kolEt });
    y += h + 9;
  }
  doc.moveTo(L, y).lineTo(L + P, y).lineWidth(0.5).strokeColor(LINE).stroke();
  y += 12;

  if (ramka) {
    doc.font("Sans").fontSize(fWart + 0.5);
    const h = doc.heightOfString(ramka, { width: P - 24 });
    doc.roundedRect(L, y, P, h + 20, 6).lineWidth(1).strokeColor(GREEN).stroke();
    doc.fillColor(INK).text(ramka, L + 12, y + 10, { width: P - 24 });
    y += h + 32;
  }

  // Od tego miejsca nic nie może dodać strony (stopka jest blisko dolnego marginesu)
  doc.page.margins.bottom = 0;

  // Podpisy: organizator i kierownik naukowy (skan podpisu z panelu, gdy jest, i podpis drukowany)
  const org = s.organizator;
  const podpisy: Array<{ et: string; kto: string; obraz?: string | null }> = [
    { et: "Za organizatora", kto: tekstPdf(s.podpisujacy || org?.nazwa || "", 120), obraz: s.podpisOrganizatora },
    { et: "Kierownik naukowy", kto: tekstPdf([s.kierownikNaukowy, s.kierownikNaukowyTytul].filter(Boolean).join(", "), 120), obraz: s.podpisKierownika },
  ];
  const yPodpisy = Math.min(Math.max(y + 6, yStopka - wysPodpisu - 14), yStopka - wysPodpisu - 4);
  const kol = (P - 24) / 2;
  podpisy.forEach((p, i) => {
    const x = L + i * (kol + 24);
    if (p.obraz) {
      try {
        doc.image(Buffer.from(p.obraz, "base64"), x, yPodpisy, { fit: [kol, 36], align: "center" });
      } catch {
        /* uszkodzony obraz: zostaje podpis drukowany */
      }
    }
    doc.moveTo(x, yPodpisy + 40).lineTo(x + kol, yPodpisy + 40).lineWidth(0.5).strokeColor(MUTED).stroke();
    doc.font("Sans").fontSize(8.5).fillColor(INK).text(p.kto || " ", x, yPodpisy + 44, { width: kol, align: "center", height: 12, ellipsis: true });
    doc.font("Sans").fontSize(7.5).fillColor(MUTED).text(p.et, x, yPodpisy + 57, { width: kol, align: "center" });
  });

  // Stopka: QR, weryfikacja, data wydania, reklamacje
  doc.image(qr, L, yStopka, { width: qrSize, height: qrSize });
  const tx = L + qrSize + 16;
  const tw = P - qrSize - 16;
  doc.font("SansBold").fontSize(10).fillColor(INK).text(`Numer zaświadczenia: ${c.number}`, tx, yStopka, { width: tw });
  doc.font("Sans").fontSize(9.5).fillColor(INK).text(`Data wydania: ${dataPL(c.issuedAt)}`, { width: tw });
  doc.font("Sans").fontSize(9).fillColor(MUTED).text("Ważność sprawdzisz pod adresem:", { width: tw });
  doc.font("Sans").fontSize(9).fillColor(GREEN).text(url, { width: tw, link: url });
  const reklamacje = tekstPdf(org?.reklamacje || org?.email, 90);
  if (reklamacje) doc.font("Sans").fontSize(8.5).fillColor(MUTED).text(`Reklamacje i pytania: ${reklamacje}`, { width: tw, height: 11, ellipsis: true });
  doc.font("Sans").fontSize(8).fillColor(MUTED).text("Dokument wygenerowany elektronicznie w serwisie helloEKG.", { width: tw });

  // Unieważnione: wyraźny znak na całej stronie, z datą i powodem
  if (!c.valid) {
    const kiedy = c.invalidatedAt ? dataPL(c.invalidatedAt) : "";
    doc.save();
    doc.rotate(-30, { origin: [W / 2, doc.page.height / 2] });
    doc.font("SansBold").fontSize(64).fillColor(ALARM).fillOpacity(0.28)
      .text("UNIEWAŻNIONE", 0, doc.page.height / 2 - 40, { width: W, align: "center", lineBreak: false });
    doc.restore();
    const opis = tekstPdf(`Zaświadczenie unieważnione${kiedy ? ` ${kiedy}` : ""}.${c.invalidatedReason ? ` Powód: ${c.invalidatedReason}` : ""}`, 200);
    doc.font("SansBold").fontSize(10).fillColor(ALARM).fillOpacity(1).text(opis, L, 30, { width: P, align: "center", height: 14, ellipsis: true });
  }

  doc.end();
  return koniec;
}
