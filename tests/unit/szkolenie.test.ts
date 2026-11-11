/**
 * Szkolenie z punktami: losowanie testu, ocena, podejścia i przerwa, anonimowość ankiety,
 * numeracja i weryfikacja zaświadczeń, reguły punktów, walidacja PWZ.
 * Dane wyłącznie fikcyjne (numery PWZ wyliczone z algorytmu, nie prawdziwe osoby).
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { getTableColumns } from "drizzle-orm";
import {
  czyNumerZaswiadczenia,
  kluczWeryfikacji,
  losujTest,
  NUMER_WPISU_RE,
  ostatniRokPrzechowywania,
  poTerminie,
  powodOdrzuceniaPytaniaTestu,
  przechowywanieMinelo,
  terminOddania,
  numerZaswiadczenia,
  obliczPunkty,
  ocenTest,
  podzialProporcjonalny,
  regulaDziala,
  rokWPolsce,
  stanPodejsc,
  tokenWeryfikacji,
  widokWeryfikacji,
  type PytanieWPuli,
  type RegulaPunktow,
} from "../../server/szkolenie/logika";
import { komorkaCsv } from "../../server/szkolenie/csv";
import { cmeSurveyResponses } from "../../shared/schema";
import {
  ANKIETA_DOMYSLNA,
  inicjaly,
  problemPwzLekarza,
  sprawdzOdpowiedziAnkiety,
  sprawdzPwz,
} from "../../shared/szkolenie";

/** Generator liczb pseudolosowych z ziarnem (powtarzalne testy) */
function ziarno(s: number) {
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

/** Pula jak w paczce 11.11: 50 pytań w 7 modułach, kilka wykładów w każdym */
function pula(): PytanieWPuli[] {
  const rozklad: Array<[string, number[]]> = [
    ["S1", [3, 2, 2]], // 7
    ["S2", [2, 2, 2, 2]], // 8
    ["S3", [3, 2, 2]], // 7
    ["S4", [2, 2, 2]], // 6
    ["S5", [2, 2, 2]], // 6
    ["S6", [3, 3, 2]], // 8
    ["S7", [2, 2, 2, 2]], // 8
  ];
  const wynik: PytanieWPuli[] = [];
  for (const [m, wyklady] of rozklad) {
    wyklady.forEach((ile, w) => {
      for (let i = 0; i < ile; i++) {
        const ext = `T-${m}-${w + 1}-${i + 1}`;
        wynik.push({ id: `id-${ext}`, externalId: ext, sectionId: `${m}_0${w + 1}`, moduleId: m, excludes: [] });
      }
    });
  }
  return wynik;
}

describe("losowanie testu", () => {
  it("losuje 40 z 50 bez powtórzeń, tylko z puli", () => {
    const p = pula();
    expect(p).toHaveLength(50);
    const w = losujTest(p, 40, ziarno(1));
    expect(w).toHaveLength(40);
    expect(new Set(w.map((q) => q.id)).size).toBe(40);
    const ids = new Set(p.map((q) => q.id));
    expect(w.every((q) => ids.has(q.id))).toBe(true);
  });

  it("co najmniej 1 pytanie z każdego wykładu", () => {
    const p = pula();
    const wyklady = new Set(p.map((q) => q.sectionId));
    for (let s = 1; s <= 50; s++) {
      const w = losujTest(p, 40, ziarno(s));
      const trafione = new Set(w.map((q) => q.sectionId));
      expect(trafione.size).toBe(wyklady.size);
    }
  });

  it("proporcje modułów (największe reszty), odchylenie najwyżej 1 pytanie", () => {
    const p = pula();
    const rozmiary = new Map<string, number>();
    for (const q of p) rozmiary.set(q.moduleId, (rozmiary.get(q.moduleId) ?? 0) + 1);
    for (let s = 1; s <= 30; s++) {
      const w = losujTest(p, 40, ziarno(s));
      for (const [m, n] of Array.from(rozmiary.entries())) {
        const ile = w.filter((q) => q.moduleId === m).length;
        expect(Math.abs(ile - (40 * n) / 50)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("gdy wykładów jest więcej niż pytań, nie wymusza minimum, ale trzyma liczbę", () => {
    const w = losujTest(pula(), 10, ziarno(3));
    expect(w).toHaveLength(10);
  });

  it("podział proporcjonalny sumuje się do n", () => {
    expect(podzialProporcjonalny(40, [7, 8, 7, 6, 6, 8, 8]).reduce((a, b) => a + b, 0)).toBe(40);
    expect(podzialProporcjonalny(3, [1, 1, 1, 1])).toEqual([1, 1, 1, 0]);
    expect(podzialProporcjonalny(5, [0, 0])).toEqual([0, 0]);
  });

  it("reguła „wyklucza” w obie strony: para nigdy razem", () => {
    const p = pula();
    // T-S1-1-1 wyklucza T-S1-1-2; T-S2-1-2 jest wykluczane przez T-S2-1-1 (zapis tylko po jednej stronie)
    p.find((q) => q.externalId === "T-S1-1-1")!.excludes = ["T-S1-1-2", "T-S1-1-3"];
    p.find((q) => q.externalId === "T-S2-1-1")!.excludes = ["T-S2-1-2"];
    for (let s = 1; s <= 200; s++) {
      const w = new Set(losujTest(p, 45, ziarno(s)).map((q) => q.externalId));
      expect(w.has("T-S1-1-1") && (w.has("T-S1-1-2") || w.has("T-S1-1-3"))).toBe(false);
      expect(w.has("T-S2-1-1") && w.has("T-S2-1-2")).toBe(false);
    }
  });

  it("wykład z jedynym pytaniem wykluczanym przez pytanie innego wykładu: zawsze pokryty (kształt puli 11.11)", () => {
    // jak w prawdziwej puli: S3_02 ma jedno pytanie (Q-TEST-S3-02), w parze „wyklucza” z Q-TEST-S1-07 (inny wykład)
    const p = pula().filter((q) => !(q.sectionId === "S3_02" && q.externalId !== "T-S3-2-1"));
    const s302 = p.find((q) => q.externalId === "T-S3-2-1")!;
    s302.externalId = "Q-TEST-S3-02";
    const s107 = p.find((q) => q.externalId === "T-S1-1-3")!;
    s107.externalId = "Q-TEST-S1-07";
    s107.excludes = ["Q-TEST-S3-02"];
    expect(p.filter((q) => q.sectionId === "S3_02")).toHaveLength(1);
    const wyklady = new Set(p.map((q) => q.sectionId));
    for (let s = 1; s <= 1000; s++) {
      const w = losujTest(p, 40, ziarno(s));
      expect(w).toHaveLength(40);
      const ext = new Set(w.map((q) => q.externalId));
      expect(new Set(w.map((q) => q.sectionId)).size).toBe(wyklady.size);
      expect(ext.has("Q-TEST-S3-02")).toBe(true);
      expect(ext.has("Q-TEST-S1-07")).toBe(false);
    }
  });

  it("wykluczenie zapisane po stronie jedynego pytania wykładu: też pokryty", () => {
    const p = pula().filter((q) => !(q.sectionId === "S5_03" && q.externalId !== "T-S5-3-1"));
    p.find((q) => q.externalId === "T-S5-3-1")!.excludes = ["T-S2-4-1", "T-S2-4-2"]; // oba pytania wykładu S2_04
    for (let s = 1; s <= 500; s++) {
      const w = losujTest(p, 40, ziarno(s));
      const sekcje = new Set(w.map((q) => q.sectionId));
      // S5_03 i S2_04 nie mogą być pokryte razem: wtedy wygrywa jeden z nich, ale wszystkie inne wykłady są
      expect(sekcje.size).toBeGreaterThanOrEqual(new Set(p.map((q) => q.sectionId)).size - 1);
      const ext = new Set(w.map((q) => q.externalId));
      expect(ext.has("T-S5-3-1") && (ext.has("T-S2-4-1") || ext.has("T-S2-4-2"))).toBe(false);
    }
  });

  it("wykluczenia zmniejszające pulę: bierze tyle, ile się da", () => {
    const p = pula().slice(0, 3).map((q) => ({ ...q, sectionId: "S1_01" }));
    p[0].excludes = [p[1].externalId!, p[2].externalId!];
    const w = losujTest(p, 3, ziarno(9));
    expect(w.length).toBeGreaterThanOrEqual(1);
    expect(w.length).toBeLessThanOrEqual(2);
  });

  it("każde podejście to nowe losowanie (inna kolejność albo zestaw)", () => {
    const a = losujTest(pula(), 40, ziarno(11)).map((q) => q.id).join();
    const b = losujTest(pula(), 40, ziarno(12)).map((q) => q.id).join();
    expect(a).not.toBe(b);
  });
});

describe("ocena testu", () => {
  const pytania = [
    { id: "a", externalId: "T-1", answers: [{ text: "x", isCorrect: false }, { text: "y", isCorrect: true }] },
    { id: "b", externalId: "T-2", answers: [{ text: "x", isCorrect: true }, { text: "y", isCorrect: false }, { text: "z", isCorrect: false }] },
    { id: "c", externalId: "T-3", answers: [{ text: "x", isCorrect: false }, { text: "y", isCorrect: false }, { text: "z", isCorrect: true }] },
  ];

  it("ocenia po indeksie odpowiedzi w bazie, nie po pozycji na ekranie", () => {
    const w = ocenTest(pytania, { a: 1, b: 0, c: 0 }, 70);
    expect(w.wynik).toBe(2);
    expect(w.oceny.find((o) => o.questionId === "c")).toMatchObject({ chosen: 0, correct: [2], ok: false });
  });

  it("próg 70%: 2/3 (66,67%) nie zalicza, 3/3 zalicza", () => {
    expect(ocenTest(pytania, { a: 1, b: 0, c: 0 }, 70)).toMatchObject({ procent: 66.67, zaliczony: false });
    expect(ocenTest(pytania, { a: 1, b: 0, c: 2 }, 70)).toMatchObject({ procent: 100, zaliczony: true });
  });

  it("dokładnie na progu zalicza (28/40 = 70%)", () => {
    const qs = Array.from({ length: 40 }, (_, i) => ({ id: `q${i}`, externalId: null, answers: [{ text: "a", isCorrect: true }, { text: "b", isCorrect: false }] }));
    const odp = Object.fromEntries(qs.map((q, i) => [q.id, i < 28 ? 0 : 1]));
    expect(ocenTest(qs, odp, 70)).toMatchObject({ wynik: 28, procent: 70, zaliczony: true });
  });

  it("brak odpowiedzi, indeks spoza listy, tekst albo ułamek = błędna", () => {
    const w = ocenTest(pytania, { a: 7, b: "0", c: 1.5 } as Record<string, unknown>, 70);
    expect(w.wynik).toBe(0);
    expect(w.oceny.every((o) => o.chosen === null)).toBe(true);
  });

  it("pytanie usunięte (bez odpowiedzi) liczy się jako błędne, nie zmniejsza maksimum", () => {
    const w = ocenTest([...pytania, { id: "d", externalId: null, answers: [] }], { a: 1, b: 0, c: 2, d: 0 }, 70);
    expect(w).toMatchObject({ wynik: 3, maks: 4 });
  });
});

describe("podejścia i przerwa", () => {
  const z = { limit: 3, przerwaPo: 2, przerwaGodziny: 24 };
  const t0 = new Date("2026-11-11T10:00:00Z");
  const h = (n: number) => new Date(t0.getTime() + n * 3600_000);

  it("pierwsze podejście: można", () => {
    expect(stanPodejsc([], t0, z)).toMatchObject({ stan: "mozna", wykorzystane: 0, pozostale: 3 });
  });

  it("po pierwszym niezaliczonym: bez przerwy", () => {
    expect(stanPodejsc([{ submittedAt: t0, passed: false }], h(0.1), z)).toMatchObject({ stan: "mozna", pozostale: 2 });
  });

  it("po drugim niezaliczonym: przerwa 24 h, potem można", () => {
    const p = [{ submittedAt: t0, passed: false }, { submittedAt: h(1), passed: false }];
    const s = stanPodejsc(p, h(2), z);
    expect(s.stan).toBe("przerwa");
    if (s.stan === "przerwa") expect(s.od.toISOString()).toBe(h(25).toISOString());
    expect(stanPodejsc(p, h(25), z)).toMatchObject({ stan: "mozna", pozostale: 1 });
  });

  it("po trzecim niezaliczonym: wyczerpane", () => {
    const p = [{ submittedAt: t0, passed: false }, { submittedAt: h(1), passed: false }, { submittedAt: h(30), passed: false }];
    expect(stanPodejsc(p, h(100), z)).toMatchObject({ stan: "wyczerpane", pozostale: 0 });
  });

  it("zaliczony kończy podejścia", () => {
    expect(stanPodejsc([{ submittedAt: t0, passed: false }, { submittedAt: h(1), passed: true }], h(2), z).stan).toBe("zaliczony");
  });

  it("rozpoczęte, nieoddane: w toku (liczy się jako wykorzystane)", () => {
    expect(stanPodejsc([{ submittedAt: null, passed: null }], t0, z)).toMatchObject({ stan: "w_toku", wykorzystane: 1, pozostale: 2 });
  });

  it("liczby z konfiguracji: limit 5, przerwa po 1. porażce, 2 h", () => {
    const zz = { limit: 5, przerwaPo: 1, przerwaGodziny: 2 };
    expect(stanPodejsc([{ submittedAt: t0, passed: false }], h(1), zz).stan).toBe("przerwa");
    expect(stanPodejsc([{ submittedAt: t0, passed: false }], h(2), zz).stan).toBe("mozna");
  });
});

describe("ankieta anonimowa", () => {
  it("tabela odpowiedzi nie ma kolumny user_id ani participant_id (schemat Drizzle)", () => {
    const kolumny = Object.values(getTableColumns(cmeSurveyResponses)).map((c) => c.name);
    expect(kolumny).not.toContain("user_id");
    expect(kolumny).not.toContain("participant_id");
    expect(kolumny.some((k) => /user|participant|email|enrollment/i.test(k))).toBe(false);
    // bez dokładnej godziny: tylko miesiąc
    expect(kolumny).toContain("month");
    expect(kolumny.some((k) => /_at$|time|date/i.test(k))).toBe(false);
  });

  it("migracja tworzy cme_survey_responses bez user_id", () => {
    const sqlTxt = fs.readFileSync(path.resolve(__dirname, "../../migrations/2026-11-11-punkty.sql"), "utf8");
    const m = sqlTxt.match(/CREATE TABLE IF NOT EXISTS cme_survey_responses \(([\s\S]*?)\);/);
    expect(m).not.toBeNull();
    expect(m![1]).not.toMatch(/user_id|participant_id|timestamptz/);
  });

  it("walidacja odpowiedzi: wymagane, skala od 1 do 5, tak/nie, tekst opcjonalny", () => {
    const ok = {
      nowa_wiedza: true, oparta_na_faktach: true, w_praktyce: true, korzysc_pacjentow: true, bez_reklamy: true,
      ocena_ogolna: 5, organizacja: 4, materialy: 4, test: 3, polecenie: true,
    };
    expect(sprawdzOdpowiedziAnkiety(ANKIETA_DOMYSLNA, ok)).toMatchObject({ odpowiedzi: { ...ok, uwagi: null, najslabsze: null, najmocniejsze: null } });
    expect("blad" in sprawdzOdpowiedziAnkiety(ANKIETA_DOMYSLNA, { ...ok, ocena_ogolna: 6 })).toBe(true);
    expect("blad" in sprawdzOdpowiedziAnkiety(ANKIETA_DOMYSLNA, { ...ok, bez_reklamy: "tak" })).toBe(true);
    expect("blad" in sprawdzOdpowiedziAnkiety(ANKIETA_DOMYSLNA, { ...ok, polecenie: undefined })).toBe(true);
    // nadmiarowe pola (np. próba dopisania user_id) nie trafiają do zapisu
    const w = sprawdzOdpowiedziAnkiety(ANKIETA_DOMYSLNA, { ...ok, user_id: "x" });
    expect("odpowiedzi" in w && !("user_id" in w.odpowiedzi)).toBe(true);
  });

  it("ankieta startowa ma pytania z wzoru NIL, w tym o reklamę i stronniczość", () => {
    const tresci = ANKIETA_DOMYSLNA.pytania.map((p) => p.tresc);
    expect(tresci).toContain("Czy treści kształcenia były wolne od reklamy i stronniczości?");
    for (const id of ["nowa_wiedza", "oparta_na_faktach", "w_praktyce", "korzysc_pacjentow", "najslabsze", "najmocniejsze", "organizacja"]) {
      expect(ANKIETA_DOMYSLNA.pytania.some((p) => p.id === id)).toBe(true);
    }
  });
});

describe("numeracja i weryfikacja zaświadczeń", () => {
  it("format HE-RRRR-NNNNNN", () => {
    expect(numerZaswiadczenia(2026, 1)).toBe("HE-2026-000001");
    expect(numerZaswiadczenia(2027, 123456)).toBe("HE-2027-123456");
    expect(() => numerZaswiadczenia(2026, 0)).toThrow();
    expect(() => numerZaswiadczenia(2026, 1_000_000)).toThrow();
  });

  it("rozpoznaje tylko poprawne numery (ochrona trasy weryfikacji)", () => {
    expect(czyNumerZaswiadczenia("HE-2026-000001")).toBe(true);
    for (const z of ["HE-2026-1", "he-2026-000001", "HE-2026-000001 ", "EKG-ABCDEF12-34567890", "../HE-2026-000001", 42]) {
      expect(czyNumerZaswiadczenia(z)).toBe(false);
    }
  });

  it("rok numeracji w strefie Polski (31.12, 23:30 UTC to już nowy rok)", () => {
    expect(rokWPolsce(new Date("2026-12-31T23:30:00Z"))).toBe(2027);
    expect(rokWPolsce(new Date("2026-12-31T22:30:00Z"))).toBe(2026);
  });

  it("publiczna weryfikacja: tylko inicjały, bez PWZ, zawodu i pełnego nazwiska", () => {
    const v = widokWeryfikacji({
      number: "HE-2026-000007",
      valid: true,
      issuedAt: new Date("2026-11-11T12:00:00Z"),
      snapshot: { imie: "Testowa Anna", nazwisko: "Przykładowa-Nowak", pwz: "3123456", zawod: "ratownik", tytul: "Kurs EKG" },
    }, inicjaly);
    expect(v).toEqual({ numer: "HE-2026-000007", wazne: true, tytul: "Kurs EKG", dataWydania: "11.11.2026", inicjaly: "T. A. P.-N." });
    expect(JSON.stringify(v)).not.toMatch(/3123456|ratownik|Przykładowa/);
  });

  it("klucz weryfikacji: 128 losowych bitów (base64url), za każdym razem inny", () => {
    const klucze = Array.from({ length: 2000 }, () => tokenWeryfikacji());
    expect(new Set(klucze).size).toBe(klucze.length);
    for (const k of klucze) {
      expect(k).toMatch(/^[A-Za-z0-9_-]{22}$/);
      expect(Buffer.from(k, "base64url")).toHaveLength(16);
    }
    // bez wzoru: znaki rozłożone po całym alfabecie (pierwsza pozycja przyjmuje wiele wartości)
    expect(new Set(klucze.map((k) => k[0])).size).toBeGreaterThan(40);
  });

  it("publiczne wyszukiwanie: sam numer HE-… nie jest kluczem (nie da się wyliczać zaświadczeń)", () => {
    expect(kluczWeryfikacji("HE-2026-000001")).toBeNull();
    expect(kluczWeryfikacji("HE-2026-000001/x")).toBeNull();
    expect(kluczWeryfikacji("")).toBeNull();
    expect(kluczWeryfikacji(undefined)).toBeNull();
    expect(kluczWeryfikacji("a".repeat(23))).toBeNull();
    const k = tokenWeryfikacji();
    expect(kluczWeryfikacji(k)).toBe(k);
  });

  it("unieważnione zaświadczenie: ważne = false", () => {
    const v = widokWeryfikacji({ number: "HE-2026-000008", valid: false, issuedAt: new Date(), snapshot: { imie: "Ła", nazwisko: "Żó" } }, inicjaly);
    expect(v.wazne).toBe(false);
    expect(v.inicjaly).toBe("Ł. Ż.");
  });
});

describe("reguły punktów", () => {
  const baza = {
    pointsPerHour: 0, pointsGranted: null, maxPoints: null, minHours: null, testRequired: true, registryRequired: false,
    registryNumber: null, nrlResolution: null, formInfoAcceptedAt: null, decisionNumber: null, inactiveReason: null,
  };
  const ratownik: RegulaPunktow = { ...baza, profession: "ratownik", active: true, pointsMode: "godziny", pointsPerHour: 1, maxPoints: 10, minHours: 4 };
  const lekarz: RegulaPunktow = {
    ...baza, profession: "lekarz", active: false, pointsMode: "decyzja", registryRequired: true,
    inactiveReason: "Szkolenie czeka na akceptację NRL i wpis do rejestru.",
  };
  const lekarzKomplet: RegulaPunktow = {
    ...lekarz, active: true, inactiveReason: null, pointsGranted: 40, nrlResolution: "TEST-NRL/1", registryNumber: "26-123456-003-0001", formInfoAcceptedAt: "2026-12-01",
  };
  const pielegniarka: RegulaPunktow = { ...baza, profession: "pielegniarka", active: false, pointsMode: "decyzja", inactiveReason: "Czeka na decyzję NRPiP." };

  it("ratownik: 1 pkt za godzinę dydaktyczną, 53 h daje najwyżej 10 punktów", () => {
    expect(obliczPunkty(ratownik, 53, true)).toEqual({ punkty: 10, powod: null });
  });

  it("ratownik: krócej niż 4 h, bez punktów; 5 h = 5 punktów", () => {
    expect(obliczPunkty(ratownik, 3, true).punkty).toBeNull();
    expect(obliczPunkty(ratownik, 5, true)).toEqual({ punkty: 5, powod: null });
  });

  it("test wymagany: bez zaliczenia brak punktów", () => {
    expect(obliczPunkty(ratownik, 53, false).punkty).toBeNull();
  });

  it("lekarz nieaktywny bez numeru rejestru: bez punktów, z powodem", () => {
    expect(regulaDziala(lekarz)).toBe(false);
    expect(obliczPunkty(lekarz, 53, true)).toEqual({ punkty: null, powod: "Szkolenie czeka na akceptację NRL i wpis do rejestru." });
  });

  it("lekarz: reguła działa dopiero z uchwałą NRL, numerem wpisu i datą przyjęcia informacji o formie", () => {
    expect(regulaDziala(lekarzKomplet)).toBe(true);
    expect(regulaDziala({ ...lekarzKomplet, nrlResolution: null })).toBe(false);
    expect(regulaDziala({ ...lekarzKomplet, registryNumber: null })).toBe(false);
    expect(regulaDziala({ ...lekarzKomplet, formInfoAcceptedAt: " " })).toBe(false);
    expect(regulaDziala({ ...lekarzKomplet, registryNumber: "26/123456/003/0001" })).toBe(false); // zły format
    expect(regulaDziala({ ...lekarzKomplet, active: false })).toBe(false);
  });

  it("lekarz: punkty z uchwały NRL (wartość przyznana), nie liczone z godzin", () => {
    expect(obliczPunkty(lekarzKomplet, 53, true)).toEqual({ punkty: 40, powod: null });
    expect(obliczPunkty({ ...lekarzKomplet, pointsGranted: null }, 53, true).punkty).toBeNull();
  });

  it("pielęgniarka: nieaktywna do decyzji NRPiP; z decyzją i przyznanymi punktami działa", () => {
    expect(obliczPunkty(pielegniarka, 53, true)).toEqual({ punkty: null, powod: "Czeka na decyzję NRPiP." });
    const zDecyzja = { ...pielegniarka, active: true, inactiveReason: null, decisionNumber: "TEST/2026/1", pointsGranted: 30 };
    expect(obliczPunkty(zDecyzja, 53, true)).toEqual({ punkty: 30, powod: null });
    expect(regulaDziala({ ...zDecyzja, decisionNumber: null })).toBe(false);
  });

  it("student / brak reguły: bez punktów", () => {
    expect(obliczPunkty(null, 53, true).punkty).toBeNull();
    const student = { ...ratownik, profession: "student", active: false, pointsPerHour: 0, maxPoints: null, minHours: null, inactiveReason: "Bez punktów." };
    expect(obliczPunkty(student, 53, true)).toEqual({ punkty: null, powod: "Bez punktów." });
  });

  it("format numeru wpisu RR-NNNNNN-00X-ZZZZ", () => {
    expect(NUMER_WPISU_RE.test("26-123456-003-0001")).toBe(true);
    expect(NUMER_WPISU_RE.test("26-123456-013-0001")).toBe(false);
    expect(NUMER_WPISU_RE.test("2026-123456-003-0001")).toBe(false);
  });
});

describe("walidacja PWZ", () => {
  /** Fikcyjny numer z poprawną cyfrą kontrolną dla 6 cyfr */
  const zKontrolna = (szesc: string) => {
    const d = szesc.split("").map(Number);
    const k = d.reduce((a, x, i) => a + (i + 1) * x, 0) % 11;
    return k === 10 ? null : `${k}${szesc}`;
  };

  it("lekarz: przykład NIL 5425740 poprawny, 5425741 i 0425740 błędne", () => {
    expect(problemPwzLekarza("5425740")).toBeNull();
    expect(problemPwzLekarza("5425741")).toMatch(/kontrolna/);
    expect(problemPwzLekarza("0425740")).toMatch(/zera/);
    expect(zKontrolna("123456")).toBe("3123456");
    expect(problemPwzLekarza("3123456")).toBeNull();
  });

  it("lekarz: długość, litery, wynik 10", () => {
    expect(problemPwzLekarza("312345")).toMatch(/7 cyfr/);
    expect(problemPwzLekarza("31234X6")).toMatch(/7 cyfr/);
    const szesc = Array.from({ length: 1_000 }, (_, i) => String(100000 + i)).find((s) => zKontrolna(s) === null)!;
    for (let k = 1; k <= 9; k++) expect(problemPwzLekarza(`${k}${szesc}`)).not.toBeNull();
  });

  it("lekarz i lekarz dentysta: walidacja twarda (błąd blokuje zapis)", () => {
    expect(sprawdzPwz("lekarz", "4123456").blad).toMatch(/kontrolna/);
    expect(sprawdzPwz("lekarz_dentysta", "5425740")).toEqual({ blad: null, pwz: "5425740" });
  });

  it("pielęgniarka i położna: 7 cyfr + obowiązkowa litera P/A zgodna z zawodem", () => {
    expect(sprawdzPwz("pielegniarka", "1234567p")).toEqual({ blad: null, pwz: "1234567P" });
    expect(sprawdzPwz("polozna", "1234567A")).toEqual({ blad: null, pwz: "1234567A" });
    expect(sprawdzPwz("pielegniarka", "1234567A").blad).toMatch(/nie pasuje do zawodu/);
    expect(sprawdzPwz("polozna", "1234567P").blad).toMatch(/nie pasuje do zawodu/);
    expect(sprawdzPwz("pielegniarka", "1234567").blad).not.toBeNull(); // bez litery
    expect(sprawdzPwz("polozna", "123456A").blad).not.toBeNull(); // 6 cyfr
  });

  it("ratownik: dowolny numer bez walidacji formatu albo „nie mam jeszcze numeru”", () => {
    expect(sprawdzPwz("ratownik", "000123")).toEqual({ blad: null, pwz: "000123" });
    expect(sprawdzPwz("ratownik", "R/123").blad).not.toBeNull(); // tylko cyfry i litery
    expect(sprawdzPwz("ratownik", "RM12A")).toEqual({ blad: null, pwz: "RM12A" });
    expect(sprawdzPwz("ratownik", "", { brakNumeru: true })).toEqual({ blad: null, pwz: null });
    expect(sprawdzPwz("ratownik", "").blad).not.toBeNull();
  });

  it("student i inny bez numeru", () => {
    expect(sprawdzPwz("student", "")).toEqual({ blad: null, pwz: null });
    expect(sprawdzPwz("inny", "123")).toEqual({ blad: null, pwz: null });
  });

  it("spacje usuwane, znaki specjalne odrzucane", () => {
    expect(sprawdzPwz("lekarz", " 542 5740 ").pwz).toBe("5425740");
    expect(sprawdzPwz("ratownik", "12;DROP").blad).not.toBeNull();
  });
});

describe("test: pula, limit czasu, przechowywanie", () => {
  const odp = (n: number, poprawne: number[]) => Array.from({ length: n }, (_, i) => ({ text: `o${i}`, isCorrect: poprawne.includes(i) }));

  it("do testu tylko pytania jednokrotnego wyboru z co najmniej 5 odpowiedziami i dokładnie 1 poprawną", () => {
    expect(powodOdrzuceniaPytaniaTestu({ questionType: "multiple_choice", answers: odp(5, [2]) })).toBeNull();
    expect(powodOdrzuceniaPytaniaTestu({ questionType: "multiple_choice", answers: odp(4, [1]) })).toMatch(/co najmniej 5/);
    expect(powodOdrzuceniaPytaniaTestu({ questionType: "multiple_choice", answers: odp(5, [1, 2]) })).toMatch(/dokładnie 1/);
    expect(powodOdrzuceniaPytaniaTestu({ questionType: "multiple_choice", answers: odp(5, []) })).toMatch(/dokładnie 1/);
    expect(powodOdrzuceniaPytaniaTestu({ questionType: "matching", answers: odp(5, [0]) })).not.toBeNull();
  });

  it("limit czasu: termin = start + limit; po terminie i 2 min zapasu podejście się zamyka", () => {
    const start = new Date("2026-11-11T10:00:00Z");
    const t = terminOddania(start, 90)!;
    expect(t.toISOString()).toBe("2026-11-11T11:30:00.000Z");
    expect(poTerminie(t, new Date("2026-11-11T11:31:59Z"))).toBe(false);
    expect(poTerminie(t, new Date("2026-11-11T11:32:01Z"))).toBe(true);
    expect(terminOddania(start, 0)).toBeNull();
    expect(poTerminie(null, new Date("2030-01-01"))).toBe(false);
  });

  it("przechowywanie 5 lat od końca roku wydania (2.01.2026 → do 31.12.2031)", () => {
    const w = new Date("2026-01-02T10:00:00Z");
    expect(ostatniRokPrzechowywania(w)).toBe(2031);
    expect(przechowywanieMinelo([w], new Date("2031-12-31T20:00:00Z"))).toBe(false);
    expect(przechowywanieMinelo([w], new Date("2031-12-31T23:30:00Z"))).toBe(true); // już 1.01.2032 w Polsce
    expect(przechowywanieMinelo([w, new Date("2028-05-01T10:00:00Z")], new Date("2032-06-01"))).toBe(false); // liczy najpóźniejsze
    expect(przechowywanieMinelo([], new Date())).toBe(true); // bez zaświadczenia: nic do przechowywania
  });
});

describe("lista obecności CSV", () => {
  it("bez formuł i z cudzysłowami", () => {
    expect(komorkaCsv("=HYPERLINK(1)")).toBe("'=HYPERLINK(1)");
    expect(komorkaCsv("Nowak; Anna")).toBe('"Nowak; Anna"');
    expect(komorkaCsv('a"b')).toBe('"a""b"');
    expect(komorkaCsv(null)).toBe("");
  });
});
