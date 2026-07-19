import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { z } from "zod";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { CheckCircle, Mail } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import Logo from "@/components/layout/Logo";

const forgotPasswordSchema = z.object({
  email: z.string().email("Podaj prawidłowy adres e-mail"),
});

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;

export default function ForgotPassword() {
  const [submitted, setSubmitted] = useState(false);

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
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

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-background">
        <Card className="w-full max-w-md">
          <CardContent className="pt-8">
            <div className="flex flex-col items-center text-center space-y-4">
              <CheckCircle className="h-14 w-14 text-green-500" />
              <h2 className="text-xl font-semibold">Sprawdź skrzynkę</h2>
              <p className="text-muted-foreground">
                Jeśli podany adres e-mail jest powiązany z kontem, za chwilę
                otrzymasz wiadomość z linkiem do resetowania hasła.
              </p>
              <p className="text-sm text-muted-foreground">
                Link wygasa po 60 minutach.
              </p>
              <Button asChild className="w-full mt-2">
                <a href="/">Wróć na stronę główną</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-background">
      <Card className="w-full max-w-md">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <Logo markSize={56} />
          </div>
          <CardTitle className="text-2xl text-center">Odzyskaj hasło</CardTitle>
          <CardDescription className="text-center">
            Podaj adres e-mail, a wyślemy Ci link do ustawienia nowego hasła.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit((data) => mutation.mutate(data))}
              className="space-y-4"
            >
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Adres e-mail</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        <Input
                          type="email"
                          placeholder="twoj@email.pl"
                          className="pl-9"
                          {...field}
                        />
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="w-full" disabled={mutation.isPending}>
                {mutation.isPending ? "Wysyłam..." : "Wyślij link do resetowania"}
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Pamiętasz hasło?{" "}
                <a href="/" className="text-primary hover:underline font-medium">
                  Zaloguj się
                </a>
              </p>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
