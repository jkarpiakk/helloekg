import { useState, type ReactNode } from "react";
import { Link } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useSearch } from "wouter";
import { z } from "zod";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import { apiRequest } from "@/lib/queryClient";
import { rise, stagger } from "@/lib/motion";

const resetPasswordFormSchema = z.object({
  password: z.string().min(8, "Hasło musi mieć co najmniej 8 znaków"),
  confirmPassword: z.string().min(8, "Hasło musi mieć co najmniej 8 znaków"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Hasła się różnią — wpisz to samo hasło w obu polach",
  path: ["confirmPassword"],
});

type ResetPasswordFormValues = z.infer<typeof resetPasswordFormSchema>;

/** Wąska kolumna wyśrodkowana: etykieta, tytuł, opis, jedno działanie */
function Screen({
  stateKey,
  label,
  labelClass = "",
  title,
  lead,
  children,
  role,
}: {
  stateKey: string;
  label: string;
  labelClass?: string;
  title: string;
  lead: string;
  children: ReactNode;
  role?: string;
}) {
  return (
    <div className="wrap">
      <motion.div
        key={stateKey}
        role={role}
        className="mx-auto max-w-[30rem] py-20 sm:py-28"
        variants={stagger(0.05)}
        initial="hidden"
        animate="show"
      >
        <motion.p variants={rise} className={`label ${labelClass}`}>{label}</motion.p>
        <motion.h1 variants={rise} className="h2 mt-4 text-[var(--txt)]">{title}</motion.h1>
        <motion.p variants={rise} className="lead mt-4">{lead}</motion.p>
        <motion.div variants={rise} className="mt-8">{children}</motion.div>
      </motion.div>
    </div>
  );
}

const fieldLabel = "text-sm font-normal text-[var(--txt2)]";

export default function ResetPassword() {
  const [showPassword, setShowPassword] = useState(false);
  const [success, setSuccess] = useState(false);
  const { toast } = useToast();
  const searchString = useSearch();
  const params = new URLSearchParams(searchString);
  const token = params.get("token");

  const form = useForm<ResetPasswordFormValues>({
    resolver: zodResolver(resetPasswordFormSchema),
    mode: "onTouched",
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  });

  const resetMutation = useMutation({
    mutationFn: async (data: ResetPasswordFormValues) => {
      const res = await apiRequest("POST", "/api/auth/reset-password", {
        token,
        password: data.password,
        confirmPassword: data.confirmPassword,
      });
      return res.json();
    },
    onSuccess: () => {
      setSuccess(true);
    },
    onError: (error: any) => {
      let description = "Link mógł wygasnąć. Poproś o nowy i spróbuj jeszcze raz.";
      try {
        const jsonStart = error.message?.indexOf("{");
        if (jsonStart >= 0) {
          const parsed = JSON.parse(error.message.substring(jsonStart));
          description = parsed.error || description;
        }
      } catch {}
      toast({
        title: "Nie udało się zmienić hasła",
        description,
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: ResetPasswordFormValues) => {
    resetMutation.mutate(data);
  };

  if (!token) {
    return (
      <Screen
        stateKey="invalid"
        role="alert"
        label="Nieprawidłowy link"
        labelClass="text-[var(--alarm)]"
        title="Ten link nie działa"
        lead="Link do zmiany hasła jest niepełny lub uszkodzony. Poproś o nowy — wyślemy go na twój adres e-mail."
      >
        <Button asChild>
          <Link href="/forgot-password">Poproś o nowy link</Link>
        </Button>
      </Screen>
    );
  }

  if (success) {
    return (
      <Screen
        stateKey="success"
        role="status"
        label="Gotowe"
        labelClass="label--g"
        title="Hasło zmienione"
        lead="Możesz już zalogować się nowym hasłem."
      >
        <Button asChild>
          <Link href="/?auth=login">Zaloguj się</Link>
        </Button>
      </Screen>
    );
  }

  return (
    <Screen
      stateKey="form"
      label="Nowe hasło"
      title="Ustaw nowe hasło"
      lead="Wybierz hasło, które ma co najmniej 8 znaków."
    >
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField
            control={form.control}
            name="password"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={fieldLabel}>Nowe hasło</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      type={showPassword ? "text" : "password"}
                      autoComplete="new-password"
                      placeholder="Co najmniej 8 znaków"
                      className="pr-12"
                      {...field}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-[var(--txt3)] transition-[transform,color] duration-150 hover:text-[var(--txt)] active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                      aria-label={showPassword ? "Ukryj hasło" : "Pokaż hasło"}
                      aria-pressed={showPassword}
                    >
                      {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <FormField
            control={form.control}
            name="confirmPassword"
            render={({ field }) => (
              <FormItem>
                <FormLabel className={fieldLabel}>Powtórz hasło</FormLabel>
                <FormControl>
                  <Input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    placeholder="••••••••"
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          <Button type="submit" className="w-full" disabled={resetMutation.isPending}>
            {resetMutation.isPending ? "Zmieniam hasło…" : "Zmień hasło"}
          </Button>
        </form>
      </Form>
    </Screen>
  );
}
