import { forwardRef, useEffect, useState, type ComponentProps } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import type { LoginForm, RegisterForm } from "@/types";
import { apiRequest } from "@/lib/queryClient";
import { rise, stagger, spring } from "@/lib/motion";

type AuthMode = "login" | "register";

interface AuthFormsProps {
  mode: AuthMode;
  onSuccess?: () => void;
  /** Przełączenie logowanie ↔ rejestracja. Bez tego komponent przełącza się sam. */
  onSwitchMode?: (mode: AuthMode) => void;
}

// Komunikaty mówią, co zrobić — nie tylko, co jest źle
const emailField = z.string().email("Wpisz adres e-mail w formacie imie@domena.pl");
const passwordField = z.string().min(8, "Hasło musi mieć co najmniej 8 znaków");

const loginSchema = z.object({
  email: emailField,
  password: passwordField,
});

const registerSchema = z.object({
  email: emailField,
  password: passwordField,
  confirmPassword: z.string().min(1, "Wpisz hasło jeszcze raz"),
  firstName: z.string().optional().default(""),
  lastName: z.string().optional().default(""),
  profession: z.string().optional(),
  // Regulamin dojdzie przed startem płatnej wersji — w becie wymagamy tylko polityki prywatności
  termsAccepted: z.boolean().optional(),
  privacyAccepted: z.boolean().refine(val => val === true, "Zaznacz, aby założyć konto"),
  marketingConsent: z.boolean().default(false),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Hasła się różnią — wpisz to samo hasło w obu polach",
  path: ["confirmPassword"],
});

/** apiRequest rzuca błąd w formacie „401: {"error": "..."}” — wyciągamy samą treść */
function readableError(error: unknown, fallback: string): string {
  const message = (error as Error | undefined)?.message;
  if (!message) return fallback;
  try {
    const jsonStart = message.indexOf("{");
    if (jsonStart >= 0) {
      const parsed = JSON.parse(message.substring(jsonStart));
      return parsed.error || parsed.message || fallback;
    }
  } catch {}
  return message.replace(/^\d{3}:\s*/, "") || fallback;
}

type PasswordInputProps = ComponentProps<typeof Input> & {
  visible: boolean;
  onToggle: () => void;
  toggleTestId?: string;
};

const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  ({ visible, onToggle, toggleTestId, className, ...props }, ref) => (
    <div className="relative">
      <Input ref={ref} type={visible ? "text" : "password"} className={`pr-12 ${className ?? ""}`} {...props} />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-1 top-1/2 grid h-10 w-10 -translate-y-1/2 place-items-center rounded-full text-[var(--txt3)] transition-[transform,color] duration-150 hover:text-[var(--txt)] active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={visible ? "Ukryj hasło" : "Pokaż hasło"}
        aria-pressed={visible}
        data-testid={toggleTestId}
      >
        {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  ),
);
PasswordInput.displayName = "PasswordInput";

const fieldLabel = "text-sm font-normal text-[var(--txt2)]";

export default function AuthForms({ mode: modeProp, onSuccess, onSwitchMode }: AuthFormsProps) {
  const [mode, setMode] = useState<AuthMode>(modeProp);
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const { login, register } = useAuth();
  const { toast } = useToast();

  useEffect(() => setMode(modeProp), [modeProp]);

  const switchMode = (next: AuthMode) => {
    setShowPassword(false);
    if (onSwitchMode) onSwitchMode(next);
    else setMode(next);
  };

  const forgotPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/auth/forgot-password", { email });
      return res.json();
    },
    onSuccess: () => {
      setForgotSent(true);
    },
    onError: (error: any) => {
      toast({
        title: "Nie udało się wysłać linku",
        description: readableError(error, "Spróbuj ponownie za chwilę."),
        variant: "destructive",
      });
    },
  });

  // Walidacja przy opuszczeniu pola, potem na bieżąco przy poprawianiu
  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    mode: "onTouched",
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
    defaultValues: {
      email: "",
      password: "",
      confirmPassword: "",
      firstName: "",
      lastName: "",
      profession: "",
      termsAccepted: false,
      privacyAccepted: false,
      marketingConsent: false,
    },
  });

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: () => {
      toast({ title: "Zalogowano" });
      onSuccess?.();
      window.location.href = "/dashboard";
    },
    onError: (error: any) => {
      toast({
        title: "Nie udało się zalogować",
        description: readableError(error, "Sprawdź adres e-mail i hasło."),
        variant: "destructive",
      });
    },
  });

  const registerMutation = useMutation({
    mutationFn: register,
    onSuccess: (data) => {
      toast({
        title: "Konto utworzone",
        description: data.message,
      });
      onSuccess?.();
    },
    onError: (error: any) => {
      toast({
        title: "Nie udało się założyć konta",
        description: readableError(error, "Spróbuj ponownie za chwilę."),
        variant: "destructive",
      });
    },
  });

  const onLoginSubmit = (data: LoginForm) => {
    loginMutation.mutate(data);
  };

  const onRegisterSubmit = (data: RegisterForm) => {
    registerMutation.mutate(data);
  };

  const header = (label: string, title: string, lead: string) => (
    <motion.div variants={rise} className="space-y-3 pr-10">
      <p className="label">{label}</p>
      <h2 className="h3 text-[var(--txt)]">{title}</h2>
      <p className="text-[15px] leading-relaxed text-[var(--txt2)]">{lead}</p>
    </motion.div>
  );

  const switchLine = (question: string, action: string, next: AuthMode) => (
    <motion.p variants={rise} className="text-center text-sm text-[var(--txt2)]">
      {question}{" "}
      <button
        type="button"
        className="font-medium text-[var(--txt)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
        onClick={() => switchMode(next)}
        data-testid={`switch-to-${next}`}
      >
        {action}
      </button>
    </motion.p>
  );

  if (mode === "login") {
    return (
      <motion.div
        key="login"
        className="w-full space-y-6"
        variants={stagger(0.04)}
        initial="hidden"
        animate="show"
      >
        {header("Logowanie", "Witaj z powrotem", "Zaloguj się, żeby wrócić do kursu i swojego postępu.")}

        <motion.div variants={rise}>
          <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4" noValidate>
              <FormField
                control={loginForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className={fieldLabel}>Adres e-mail</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        autoComplete="email"
                        inputMode="email"
                        placeholder="imie@domena.pl"
                        {...field}
                        data-testid="login-email"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={loginForm.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <div className="flex items-baseline justify-between gap-3">
                      <FormLabel className={fieldLabel}>Hasło</FormLabel>
                      <button
                        type="button"
                        className="text-[13px] text-[var(--txt2)] underline-offset-4 hover:text-[var(--txt)] hover:underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        onClick={() => {
                          setShowForgotPassword((open) => !open);
                          setForgotSent(false);
                          setForgotEmail(loginForm.getValues("email") || "");
                        }}
                        aria-expanded={showForgotPassword}
                        data-testid="forgot-password-link"
                      >
                        Nie pamiętasz hasła?
                      </button>
                    </div>
                    <FormControl>
                      <PasswordInput
                        autoComplete="current-password"
                        placeholder="••••••••"
                        visible={showPassword}
                        onToggle={() => setShowPassword((v) => !v)}
                        toggleTestId="toggle-password"
                        {...field}
                        data-testid="login-password"
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <AnimatePresence initial={false}>
                {showForgotPassword && (
                  <motion.div
                    key="forgot"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={spring}
                    className="overflow-hidden"
                  >
                    <div className="space-y-3 rounded-[12px] border border-[var(--line)] p-4">
                      {forgotSent ? (
                        <div className="space-y-3" role="status">
                          <p className="text-sm text-[var(--txt)]">
                            Jeśli konto z tym adresem istnieje, wysłaliśmy na nie link do ustawienia nowego hasła. Sprawdź skrzynkę (także spam).
                          </p>
                          <button
                            type="button"
                            className="text-sm text-[var(--txt2)] underline-offset-4 hover:text-[var(--txt)] hover:underline"
                            onClick={() => setShowForgotPassword(false)}
                          >
                            Zamknij
                          </button>
                        </div>
                      ) : (
                        <>
                          <p className="text-sm text-[var(--txt2)]">
                            Podaj adres e-mail konta, a wyślemy ci link do ustawienia nowego hasła.
                          </p>
                          <Input
                            type="email"
                            autoComplete="email"
                            placeholder="imie@domena.pl"
                            value={forgotEmail}
                            onChange={(e) => setForgotEmail(e.target.value)}
                            aria-label="Adres e-mail do resetu hasła"
                            data-testid="forgot-password-email"
                          />
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              disabled={!forgotEmail || forgotPasswordMutation.isPending}
                              onClick={() => forgotPasswordMutation.mutate(forgotEmail)}
                              data-testid="forgot-password-submit"
                            >
                              {forgotPasswordMutation.isPending ? "Wysyłam…" : "Wyślij link"}
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => setShowForgotPassword(false)}
                            >
                              Anuluj
                            </Button>
                          </div>
                        </>
                      )}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
                data-testid="login-submit"
              >
                {loginMutation.isPending ? "Loguję…" : "Zaloguj się"}
              </Button>
            </form>
          </Form>
        </motion.div>

        {switchLine("Nie masz konta?", "Załóż konto", "register")}
      </motion.div>
    );
  }

  return (
    <motion.div
      key="register"
      className="w-full space-y-6"
      variants={stagger(0.04)}
      initial="hidden"
      animate="show"
    >
      {header("Wersja beta", "Załóż konto", "Konto daje dostęp do wszystkich modułów bety i zapisuje twój postęp.")}

      <motion.div variants={rise}>
        <Form {...registerForm}>
          <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4" noValidate>
            <FormField
              control={registerForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={fieldLabel}>Adres e-mail</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      autoComplete="email"
                      inputMode="email"
                      placeholder="imie@domena.pl"
                      {...field}
                      data-testid="register-email"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={registerForm.control}
              name="password"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={fieldLabel}>Hasło</FormLabel>
                  <FormControl>
                    <PasswordInput
                      autoComplete="new-password"
                      placeholder="Co najmniej 8 znaków"
                      visible={showPassword}
                      onToggle={() => setShowPassword((v) => !v)}
                      toggleTestId="toggle-password"
                      {...field}
                      data-testid="register-password"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={registerForm.control}
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
                      data-testid="register-confirmPassword"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-3 border-t border-[var(--line)] pt-4">
              <FormField
                control={registerForm.control}
                name="privacyAccepted"
                render={({ field }) => (
                  <FormItem className="space-y-1">
                    <div className="flex items-start gap-3">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) => {
                            field.onChange(checked === true);
                            field.onBlur();
                          }}
                          className="mt-0.5"
                          data-testid="register-privacy"
                        />
                      </FormControl>
                      <FormLabel className="text-sm font-normal leading-snug text-[var(--txt2)]">
                        Akceptuję{" "}
                        <a
                          href="https://helloekg.pl/polityka-prywatnosci.html"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[var(--txt)] underline underline-offset-2"
                          onClick={(e) => e.stopPropagation()}
                        >
                          politykę prywatności
                        </a>
                      </FormLabel>
                    </div>
                    <FormMessage className="pl-7" />
                  </FormItem>
                )}
              />
              <FormField
                control={registerForm.control}
                name="marketingConsent"
                render={({ field }) => (
                  <FormItem className="flex items-start gap-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={(checked) => field.onChange(checked === true)}
                        className="mt-0.5"
                        data-testid="register-marketing"
                      />
                    </FormControl>
                    <FormLabel className="text-sm font-normal leading-snug text-[var(--txt2)]">
                      Chcę dostawać e-maile o nowościach w kursie (opcjonalnie)
                    </FormLabel>
                  </FormItem>
                )}
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={registerMutation.isPending}
              data-testid="register-submit"
            >
              {registerMutation.isPending ? "Zakładam konto…" : "Załóż konto"}
            </Button>
          </form>
        </Form>
      </motion.div>

      {switchLine("Masz już konto?", "Zaloguj się", "login")}
    </motion.div>
  );
}
