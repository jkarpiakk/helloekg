import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useTranslation } from "@/lib/i18n";
import { useAuth } from "@/lib/auth";
import { useToast } from "@/hooks/use-toast";
import { Eye, EyeOff } from "lucide-react";
import { z } from "zod";
import type { LoginForm, RegisterForm } from "@/types";
import logoImage from "@assets/logo ekg 2_1757715460574.png";
import { apiRequest } from "@/lib/queryClient";

interface AuthFormsProps {
  mode: "login" | "register";
  onSuccess?: () => void;
}

const loginSchema = z.object({
  email: z.string().email("Nieprawidłowy adres e-mail"),
  password: z.string().min(8, "Hasło musi mieć co najmniej 8 znaków"),
});

const registerSchema = z.object({
  email: z.string().email("Nieprawidłowy adres e-mail"),
  password: z.string().min(8, "Hasło musi mieć co najmniej 8 znaków"),
  confirmPassword: z.string(),
  firstName: z.string().optional().default(""),
  lastName: z.string().optional().default(""),
  profession: z.string().optional(),
  termsAccepted: z.boolean().refine(val => val === true, "Musisz zaakceptować regulamin"),
  privacyAccepted: z.boolean().refine(val => val === true, "Musisz zaakceptować politykę prywatności"),
  marketingConsent: z.boolean().default(false),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Hasła nie pasują do siebie",
  path: ["confirmPassword"],
});

export default function AuthForms({ mode, onSuccess }: AuthFormsProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [forgotEmail, setForgotEmail] = useState("");
  const [forgotSent, setForgotSent] = useState(false);
  const { t } = useTranslation();
  const { login, register } = useAuth();
  const { toast } = useToast();

  const forgotPasswordMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await apiRequest("POST", "/api/auth/forgot-password", { email });
      return res.json();
    },
    onSuccess: () => {
      setForgotSent(true);
    },
    onError: (error: any) => {
      let description = "Nie udało się wysłać linku";
      try {
        const jsonStart = error.message?.indexOf("{");
        if (jsonStart >= 0) {
          const parsed = JSON.parse(error.message.substring(jsonStart));
          description = parsed.error || description;
        }
      } catch {}
      toast({
        title: "Błąd",
        description,
        variant: "destructive",
      });
    },
  });

  const loginForm = useForm<LoginForm>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  });

  const registerForm = useForm<RegisterForm>({
    resolver: zodResolver(registerSchema),
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
      toast({
        title: "Sukces",
        description: "Zostałeś pomyślnie zalogowany",
      });
      onSuccess?.();
      window.location.href = "/dashboard";
    },
    onError: (error: any) => {
      toast({
        title: "Błąd logowania",
        description: error.message || "Nieprawidłowe dane logowania",
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
        title: "Błąd rejestracji",
        description: error.message || "Nie udało się utworzyć konta",
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

  if (mode === "login") {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardHeader className="space-y-1">
          <div className="flex items-center justify-center mb-4">
            <img 
              src={logoImage} 
              alt="EKG Academy" 
              className="h-20 w-20"
            />
          </div>
          <CardTitle className="text-2xl text-center">{t("auth.loginTitle")}</CardTitle>
          <CardDescription className="text-center">
            Wprowadź swoje dane aby uzyskać dostęp do konta
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Form {...loginForm}>
            <form onSubmit={loginForm.handleSubmit(onLoginSubmit)} className="space-y-4">
              <FormField
                control={loginForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>{t("auth.email")}</FormLabel>
                    <FormControl>
                      <Input
                        type="email"
                        placeholder="email@example.com"
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
                    <FormLabel>{t("auth.password")}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          {...field}
                          data-testid="login-password"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                          onClick={() => setShowPassword(!showPassword)}
                          data-testid="toggle-password"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </Button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button
                type="submit"
                className="w-full"
                disabled={loginMutation.isPending}
                data-testid="login-submit"
              >
                {loginMutation.isPending ? "Logowanie..." : t("auth.loginButton")}
              </Button>
            </form>
          </Form>

          <div className="mt-4 text-center">
            <button
              type="button"
              className="text-sm text-primary hover:underline"
              onClick={() => { setShowForgotPassword(true); setForgotSent(false); setForgotEmail(""); }}
              data-testid="forgot-password-link"
            >
              Zapomniałem hasła
            </button>
          </div>

          {showForgotPassword && (
            <div className="mt-4 p-4 border rounded-lg space-y-3">
              {forgotSent ? (
                <div className="text-center space-y-2">
                  <p className="text-sm text-green-600 font-medium">
                    Jeśli konto z tym adresem istnieje, wysłaliśmy link do resetowania hasła.
                  </p>
                  <button
                    type="button"
                    className="text-sm text-muted-foreground hover:underline"
                    onClick={() => setShowForgotPassword(false)}
                  >
                    Zamknij
                  </button>
                </div>
              ) : (
                <>
                  <p className="text-sm text-muted-foreground">
                    Podaj adres e-mail powiązany z Twoim kontem, a wyślemy Ci link do resetowania hasła.
                  </p>
                  <Input
                    type="email"
                    placeholder="email@example.com"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    data-testid="forgot-password-email"
                  />
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      className="flex-1"
                      disabled={!forgotEmail || forgotPasswordMutation.isPending}
                      onClick={() => forgotPasswordMutation.mutate(forgotEmail)}
                      data-testid="forgot-password-submit"
                    >
                      {forgotPasswordMutation.isPending ? "Wysyłanie..." : "Wyślij link"}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowForgotPassword(false)}
                    >
                      Anuluj
                    </Button>
                  </div>
                </>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader className="space-y-1">
        <div className="flex items-center justify-center mb-4">
          <img 
            src={logoImage} 
            alt="EKG Academy" 
            className="h-20 w-20"
          />
        </div>
        <CardTitle className="text-2xl text-center">{t("auth.registerTitle")}</CardTitle>
        <CardDescription className="text-center">
          Utwórz konto aby rozpocząć naukę EKG
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...registerForm}>
          <form onSubmit={registerForm.handleSubmit(onRegisterSubmit)} className="space-y-4">
            <FormField
              control={registerForm.control}
              name="email"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>{t("auth.email")}</FormLabel>
                  <FormControl>
                    <Input
                      type="email"
                      placeholder="email@example.com"
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
                  <FormLabel>{t("auth.password")}</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        {...field}
                        data-testid="register-password"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                        onClick={() => setShowPassword(!showPassword)}
                        data-testid="toggle-password"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    </div>
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
                  <FormLabel>{t("auth.confirmPassword")}</FormLabel>
                  <FormControl>
                    <Input
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      {...field}
                      data-testid="register-confirmPassword"
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="space-y-3">
              <FormField
                control={registerForm.control}
                name="termsAccepted"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="register-terms"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-sm">
                        {t("auth.termsAccepted")}
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={registerForm.control}
                name="privacyAccepted"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="register-privacy"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-sm">
                        {t("auth.privacyAccepted")}
                      </FormLabel>
                    </div>
                  </FormItem>
                )}
              />
              <FormField
                control={registerForm.control}
                name="marketingConsent"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        data-testid="register-marketing"
                      />
                    </FormControl>
                    <div className="space-y-1 leading-none">
                      <FormLabel className="text-sm">
                        {t("auth.marketingConsent")}
                      </FormLabel>
                    </div>
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
              {registerMutation.isPending ? "Tworzenie konta..." : t("auth.registerButton")}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
