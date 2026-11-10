import { forwardRef, useEffect, useState, type ComponentProps } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useLocation } from "wouter";
import { authService, useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import type { LoginForm, RegisterForm } from "@/types";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { rise, stagger, spring } from "@/lib/motion";
import { useAppConfig } from "@/lib/config";

type AuthMode = "login" | "register";

interface AuthFormsProps {
  mode: AuthMode;
  onSuccess?: () => void;
  /** Przełączenie logowanie ↔ rejestracja. Bez tego komponent przełącza się sam. */
  onSwitchMode?: (mode: AuthMode) => void;
}

// Komunikaty mówią, co zrobić — nie tylko, co jest źle
const emailField = z.string().trim().email("Wpisz adres e-mail w formacie imie@domena.pl");

const loginSchema = z.object({
  email: emailField,
  // bez dolnego progu: starsze konta mogą mieć krótsze hasło niż dzisiejsze minimum
  password: z.string().min(1, "Wpisz hasło"),
});

const registerSchema = z.object({
  firstName: z.string().trim().min(1, "Podaj imię").max(60, "Imię jest za długie"),
  email: emailField,
  password: z.string().min(10, "Hasło musi mieć co najmniej 10 znaków").max(1024, "Hasło jest za długie"),
  confirmPassword: z.string().min(1, "Wpisz hasło jeszcze raz"),
  termsAccepted: z.boolean().refine((v) => v === true, "Zaznacz, żeby założyć konto"),
  privacyAccepted: z.boolean().refine((v) => v === true, "Zaznacz, żeby założyć konto"),
  website: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Hasła się różnią. Wpisz to samo hasło w obu polach",
  path: ["confirmPassword"],
});

type RegisterValues = z.infer<typeof registerSchema>;

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
      <Input ref={ref} type={visible ? "text" : "password"} className={`pr-14 ${className ?? ""}`} {...props} />
      <button
        type="button"
        onClick={onToggle}
        className="absolute right-0.5 top-1/2 grid h-11 w-11 -translate-y-1/2 place-items-center rounded-full text-[var(--label)] transition-[transform,color] duration-150 hover:text-[var(--txt)] active:scale-[.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
  /** Komunikat nad formularzem logowania */
  const [loginNotice, setLoginNotice] = useState<string | null>(null);
  /** Adres, na który poszedł link potwierdzający (ekran „sprawdź skrzynkę” po rejestracji) */
  const [registeredEmail, setRegisteredEmail] = useState<string | null>(null);
  const { data: config } = useAppConfig();
  const { login, register } = useAuth();
  const { toast } = useToast();

  useEffect(() => setMode(modeProp), [modeProp]);

  const switchMode = (next: AuthMode) => {
    setShowPassword(false);
    setLoginNotice(null);
    setRegisteredEmail(null);
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

  const registerForm = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    mode: "onTouched",
    defaultValues: {
      firstName: "",
      email: "",
      password: "",
      confirmPassword: "",
      termsAccepted: false,
      privacyAccepted: false,
      website: "",
    },
  });

  const loginMutation = useMutation({
    mutationFn: login,
    onSuccess: (user) => {
      toast({ title: "Zalogowano" });
      onSuccess?.();
      // niepotwierdzony adres: panel pokaże ekran „potwierdź e-mail” zamiast kursu
      window.location.href = user?.emailVerified === false ? "/potwierdz-email" : "/dashboard";
    },
    onError: (error: any) => {
      toast({
        title: "Nie udało się zalogować",
        description: readableError(error, "Sprawdź adres e-mail i hasło."),
        variant: "destructive",
      });
    },
  });

  // Rejestracja nie loguje: najpierw potwierdzenie adresu linkiem z maila (ta sama odpowiedź dla nowego i zajętego adresu)
  const registerMutation = useMutation({
    mutationFn: register,
    onSuccess: (_data, vars) => {
      setRegisteredEmail(vars.email.trim());
      registerForm.reset();
      setShowPassword(false);
    },
    onError: (error: any) => {
      toast({
        title: "Nie udało się założyć konta",
        description: readableError(error, "Spróbuj ponownie za chwilę."),
        variant: "destructive",
      });
    },
  });

  const resendMutation = useMutation({
    mutationFn: async (email: string) => (await apiRequest("POST", "/api/auth/resend-verification", { email })).json(),
    onSuccess: () => toast({ title: "Wysłane", description: "Jeśli konto czeka na potwierdzenie, nowy link jest w drodze." }),
    onError: (error: any) =>
      toast({ title: "Nie udało się wysłać", description: readableError(error, "Spróbuj ponownie za chwilę."), variant: "destructive" }),
  });

  const onLoginSubmit = (data: LoginForm) => {
    loginMutation.mutate(data);
  };

  const onRegisterSubmit = (data: RegisterValues) => {
    registerMutation.mutate({ ...data, termsAccepted: true, privacyAccepted: true });
  };

  const header = (label: string, title: string, lead: string) => (
    <motion.div variants={rise} className="space-y-3 pr-10">
      <p className="label">{label}</p>
      <h2 className="h3 text-[var(--txt)]">{title}</h2>
      <p className="text-sub leading-relaxed text-[var(--txt2)]">{lead}</p>
    </motion.div>
  );

  const switchLine = (question: string, action: string, next: AuthMode) => (
    <motion.p variants={rise} className="text-center text-sm text-[var(--txt2)]">
      {question}{" "}
      <button
        type="button"
        className="inline-flex min-h-11 items-center font-medium text-[var(--txt)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-sm"
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

        {loginNotice && (
          <motion.p
            variants={rise}
            role="status"
            className="rounded-lg border border-[var(--puls-deep)] bg-[var(--tint)] px-4 py-3 text-sub text-[var(--txt)]"
            data-testid="login-notice"
          >
            {loginNotice}
          </motion.p>
        )}

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
                        className="-my-3 inline-flex min-h-11 items-center text-note text-[var(--txt2)] underline-offset-4 hover:text-[var(--txt)] hover:underline rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
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
                        placeholder="Twoje hasło"
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
                    <div className="space-y-3 rounded-lg border border-[var(--line)] p-4">
                      {forgotSent ? (
                        <div className="space-y-3" role="status">
                          <p className="text-sm text-[var(--txt)]">
                            Jeśli konto z tym adresem istnieje, wysłaliśmy na nie link do ustawienia nowego hasła. Sprawdź skrzynkę (także spam).
                          </p>
                          <button
                            type="button"
                            className="inline-flex min-h-11 items-center text-sm text-[var(--txt2)] underline-offset-4 hover:text-[var(--txt)] hover:underline"
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

  const zgodaLabel = (przed: string, href: string, tekst: string) => (
    <FormLabel className="text-sm font-normal leading-snug text-[var(--txt2)]">
      {przed}{" "}
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-[var(--txt)] underline underline-offset-2"
        onClick={(e) => e.stopPropagation()}
      >
        {tekst}
      </a>
    </FormLabel>
  );

  if (registeredEmail) {
    return (
      <motion.div key="registered" className="w-full space-y-6" variants={stagger(0.04)} initial="hidden" animate="show" role="status" data-testid="register-done">
        {header("Wersja beta", "Sprawdź skrzynkę", `Wysłaliśmy link na ${registeredEmail}. Kliknij go, żeby potwierdzić adres. Link działa 24 godziny.`)}
        <motion.p variants={rise} className="text-sub leading-relaxed text-[var(--txt2)]">
          Nie widzisz wiadomości? Zajrzyj do spamu i ofert. Po potwierdzeniu zaloguj się i zacznij kurs.
        </motion.p>
        <motion.div variants={rise} className="flex flex-col gap-3 sm:flex-row">
          <Button type="button" onClick={() => switchMode("login")} data-testid="register-done-login">Przejdź do logowania</Button>
          <Button
            type="button"
            variant="outline"
            disabled={resendMutation.isPending}
            onClick={() => resendMutation.mutate(registeredEmail)}
            data-testid="register-done-resend"
          >
            {resendMutation.isPending ? "Wysyłam…" : "Wyślij link jeszcze raz"}
          </Button>
        </motion.div>
      </motion.div>
    );
  }

  if (config && !config.rejestracjaOtwarta) {
    return (
      <motion.div key="register-closed" className="w-full space-y-6" variants={stagger(0.04)} initial="hidden" animate="show" data-testid="register-closed">
        {header("Wersja beta", "Rejestracja chwilowo zamknięta", "Nowe konta zakładamy w kolejnych turach. Jeśli masz już konto, zaloguj się.")}
        <motion.div variants={rise}>
          <Button type="button" className="w-full" onClick={() => switchMode("login")}>Zaloguj się</Button>
        </motion.div>
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
      {header("Wersja beta", "Załóż konto", "Konto daje dostęp do wszystkich modułów bety i zapisuje twój postęp. Kurs otworzysz po potwierdzeniu adresu e-mail.")}

      <motion.div variants={rise}>
        <Form {...registerForm}>
          <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4" noValidate>
            <FormField
              control={registerForm.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className={fieldLabel}>Imię</FormLabel>
                  <FormControl>
                    <Input autoComplete="given-name" placeholder="Twoje imię" {...field} data-testid="register-firstName" />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            {/* Pole-pułapka: niewidoczne dla ludzi i czytników ekranu, automaty je wypełniają */}
            <div aria-hidden="true" className="absolute -left-[10000px] h-px w-px overflow-hidden">
              <label htmlFor="register-website">Strona internetowa</label>
              <input id="register-website" type="text" tabIndex={-1} autoComplete="off" {...registerForm.register("website")} />
            </div>
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
                      placeholder="Co najmniej 10 znaków"
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
                      placeholder="Wpisz hasło jeszcze raz"
                      {...field}
                      data-testid="register-confirmPassword"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-3 border-t border-[var(--line)] pt-4">
              {(["termsAccepted", "privacyAccepted"] as const).map((pole) => (
                <FormField
                  key={pole}
                  control={registerForm.control}
                  name={pole}
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
                            data-testid={pole === "termsAccepted" ? "register-terms" : "register-privacy"}
                          />
                        </FormControl>
                        {pole === "termsAccepted"
                          ? zgodaLabel("Akceptuję", "/regulamin-bety", "regulamin bety")
                          : zgodaLabel("Akceptuję", "/polityka-prywatnosci", "politykę prywatności")}
                      </div>
                      <FormMessage className="pl-7" />
                    </FormItem>
                  )}
                />
              ))}
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
