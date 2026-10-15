import { useState } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { apiRequest } from "@/lib/queryClient";
import { rise, stagger } from "@/lib/motion";

const forgotPasswordSchema = z.object({
  email: z.string().email("Wpisz adres e-mail w formacie imie@domena.pl"),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPassword() {
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    mode: "onTouched",
    defaultValues: { email: "" },
  });

  const mutation = useMutation({
    mutationFn: async (data: ForgotPasswordValues) => {
      const res = await apiRequest("POST", "/api/auth/forgot-password", data);
      return res.json();
    },
    onSuccess: () => setSubmitted(true),
    onError: () => setSubmitted(true), // Always show success — don't reveal if email exists
  });

  return (
    <div className="wrap">
      <motion.div
        key={submitted ? "sent" : "form"}
        className="mx-auto max-w-[30rem] py-20 sm:py-28"
        variants={stagger(0.05)}
        initial="hidden"
        animate="show"
      >
        {submitted ? (
          <div role="status">
            <motion.p variants={rise} className="label label--g">Link wysłany</motion.p>
            <motion.h1 variants={rise} className="h2 mt-4 text-[var(--txt)]">
              Sprawdź skrzynkę
            </motion.h1>
            <motion.p variants={rise} className="lead mt-4">
              Jeśli ten adres jest powiązany z kontem, za chwilę dostaniesz e-mail z linkiem do ustawienia
              nowego hasła. Link działa 60 minut — nie widzisz wiadomości? Zajrzyj do spamu.
            </motion.p>
            <motion.div variants={rise} className="mt-8">
              <Button asChild>
                <Link href="/?auth=login">Wróć do logowania</Link>
              </Button>
            </motion.div>
          </div>
        ) : (
          <>
            <motion.p variants={rise} className="label">Odzyskiwanie hasła</motion.p>
            <motion.h1 variants={rise} className="h2 mt-4 text-[var(--txt)]">
              Nie pamiętasz hasła?
            </motion.h1>
            <motion.p variants={rise} className="lead mt-4">
              Podaj adres e-mail konta, a wyślemy ci link do ustawienia nowego hasła.
            </motion.p>
            <motion.div variants={rise} className="mt-8">
              <Form {...form}>
                <form
                  onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
                  className="space-y-4"
                  noValidate
                >
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-sm font-normal text-[var(--txt2)]">Adres e-mail</FormLabel>
                        <FormControl>
                          <Input
                            type="email"
                            autoComplete="email"
                            inputMode="email"
                            placeholder="imie@domena.pl"
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <Button type="submit" className="w-full" disabled={mutation.isPending}>
                    {mutation.isPending ? "Wysyłam…" : "Wyślij link"}
                  </Button>
                  <p className="text-center text-sm text-[var(--txt2)]">
                    Pamiętasz hasło?{" "}
                    <Link href="/?auth=login" className="font-medium text-[var(--txt)] underline-offset-4 hover:underline">
                      Zaloguj się
                    </Link>
                  </p>
                </form>
              </Form>
            </motion.div>
          </>
        )}
      </motion.div>
    </div>
  );
}
