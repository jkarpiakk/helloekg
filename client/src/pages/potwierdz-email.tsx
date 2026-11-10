import { useMutation } from "@tanstack/react-query";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { rise, stagger } from "@/lib/motion";

/**
 * Zalogowane konto bez potwierdzonego adresu: zamiast kursu ten ekran (serwer i tak zwraca 403 EMAIL_NOT_VERIFIED
 * dla treści i grafik). Można poprosić o nowy link albo się wylogować.
 */
export default function PotwierdzEmail() {
  const { user, logout } = useAuth();
  const { toast } = useToast();
  const resend = useMutation({
    mutationFn: async () => (await apiRequest("POST", "/api/auth/resend-verification", { email: user?.email })).json(),
    onSuccess: () => toast({ title: "Wysłane", description: "Nowy link jest w drodze. Poprzedni przestał działać." }),
    onError: () => toast({ title: "Nie udało się wysłać", description: "Spróbuj ponownie za chwilę.", variant: "destructive" }),
  });

  return (
    <div className="wrap">
      <motion.div
        className="mx-auto max-w-[30rem] py-20 sm:py-28"
        variants={stagger(0.05)}
        initial="hidden"
        animate="show"
        role="status"
        data-testid="potwierdz-email"
      >
        <motion.p variants={rise} className="label">Jeszcze jeden krok</motion.p>
        <motion.h1 variants={rise} className="h2 mt-4 text-[var(--txt)]">Potwierdź adres e-mail</motion.h1>
        <motion.p variants={rise} className="lead mt-4">
          Wysłaliśmy link na {user?.email}. Kliknij go, a kurs otworzy się od razu. Link działa 24 godziny.
          Nie widzisz wiadomości? Zajrzyj do spamu.
        </motion.p>
        <motion.div variants={rise} className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Button onClick={() => resend.mutate()} disabled={resend.isPending} data-testid="potwierdz-email-resend">
            {resend.isPending ? "Wysyłam…" : "Wyślij link jeszcze raz"}
          </Button>
          <Button variant="outline" onClick={() => logout()}>Wyloguj się</Button>
        </motion.div>
      </motion.div>
    </div>
  );
}
