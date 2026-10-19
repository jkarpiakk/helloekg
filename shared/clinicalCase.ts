/**
 * Przypadek kliniczny („clinical_case") — kontrakt 1:1 ze studiem
 * (helloekg-studio/shared/src/questions.ts → clinicalCaseConfigSchema).
 *
 * Przypadek = scenariusz (pacjent, godzina, parametry) + opcjonalny zapis EKG
 * + 2–5 kroków odsłanianych po kolei. Krok to proste pytanie: jedna poprawna
 * odpowiedź albo wskazanie miejsca na zapisie przypadku. Każdy krok ma własne
 * wyjaśnienie, a na końcu jest „złota rada z dyżuru".
 *
 * Wynik = odsetek trafionych kroków (wynik częściowy jak w drag&drop).
 *
 * Typy żyją osobno, bo shared/schema.ts edytują równolegle inne zmiany.
 * Gdy unia QuestionConfig w schema.ts dostanie wariant clinical_case,
 * `AnyQuestionConfig` i `AnyAnswerData` dalej działają bez zmian.
 */
import type { AnswerData, HotspotConfig, QuestionConfig } from "./schema";

export interface ClinicalCaseVital {
  label: string;
  value: string;
}

export interface ClinicalCaseStepSingle {
  id: string;
  kind: "single";
  prompt: string; // Markdown
  answers: Array<{ text: string; isCorrect: boolean }>;
  explanation: string; // Markdown
}

export interface ClinicalCaseStepHotspot {
  id: string;
  kind: "hotspot";
  prompt: string;
  /** Współrzędne w % obrazu przypadku (0–100); rect = [lewo, góra, prawo, dół] */
  hotspots: HotspotConfig["hotspots"];
  explanation: string;
}

export type ClinicalCaseStep = ClinicalCaseStepSingle | ClinicalCaseStepHotspot;

export interface ClinicalCaseConfig {
  intro: string; // Markdown — scenariusz
  timeLabel?: string; // np. „03:12"
  place?: string; // np. „SOR"
  vitals?: ClinicalCaseVital[];
  /** Kod grafiki ze studia — tylko informacyjnie */
  imageGfx?: string;
  /** Zapis EKG przypadku (/content-assets/…) — ustawia importer */
  imageUrl?: string;
  steps: ClinicalCaseStep[];
  takeaway: string; // Markdown — złota rada
}

export type ClinicalCaseQuestionConfig = { type: "clinical_case"; config: ClinicalCaseConfig };

/** Odpowiedź na jeden krok. selectedIndex = indeks w `answers` z konfiguracji (nie po tasowaniu). */
export interface ClinicalCaseStepAnswer {
  stepId: string;
  selectedIndex?: number;
  clickedHotspots?: string[];
}

export interface ClinicalCaseAnswer {
  type: "clinical_case";
  steps: ClinicalCaseStepAnswer[];
}

export type AnyQuestionConfig = QuestionConfig | ClinicalCaseQuestionConfig;
export type AnyAnswerData = AnswerData | ClinicalCaseAnswer;

/** Czy krok jest zaliczony. Hotspot: wskazanie w poprawny obszar, bez pudła (trafienie liczy przeglądarka, jak w hotspocie). */
export function isClinicalStepCorrect(step: ClinicalCaseStep, answer: ClinicalCaseStepAnswer | undefined): boolean {
  if (!answer) return false;
  if (step.kind === "single") {
    const i = answer.selectedIndex;
    return typeof i === "number" && step.answers[i]?.isCorrect === true;
  }
  const clicked = answer.clickedHotspots ?? [];
  if (clicked.length === 0) return false;
  return clicked.every((id) => step.hotspots.find((h) => h.id === id)?.isCorrect === true);
}

/** Ocena całego przypadku w kształcie walidatorów quizService. correctItems/incorrectItems = identyfikatory kroków. */
export function gradeClinicalCase(
  config: ClinicalCaseConfig,
  answer: ClinicalCaseAnswer,
): { isCorrect: boolean; partialScore: number; correctItems: string[]; incorrectItems: string[] } {
  const correctItems: string[] = [];
  const incorrectItems: string[] = [];
  const given = Array.isArray(answer?.steps) ? answer.steps : [];
  for (const step of config.steps ?? []) {
    const a = given.find((x) => x && x.stepId === step.id);
    (isClinicalStepCorrect(step, a) ? correctItems : incorrectItems).push(step.id);
  }
  const total = config.steps?.length ?? 0;
  return {
    isCorrect: total > 0 && incorrectItems.length === 0,
    partialScore: total === 0 ? 0 : correctItems.length / total,
    correctItems,
    incorrectItems,
  };
}

/** Wzorcowa odpowiedź (feedback „correctAnswer") — pierwsza poprawna odpowiedź / poprawne obszary każdego kroku. */
export function buildClinicalCaseCorrectAnswer(config: ClinicalCaseConfig): ClinicalCaseAnswer {
  return {
    type: "clinical_case",
    steps: config.steps.map((s) =>
      s.kind === "single"
        ? { stepId: s.id, selectedIndex: s.answers.findIndex((a) => a.isCorrect) }
        : { stepId: s.id, clickedHotspots: s.hotspots.filter((h) => h.isCorrect).map((h) => h.id) },
    ),
  };
}
