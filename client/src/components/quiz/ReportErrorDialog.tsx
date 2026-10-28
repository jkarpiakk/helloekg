import { useEffect, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ReportErrorDialogProps {
  questionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/**
 * Szkice zgłoszeń per pytanie — „Anuluj”, zamknięcie okna czy przejście do innego pytania
 * nie kasują wpisanego tekstu; szkic znika dopiero po wysłaniu (żyje do przeładowania strony).
 */
const drafts = new Map<string, string>();

export default function ReportErrorDialog({ questionId, open, onOpenChange }: ReportErrorDialogProps) {
  const [message, setMessageState] = useState(() => drafts.get(questionId) ?? "");
  const [touched, setTouched] = useState(false);
  const setMessage = (value: string) => {
    setMessageState(value);
    if (value.trim()) drafts.set(questionId, value);
    else drafts.delete(questionId);
  };

  // Inne pytanie → jego własny szkic (albo puste pole)
  useEffect(() => {
    setMessageState(drafts.get(questionId) ?? "");
    setTouched(false);
  }, [questionId]);
  const { toast } = useToast();

  const reportMutation = useMutation({
    mutationFn: async (data: { questionId: string; message: string }) => {
      const response = await apiRequest("POST", "/api/report-error", data);
      return response.json();
    },
    onSuccess: (_data, vars) => {
      toast({
        title: "Zgłoszenie wysłane",
        description: "Dzięki, sprawdzimy to pytanie.",
      });
      drafts.delete(vars.questionId);
      if (vars.questionId === questionId) setMessageState("");
      setTouched(false);
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Nie udało się wysłać zgłoszenia",
        description: error.message || "Sprawdź połączenie i spróbuj ponownie.",
        variant: "destructive",
      });
    },
  });

  const empty = !message.trim();

  const handleSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    setTouched(true);
    if (empty) return;
    reportMutation.mutate({ questionId, message });
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(o) => {
        if (!o) setTouched(false);
        onOpenChange(o);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="pr-10">
          <p className="label">Zgłoszenie</p>
          <DialogTitle className="h3">Co jest nie tak z tym pytaniem?</DialogTitle>
          <DialogDescription className="text-[15px] text-[var(--txt2)]">
            Opisz błąd merytoryczny, literówkę albo niejasne sformułowanie. Twoje zgłoszenie trafi do autorów pytań.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="grid gap-4 pt-1">
          <div className="grid gap-2">
            <label htmlFor="error-report-message" className="label">
              Opis
            </label>
            <Textarea
              id="error-report-message"
              placeholder="Np. w odpowiedzi C powinno być „odstęp PR”, a nie „odcinek PR”."
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              onBlur={() => setTouched(true)}
              rows={5}
              className="resize-none"
              aria-invalid={touched && empty ? true : undefined}
              aria-describedby={touched && empty ? "error-report-hint" : undefined}
              data-testid="error-report-message"
            />
            {touched && empty ? (
              <p id="error-report-hint" className="text-[14px] text-[var(--txt2)]">
                Napisz choć jedno zdanie, żebyśmy wiedzieli, co poprawić.
              </p>
            ) : (
              !empty && (
                <p className="text-[14px] text-[var(--txt2)]" data-testid="error-report-draft-note">
                  Opis zostaje do wysłania. „Anuluj” go nie usuwa.
                </p>
              )
            )}
          </div>

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                // Bez kasowania: opis czeka na wysłanie przy ponownym otwarciu
                setTouched(false);
                onOpenChange(false);
              }}
              data-testid="error-report-cancel"
            >
              Anuluj
            </Button>
            <Button type="submit" disabled={reportMutation.isPending} data-testid="error-report-submit">
              {reportMutation.isPending ? "Wysyłam…" : "Wyślij zgłoszenie"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
