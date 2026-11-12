import { useState } from "react";
import type { AnswerData, QuizResult } from "@/types";
import type { ImageChoiceConfig } from "@shared/wyborZapisu";
import { sanitizeMarkdown } from "@/lib/sanitize";
import { WyborZapisu } from "../wybor-zapisu/WyborZapisu";
import { BrakObrazu } from "../BrakObrazu";

interface ImageChoiceQuestionProps {
  /** Opcje już w kolejności tego podejścia (losuje serwer przy podaniu pytania) */
  config: ImageChoiceConfig;
  onChange: (answer: AnswerData) => void;
  disabled: boolean;
  showResult: boolean;
  result?: QuizResult;
  onImageClick?: (imageUrl: string, origin?: HTMLElement, alt?: string) => void;
}

/**
 * „Wybierz zapis” w kursie: te same karty co w podglądzie studia (wybor-zapisu/, kopia ze studia).
 * Odpowiedź to id opcji, nie litera. Po sprawdzeniu poprawność, opisy i alt z rejestru
 * przychodzą z wynikiem (QuizInterface dokłada je do konfiguracji po id).
 */
export default function ImageChoiceQuestion({ config, onChange, disabled, showResult, onImageClick }: ImageChoiceQuestionProps) {
  const [wybrane, setWybrane] = useState<string[]>([]);
  const zmien = (ids: string[]) => {
    setWybrane(ids);
    onChange({ type: "image_choice", selectedIds: ids });
  };
  return (
    <div className="mb-2">
      <WyborZapisu
        opcje={config.options}
        wybrane={wybrane}
        onZmiana={zmien}
        wielokrotny={config.allowMultiple}
        zablokowane={disabled}
        pokazWynik={showResult}
        src={(o) => o.imageUrl}
        md={(t) => sanitizeMarkdown(t).__html}
        onPowieksz={(src, alt, el) => onImageClick?.(src, el, alt)}
        brakObrazu={(o, stan) => (
          <BrakObrazu
            stan={stan}
            miejsce="zapis"
            kod={(o as { imageGfx?: string }).imageGfx}
            url={stan === "blad-ladowania" ? o.imageUrl : undefined}
            kompakt
          />
        )}
      />
    </div>
  );
}
