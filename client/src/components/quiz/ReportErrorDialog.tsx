import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { AlertTriangle } from "lucide-react";

interface ReportErrorDialogProps {
  questionId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function ReportErrorDialog({ questionId, open, onOpenChange }: ReportErrorDialogProps) {
  const [message, setMessage] = useState("");
  const { toast } = useToast();

  const reportMutation = useMutation({
    mutationFn: async (data: { questionId: string; message: string }) => {
      const response = await apiRequest("POST", "/api/report-error", data);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Zgłoszenie wysłane",
        description: "Dziękujemy za pomoc w poprawie jakości pytań!",
      });
      setMessage("");
      onOpenChange(false);
    },
    onError: (error: any) => {
      toast({
        title: "Błąd",
        description: error.message || "Nie udało się wysłać zgłoszenia",
        variant: "destructive",
      });
    },
  });

  const handleSubmit = () => {
    if (!message.trim()) {
      toast({
        title: "Uwaga",
        description: "Proszę opisać problem",
        variant: "destructive",
      });
      return;
    }

    reportMutation.mutate({ questionId, message });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Zgłoś błąd w pytaniu
          </DialogTitle>
          <DialogDescription>
            Pomóż nam poprawić jakość pytań. Opisz co jest nie tak z tym pytaniem.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 pt-4">
          <Textarea
            placeholder="Opisz błąd lub problem z pytaniem (np. błąd merytoryczny, literówka, nieaktualna informacja...)"
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={5}
            className="resize-none"
            data-testid="error-report-message"
          />

          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => {
                setMessage("");
                onOpenChange(false);
              }}
              data-testid="error-report-cancel"
            >
              Anuluj
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={reportMutation.isPending}
              data-testid="error-report-submit"
            >
              {reportMutation.isPending ? "Wysyłanie..." : "Wyślij zgłoszenie"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
