import { useState } from "react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { plural } from "@/lib/i18n";

export const EXAM_COUNTS = [10, 20, 40] as const;
export type ExamCount = (typeof EXAM_COUNTS)[number];

export const isExamCount = (n: number): n is ExamCount => (EXAM_COUNTS as readonly number[]).includes(n);

/**
 * Egzamin próbny: wybór liczby pytań i od razu start sesji (/quiz?mode=exam&count=N).
 * Ten sam dialog otwiera Postęp i ekran /quiz — bez przystanku po drodze.
 */
export default function ExamCountDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const [, setLocation] = useLocation();
  const [count, setCount] = useState<ExamCount>(20);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="exam-dialog">
        <DialogHeader>
          <DialogTitle>Egzamin próbny</DialogTitle>
          <DialogDescription>
            Pytania losujemy z całego kursu. Wynik i wyjaśnienia zobaczysz na końcu. Ile pytań chcesz rozwiązać?
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-3 gap-3 my-2" role="group" aria-label="Liczba pytań">
          {EXAM_COUNTS.map((n) => (
            <button
              key={n}
              type="button"
              className="chip justify-center min-h-[64px] flex-col gap-1"
              aria-pressed={count === n}
              onClick={() => setCount(n)}
              data-testid={`exam-count-${n}`}
            >
              <span className="num text-[1.5rem] leading-none text-[var(--txt)]">{n}</span>
              <span className="text-[12px]">{plural(n, "pytanie", "pytania", "pytań")}</span>
            </button>
          ))}
        </div>

        <DialogFooter className="gap-3 sm:gap-3">
          <Button variant="outline" onClick={() => onOpenChange(false)} data-testid="exam-cancel">
            Anuluj
          </Button>
          <Button
            onClick={() => {
              onOpenChange(false);
              setLocation(`/quiz?mode=exam&count=${count}`);
            }}
            data-testid="exam-start"
          >
            Rozpocznij egzamin
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
