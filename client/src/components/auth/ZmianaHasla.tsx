import { useState, type FormEvent } from "react";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { PASSWORD_MIN_LENGTH } from "@shared/schema";

function readableError(error: unknown): string {
  const msg = error instanceof Error ? error.message : "";
  const json = msg.replace(/^\d{3}:\s*/, "");
  try {
    return JSON.parse(json).error || "Nie udało się zmienić hasła";
  } catch {
    return json || "Nie udało się zmienić hasła";
  }
}

/** Zmiana hasła z menu konta: obecne, nowe, powtórzone. Inne urządzenia zostają wylogowane. */
export default function ZmianaHasla({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [obecne, setObecne] = useState("");
  const [nowe, setNowe] = useState("");
  const [powtorz, setPowtorz] = useState("");
  const [blad, setBlad] = useState<string | null>(null);
  const [pracuje, setPracuje] = useState(false);
  const { toast } = useToast();

  const zamknij = (o: boolean) => {
    if (pracuje) return;
    onOpenChange(o);
    if (!o) {
      setObecne("");
      setNowe("");
      setPowtorz("");
      setBlad(null);
    }
  };

  const wyslij = async (e: FormEvent) => {
    e.preventDefault();
    setBlad(null);
    if (!obecne) return setBlad("Wpisz obecne hasło.");
    if (nowe.length < PASSWORD_MIN_LENGTH) return setBlad(`Nowe hasło musi mieć co najmniej ${PASSWORD_MIN_LENGTH} znaków.`);
    if (nowe !== powtorz) return setBlad("Nowe hasła się różnią.");
    setPracuje(true);
    try {
      await apiRequest("POST", "/api/auth/change-password", { currentPassword: obecne, newPassword: nowe });
      setPracuje(false);
      zamknij(false);
      toast({ title: "Hasło zmienione", description: "Na innych urządzeniach trzeba zalogować się nowym hasłem." });
    } catch (error) {
      setBlad(readableError(error));
      setPracuje(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={zamknij}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={wyslij} className="grid gap-5" noValidate>
          <DialogHeader>
            <DialogTitle>Zmień hasło</DialogTitle>
            <DialogDescription>Po zmianie inne urządzenia zostaną wylogowane. Dostaniesz też maila z potwierdzeniem.</DialogDescription>
          </DialogHeader>
          {[
            ["obecne-haslo", "Obecne hasło", obecne, setObecne, "current-password"],
            ["nowe-haslo", `Nowe hasło (co najmniej ${PASSWORD_MIN_LENGTH} znaków)`, nowe, setNowe, "new-password"],
            ["powtorz-haslo", "Powtórz nowe hasło", powtorz, setPowtorz, "new-password"],
          ].map(([id, etykieta, wartosc, ustaw, auto]) => (
            <div key={id as string} className="grid gap-2">
              <label htmlFor={id as string} className="text-sm text-[var(--txt2)]">{etykieta as string}</label>
              <Input
                id={id as string}
                type="password"
                autoComplete={auto as string}
                value={wartosc as string}
                onChange={(e) => (ustaw as (v: string) => void)(e.target.value)}
                disabled={pracuje}
                aria-invalid={blad ? true : undefined}
                aria-describedby={blad ? "zmiana-hasla-blad" : undefined}
                data-testid={id as string}
              />
            </div>
          ))}
          {blad && <p id="zmiana-hasla-blad" role="alert" className="text-sm text-[var(--alarm)]">{blad}</p>}
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => zamknij(false)} disabled={pracuje}>Anuluj</Button>
            <Button type="submit" disabled={pracuje} data-testid="zmiana-hasla-zapisz">{pracuje ? "Zapisuję…" : "Zmień hasło"}</Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
